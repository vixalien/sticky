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
import Gtk from "gi://Gtk?version=4.0";

import { StickyNotes } from "./notes.js";
import { Note, Style } from "./util.js";
import { Window } from "./window.js";

export class Application extends Adw.Application {
  private window: StickyNotes | null = null;
  private note_windows: Window[] = [];

  static {
    GObject.registerClass(this);
  }

  // notes: Note[] = [];
  notes_list = Gio.ListStore.new(Note.$gtype) as Gio.ListStore<Note>;

  sort_notes() {
    this.notes_list.sort((note1: Note, note2: Note) => {
      return note1.modified.compare(note2.modified);
    });
  }

  constructor() {
    super({
      application_id: "com.vixalien.sticky",
      flags: Gio.ApplicationFlags.DEFAULT_FLAGS,
    });

    this.init_actions();

    SAMPLE_NOTES.map((note) => this.notes_list.append(note));
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
    this.set_accels_for_action("app.cycle", ["<Primary><Shift>a"]);
    this.set_accels_for_action("app.cycle-reverse", ["<Primary><Shift>b"]);

    this.set_accels_for_action("win.open-primary-menu", ["F10"]);
    this.set_accels_for_action("win.show-help-overlay", ["<Primary>question"]);
    this.set_accels_for_action("win.delete", ["<Primary>w"]);

    this.set_accels_for_action("win.bold", ["<Primary>b"]);
    this.set_accels_for_action("win.italic", ["<Primary>i"]);
    this.set_accels_for_action("win.underline", ["<Primary>u"]);
    this.set_accels_for_action("win.strikethrough", ["<Primary>s"]);
  }

  get_note_window(uuid: string) {
    return this.note_windows.find((w) => w.note.uuid === uuid);
  }

  cycle(reverse = false) {
    this.sort_notes();

    if (this.notes_list.n_items <= 0) return;

    const filter = Gtk.CustomFilter.new((item) => {
      const note = item as Note;
      return this.is_note_open(note.uuid);
    });

    const notes = Gtk.FilterListModel.new(
      this.notes_list,
      filter,
    ) as Gtk.FilterListModel<Note>;

    const presented = this.active_window;

    if (presented instanceof StickyNotes) {
      if (reverse) {
        this.get_note_window(notes.get_item(notes.n_items - 1)!.uuid)
          ?.present();
      } else {
        this.get_note_window(notes.get_item(0)!.uuid)?.present();
      }
    } else if (presented instanceof Window) {
      const id = this.find_note_id(presented.note.uuid)!;

      const focus_id = id + (reverse ? -1 : 1);

      if (focus_id < 0 || focus_id >= notes.n_items) {
        this.all_notes();
      } else {
        this.get_note_window(notes.get_item(focus_id)!.uuid)?.present();
      }
    }
  }

  cycle_linear() {
    // reverse the order (makes it loop oldest first)
    return this.cycle(true);
  }

  cycle_reverse() {
    // reverse the order (makes it loop oldest first)
    return this.cycle(false);
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

  find_note_id(uuid: string) {
    let found = false, id = 0;

    while (id < this.notes_list.n_items) {
      if (this.notes_list.get_item(id)!.uuid === uuid) {
        return id;
      }
      id++;
    }
  }

  find_note(uuid: string) {
    let found = false, id = 0;

    while (id < this.notes_list.n_items) {
      const note = this.notes_list.get_item(id)!;
      if (note.uuid === uuid) {
        return note;
      }
      id++;
    }
  }

  find_open_note(uuid: string) {
    const saved_note = this.note_windows.find((window) =>
      window.note.uuid === uuid
    )?.save() as Note;

    return saved_note ?? undefined;
  }

  changed_note(uuid: string) {
    const found_id = this.find_note_id(uuid);
    const found_note = this.find_open_note(uuid);

    if (found_id !== undefined && found_note) {
      this.notes_list.splice(found_id, 1, [found_note]);
    }
  }

  delete_note(uuid: string) {
    const found_id = this.find_note_id(uuid);

    if (found_id !== undefined) this.notes_list.splice(found_id, 1, []);
  }

  all_notes() {
    if (!this.window) {
      this.window = new StickyNotes({
        application: this,
      });

      this.window.connect("note-activated", (_, uuid) => {
        this.show_note(uuid);
      });

      this.window.connect("deleted", (_, uuid) => {
        this.delete_note(uuid);
      });

      this.window.connect("close-request", () => {
        this.window = null;
      });
    }

    this.window.present();
  }

  new_note() {
    const note = Note.generate();

    this.notes_list.append(note);

    this.show_note(note.uuid);
  }

  show_note(uuid: string) {
    const note = this.find_note(uuid);

    if (!note) return;

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
      this.window?.set_note_visible(note!.uuid, false);
      return false;
    });

    window.connect("changed", (_, uuid, what: string) => {
      this.changed_note(uuid);
    });

    window.connect("deleted", (_, uuid) => {
      this.delete_note(uuid);
    });

    this.window?.set_note_visible(uuid, true);
  }
}

const SAMPLE_NOTE = Note.generate();
SAMPLE_NOTE.content =
  "Hello World! Lorem Ipsum dolor sit amet, lorem ipsum dolor sit amet lorem ipsum dolor sit amet lorem ipsum dolor sit amet lorem ipsum dolor sit amet lorem ipsum dolor sit amet lorem ipsum dolor sit amet lorem ipsum dolor sit amet lorem ipsum dolor sit amet lorem ipsum dolor sit amet lorem ipsum dolor sit amet ";

const SAMPLE_2 = SAMPLE_NOTE.copy();
SAMPLE_2.content = "hola amigos";
SAMPLE_2.uuid = GLib.uuid_string_random();
SAMPLE_2.style = Style.pink;
SAMPLE_2.tags = [{
  name: "bold",
  start: 0,
  end: 15,
}];
SAMPLE_2.modified_date = new Date("2019-01-01");

const SAMPLE_3 = SAMPLE_NOTE.copy();
SAMPLE_3.content = "halo!";
SAMPLE_3.uuid = GLib.uuid_string_random();
SAMPLE_3.style = Style.window;
SAMPLE_3.tags = [{
  name: "bold",
  start: 0,
  end: 15,
}, {
  name: "italic",
  start: 3,
  end: 10,
}];
SAMPLE_3.modified_date = new Date("2021-01-05");

const SAMPLE_4 = SAMPLE_NOTE.copy();
SAMPLE_4.content = "bonjour";
SAMPLE_4.uuid = GLib.uuid_string_random();
SAMPLE_4.style = Style.green;
SAMPLE_4.tags = [{
  name: "bold",
  start: 0,
  end: 15,
}];
SAMPLE_4.modified_date = new Date("2005-08-01");

const SAMPLE_5 = SAMPLE_NOTE.copy();
SAMPLE_5.content = "muraho";
SAMPLE_5.uuid = GLib.uuid_string_random();
SAMPLE_5.style = Style.purple;
SAMPLE_5.tags = [{
  name: "strikethrough",
  start: 12,
  end: 31,
}];
SAMPLE_5.modified_date = new Date("2005-03-01");

const SAMPLE_6 = SAMPLE_NOTE.copy();
SAMPLE_6.content = "mwiriwe";
SAMPLE_6.uuid = GLib.uuid_string_random();
SAMPLE_6.style = Style.gray;
SAMPLE_6.tags = [{
  name: "underline",
  start: 13,
  end: 21,
}];
SAMPLE_6.modified_date = new Date("1981-01-01");

const SAMPLE_NOTES: Note[] = [
  SAMPLE_NOTE,
  SAMPLE_2,
  SAMPLE_3,
  SAMPLE_4,
  SAMPLE_5,
  SAMPLE_6,
];
