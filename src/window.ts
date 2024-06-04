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
import GLib from "gi://GLib";

import { StyleSelector } from "./styleselector.js";
import { Note, Style } from "./util/index.js";
import { WriteableStickyNote } from "./view.js";
import { find } from "linkifyjs";
import { AddActionEntries } from "types/extra.js";

export class Window extends Adw.ApplicationWindow {
  private _container!: Gtk.Box;
  private _text!: Gtk.TextView;
  private _menu_button!: Gtk.MenuButton;
  private _action_button!: Gtk.ToggleButton;
  private _action_revealer!: Gtk.Revealer;

  private view: WriteableStickyNote;
  private selector: StyleSelector;

  note: Note;

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
      },
      this,
    );
  }

  get_style() {
    return this.selector.style;
  }

  constructor(
    { note, ...params }: Partial<Gtk.TextView.ConstructorProperties> & {
      note: Note;
    },
  ) {
    super(params);

    this.note = note;

    // setup this note

    note.bind_property(
      "width",
      this,
      "default-width",
      GObject.BindingFlags.SYNC_CREATE | GObject.BindingFlags.BIDIRECTIONAL,
    );

    note.bind_property(
      "height",
      this,
      "default-height",
      GObject.BindingFlags.SYNC_CREATE | GObject.BindingFlags.BIDIRECTIONAL,
    );

    // TODO: also present self if this window gets (re-)opened
    note.bind_property(
      "open",
      this,
      "visible",
      GObject.BindingFlags.SYNC_CREATE | GObject.BindingFlags.BIDIRECTIONAL,
    );

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

    this.add_actions();

    this.selector = new StyleSelector({ style: note.style });
    this.selector.connect("style-changed", (_selector, style) => {
      this.set_style(style);
      this.note.style = style;
    });

    const popover = this._menu_button.get_popover() as Gtk.PopoverMenu;
    popover.add_child(this.selector, "notestyleswitcher");
  }

  last_revealer = false;

  update_link(selected: boolean, text: string) {
    if (selected) {
      const href = find(text)[0].href;
      this._action_button.action_target = GLib.Variant.new_string(href);
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
    (this.add_action_entries as AddActionEntries)([
      {
        name: "delete",
        activate: () => {
          this.application.activate_action(
            "delete-note",
            GLib.Variant.new_string(this.note.uuid),
          );
        },
      },
      ...this.view.actions.map(([name, tag]) => {
        return {
          name: name,
          activate: () => {
            this.view.apply_tag(tag);
          },
        };
      }),
    ]);
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

  vfunc_close_request(): boolean {
    this.note.open = false;

    return super.vfunc_close_request();
  }
}
