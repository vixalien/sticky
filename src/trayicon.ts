/* MIT License
 *
 * Copyright (c) 2026 Sticky Notes contributors
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * SPDX-License-Identifier: MIT
 */

import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GdkPixbuf from "gi://GdkPixbuf";

import type { Application } from "./application.js";
import { compare_notes_newest_first, Note, Style } from "./util.js";

// GTK4 has no tray icon support, so the icon is provided over D-Bus using the
// StatusNotifierItem specification, and its menu using the com.canonical.dbusmenu
// specification. See:
// https://www.freedesktop.org/wiki/Specifications/StatusNotifierItem/
// https://github.com/AyatanaIndicators/libdbusmenu/blob/master/libdbusmenu-glib/dbus-menu.xml

const WATCHER_BUS_NAME = "org.kde.StatusNotifierWatcher";
const WATCHER_OBJECT_PATH = "/StatusNotifierWatcher";
const ITEM_OBJECT_PATH = "/StatusNotifierItem";
const MENU_OBJECT_PATH = "/com/vixalien/sticky/TrayMenu";

const StatusNotifierItemInterface = `
<node>
  <interface name="org.kde.StatusNotifierItem">
    <property name="Category" type="s" access="read"/>
    <property name="Id" type="s" access="read"/>
    <property name="Title" type="s" access="read"/>
    <property name="Status" type="s" access="read"/>
    <property name="WindowId" type="i" access="read"/>
    <property name="IconName" type="s" access="read"/>
    <property name="OverlayIconName" type="s" access="read"/>
    <property name="AttentionIconName" type="s" access="read"/>
    <property name="AttentionMovieName" type="s" access="read"/>
    <property name="ItemIsMenu" type="b" access="read"/>
    <property name="Menu" type="o" access="read"/>
    <method name="Activate">
      <arg name="x" type="i" direction="in"/>
      <arg name="y" type="i" direction="in"/>
    </method>
    <method name="SecondaryActivate">
      <arg name="x" type="i" direction="in"/>
      <arg name="y" type="i" direction="in"/>
    </method>
    <method name="ContextMenu">
      <arg name="x" type="i" direction="in"/>
      <arg name="y" type="i" direction="in"/>
    </method>
    <method name="Scroll">
      <arg name="delta" type="i" direction="in"/>
      <arg name="orientation" type="s" direction="in"/>
    </method>
    <signal name="NewIcon"/>
    <signal name="NewTitle"/>
    <signal name="NewStatus">
      <arg name="status" type="s"/>
    </signal>
  </interface>
</node>
`;

const DBusMenuInterface = `
<node>
  <interface name="com.canonical.dbusmenu">
    <property name="Version" type="u" access="read"/>
    <property name="TextDirection" type="s" access="read"/>
    <property name="Status" type="s" access="read"/>
    <property name="IconThemePath" type="as" access="read"/>
    <method name="GetLayout">
      <arg name="parentId" type="i" direction="in"/>
      <arg name="recursionDepth" type="i" direction="in"/>
      <arg name="propertyNames" type="as" direction="in"/>
      <arg name="revision" type="u" direction="out"/>
      <arg name="layout" type="(ia{sv}av)" direction="out"/>
    </method>
    <method name="GetGroupProperties">
      <arg name="ids" type="ai" direction="in"/>
      <arg name="propertyNames" type="as" direction="in"/>
      <arg name="properties" type="a(ia{sv})" direction="out"/>
    </method>
    <method name="GetProperty">
      <arg name="id" type="i" direction="in"/>
      <arg name="name" type="s" direction="in"/>
      <arg name="value" type="v" direction="out"/>
    </method>
    <method name="Event">
      <arg name="id" type="i" direction="in"/>
      <arg name="eventId" type="s" direction="in"/>
      <arg name="data" type="v" direction="in"/>
      <arg name="timestamp" type="u" direction="in"/>
    </method>
    <method name="EventGroup">
      <arg name="events" type="a(isvu)" direction="in"/>
      <arg name="idErrors" type="ai" direction="out"/>
    </method>
    <method name="AboutToShow">
      <arg name="id" type="i" direction="in"/>
      <arg name="needUpdate" type="b" direction="out"/>
    </method>
    <method name="AboutToShowGroup">
      <arg name="ids" type="ai" direction="in"/>
      <arg name="updatesNeeded" type="ai" direction="out"/>
      <arg name="idErrors" type="ai" direction="out"/>
    </method>
    <signal name="ItemsPropertiesUpdated">
      <arg name="updatedProps" type="a(ia{sv})"/>
      <arg name="removedProps" type="a(ias)"/>
    </signal>
    <signal name="LayoutUpdated">
      <arg name="revision" type="u"/>
      <arg name="parent" type="i"/>
    </signal>
  </interface>
</node>
`;

// the "header" color of each note style, used to draw the menu swatches
const STYLE_COLORS = new Map<Style, string>([
  [Style.yellow, "#ffee92"],
  [Style.pink, "#ffc5e1"],
  [Style.green, "#d1ebcb"],
  [Style.purple, "#e2d0f5"],
  [Style.blue, "#cce7ff"],
  [Style.gray, "#dddad8"],
  [Style.charcoal, "#3f3d3c"],
  [Style.window, "#deddda"],
]);

const SWATCH_SIZE = 16;
const SWATCH_BORDER = 1;

// hosts cache menu items by id, so ids must be stable across rebuilds
const SEPARATOR_ID = 1;
const OPEN_ID = 2;
const FIRST_NOTE_ID = 3;

interface TrayMenuItem {
  id: number;
  properties: Record<string, GLib.Variant>;
  activate?: () => void;
}

// in dbusmenu labels, a single underscore marks the mnemonic character
const escape_label = (label: string) => label.replace(/_/g, "__");

export class TrayIcon {
  private app: Application;
  private item_dbus_object: Gio.DBusExportedObject | null = null;
  private menu_dbus_object: Gio.DBusExportedObject | null = null;
  private watcher_id: number | null = null;
  private items: TrayMenuItem[] = [];
  private note_order: string[] = [];
  private note_ids = new Map<string, number>();
  private next_note_id = FIRST_NOTE_ID;
  private revision = 0;
  private rebuild_source: number | null = null;
  private connected_notes = new WeakSet<Note>();
  private swatches = new Map<Style, GLib.Variant>();

  registered = false;
  registered_changed: ((registered: boolean) => void) | null = null;

  constructor(app: Application) {
    this.app = app;

    this.rebuild_menu();

    this.app.notes_list.connect("items-changed", () => {
      this.watch_notes();
      this.invalidate_menu();
    });
    this.watch_notes();
  }

  start() {
    try {
      this.export();
    } catch (error) {
      console.error("Failed to export tray icon on D-Bus:", error as any);
      return;
    }

    this.watcher_id = Gio.bus_watch_name(
      Gio.BusType.SESSION,
      WATCHER_BUS_NAME,
      Gio.BusNameWatcherFlags.NONE,
      () => this.register(),
      () => this.set_registered(false),
    );
  }

  private export() {
    this.item_dbus_object = Gio.DBusExportedObject.wrapJSObject(
      StatusNotifierItemInterface,
      this.make_item_implementation(),
    );
    this.item_dbus_object.export(Gio.DBus.session, ITEM_OBJECT_PATH);

    this.menu_dbus_object = Gio.DBusExportedObject.wrapJSObject(
      DBusMenuInterface,
      this.make_menu_implementation(),
    );
    this.menu_dbus_object.export(Gio.DBus.session, MENU_OBJECT_PATH);
  }

  private register() {
    Gio.DBus.session.call(
      WATCHER_BUS_NAME,
      WATCHER_OBJECT_PATH,
      WATCHER_BUS_NAME,
      "RegisterStatusNotifierItem",
      // registering the object path (instead of a bus name) works with all
      // modern hosts and doesn't require owning a second name on the bus
      new GLib.Variant("(s)", [ITEM_OBJECT_PATH]),
      null,
      Gio.DBusCallFlags.NONE,
      -1,
      null,
      (connection, result) => {
        try {
          connection!.call_finish(result);
          this.set_registered(true);
        } catch (error) {
          console.error(
            "Failed to register with the status notifier watcher:",
            error as any,
          );
          this.set_registered(false);
        }
      },
    );
  }

  private set_registered(registered: boolean) {
    if (this.registered === registered) return;
    this.registered = registered;
    this.registered_changed?.(registered);
  }

  private make_item_implementation() {
    return {
      Category: "ApplicationStatus",
      Id: pkg.name,
      Title: _("Sticky Notes"),
      Status: "Active",
      WindowId: 0,
      IconName: pkg.name,
      OverlayIconName: "",
      AttentionIconName: "",
      AttentionMovieName: "",
      ItemIsMenu: false,
      Menu: MENU_OBJECT_PATH,
      Activate: (_x: number, _y: number) => {
        this.app.all_notes();
      },
      SecondaryActivate: (_x: number, _y: number) => {
        this.app.all_notes();
      },
      ContextMenu: (_x: number, _y: number) => {
        // the host displays the Menu itself
      },
      Scroll: (_delta: number, _orientation: string) => {},
    };
  }

  private make_menu_implementation() {
    return {
      Version: 3,
      TextDirection: "ltr",
      Status: "normal",
      IconThemePath: [] as string[],
      GetLayout: (
        parent_id: number,
        recursion_depth: number,
        _property_names: string[],
      ) => {
        return GLib.Variant.new_tuple([
          GLib.Variant.new_uint32(this.revision),
          this.layout_variant(parent_id, recursion_depth),
        ]);
      },
      GetGroupProperties: (ids: number[], _property_names: string[]) => {
        const rows = this.items
          .filter((item) => ids.length === 0 || ids.includes(item.id))
          .map((item) => [item.id, item.properties]);

        if (ids.length === 0 || ids.includes(0)) {
          rows.unshift([0, this.root_properties()]);
        }

        return new GLib.Variant("(a(ia{sv}))", [rows]);
      },
      GetProperty: (id: number, name: string) => {
        const value = id === 0
          ? this.root_properties()[name]
          : this.items.find((item) => item.id === id)?.properties[name];

        return value ?? new GLib.Variant("s", "");
      },
      Event: (
        id: number,
        event_id: string,
        _data: GLib.Variant,
        _timestamp: number,
      ) => {
        if (event_id !== "clicked") return;
        this.items.find((item) => item.id === id)?.activate?.();
      },
      EventGroup: (events: [number, string, GLib.Variant, number][]) => {
        const id_errors: number[] = [];

        for (const [id, event_id] of events) {
          const item = this.items.find((item) => item.id === id);
          if (!item && id !== 0) {
            id_errors.push(id);
            continue;
          }
          if (event_id === "clicked") item?.activate?.();
        }

        return id_errors;
      },
      AboutToShow: (_id: number) => true,
      AboutToShowGroup: (ids: number[]) => {
        return new GLib.Variant("(aiai)", [ids, []]);
      },
    };
  }

  private root_properties(): Record<string, GLib.Variant> {
    return {
      "children-display": new GLib.Variant("s", "submenu"),
    };
  }

  private item_variant(item: TrayMenuItem) {
    return new GLib.Variant("(ia{sv}av)", [item.id, item.properties, []]);
  }

  private layout_variant(parent_id: number, recursion_depth: number) {
    if (parent_id !== 0) {
      const item = this.items.find((item) => item.id === parent_id);

      return item
        ? this.item_variant(item)
        : new GLib.Variant("(ia{sv}av)", [parent_id, {}, []]);
    }

    const children = recursion_depth === 0
      ? []
      : this.items.map((item) => this.item_variant(item));

    return new GLib.Variant("(ia{sv}av)", [
      0,
      this.root_properties(),
      children,
    ]);
  }

  private swatch(style: Style) {
    const cached = this.swatches.get(style);
    if (cached) return cached;

    const hex = STYLE_COLORS.get(style) ?? STYLE_COLORS.get(Style.yellow)!;
    const rgb = parseInt(hex.slice(1), 16);
    const darken = (channel: number) => Math.round(channel * 0.6);
    const border = (darken((rgb >> 16) & 0xff) << 16) |
      (darken((rgb >> 8) & 0xff) << 8) |
      darken(rgb & 0xff);

    const pixbuf = GdkPixbuf.Pixbuf.new(
      GdkPixbuf.Colorspace.RGB,
      true,
      8,
      SWATCH_SIZE,
      SWATCH_SIZE,
    )!;
    // pixel is RGBA as an unsigned 32-bit value; avoid << which yields
    // negative numbers for bright colors
    pixbuf.fill(border * 0x100 + 0xff);

    const inner_size = SWATCH_SIZE - 2 * SWATCH_BORDER;
    const inner = GdkPixbuf.Pixbuf.new(
      GdkPixbuf.Colorspace.RGB,
      true,
      8,
      inner_size,
      inner_size,
    )!;
    inner.fill(rgb * 0x100 + 0xff);
    inner.copy_area(
      0,
      0,
      inner_size,
      inner_size,
      pixbuf,
      SWATCH_BORDER,
      SWATCH_BORDER,
    );

    const [success, buffer] = pixbuf.save_to_bufferv("png", [], []);
    if (!success) return new GLib.Variant("ay", []);

    const variant = new GLib.Variant("ay", buffer);
    this.swatches.set(style, variant);
    return variant;
  }

  private watch_notes() {
    this.app.foreach_note((note) => {
      if (this.connected_notes.has(note)) return;
      this.connected_notes.add(note);

      // "modified" changes on any edit and also reorders the list;
      // "style" changes the swatch color
      note.connect("notify::modified", () => this.invalidate_menu());
      note.connect("notify::style", () => this.invalidate_menu());
    });
  }

  private invalidate_menu() {
    if (this.rebuild_source !== null) return;

    this.rebuild_source = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
      this.rebuild_source = null;

      const previous = new Map(
        this.items.map((item) => [item.id, item.properties]),
      );
      this.rebuild_menu();
      this.emit_menu_updates(previous);

      return GLib.SOURCE_REMOVE;
    });
  }

  private emit_menu_updates(
    previous: Map<number, Record<string, GLib.Variant>>,
  ) {
    const updated: [number, Record<string, GLib.Variant>][] = [];
    const removed: [number, string[]][] = [];

    for (const item of this.items) {
      const old = previous.get(item.id);
      // new items are picked up through LayoutUpdated
      if (!old) continue;

      const changed: Record<string, GLib.Variant> = {};
      for (const [name, value] of Object.entries(item.properties)) {
        if (!old[name]?.equal(value)) changed[name] = value;
      }
      if (Object.keys(changed).length > 0) updated.push([item.id, changed]);

      const dropped = Object.keys(old).filter(
        (name) => !(name in item.properties),
      );
      if (dropped.length > 0) removed.push([item.id, dropped]);
    }

    if (updated.length > 0 || removed.length > 0) {
      this.menu_dbus_object?.emit_signal(
        "ItemsPropertiesUpdated",
        new GLib.Variant("(a(ia{sv})a(ias))", [updated, removed]),
      );
    }

    this.menu_dbus_object?.emit_signal(
      "LayoutUpdated",
      new GLib.Variant("(ui)", [this.revision, 0]),
    );
  }

  private note_id(uuid: string) {
    let id = this.note_ids.get(uuid);

    if (id === undefined) {
      id = this.next_note_id++;
      this.note_ids.set(uuid, id);
    }

    return id;
  }

  private rebuild_menu() {
    const items: TrayMenuItem[] = [];

    const notes = this.app.notes_array().sort(compare_notes_newest_first);

    const uuids = notes.map((note) => note.uuid);
    const existing = new Set(uuids);

    for (const uuid of this.note_ids.keys()) {
      if (!existing.has(uuid)) this.note_ids.delete(uuid);
    }

    // hosts may not support moving items, so a reorder gets fresh ids
    const known = new Set(this.note_order);
    const kept = this.note_order.filter((uuid) => existing.has(uuid));
    const kept_now = uuids.filter((uuid) => known.has(uuid));
    if (kept.some((uuid, index) => uuid !== kept_now[index])) {
      this.note_ids.clear();
    }
    this.note_order = uuids;

    for (const note of notes) {
      const uuid = note.uuid;
      const title = note.title.trim();

      items.push({
        id: this.note_id(uuid),
        properties: {
          label: new GLib.Variant(
            "s",
            title ? escape_label(title) : `(${_("Empty Note")})`,
          ),
          "icon-data": this.swatch(note.style),
        },
        activate: () => this.app.show_note(uuid),
      });
    }

    items.push({
      id: SEPARATOR_ID,
      properties: { type: new GLib.Variant("s", "separator") },
    });

    items.push({
      id: OPEN_ID,
      properties: {
        label: new GLib.Variant("s", escape_label(_("Open Sticky Notes"))),
        "icon-name": new GLib.Variant("s", "edit-find-symbolic"),
      },
      activate: () => this.app.search_notes(),
    });

    this.items = items;
    this.revision++;
  }
}
