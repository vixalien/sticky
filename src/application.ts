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

import { StickyAllNotesWindow } from "./notes.js";
import { confirm_delete, Note, settings } from "./util/index.js";
import { delete_note, load_notes, NewNotesDir, save_notes } from "./store.js";
import { StickyNoteWindow } from "./window.js";
import { find_item, list_foreach, list_model_to_array } from "./util/list.js";
import { AddActionEntries } from "types/extra.js";

export class Application extends Adw.Application {
  private all_notes_window: StickyAllNotesWindow | null = null;
  // private note_windows: Window[] = [];

  static {
    GObject.registerClass(this);
  }

  notes = new Gio.ListStore<Note>({ item_type: Note.$gtype });
  private windows = new Gio.ListStore<StickyNoteWindow>({
    item_type: StickyNoteWindow.$gtype,
  });

  private notes_sorter = Gtk.CustomSorter.new((note1: Note, note2) => {
    return note1.modified.compare(note2.modified);
  });
  private sorted_notes = new Gtk.SortListModel<Note>({
    model: this.notes,
    sorter: this.notes_sorter,
  });

  private open_new_note = false;
  private load_notes = false;

  private create_window_for_note(note: Note): StickyNoteWindow {
    return new StickyNoteWindow({ application: this, note });
  }

  private setup_sync_windows() {
    this.notes.connect(
      "items-changed",
      (
        _self: typeof this.notes,
        position: number,
        removed: number,
        added: number,
      ) => {
        // close removed windows
        list_model_to_array(this.windows)
          .slice(position, position + removed)
          .forEach((window) => window.destroy());

        // add new windows for newly created notes
        this.windows.splice(
          position,
          removed,
          list_model_to_array(this.notes)
            .slice(position, position + added)
            .map(this.create_window_for_note.bind(this)),
        );
      },
    );
  }

  constructor() {
    super({
      application_id: "com.vixalien.sticky",
      flags: Gio.ApplicationFlags.DEFAULT_FLAGS,
    });

    GLib.set_application_name(_("Sticky Notes"));

    this.init_actions();
    this.setup_sync_windows();
    this.add_cli_options();

    this.load_notes = true;

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
    return save_notes(list_model_to_array(this.notes));
  }

  public vfunc_shutdown() {
    this.save();

    super.vfunc_shutdown();
  }

  public vfunc_activate() {
    if (this.load_notes) {
      try {
        const notes = load_notes();

        notes.forEach((note) => {
          note.setup_autosave();
        });

        this.notes.splice(0, 0, notes);
      } catch (error) {
        console.error(error as any);
      }

      this.load_notes = false;
    }

    if (this.open_new_note) {
      this.new_note();
    } else {
      if (settings.get_boolean("show-all-notes")) this.show_all_notes_window();

      let has_one_open = false;

      list_foreach(this.notes, (note) => {
        has_one_open = has_one_open || note.open;
      });

      if (!has_one_open) {
        const last_note = this.sorted_notes.get_item(
          this.sorted_notes.n_items - 1,
        );

        if (last_note) {
          last_note.open = true;
        } else {
          settings.set_boolean("show-all-notes", true);
          this.show_all_notes_window();
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
      let has_one_open = false;

      list_foreach(this.notes, (note) => {
        has_one_open = has_one_open || note.open;
      });

      if (has_one_open == false) {
        console.log(
          "Sticky Notes not opening because the `-i` flag was passed and there are no open notes",
        );
        return 0;
      }
    }

    return super.vfunc_handle_local_options(options);
  }

  private new_controller() {
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

  private init_actions() {
    (this.add_action_entries as AddActionEntries)([
      {
        name: "new-note",
        activate: () => this.new_note(),
      },
      {
        name: "delete-note",
        parameter_type: "s",
        activate: (_, params) => {
          const uuid = params?.get_string()?.[0];
          if (!uuid) return;

          this.delete_note(uuid);
        },
      },
      {
        name: "show-all-notes",
        activate: () => {
          this.show_all_notes_window();
        },
      },
      {
        name: "quit",
        activate: () => this.quit(),
      },
      {
        name: "about",
        activate: () => this.show_about(),
      },
      {
        name: "open-link",
        parameter_type: "s",
        activate: (_, param) => {
          const uri = param?.get_string()[0];
          if (!uri) return;

          Gtk.show_uri(
            this.get_active_window(),
            uri,
            Gdk.CURRENT_TIME,
          );
        },
      },
      {
        name: "cycle",
        activate: () => this.cycle_linear(),
      },
      {
        name: "cycle-reverse",
        activate: () => this.cycle_reverse(),
      },
      {
        name: "save",
        activate: () => this.save(),
      },
    ]);

    this.add_action(settings.create_action("color-scheme"));

    this.set_accels_for_action("app.new-note", ["<Primary>n"]);
    this.set_accels_for_action("app.show-all-notes", ["<Primary>h"]);

    this.set_accels_for_action("app.quit", ["<Primary>q"]);
    this.set_accels_for_action("app.save", ["<Primary>s"]);

    this.set_accels_for_action("win.open-primary-menu", ["F10"]);
    this.set_accels_for_action("win.show-help-overlay", ["<Primary>question"]);
    this.set_accels_for_action("window.close", ["<Primary>w"]);

    this.set_accels_for_action("win.bold", ["<Primary>b"]);
    this.set_accels_for_action("win.italic", ["<Primary>i"]);
    this.set_accels_for_action("win.underline", ["<Primary>u"]);
    this.set_accels_for_action("win.strikethrough", ["<Primary>t"]);
  }

  /**
   * Switch to the Next or Previous window
   * usually in response to clicking Alt+Tab
   */
  private cycle(reverse = false) {
    if (this.notes.n_items <= 0) return;

    const filter = Gtk.CustomFilter.new((item) => {
      const note = item as Note;
      return note.open;
    });

    const notes = Gtk.FilterListModel.new(
      this.sorted_notes,
      filter,
    ) as Gtk.FilterListModel<Note>;

    const presented = this.active_window;

    if (presented instanceof StickyAllNotesWindow) {
      this.windows.get_item(reverse ? notes.n_items - 1 : 0)?.present();
    } else if (presented instanceof StickyNoteWindow) {
      let id;

      for (id = 0; id < notes.n_items; id++) {
        if (notes.get_item(id)!.uuid === presented.note.uuid) {
          break;
        }
      }

      const focus_id = id + (reverse ? -1 : 1);

      if (focus_id < 0 || focus_id >= notes.n_items) {
        this.show_all_notes_window();
      } else {
        this.windows.get_item(focus_id)?.present();
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

  private real_delete_note(uuid: string) {
    const [position] = find_item(this.notes, (note) => note.uuid === uuid);

    if (position == false) return;

    delete_note(uuid);
    this.notes.remove(position);
  }

  delete_note(uuid: string) {
    confirm_delete(this.get_active_window()!, () => {
      this.real_delete_note(uuid);
    });
  }

  private show_all_notes_window() {
    if (!this.all_notes_window) {
      this.all_notes_window = new StickyAllNotesWindow({
        application: this,
      });

      this.all_notes_window.connect("close-request", () => {
        this.all_notes_window = null;
        settings.set_boolean("show-all-notes", false);
      });

      this.all_notes_window.add_controller(this.new_controller());
    }

    settings.set_boolean("show-all-notes", true);

    this.all_notes_window.present();
  }

  private new_note() {
    const note = Note.new_with_autosave(true);

    this.notes.append(note);
  }
}
