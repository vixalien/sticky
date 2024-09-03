import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

import { Note } from "../util";
import { SignalListeners } from "../util/listeners";

export class StickyNoteTextView extends Gtk.TextView {
  static {
    GObject.registerClass({
      GTypeName: "StickyNoteTextView",
    }, this);
  }

  constructor(params: Partial<Gtk.TextView.ConstructorProperties>) {
    super(params);

    this.buffer.connect("changed", this.buffer_changed_cb.bind(this));
  }

  private _note: Note | null = null;

  get note() {
    return this._note;
  }

  set note(value: Note | null) {
    if (this._note == value) return;
    this.clear_note();

    if (!value) return;
    this._note = value;
    this.update_note();
  }

  private listeners = new SignalListeners();

  private clear_note() {
    this.listeners.clear();
  }

  private update_note() {
    if (!this.note) return;
  }

  // callbacks
  private buffer_changed_cb(buffer: Gtk.TextBuffer) {
    if (!this.note) return;

    if (this.note.content === buffer.text) return;

    this.note.content = buffer.text;
  }
}
