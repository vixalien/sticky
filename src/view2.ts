import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

import { Note } from "./util";
import { SignalListeners } from "./util/listeners";

export class StickyNoteView extends Gtk.TextView {
  static {
    GObject.registerClass({
      GTypeName: "StickyNoteView",
    }, this);
  }

  constructor() {
    super({
      wrap_mode: Gtk.WrapMode.WORD_CHAR,
    });

    this.add_css_class("card-text-view");
  }

  private _note: Note | null = null;

  get note() {
    return this._note;
  }

  set note(value: Note | null) {
    if (!value || value === this._note) return;

    this.clear_note(this._note);
    this.set_note(value);
  }

  private listeners = new SignalListeners();

  private clear_note(_note: Note | null) {
    this.listeners.clear();
  }

  private set_note(note: Note) {
    this._note = note;

    this.listeners.add(
      note,
      note.connect("notify::content", () => {
        this.update_content();
      }),
    );

    this.update_content();
  }

  /**
   * Update this view because the note's content changed
   */
  private update_content() {
    if (!this.note) return;

    const text = this.note.content.trim();

    if (text.length === 0) {
      // This note has no content yet
      this.buffer.text = "";
      this.buffer.insert_markup(
        this.buffer.get_start_iter(),
        `<i>(${_("Empty Note")})</i>`,
        -1,
      );
    } else {
      this.buffer.text = clip_content(text);
    }
  }
}

const MAX_LINES = 5;
const MAX_CHARS = 240;

/**
 * Clip a note's content according to `MAX_LINES` and `MAX_CHARS`
 * @param text The content to clip
 */
function clip_content(text: string) {
  let cut = text.trim()
    // Limit the text to the first `MAX_LINES` lines
    .split("\n").slice(0, MAX_LINES).join("\n")
    // Limit the text to the first `MAX_CHARS` lines
    .slice(0, MAX_CHARS);

  // Show an ellipsis if the text was trimmed
  return cut.length === text.length ? cut : `${cut}…`;
}
