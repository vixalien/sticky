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

import { Note } from "../util/index.js";
import { AddActionEntries } from "types/extra.js";
import { StickyNoteEditor } from "./editor.js";

GObject.type_ensure(StickyNoteEditor.$gtype);

export class StickyNoteWindow extends Adw.ApplicationWindow {
  private _editor!: StickyNoteEditor;

  note: Note;

  static {
    GObject.registerClass(
      {
        Template: "resource:///com/vixalien/sticky/ui/window.ui",
        GTypeName: "StickyNoteWindow",
        InternalChildren: [
          "editor",
        ],
      },
      this,
    );
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

    this._editor.note = note;

    this.add_actions();
  }

  add_actions() {
    const tag_actions = Object.entries(this._editor.tag_map).map(
      ([name, tag]) => {
        return {
          name: name,
          activate: () => {
            this._editor.apply_tag(tag);
          },
        };
      },
    );

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
      ...tag_actions,
    ]);
  }

  vfunc_close_request(): boolean {
    this.note.open = false;

    return super.vfunc_close_request();
  }
}
