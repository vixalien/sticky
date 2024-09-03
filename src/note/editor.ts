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

import { find } from "linkifyjs";

import { get_style_css_name, StyleSelector } from "../styleselector.js";
import { Note, Style } from "../util/index.js";
import { SignalListeners } from "../util/listeners.js";
import { get_tag_map } from "../util/tags.js";
import { StickyNoteTextView } from "./textview.js";

GObject.type_ensure(StickyNoteTextView.$gtype);

export class StickyNoteEditor extends Adw.Bin {
  private _text_view!: Gtk.TextView;
  private _menu_button!: Gtk.MenuButton;
  private _action_button!: Gtk.ToggleButton;
  private _action_revealer!: Gtk.Revealer;

  private selector: StyleSelector;

  static {
    GObject.registerClass(
      {
        Template: "resource:///com/vixalien/sticky/ui/editor.ui",
        GTypeName: "StickyNoteEditor",
        InternalChildren: [
          "text_view",
          "menu_button",
          "action_revealer",
          "action_button",
        ],
      },
      this,
    );
  }

  constructor(
    params: Partial<Gtk.TextView.ConstructorProperties>,
  ) {
    super(params);

    // setup this note

    // this.view = new WriteableStickyNote(note);
    // this.view.connect("selection-changed", this.check_tags.bind(this));
    // this.view.connect(
    //   "tag-toggle",
    //   (_view: WriteableStickyNote, tag: string, active: boolean) => {
    //     const button =
    //       this[`_${tag}_button` as keyof typeof this] as Gtk.ToggleButton;
    //     if (!button) return;
    //     button.active = active;
    //   },
    // );
    // this.view.connect("link-selected", (_, text) => {
    //   this.show_link(true, text);
    // });
    // this.view.connect("link-unselected", () => {
    //   this.show_link(false, "");
    // });

    // add the Style Selector
    this.selector = new StyleSelector();
    this.selector.connect("style-changed", (_selector, style) => {
      this.style_updated_cb(style);
    });

    const popover = this._menu_button.get_popover() as Gtk.PopoverMenu;
    popover.add_child(this.selector, "notestyleswitcher");
  }

  tag_map = get_tag_map();

  last_revealer = false;

  show_link(selected: boolean, text: string) {
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
          this._text_view,
          "bottom_margin",
        );

        const animation = Adw.TimedAnimation.new(
          this._text_view,
          this._text_view.bottom_margin,
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

  // check_tags() {
  //   for (const [name, tag] of this.view.actions) {
  //     const button =
  //       this[`_${name}_button` as keyof typeof this] as Gtk.ToggleButton;
  //     const active = this.view.has_tag(tag) !== false;
  //     if (active === button.active) {
  //       continue;
  //     }
  //     button.active = active;
  //   }
  // }

  apply_tag(tag: Gtk.TextTag) {
    //
  }

  private _note: Note | null = null;

  get note() {
    return this._note;
  }

  set note(value: Note | null) {
    if (value === this._note) return;
    this.clear_note();

    if (!value) return;
    this._note = value;
    this.show_note();
  }

  private listeners = new SignalListeners();

  private clear_note() {
    this.listeners.clear();
  }

  private show_note() {
    if (!this.note) return;

    this.listeners.add_bindings(
      this.note.bind_property(
        "content",
        this._text_view.buffer,
        "text",
        GObject.BindingFlags.SYNC_CREATE | GObject.BindingFlags.BIDIRECTIONAL,
      ),
    );

    this.update_style(this.note.style);
  }

  private style_updated_cb(style: Style) {
    if (!this.note) return;

    // update the note's style
    this.note.modified_date = new Date();
    this.note.style = style;

    this.update_style(style);
  }

  /**
   * Update our CSS classname based on the style
   */
  private update_style(style: Style) {
    const style_css_name = get_style_css_name(style);

    for (const css_class of this.get_css_classes()) {
      if (css_class.startsWith("style-") && css_class !== style_css_name) {
        this.remove_css_class(css_class);
      }
    }

    this.add_css_class(style_css_name);
  }
}
