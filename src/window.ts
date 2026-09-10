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

import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import Adw from "gi://Adw";
import Gio from "gi://Gio";
import GLib from "gi://GLib";

import { StyleSelector } from "./styleselector.js";
import { confirm_delete, Note, Style } from "./util.js";
import { WriteableStickyNote } from "./view.js";
import { find } from "linkifyjs";
import { Application } from "./application.js";

export class Window extends Adw.ApplicationWindow {
  declare _container: Gtk.Box;
  declare _text: Gtk.TextView;
  declare _menu_button: Gtk.MenuButton;

  declare _bold_button: Gtk.ToggleButton;
  declare _underline_button: Gtk.ToggleButton;
  declare _italic_button: Gtk.ToggleButton;
  declare _strikethrough_button: Gtk.ToggleButton;
  declare _action_button: Gtk.ToggleButton;
  declare _action_revealer: Gtk.Revealer;

  // buffer = new Gtk.TextBuffer();

  view: WriteableStickyNote;

  selector: StyleSelector;

  note: Note;
  deleted = false;
  cursor_scroll_source: number | null = null;
  last_revealer = false;

  static {
    GObject.registerClass(
      {
        Template: "resource:///com/vixalien/sticky/ui/window.ui",
        GTypeName: "StickyNoteWindow",
        InternalChildren: [
          "container",
          "text",
          "bold_button",
          "underline_button",
          "italic_button",
          "strikethrough_button",
          "menu_button",
          "action_revealer",
          "action_button",
        ],
        Signals: {
          deleted: {
            param_types: [GObject.TYPE_STRING],
          },
        },
      },
      this,
    );
  }

  get_style() {
    return this.selector.style;
  }

  constructor(
    { note, ...params }: Partial<Adw.ApplicationWindow.ConstructorProps> & {
      note: Note;
    },
  ) {
    super(params);

    this.note = note;

    this.default_width = note.width;
    this.default_height = note.height;

    this.note.bind_property_full(
      "title",
      this,
      "title",
      GObject.BindingFlags.SYNC_CREATE,
      (__, title) => {
        if (!title) {
          return [true, _("Sticky Note")];
        }
        return [true, title];
      },
      null,
    );

    this.connect("close-request", () => {
      this.cancel_cursor_scroll();

      if (this.deleted) return;

      if (this.view.note && this.view.note.content.trim().length === 0) {
        (this.application as Application).delete_note(this.note.uuid);
        return;
      }

      const width = this.get_allocated_width();
      const height = this.get_allocated_height();

      if (width !== note.width) {
        this.note.width = width;
      }
      if (height !== note.height) {
        this.note.height = height;
      }
    });
    this.connect("unrealize", this.cancel_cursor_scroll.bind(this));

    this.set_style(note.style, true);

    this.view = new WriteableStickyNote(note);
    this.view.connect("selection-changed", this.check_tags.bind(this));
    this.view.connect(
      "tag-toggle",
      (_view: WriteableStickyNote, tag: string, active: boolean) => {
        const button =
          this[`_${tag}_button` as keyof typeof this] as Gtk.ToggleButton;
        if (!button) return;
        button.active = active;
      },
    );
    this.view.connect("link-selected", (_, text) => {
      this.update_link(true, text);
    });
    this.view.connect("link-unselected", () => {
      this.update_link(false, "");
    });

    this._text.buffer = this.view.buffer;
    this.view.buffer.connect(
      "notify::cursor-position",
      this.queue_cursor_scroll.bind(this),
    );
    this.view.buffer.connect("changed", this.queue_cursor_scroll.bind(this));

    this.add_actions();

    this.selector = new StyleSelector({ style: note.style });
    this.selector.connect("style-changed", (_selector, style) => {
      this.set_style(style);
      this.note.style = style;
    });

    const popover = this._menu_button.get_popover() as Gtk.PopoverMenu;
    popover.add_child(this.selector, "notestyleswitcher");
  }

  queue_cursor_scroll() {
    if (!this.get_realized() || this.cursor_scroll_source !== null) return;

    this.cursor_scroll_source = GLib.idle_add(
      GLib.PRIORITY_DEFAULT_IDLE,
      () => {
        this.cursor_scroll_source = null;
        this.scroll_cursor_into_view();
        return GLib.SOURCE_REMOVE;
      },
    );
  }

  cancel_cursor_scroll() {
    if (this.cursor_scroll_source === null) return;

    GLib.source_remove(this.cursor_scroll_source);
    this.cursor_scroll_source = null;
  }

  scroll_cursor_into_view() {
    const cursor = this.view.buffer.get_iter_at_mark(
      this.view.buffer.get_insert(),
    );
    const cursor_rect = this._text.get_iter_location(cursor);
    const visible_rect = this._text.get_visible_rect();
    const visible_top = visible_rect.y + this._text.top_margin;
    const visible_bottom = visible_rect.y + visible_rect.height -
      this._text.bottom_margin;

    let offset = 0;
    if (cursor_rect.y < visible_top) {
      offset = cursor_rect.y - visible_top;
    } else if (cursor_rect.y + cursor_rect.height > visible_bottom) {
      offset = cursor_rect.y + cursor_rect.height - visible_bottom;
    }

    if (offset === 0) return;
    this._text.vadjustment.value += offset;
  }

  update_link(selected: boolean, text: string) {
    if (selected) {
      const link = find(text)[0];
      if (link) {
        this._action_button.action_target = GLib.Variant.new_string(link.href);
      } else {
        selected = false;
      }
    }

    if (this.last_revealer === selected) return;

    this.last_revealer = selected;
    this._action_revealer.reveal_child = selected;

    // add timeout for the transition to finish
    GLib.timeout_add(
      GLib.PRIORITY_DEFAULT,
      this._action_revealer.transition_duration,
      () => {
        const target = Adw.PropertyAnimationTarget.new(
          this._text,
          "bottom_margin",
        );

        const animation = Adw.TimedAnimation.new(
          this._text,
          this._text.bottom_margin,
          60 +
            (selected ? this._action_revealer.get_allocated_height() : 0),
          this._action_revealer.transition_duration,
          target,
        );

        animation.play();

        return GLib.SOURCE_REMOVE;
      },
    );
  }

  check_tags() {
    for (const [name, tag] of this.view.actions) {
      const button =
        this[`_${name}_button` as keyof typeof this] as Gtk.ToggleButton;
      const active = this.view.has_tag(tag) !== false;
      if (active === button.active) {
        continue;
      }
      button.active = active;
    }
  }

  add_actions() {
    const delete_ = Gio.SimpleAction.new("delete", null);
    delete_.connect("activate", () => this.delete());
    this.add_action(delete_);

    for (const [name, tag] of this.view.actions) {
      const action = Gio.SimpleAction.new(name, null);
      action.connect("activate", () => this.view.apply_tag(tag));
      this.add_action(action);
    }
  }

  set_style(style: Style, is_init = false) {
    for (const s of this._container.get_css_classes()) {
      if (s.startsWith("style-") && s !== `style-specifity`) {
        this._container.remove_css_class(s);
      }
    }

    this._container.add_css_class(`style-${Style[style]}`);

    if (!is_init) this.note.modified_date = new Date();
  }

  delete() {
    confirm_delete(this, () => {
      this.deleted = true;
      this.emit("deleted", this.note.uuid);
      console.log("emitted deleted");
    });
  }
}
