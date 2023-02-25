import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import Pango from "gi://Pango";
import GLib from "gi://GLib";

import { Note, SETTINGS, Style } from "./util.js";

export class StickyNoteView extends Gtk.TextView {
  bold_tag = Gtk.TextTag.new("bold");
  underline_tag = Gtk.TextTag.new("underline");
  italic_tag = Gtk.TextTag.new("italic");
  strikethrough_tag = Gtk.TextTag.new("strikethrough");

  actions = [
    ["bold", this.bold_tag],
    ["underline", this.underline_tag],
    ["italic", this.italic_tag],
    ["strikethrough", this.strikethrough_tag],
  ] as [string, Gtk.TextTag][];

  style: Style;
  _note?: Note;

  updating = false;

  set note(note: Note) {
    // console.log("setting note", note.content);

    // this.buffer.text = "Hello world!";

    this.updating = false;
    this._note = note;
    this.clear_tags();
    this.buffer.text = note.content;
    this.style = note.style;
    this.init_tags(note.tags);
  }

  constructor(
    note?: Note,
    editable = true,
  ) {
    super();

    this.buffer = new Gtk.TextBuffer();

    this.add_tags();
    this.style = note?.style ?? SETTINGS.DEFAULT_STYLE;
    if (note) this._note = this.note = note;

    this.buffer.connect("mark-set", (buffer, _loc, mark) => {
      if (mark == buffer.get_insert() || buffer.get_selection_bounds()[0]) {
        this.emit("selection-changed");
      }
    });

    if (editable) {
      this.buffer.connect("changed", () => {
        if (this.updating) {
          this.updating = false;
          return;
        }
        if (!this._note) return;
        this.emit("changed", this._note.uuid, "content");
      });
    }
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
          "changed": {
            param_types: [GObject.TYPE_STRING, GObject.TYPE_STRING],
          },
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
      end.forward_cursor_position();
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
      const start = this.buffer.get_iter_at_mark(
        this.buffer.get_insert(),
      );
      end = start.copy();
      end.forward_cursor_position();
    }

    const has_tag = this.has_tag(tag);

    if (this.has_tag(tag)) {
      this.buffer.remove_tag(tag, start, end);
    } else {
      this.buffer.apply_tag(tag, start, end);
    }

    this.emit("tag-toggle", tag.name, !has_tag);
    this.emit("changed", this.note.uuid, "tags");
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

    if (!this._note) {
      throw new Error("No note to save");
    }

    const note = this._note.copy();
    note.content = content;
    note.style = this.style, note.tags = tags;
    note.modified = GLib.DateTime.new_now_utc();

    return note;
  }
}
