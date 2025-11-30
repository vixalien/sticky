/* MIT License
 *
 * Copyright (c) 2023 Angelo Verlain, Chris Davis
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

import Adw from "gi://Adw";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";

Gio._promisify(
  Gio.File.prototype,
  "load_contents_async",
  "load_contents_finish",
);

Gio._promisify(
  Gio.File.prototype,
  "replace_contents_async",
  "replace_contents_finish",
);

export interface ITag {
  name: string;
  start: number;
  end: number;
}

export interface INote {
  v: 1;
  uuid: string;
  content: string;
  title: string;
  style: Style;
  tags: ITag[];
  modified: Date;
  width: number;
  height: number;
  open: boolean;
}

export enum Style {
  "yellow" = 1,
  "pink",
  "green",
  "purple",
  "blue",
  "gray",
  "charcoal",
  "window",
}

export const StyleNames = new Map([
  [Style.yellow, _("Yellow")],
  [Style.pink, _("Pink")],
  [Style.green, _("Green")],
  [Style.purple, _("Purple")],
  [Style.blue, _("Blue")],
  [Style.gray, _("Gray")],
  [Style.charcoal, _("Charcoal")],
  [Style.window, _("Window")],
]);

export const styles = Object.values(Style).filter(
  (style) => typeof style === "number",
) as Style[];

export const settings = new Gio.Settings({ schema_id: "com.vixalien.sticky" });

const get_settings = () => ({
  DEFAULT_STYLE: settings.get_enum("default-style") as Style,
  DEFAULT_WIDTH: settings.get_int("default-width"),
  DEFAULT_HEIGHT: settings.get_int("default-height"),
  CONFIRM_DELETE: settings.get_boolean("confirm-delete"),
});

export let SETTINGS = get_settings();

settings.connect("changed", () => {
  SETTINGS = get_settings();
});

export class Tag extends GObject.Object {
  static $gtype: GObject.GType<Tag>;

  name: string;
  start: number;
  end: number;

  constructor(name: string, start: number = 0, end: number = 0) {
    super();
    this.name = name;
    this.start = start;
    this.end = end;
  }

  static {
    GObject.registerClass({
      GTypeName: "TagObject",
      Properties: {
        // deno-fmt-ignore
        name: GObject.ParamSpec.string("name", "Name", "The name of the tag", GObject.ParamFlags.READWRITE, ""),
        // deno-fmt-ignore
        start: GObject.ParamSpec.int("start", "Start", "Starting position of the tag", GObject.ParamFlags.READWRITE, 0, 100, 0),
        // deno-fmt-ignore
        end: GObject.ParamSpec.int("end", "End", "Ending position of the tag", GObject.ParamFlags.READWRITE, 0, 100, 0),
      },
    }, this);
  }
}

export class Note extends GObject.Object {
  private static tag_list_pspec = GObject.param_spec_object(
    "tag_list",
    "Tags",
    "Tags of the note",
    Gio.ListStore.$gtype,
    GObject.ParamFlags.READWRITE,
  );

  static $gtype: GObject.GType<Note>;

  v: 1;
  uuid: string;
  content: string;
  title: string;
  style: Style;
  tag_list: Gio.ListStore<Tag>;
  modified: GLib.DateTime;
  width: number;
  height: number;
  open: boolean;

  get tags() {
    const items = [];

    for (let i = 0; i < this.tag_list.get_n_items(); i++) {
      const tag = this.tag_list.get_item(i)!;
      items.push({
        name: tag.name,
        start: tag.start,
        end: tag.end,
      });
    }

    return items;
  }

  set tags(tags: INote["tags"]) {
    this.tag_list.remove_all();

    for (const tag of tags) {
      const tag_object = new Tag(tag.name, tag.start, tag.end);
      this.tag_list.append(tag_object);
    }

    this.emit("notify::tag_list", Note.tag_list_pspec);
  }

  get modified_date() {
    return new Date(this.modified.to_unix() * 1000);
  }

  // anything the constructor of date accepts
  set modified_date(date: Date) {
    this.modified = GLib.DateTime.new_from_iso8601(
      new Date(date).toISOString(),
      null,
    );
  }

  constructor(note: INote) {
    super();
    this.v = note.v;
    this.uuid = note.uuid;
    this.content = note.content;
    this.title = note.title;
    this.style = note.style;
    this.tag_list = Gio.ListStore.new(Tag.$gtype) as Gio.ListStore<Tag>;
    this.tags = note.tags;
    this.modified = GLib.DateTime.new_from_iso8601(
      new Date(note.modified).toISOString(),
      null,
    );
    this.width = note.width;
    this.height = note.height;
    this.open = note.open ?? false;

    this.bind_property_full(
      "content",
      this,
      "title",
      GObject.BindingFlags.SYNC_CREATE,
      (_, content) => {
        if (!content) return [true, ""];
        let title = content.split("\n")[0].slice(0, 20);
        if (title.length != content.length) title += "…";
        return [true, title];
      },
      null
    );


  }

  static generate() {
    return new this({
      v: 1,
      uuid: GLib.uuid_string_random(),
      content: "",
      title: "",
      style: SETTINGS.DEFAULT_STYLE,
      tags: [],
      modified: new Date(),
      width: 300,
      height: 300,
      open: false,
    });
  }

  copy() {
    return new Note({
      v: this.v,
      uuid: this.uuid,
      content: this.content,
      title: this.title,
      style: this.style,
      tags: this.tags.map((tag) => ({
        name: tag.name,
        start: tag.start,
        end: tag.end,
      })),
      modified: new Date(this.modified.to_unix() * 1000),
      width: this.width,
      height: this.height,
      open: this.open,
    });
  }

  toJSON(): INote {
    return {
      v: this.v,
      uuid: this.uuid,
      content: this.content,
      title: this.title,
      style: this.style,
      tags: this.tags,
      modified: this.modified_date,
      width: this.width,
      height: this.height,
      open: this.open,
    };
  }

  static {
    GObject.registerClass({
      GTypeName: "NoteObject",
      Properties: {
        // deno-fmt-ignore
        v: GObject.ParamSpec.int("v", "Version", "Version of the note", GObject.ParamFlags.READWRITE, 0, 100, 0),
        // deno-fmt-ignore
        uuid: GObject.ParamSpec.string("uuid", "UUID", "UUID of the note", GObject.ParamFlags.READWRITE, ""),
        // deno-fmt-ignore
        content: GObject.ParamSpec.string("content", "Content", "Content of the note", GObject.ParamFlags.READWRITE, ""),
        // deno-fmt-ignore
        title: GObject.ParamSpec.string("title", "Title", "Title of the note", GObject.ParamFlags.READWRITE, ""),
        // deno-fmt-ignore
        style: GObject.ParamSpec.int("style", "Style", "Style of the note", GObject.ParamFlags.READWRITE, 0, 100, 0),
        // deno-fmt-ignore
        tag_list: this.tag_list_pspec,
        // // deno-fmt-ignore
        modified: GObject.ParamSpec.boxed("modified", "Modified", "Date the note was modified", GObject.ParamFlags.READWRITE, GLib.DateTime),
        // deno-fmt-ignore
        width: GObject.ParamSpec.int("width", "Width", "Width of the note", GObject.ParamFlags.READWRITE, 0, 100, 0),
        // deno-fmt-ignore
        height: GObject.ParamSpec.int("height", "Height", "Height of the note", GObject.ParamFlags.READWRITE, 0, 100, 0),
        // deno-fmt-ignore
        open: GObject.ParamSpec.boolean("open", "Open", "Whether the note was open when the application was closed", GObject.ParamFlags.READWRITE, false),
      },
    }, this);
  }
}

export const confirm_delete = (window: Gtk.Window, cb: () => void) => {
  if (SETTINGS.CONFIRM_DELETE) {
    const dialog = Adw.MessageDialog.new(
      window,
      _("Delete Note?"),
      _("This action cannot be undone. If you want to hide the note, you can close it instead."),
    );
    dialog.add_response("cancel", _("Cancel"));
    dialog.add_response("delete", _("Delete"));
    dialog.set_response_appearance(
      "delete",
      Adw.ResponseAppearance.DESTRUCTIVE,
    );
    dialog.set_default_response("cancel");
    dialog.set_close_response("cancel");
    dialog.connect("response", (_dialog, response) => {
      if (response === "delete") {
        cb();
      }
    });
    dialog.present();
  } else {
    cb();
  }
};
