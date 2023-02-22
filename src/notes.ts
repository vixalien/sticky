import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import Adw from "gi://Adw";

import { Note, StickyNoteCard } from "./card.js";

export class StickyNotes extends Adw.ApplicationWindow {
  static {
    GObject.registerClass(
      {
        Template: "resource:///com/vixalien/sticky/notes.ui",
        GTypeName: "StickyNotes",
        InternalChildren: ["search", "notes_box", "no_notes", "no_results"],
      },
      this,
    );
  }

  _search!: Gtk.SearchEntry;
  _notes_box!: Gtk.ListBox;
  _no_notes!: Adw.StatusPage;
  _no_results!: Adw.StatusPage;

  _notes: Note[] = [];

  get notes() {
    return this._notes;
  }

  set notes(notes: Note[]) {
    this._notes = notes;

    this.render_notes();
  }

  constructor(
    { notes, ...params }: Partial<Gtk.Window.ConstructorProperties> & {
      notes: Note[];
    },
  ) {
    super(params);

    this.notes = notes;
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

    this._notes.forEach((note) => {
      this._notes_box.append(new StickyNoteCard(note));
    });
  }

  set_visible_child(child: "no_notes" | "no_results" | "notes_box") {
    this._no_notes.visible = child === "no_notes";
    this._no_results.visible = child === "no_results";
    this._notes_box.visible = child === "notes_box";
  }
}
