import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import Adw from "gi://Adw";
import GLib from "gi://GLib";

import { StickyNoteCard } from "./card.js";
import { Note } from "./util.js";

export class StickyNotes extends Adw.ApplicationWindow {
  static {
    GObject.registerClass(
      {
        Template: "resource:///com/vixalien/sticky/notes.ui",
        GTypeName: "StickyNotes",
        InternalChildren: ["search", "notes_box", "no_notes", "no_results"],
        Signals: {
          "note-activated": {
            param_types: [GObject.TYPE_STRING],
          },
        },
      },
      this,
    );
  }

  _search!: Gtk.Box;
  _notes_box!: Gtk.ListBox;
  _no_notes!: Adw.StatusPage;
  _no_results!: Adw.StatusPage;

  _notes: Note[] = [];

  cards: StickyNoteCard[] = [];

  get notes() {
    return this._notes;
  }

  set notes(notes: Note[]) {
    this._notes = notes;
  }

  constructor(
    { notes, ...params }: Partial<Gtk.Window.ConstructorProperties> & {
      notes: Note[];
    },
  ) {
    super(params);

    this.notes = notes;

    this._notes_box.activate_on_single_click = false;
    this._notes_box.connect("row-activated", (list, row) => {
      this.emit(
        "note-activated",
        (row.get_first_child() as StickyNoteCard).note.uuid,
      );
    });

    this.render_notes();
  }

  clear_notes() {
    let child = this._notes_box.get_first_child();

    while (child) {
      this._notes_box.remove(child);
      child = this._notes_box.get_first_child();
    }
  }

  render_notes() {
    this.clear_notes();

    if (this._notes.length === 0) {
      this.set_visible_child("no_notes");
    }

    let index = 0;

    const add_card = () => {
      const card = new StickyNoteCard(this._notes[index]);

      this.cards.push(card);

      this._notes_box.append(card);

      index++;

      if (index < this._notes.length) {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT_IDLE, 0, add_card);
      }

      return GLib.SOURCE_REMOVE;
    };

    add_card();
  }

  changed_note(uuid: string, note: Note) {
    const card = this.cards.find((card) => card.note.uuid === uuid);

    if (!card) return;

    card.note = note;
  }

  set_visible_child(child: "no_notes" | "no_results" | "notes_box") {
    this._no_notes.visible = child === "no_notes";
    this._no_results.visible = child === "no_results";
    this._notes_box.visible = child === "notes_box";
    this._search.visible = child === "notes_box" || child === "no_results";
  }
}
