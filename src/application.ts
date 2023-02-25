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
import Gio from "gi://Gio";
import Adw from "gi://Adw";
import GLib from "gi://GLib";

import { StickyNotes } from "./notes.js";
import { gen_new_note, Note, Style } from "./util.js";
import { Window } from "./window.js";

export class Application extends Adw.Application {
  private window?: StickyNotes;
  private note_windows: StickyNotes[] = [];

  static {
    GObject.registerClass(this);
  }

  constructor() {
    super({
      application_id: "com.vixalien.sticky",
      flags: Gio.ApplicationFlags.DEFAULT_FLAGS,
    });

    const quit_action = new Gio.SimpleAction({ name: "quit" });
    quit_action.connect("activate", () => {
      this.quit();
    });
    this.add_action(quit_action);
    this.set_accels_for_action("app.quit", ["<primary>q"]);

    const show_about_action = new Gio.SimpleAction({ name: "about" });
    show_about_action.connect("activate", () => {
      let aboutParams = {
        transient_for: this.active_window,
        application_name: "sticky-notes",
        application_icon: "com.vixalien.sticky",
        developer_name: "Christopher Davis",
        version: "0.1.0",
        developers: [
          "Christopher Davis <christopherdavis@gnome.org>",
        ],
        copyright: "© 2023 Christopher Davis",
      };
      const aboutWindow = new Adw.AboutWindow(aboutParams);
      aboutWindow.present();
    });
    this.add_action(show_about_action);
  }

  public vfunc_activate(): void {
    if (!this.window) {
      this.window = new StickyNotes({
        application: this,
        notes: SAMPLE_NOTES,
      });
    }

    this.window.present();
  }
}

const SAMPLE_NOTE = {
  ...gen_new_note(),
  content:
    "Hello World! Lorem Ipsum dolor sit amet, lorem ipsum dolor sit amet lorem ipsum dolor sit amet lorem ipsum dolor sit amet lorem ipsum dolor sit amet lorem ipsum dolor sit amet lorem ipsum dolor sit amet lorem ipsum dolor sit amet lorem ipsum dolor sit amet lorem ipsum dolor sit amet lorem ipsum dolor sit amet ",
};

const SAMPLE_NOTES: Note[] = [
  {
    ...SAMPLE_NOTE,
    uuid: GLib.uuid_string_random(),
    style: Style.pink,
    tags: [
      {
        name: "bold",
        start: 0,
        end: 15,
      },
    ],
  },
  SAMPLE_NOTE,
  {
    ...SAMPLE_NOTE,
    uuid: GLib.uuid_string_random(),
    style: Style.window,
    tags: [
      {
        name: "bold",
        start: 0,
        end: 15,
      },
      {
        name: "italic",
        start: 3,
        end: 10,
      },
    ],
  },
  {
    ...SAMPLE_NOTE,
    uuid: GLib.uuid_string_random(),
    style: Style.green,
    tags: [
      {
        name: "bold",
        start: 0,
        end: 15,
      },
    ],
  },
  {
    ...SAMPLE_NOTE,
    uuid: GLib.uuid_string_random(),
    style: Style.purple,
    tags: [
      {
        name: "strikethrough",
        start: 12,
        end: 31,
      },
    ],
  },
  {
    ...SAMPLE_NOTE,
    uuid: GLib.uuid_string_random(),
    style: Style.gray,
    tags: [
      {
        name: "underline",
        start: 13,
        end: 21,
      },
    ],
  },
];
