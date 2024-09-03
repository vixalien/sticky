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
import GLib from "gi://GLib";

import { Note, Style } from "./util/index.js";
import { SignalListeners } from "./util/listeners.js";
import { StickyNoteView } from "./view2.js";

GObject.type_ensure(StickyNoteView.$gtype);

export class StickyNoteCard extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "StickyNoteCard",
      Template: "resource:///com/vixalien/sticky/ui/card.ui",
      InternalChildren: [
        "modified_label",
        "view_image",
        "delete_button",
        "scrolled",
        "view",
      ],
      Properties: {
        style: GObject.param_spec_int(
          "style",
          "style",
          "The style of this card",
          -1,
          Style.window,
          -1,
          GObject.ParamFlags.READWRITE,
        ),
      },
    }, this);
  }

  private _modified_label!: Gtk.Label;
  private _view_image!: Gtk.Image;
  private _delete_button!: Gtk.Button;
  private _view!: StickyNoteView;

  constructor(public window: Gtk.Window) {
    super();
  }

  private listeners = new SignalListeners();

  show_note(note: Note) {
    if (this._view.note === note) return;

    this.clear();

    this._delete_button.action_target = GLib.Variant.new_string(note.uuid);

    this.listeners.add_bindings(
      note.bind_property(
        "open",
        this._view_image,
        "visible",
        GObject.BindingFlags.SYNC_CREATE,
      ),
      // @ts-expect-error incorrect types
      note.bind_property_full(
        "modified",
        this._modified_label,
        "label",
        GObject.BindingFlags.SYNC_CREATE,
        (_, value: GLib.DateTime) => {
          const modified = value.to_local();

          if (!modified) return [false, null];

          // if date is today, show time
          // otherwise, show date
          const format_string =
            GLib.DateTime.new_now_local().format("%F") === modified.format("%F")
              ? "%R"
              : "%F";

          return [true, modified.format(format_string)];
        },
        null,
      ),
      note.bind_property(
        "style",
        this,
        "style",
        GObject.BindingFlags.SYNC_CREATE,
      ),
    );

    this._view.note = note;
  }

  clear() {
    this.listeners.clear();
  }

  get style() {
    for (const className of this.css_classes) {
      if (className.startsWith("style-") && className !== "style-specifity") {
        const style = Style[className.slice(6) as any] as unknown as Style;
        if (style) return style;
      }
    }

    return -1;
  }

  set style(style: Style | -1) {
    if (style === -1 || !Style[style] || this.style === style) return;

    this.remove_css_class(`style-${Style[this.style]}`);
    this.add_css_class(`style-${Style[style]}`);
  }
}
