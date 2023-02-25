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
  private window: StickyNotes | null = null;
  private note_windows: Window[] = [];

  static {
    GObject.registerClass(this);
  }

  notes: Note[] = [];

  constructor() {
    super({
      application_id: "com.vixalien.sticky",
      flags: Gio.ApplicationFlags.DEFAULT_FLAGS,
    });

    this.init_actions();

    this.notes = SAMPLE_NOTES;
  }

  public vfunc_activate(): void {
    this.all_notes();
  }

  is_note_open(uuid: string) {
    return this.note_windows.some((w: Window) => w.note.uuid === uuid);
  }

  init_actions() {
    const quit_action = new Gio.SimpleAction({ name: "quit" });
    quit_action.connect("activate", this.quit.bind(this));
    this.add_action(quit_action);

    const show_about_action = new Gio.SimpleAction({ name: "about" });
    show_about_action.connect("activate", this.show_about.bind(this));
    this.add_action(show_about_action);

    const new_note = new Gio.SimpleAction({ name: "new-note" });
    new_note.connect("activate", this.new_note.bind(this));
    this.add_action(new_note);

    const all_notes = new Gio.SimpleAction({ name: "all-notes" });
    all_notes.connect("activate", () => {
      GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
        this.all_notes();
        return GLib.SOURCE_REMOVE;
      });
    });
    this.add_action(all_notes);

    const cycle_linear = new Gio.SimpleAction({ name: "cycle" });
    cycle_linear.connect("activate", this.cycle_linear.bind(this));
    this.add_action(cycle_linear);

    const cycle_reverse = new Gio.SimpleAction({ name: "cycle-reverse" });
    cycle_reverse.connect("activate", this.cycle_reverse.bind(this));
    this.add_action(cycle_reverse);

    this.set_accels_for_action("app.quit", ["<Primary>q"]);
    this.set_accels_for_action("app.new-note", ["<Primary>n"]);
    this.set_accels_for_action("app.all-notes", ["<Primary>h"]);
    // this.set_accels_for_action("app.cycle", ["<Primary><Shift>a"]);
    // this.set_accels_for_action("app.cycle-reverse", ["<Primary><Shift>b"]);

    this.set_accels_for_action("win.open-primary-menu", ["F10"]);
    this.set_accels_for_action("win.show-help-overlay", ["<Primary>question"]);

    this.set_accels_for_action("win.bold", ["<Primary>b"]);
    this.set_accels_for_action("win.italic", ["<Primary>i"]);
    this.set_accels_for_action("win.underline", ["<Primary>u"]);
    this.set_accels_for_action("win.strikethrough", ["<Primary>s"]);
  }

  get sorted_notes() {
    return this.notes.sort((note1, note2) => {
      const date1 = GLib.DateTime.new_from_iso8601(
        note1.modified.toISOString(),
        null,
      );
      const date2 = GLib.DateTime.new_from_iso8601(
        note2.modified.toISOString(),
        null,
      );

      return date2.compare(date1);
    });
  }

  get_note_window(uuid: string) {
    return this.note_windows.find((w) => w.note.uuid === uuid);
  }

  cycle(reverse = false) {
    const sorted_notes = this.sorted_notes
      .filter((note) => this.is_note_open(note.uuid));

    if (sorted_notes.length <= 0) return;

    const presented = this.active_window;

    if (presented instanceof StickyNotes) {
      if (reverse) {
        this.get_note_window(sorted_notes[sorted_notes.length - 1].uuid)
          ?.present();
      } else {
        this.get_note_window(sorted_notes[0].uuid)?.present();
      }
    } else if (presented instanceof Window) {
      const id = sorted_notes.findIndex((note) =>
        note.uuid === presented.note.uuid
      );

      const focus_id = id + (reverse ? -1 : 1);

      if (focus_id < 0 || focus_id >= sorted_notes.length) {
        this.all_notes();
      } else {
        this.get_note_window(sorted_notes[focus_id].uuid)?.present();
      }
    }
  }

  cycle_linear() {
    return this.cycle(false);
  }

  cycle_reverse() {
    return this.cycle(true);
  }

  show_about() {
    const aboutParams = {
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
  }

  changed_note(uuid: string, render = false) {
    const saved_note = this.note_windows.find((window) =>
      window.note.uuid === uuid
    )?.save() as Note;

    this.window?.changed_note(uuid, saved_note);

    this.notes = this.notes.map((note) => {
      if (note.uuid === uuid) return saved_note;
      return note;
    });

    // this.window.notes = this.window.notes.map((note) => {
    //   if (note.uuid === uuid) {
    //     const saved_note = this.note_windows.find((window) =>
    //       window.note.uuid === uuid
    //     )?.save() as Note;
    //     return saved_note;
    //   }
    //   return note;
    // });

    // if (render) this.window.render_notes();
  }

  all_notes() {
    if (!this.window) {
      this.window = new StickyNotes({
        application: this,
      });

      this.window.connect("note-activated", (_, uuid) => {
        this.show_note(uuid);
      });

      this.window.connect("close-request", () => {
        this.window = null;
      });
    }

    this.window.present();
  }

  new_note() {
    const note = gen_new_note();

    this.notes.push(note);

    if (this.window) {
      this.window.add_note(note, () => {
        this.show_note(note.uuid);
      });
    } else {
      this.show_note(note.uuid);
    }
  }

  show_note(uuid: string) {
    const note = this.notes.find((note) => note.uuid === uuid);

    if (!note) {
      return;
    }

    const note_window = this.note_windows.find((window) =>
      window.note.uuid === uuid
    );

    if (note_window) {
      note_window.present();
      return;
    }

    const window = new Window({
      application: this,
      note,
    });

    this.note_windows.push(window);

    window.present();

    window.connect("close-request", () => {
      this.note_windows = this.note_windows.filter((win) => win !== window);
      this.window?.set_note_visible(note.uuid, false);
      return false;
    });

    window.connect("changed", (_, uuid, what: string) => {
      this.changed_note(uuid, what !== "width" && what !== "height");
    });

    this.window?.set_note_visible(uuid, true);

    // window.connect("save", () => {
    //   this.window?.save(note);
    // });

    // window.connect("delete", () => {
    //   this.window?.delete(note);
    // });
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
    modified: new Date("2019-01-01"),
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
    modified: new Date("2021-01-05"),
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
    modified: new Date("2020-01-01"),
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
    modified: new Date("1981-01-01"),
  },
];
