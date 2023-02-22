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
import Pango from "gi://Pango";
import Gio from "gi://Gio";

import { Style, StyleSelector } from "./styleselector.js";

interface Note {
  content: string;
  style: Style;
}

const DEFAULT_STYLE: Style = "yellow";

export class Window extends Adw.ApplicationWindow {
  _container!: Gtk.Box;
  _text!: Gtk.TextView;
  _menu_button!: Gtk.MenuButton;

  _bold_button!: Gtk.ToggleButton;
  _underline_button!: Gtk.ToggleButton;
  _italic_button!: Gtk.ToggleButton;
  _strikethrough_button!: Gtk.ToggleButton;

  buffer = new Gtk.TextBuffer();

  bold_tag = Gtk.TextTag.new("bold");
  underline_tag = Gtk.TextTag.new("underline");
  italic_tag = Gtk.TextTag.new("italic");
  strikethrough_tag = Gtk.TextTag.new("strikethrough");

  actions = [
    ["bold", this.bold_tag, this._bold_button, "<Ctrl>b"],
    ["underline", this.underline_tag, this._underline_button, "<Ctrl>u"],
    ["italic", this.italic_tag, this._italic_button, "<Ctrl>i"],
    [
      "strikethrough",
      this.strikethrough_tag,
      this._strikethrough_button,
      "<Ctrl>s",
    ],
  ] as [string, Gtk.TextTag, Gtk.ToggleButton, string][];

  static {
    GObject.registerClass(
      {
        Template: "resource:///org/example/TypescriptTemplate/window.ui",
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

  constructor(params?: Partial<Adw.ApplicationWindow.ConstructorProperties>) {
    super(params);

    this._text.buffer = this.buffer;

    this.buffer.connect("mark-set", (buffer, _loc, mark) => {
      if (mark == buffer.get_insert() || buffer.get_selection_bounds()[0]) {
        this.check_tags();
      }
    });

    this.set_style(DEFAULT_STYLE);
    this.add_tags();
    this.add_actions();

    const selector = new StyleSelector({ style: DEFAULT_STYLE });
    selector.connect("style-changed", (_selector, style) => {
      console.log("style changed", style);
      this.set_style(style);
    });

    const popover = this._menu_button.get_popover() as Gtk.PopoverMenu;
    popover.add_child(selector, "notestyleswitcher");

    // (this._text.get_parent()?.get_parent() as Gtk.Box)
    //   .append(selector);
  }

  check_tags() {
    for (const [_name, tag, button] of this.actions) {
      const active = this.has_tag(tag);
      if (active === button.active) {
        continue;
      }
      button.active = active;
    }
  }

  add_tags() {
    this.bold_tag.weight = Pango.Weight.BOLD;
    this.underline_tag.underline = Pango.Underline.SINGLE;
    this.italic_tag.style = Pango.Style.ITALIC;
    this.strikethrough_tag.strikethrough = true;

    this.buffer.tag_table.add(this.bold_tag);
    this.buffer.tag_table.add(this.underline_tag);
    this.buffer.tag_table.add(this.italic_tag);
    this.buffer.tag_table.add(this.strikethrough_tag);
  }

  add_actions() {
    for (const [name, tag] of this.actions) {
      const action = Gio.SimpleAction.new(name, null);
      action.connect("activate", () => this.apply_tag(tag));
      // add accelerator
      this.application.set_accels_for_action(
        `win.${name}`,
        [this.actions.find((a) => a[1] == tag)![3]],
      );
      this.add_action(action);
    }
  }

  has_tag(tag: Gtk.TextTag) {
    let [selection, start, end] = this.buffer.get_selection_bounds();
    if (!selection) {
      start = this.buffer.get_iter_at_mark(
        this.buffer.get_insert(),
      );
      end = start.copy();
    }

    do {
      if (start.has_tag(tag)) {
        return true;
      }
      start.forward_char();
    } while (start.compare(end) < 0);

    return false;
  }

  apply_tag(tag: Gtk.TextTag) {
    let [selection, start, end] = this.buffer.get_selection_bounds();
    // if no selection, apply to the current word
    if (!selection) {
      const iter = this.buffer.get_iter_at_mark(
        this.buffer.get_insert(),
      );
      start = iter.copy();
      end = iter.copy();
      start.backward_word_start();
      end.forward_word_end();
      this.buffer.select_range(start, end);
    }

    const button = this.actions.find((a) => a[1] === tag)![2];

    if (this.has_tag(tag)) {
      this.buffer.remove_tag(tag, start, end);
      button.active = false;
    } else {
      this.buffer.apply_tag(tag, start, end);
      button.active = true;
    }
  }

  set_style(style: Style) {
    for (const s of this._container.get_css_classes()) {
      if (s.startsWith("style-")) {
        this._container.remove_css_class(s);
      }
    }

    this._container.add_css_class(`style-${style}`);
  }
}
