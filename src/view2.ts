import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

import { Note } from "./util";
import { SignalListeners } from "./util/listeners";
import { get_tag_map } from "./tags";

export class StickyNoteView extends Gtk.TextView {
  static {
    GObject.registerClass({
      GTypeName: "StickyNoteView",
    }, this);
  }

  tag_map = get_tag_map();

  constructor() {
    super({
      wrap_mode: Gtk.WrapMode.WORD_CHAR,
    });

    this.add_css_class("card-text-view");
    this.register_tags();
  }

  private register_tags() {
    for (const tag of Object.values(this.tag_map)) {
      this.buffer.tag_table.add(tag);
    }
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
      note.connect("notify::tag-list", () => {
        this.update_tags();
      }),
    );

    this.update_content();
    this.update_tags();
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

  // TODO: track each tag and update it individually
  private update_tags() {
    if (!this.note) return;
    this.clear_tags();

    // first clear all current tags
    const start = this.buffer.get_start_iter();
    const end = this.buffer.get_end_iter();

    for (const tag of Object.values(this.tag_map)) {
      this.buffer.remove_tag(tag, start, end);
    }

    // then
    for (const tag of this.note.tags) {
      const start = this.buffer.get_iter_at_offset(tag.start);
      const end = this.buffer.get_iter_at_offset(tag.end);

      this.buffer.apply_tag_by_name(tag.name, start, end);
    }
  }

  private clear_tags() {
    const start = this.buffer.get_start_iter();
    const end = this.buffer.get_end_iter();

    for (const tag of Object.values(this.tag_map)) {
      this.buffer.remove_tag(tag, start, end);
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
