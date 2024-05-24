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
import Gio from "gi://Gio";
import Adw from "gi://Adw";
import GLib from "gi://GLib";
import Gtk from "gi://Gtk?version=4.0";
import Gdk from "gi://Gdk?version=4.0";

import { StickyNotes } from "./notes.js";
import { Note, settings } from "./util/index.js";
import {
  delete_note,
  load_notes,
  NewNotesDir,
  save_note,
  save_notes,
} from "./store.js";
import { Window } from "./window.js";

export class Application extends Adw.Application {
  private window: StickyNotes | null = null;
  private note_windows: Window[] = [];

  static {
    GObject.registerClass(this);
  }

  notes_list = Gio.ListStore.new(Note.$gtype) as Gio.ListStore<Note>;

  open_new_note = false;

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

    GLib.set_application_name(_("Sticky Notes"));

    this.init_actions();

    try {
      const notes = load_notes();

      notes.forEach((note) => {
        note.connect("notify::modified", (_, x) => {
          save_note(note);
        });

        // changing open doesn't change modified
        note.connect("notify::open", () => {
          save_note(note);
        });

        this.notes_list.append(note);
      });

      this.sort_notes();
    } catch (error) {
      console.error(error as any);
    }

    this.add_cli_options();

    console.log("Storing Notes at: " + NewNotesDir.get_path());
  }

  private add_cli_options() {
    this.add_main_option(
      "version",
      "v".charCodeAt(0),
      GLib.OptionFlags.NONE,
      GLib.OptionArg.NONE,
      "Print version information and exit",
      null,
    );

    this.add_main_option(
      "new-note",
      "n".charCodeAt(0),
      GLib.OptionFlags.NONE,
      GLib.OptionArg.NONE,
      "Open a new note",
      null,
    );

    this.add_main_option(
      "if-open-note",
      "i".charCodeAt(0),
      GLib.OptionFlags.NONE,
      GLib.OptionArg.NONE,
      "Only show the app if there is atleast one open note",
      null,
    );
  }

  save() {
    const array: Note[] = [];

    this.foreach_note((note) => {
      array.push(note);
    });

    return save_notes(array);
  }

  public vfunc_shutdown() {
    this.save();

    super.vfunc_shutdown();
  }

  public vfunc_activate() {
    // this is used to track if there is atleast one window open. id there isn't,
    // we show the all_notes
    let has_one_open = false;

    if (this.open_new_note) {
      this.new_note();
    } else {
      if (settings.get_boolean("show-all-notes")) this.all_notes();

      this.foreach_note((note) => {
        if (note.open) {
          if (has_one_open == false) has_one_open = true;
          this.show_note(note.uuid);
        }
      });

      if (!has_one_open) {
        const last_open_note = this.notes_array()
          .sort((a, b) => b.modified.compare(a.modified))[0];

        if (has_one_open) {
          this.show_note(last_open_note.uuid);
        } else {
          settings.set_boolean("show-all-notes", true);
          this.all_notes();
        }
      }
    }
  }

  vfunc_handle_local_options(options: GLib.VariantDict): number {
    if (options.contains("version")) {
      print(pkg.version);
      /* quit the invoked process after printing the version number
         * leaving the running instance unaffected
         */
      return 0;
    } else if (options.contains("new-note")) {
      this.open_new_note = true;
    } else if (options.contains("if-open-note")) {
      let open = false;

      this.foreach_note((note) => {
        open = open || note.open;
      });

      if (open == false) {
        console.log(
          "Sticky Notes not opening because the `-i` flag was passed and there are no open notes",
        );
        return 0;
      }
    }

    return super.vfunc_handle_local_options(options);
  }

  is_note_open(uuid: string) {
    return this.note_windows.some((w: Window) => w.note.uuid === uuid);
  }

  new_controller() {
    const controller = new Gtk.ShortcutController();

    const add_shortcut = (fn: () => void, accels: string[]) => {
      const shortcut = new Gtk.Shortcut({
        trigger: Gtk.ShortcutTrigger.parse_string(accels.join("|")),
        // @ts-ignore bad types
        action: Gtk.CallbackAction.new(() => {
          fn();
          return true;
        }),
      });
      controller.add_shortcut(shortcut);
    };

    add_shortcut(this.cycle_linear.bind(this), [
      "<Primary>Page_Down",
      "<Primary>Tab",
      "<Primary>ISO_Left_Tab",
      "<Primary>KP_Tab",
    ]);
    add_shortcut(this.cycle_reverse.bind(this), [
      "<Primary>Page_Up",
      "<Primary><Shift>Tab",
      "<Primary><Shift>ISO_Left_Tab",
      "<Primary><Shift>KP_Tab",
    ]);

    return controller;
  }

  init_actions() {
    const quit_action = new Gio.SimpleAction({ name: "quit" });
    quit_action.connect("activate", () => this.quit());
    this.add_action(quit_action);

    const show_about_action = new Gio.SimpleAction({ name: "about" });
    show_about_action.connect("activate", () => this.show_about());
    this.add_action(show_about_action);

    const new_note = new Gio.SimpleAction({ name: "new-note" });
    new_note.connect("activate", () => this.new_note());
    this.add_action(new_note);

    const all_notes = new Gio.SimpleAction({ name: "all-notes" });
    all_notes.connect("activate", () => {
      GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
        this.all_notes();
        return GLib.SOURCE_REMOVE;
      });
    });
    this.add_action(all_notes);

    const open_link = new Gio.SimpleAction({
      name: "open-link",
      parameter_type: GLib.VariantType.new("s"),
    });
    open_link.connect("activate", (_, parameter) => {
      if (!parameter) return;
      const [uri] = parameter.get_string();

      if (uri === "null") return;
      Gtk.show_uri(
        this.get_active_window(),
        uri,
        Gdk.CURRENT_TIME,
      );
    });
    this.add_action(open_link);

    const cycle_linear = new Gio.SimpleAction({ name: "cycle" });
    cycle_linear.connect("activate", () => this.cycle_linear());
    this.add_action(cycle_linear);

    const cycle_reverse = new Gio.SimpleAction({ name: "cycle-reverse" });
    cycle_reverse.connect("activate", () => this.cycle_reverse());
    this.add_action(cycle_reverse);

    const save = new Gio.SimpleAction({ name: "save" });
    save.connect("activate", () => this.save());
    this.add_action(save);

    this.add_action(settings.create_action("color-scheme"));

    this.set_accels_for_action("app.quit", ["<Primary>q"]);
    this.set_accels_for_action("app.new-note", ["<Primary>n"]);
    this.set_accels_for_action("app.all-notes", ["<Primary>h"]);
    // this.set_accels_for_action("app.cycle", ["<Primary><Shift>a"]);
    // this.set_accels_for_action("app.cycle-reverse", ["<Primary><Shift>b"]);
    this.set_accels_for_action("app.save", ["<Primary>s"]);

    this.set_accels_for_action("win.open-primary-menu", ["F10"]);
    this.set_accels_for_action("win.show-help-overlay", ["<Primary>question"]);
    this.set_accels_for_action("window.close", ["<Primary>w"]);

    this.set_accels_for_action("win.bold", ["<Primary>b"]);
    this.set_accels_for_action("win.italic", ["<Primary>i"]);
    this.set_accels_for_action("win.underline", ["<Primary>u"]);
    this.set_accels_for_action("win.strikethrough", ["<Primary>t"]);
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
      this.get_note_window(
        notes.get_item(reverse ? notes.n_items - 1 : 0)!.uuid,
      )
        ?.present();
    } else if (presented instanceof Window) {
      let id;

      for (id = 0; id < notes.n_items; id++) {
        if (notes.get_item(id)!.uuid === presented.note.uuid) {
          break;
        }
      }

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
    return this.cycle(false);
  }

  cycle_reverse() {
    // reverse the order (makes it loop oldest first)
    return this.cycle(true);
  }

  show_about() {
    const aboutParams: Partial<Adw.AboutWindow.ConstructorProperties> = {
      transient_for: this.active_window,
      application_name: _("Sticky Notes"),
      application_icon: pkg.name,
      developer_name: "Angelo Verlain",
      version: pkg.version,
      developers: [
        "Angelo Verlain <hey@vixalien.com>",
        "Christopher Davis <christopherdavis@gnome.org>",
      ],
      designers: [
        "David Lapshin",
      ],
      // TRANSLATORS: eg. 'Translator Name <your.email@domain.com>' or 'Translator Name https://website.example'
      translator_credits: _("translator-credits"),
      copyright: "© 2023 Angelo Verlain, Christopher Davis",
      license_type: Gtk.License.MIT_X11,
      website: "https://github.com/vixalien/sticky",
      issue_url: "https://github.com/vixalien/sticky/issues",
    };

    const aboutWindow = new Adw.AboutWindow(aboutParams);
    aboutWindow.present();
  }

  notes_array() {
    const notes: Note[] = [];

    this.foreach_note((note) => {
      notes.push(note);
    });

    return notes;
  }

  foreach_note(cb: (note: Note, id?: number) => void) {
    let id = 0;

    while (id < this.notes_list.n_items) {
      cb(this.notes_list.get_item(id)!, id);
      id++;
    }
  }

  find_note_id(uuid: string) {
    return this.notes_array().findIndex((note) => note.uuid === uuid);
  }

  find_note(uuid: string) {
    return this.notes_array().find((note) => note.uuid === uuid);
  }

  find_open_window(uuid: string) {
    const win = this.note_windows.find((window) => window.note.uuid === uuid);

    return win ?? undefined;
  }

  find_open_note(uuid: string) {
    return this.find_open_window(uuid)?.note as Note ?? undefined;
  }

  changed_note(uuid: string) {
    const found_id = this.find_note_id(uuid);
    const found_note = this.find_open_note(uuid);

    if (found_id !== undefined && found_note) {
      // this.notes_list.splice(found_id, 1, [found_note]);
    }
  }

  delete_note(uuid: string) {
    const found_id = this.find_note_id(uuid);
    const found_window = this.find_open_window(uuid);

    if (found_id !== undefined) this.notes_list.splice(found_id, 1, []);
    if (found_window) found_window.close();

    delete_note(uuid);
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
        settings.set_boolean("show-all-notes", false);
      });

      this.window.add_controller(this.new_controller());
    }

    settings.set_boolean("show-all-notes", true);

    this.window.present();
  }

  new_note() {
    const note = Note.generate();

    note.connect("notify::modified", () => {
      save_note(note);
    });

    // changing open doesn't change modified
    note.connect("notify::open", () => {
      save_note(note);
    });

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

    window.add_controller(this.new_controller());

    window.connect("close-request", () => {
      // if this is the last window, it means that the app will be closed
      // immediately after, so keep this as "open" when the all notes window
      // is open (so that it's restored when the app is opened again)
      if (!(this.note_windows.length === 1 && !this.window)) {
        note.open = false;
      }

      this.note_windows = this.note_windows.filter((win) => win !== window);
      this.window?.set_note_visible(note!.uuid, false);
      return false;
    });

    window.connect("deleted", (_, uuid) => {
      this.delete_note(uuid);
    });

    if (note.open === false) note.open = true;

    window.present();
  }
}
