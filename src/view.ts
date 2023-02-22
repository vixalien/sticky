import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import Pango from "gi://Pango";

import { Style } from "./styleselector.js";

export interface Note {
  content: string;
  style: Style;
  tags: {
    name: string;
    start: number;
    end: number;
  }[];
  modified: Date;
}

export class StickyNoteView extends Gtk.TextView {
  bold_tag = Gtk.TextTag.new("bold");
  underline_tag = Gtk.TextTag.new("underline");
  italic_tag = Gtk.TextTag.new("italic");
  strikethrough_tag = Gtk.TextTag.new("strikethrough");

  actions = [
    ["bold", this.bold_tag, "<Ctrl>b"],
    ["underline", this.underline_tag, "<Ctrl>u"],
    ["italic", this.italic_tag, "<Ctrl>i"],
    ["strikethrough", this.strikethrough_tag, "<Ctrl>s"],
  ] as [string, Gtk.TextTag, string][];

  style: Style;
  _note: Note;

  get note() {
    return this.save();
  }

  set note(note: Note) {
    this._note = note;
    this.clear_tags();
    this.buffer.text = note.content;
    this.style = note.style;
    this.init_tags(note.tags);
  }

  constructor(
    note: Note,
  ) {
    super();

    this.buffer = new Gtk.TextBuffer();

    this.add_tags();
    this.style = note.style;
    this._note = this.note = note;

    this.buffer.connect("mark-set", (buffer, _loc, mark) => {
      if (mark == buffer.get_insert() || buffer.get_selection_bounds()[0]) {
        this.emit("selection-changed");
      }
    });
  }

  static {
    GObject.registerClass(
      {
        GTypeName: "StickyNoteView",
        Signals: {
          "tag-toggle": {
            param_types: [GObject.TYPE_STRING, GObject.TYPE_BOOLEAN],
          },
          "selection-changed": {},
        },
      },
      this,
    );
  }

  init_tags(tags: Note["tags"]) {
    for (const tag of tags) {
      const start = this.buffer.get_iter_at_offset(tag.start);
      const end = this.buffer.get_iter_at_offset(tag.end);
      this.buffer.apply_tag_by_name(tag.name, start, end);
    }
  }

  add_tags() {
    this.bold_tag.weight = Pango.Weight.BOLD;
    this.underline_tag.underline = Pango.Underline.SINGLE;
    this.italic_tag.style = Pango.Style.ITALIC;
    this.strikethrough_tag.strikethrough = true;

    this.buffer.tag_table.add(this.bold_tag);
    this.buffer.tag_table.add(this.underline_tag);
    this.buffer.tag_table.add(this.italic_tag);
    this.buffer.tag_table.add(this.strikethrough_tag);
  }

  has_tag(tag: Gtk.TextTag) {
    let [selection, start, end] = this.buffer.get_selection_bounds();
    if (!selection) {
      start = this.buffer.get_iter_at_mark(
        this.buffer.get_insert(),
      );
      end = start.copy();
    }

    do {
      if (start.has_tag(tag)) {
        return true;
      }
      start.forward_char();
    } while (start.compare(end) < 0);

    return false;
  }

  apply_tag(tag: Gtk.TextTag) {
    let [selection, start, end] = this.buffer.get_selection_bounds();
    // if no selection, apply to the current word
    if (!selection) {
      const iter = this.buffer.get_iter_at_mark(
        this.buffer.get_insert(),
      );
      start = iter.copy();
      end = iter.copy();
      start.backward_word_start();
      end.forward_word_end();
      this.buffer.select_range(start, end);
    }

    const has_tag = this.has_tag(tag);

    if (this.has_tag(tag)) {
      this.buffer.remove_tag(tag, start, end);
    } else {
      this.buffer.apply_tag(tag, start, end);
    }

    this.emit("tag-toggle", tag.name, has_tag);
  }

  clear_tags() {
    const start = this.buffer.get_start_iter();
    const end = this.buffer.get_end_iter();

    for (const [name, tag] of this.actions) {
      this.buffer.remove_tag(tag, start, end);
      this.emit("tag-toggle", name, false);
    }
  }

  save(): Note {
    const start = this.buffer.get_start_iter();
    const end = this.buffer.get_end_iter();
    const content = this.buffer.get_text(start, end, false);

    const tags: Note["tags"] = [];

    const init_tags: Gtk.TextTag[] = [];

    this.buffer.get_tag_table().foreach((tag) => init_tags.push(tag));

    do {
      const current = start.copy();

      for (const tag of init_tags) {
        if (current.starts_tag(tag)) {
          const tag_end = current.copy();
          tag_end.forward_to_tag_toggle(tag);
          tags.push({
            name: tag.name,
            start: current.get_offset(),
            end: tag_end.get_offset(),
          });
        }
      }

      start.forward_char();
    } while (start.compare(end) < 0);

    return {
      content,
      style: this.style,
      tags,
      modified: new Date(),
    };
  }
}
