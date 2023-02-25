/* MIT License
 *
 * Copyright (c) 2023 Chris Davis
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

import { StyleSelector } from "./styleselector.js";
import { Note, SETTINGS, Style } from "./util.js";
import { StickyNoteView } from "./view.js";

export class Window extends Adw.ApplicationWindow {
  _container!: Gtk.Box;
  _text!: Gtk.TextView;
  _menu_button!: Gtk.MenuButton;

  _bold_button!: Gtk.ToggleButton;
  _underline_button!: Gtk.ToggleButton;
  _italic_button!: Gtk.ToggleButton;
  _strikethrough_button!: Gtk.ToggleButton;

  // buffer = new Gtk.TextBuffer();

  view: StickyNoteView;

  selector: StyleSelector;

  static {
    GObject.registerClass(
      {
        Template: "resource:///com/vixalien/sticky/window.ui",
        GTypeName: "StickyNoteWindow",
        InternalChildren: [
          "container",
          "text",
          "bold_button",
          "underline_button",
          "italic_button",
          "strikethrough_button",
          "menu_button",
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

    this.width_request = note.width;
    this.height_request = note.height;
    this.set_style(SETTINGS.DEFAULT_STYLE);

    this.view = new StickyNoteView(note);

    this.view.connect("selection-changed", this.check_tags.bind(this));
    this.view.connect(
      "tag-toggle",
      (_view: StickyNoteView, tag: Gtk.TextTag, active: boolean) => {
        const button =
          this[`_${tag.name}_button` as keyof typeof this] as Gtk.ToggleButton;
        button.active = active;
      },
    );

    this._text.buffer = this.view.buffer;

    this.add_actions();

    this.selector = new StyleSelector({ style: SETTINGS.DEFAULT_STYLE });
    this.selector.connect("style-changed", (_selector, style) => {
      this.set_style(style);
    });

    const popover = this._menu_button.get_popover() as Gtk.PopoverMenu;
    popover.add_child(this.selector, "notestyleswitcher");
  }

  check_tags() {
    for (const [name, tag] of this.view.actions) {
      const button =
        this[`_${name}_button` as keyof typeof this] as Gtk.ToggleButton;
      const active = this.view.has_tag(tag);
      if (active === button.active) {
        continue;
      }
      button.active = active;
    }
  }

  add_actions() {
    for (const [name, tag] of this.view.actions) {
      const action = Gio.SimpleAction.new(name, null);
      action.connect("activate", () => this.view.apply_tag(tag));
      // add accelerator
      this.application.set_accels_for_action(
        `win.${name}`,
        [this.view.actions.find((a) => a[1] == tag)![2]],
      );
      this.add_action(action);
    }
  }

  set_style(style: Style) {
    for (const s of this._container.get_css_classes()) {
      if (s.startsWith("style-") && s !== `style-specifity`) {
        this._container.remove_css_class(s);
      }
    }

    this._container.add_css_class(`style-${Style[style]}`);
  }

  save() {
    return {
      ...this.view.save(),
      width: this.get_allocated_width(),
      height: this.get_allocated_height(),
    };
  }
}
