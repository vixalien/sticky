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
import Gtk from "gi://Gtk?version=4.0";
import Pango from "gi://Pango";
import GLib from "gi://GLib";

import { save_note } from "./store.js";

import { ITag, Note } from "./util.js";

class AbstractStickyNote extends Gtk.TextView {
  static {
    GObject.registerClass(
      {
        GTypeName: "AbstractStickyNote",
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

  _note?: Note;

  get note() {
    return this._note;
  }

  set note(note: Note | undefined) {
    if (!note) return;

    this._note = note;
    this.clear_tags();
    this.buffer.text = note.content;
    this.init_tags(note.tags);
  }

  constructor(
    note?: Note,
  ) {
    super();

    this.buffer = new Gtk.TextBuffer();

    this.register_tags();
    if (note) this._note = this.note = note;

    this.buffer.connect("mark-set", (buffer, _loc, mark) => {
      if (mark.name === "insert" || mark.name === "selection_bound") {
        this.emit("selection-changed");
      }

      if (!this.note) return;
      const tags = this.get_tags();
      if (!compare_tags(tags, this.note.tags)) {
        this.note.tags = tags;
      }
    });
  }

  private register_tags() {
    this.bold_tag.weight = Pango.Weight.BOLD;
    this.underline_tag.underline = Pango.Underline.SINGLE;
    this.italic_tag.style = Pango.Style.ITALIC;
    this.strikethrough_tag.strikethrough = true;

    this.buffer.tag_table.add(this.bold_tag);
    this.buffer.tag_table.add(this.underline_tag);
    this.buffer.tag_table.add(this.italic_tag);
    this.buffer.tag_table.add(this.strikethrough_tag);
  }

  init_tags(tags: Note["tags"]) {
    for (const tag of tags) {
      const start = this.buffer.get_iter_at_offset(tag.start);
      const end = this.buffer.get_iter_at_offset(tag.end);
      this.buffer.apply_tag_by_name(tag.name, start, end);
    }
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
      /**
       * If the user has not selected anything, we insert zero-width spaces
       * around the cursor and mark them as the start and end of the selection.
       */
      const get_cursor = () =>
        this.buffer.get_iter_at_mark(
          this.buffer.get_insert(),
        );

      const get_cursor_position = () => this.buffer.cursor_position;

      this.buffer.insert_at_cursor("\u200B\u200B\u200B", 9);
      start = this.buffer.get_iter_at_offset(get_cursor_position() - 3);
      end = this.buffer.get_iter_at_offset(get_cursor_position() - 1);
      const selec = this.buffer.get_iter_at_offset(get_cursor_position());
      selec.backward_chars(2);
      this.buffer.place_cursor(selec);
    }

    const has_tag = this.has_tag(tag);

    if (this.has_tag(tag)) {
      this.buffer.remove_tag(tag, start, end);
    } else {
      this.buffer.apply_tag(tag, start, end);
    }

    this.emit("tag-toggle", tag.name, !has_tag);
  }

  clear_tags() {
    const start = this.buffer.get_start_iter();
    const end = this.buffer.get_end_iter();

    for (const [name, tag] of this.actions) {
      this.buffer.remove_tag(tag, start, end);
      this.emit("tag-toggle", name, false);
    }
  }

  get_tags() {
    const start = this.buffer.get_start_iter();
    const end = this.buffer.get_end_iter();

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

    return tags;
  }
}

export class ReadonlyStickyNote extends AbstractStickyNote {
  static {
    GObject.registerClass(
      {
        GTypeName: "ReadonlyStickyNote",
      },
      this,
    );
  }

  listeners = new Set<number>();

  constructor(note?: Note) {
    super(note);

    this.note = note;
    this.editable = false;
    this.cursor_visible = false;
    this.show_content();
  }

  set note(note: Note | undefined) {
    this._note = super.note = note;

    this.remove_listeners();
    this.init_listeners();
    this.show_content();
  }

  get note() {
    return super.note;
  }

  clip_content(content: string) {
    const MAX_LINES = 5;
    const MAX_CHARS = 240;

    content = content.replace(/\s+$/, "");

    let cut = content.split("\n").slice(0, MAX_LINES).join("\n");

    if (cut.length > MAX_CHARS) {
      cut = cut.slice(0, MAX_CHARS);
    }

    return cut.length < content.length ? `${cut}…` : cut;
  }

  show_content() {
    if (!this.note) return;

    if (!this.note.content.replace(/\s/g, "")) {
      this.buffer.text = "";
      this.buffer.insert_markup(
        this.buffer.get_start_iter(),
        `<i>(${_("Empty Note")})</i>`,
        -1,
      );
    } else {
      this.buffer.text = this.clip_content(this.note!.content);
      this.clear_tags();
      this.init_tags(this.note!.tags);
    }
  }

  init_listeners() {
    if (!this.note) return;

    this.listeners.add(this.note.connect("notify::content", () => {
      this.show_content();
    }));

    this.listeners.add(this.note.connect("notify::tag_list", () => {
      this.clear_tags();
      this.init_tags(this.note!.tags);
    }));
  }

  remove_listeners() {
    if (!this.note) return;

    for (const listener of this.listeners) {
      this.note!.disconnect(listener);
    }

    this.listeners.clear();
  }
}

export class WriteableStickyNote extends AbstractStickyNote {
  static {
    GObject.registerClass(
      {
        GTypeName: "WriteableStickyNote",
      },
      this,
    );
  }

  updating = false;
  source: number | null = null;

  get note() {
    return super.note;
  }

  set note(note: Note | undefined) {
    this.updating = true;
    super.note = note;
  }

  change<T extends keyof Note>(key: T, value: Note[T]) {
    if (!this.note) return;
    this.note[key] = value;
    this.note.modified_date = new Date();
  }

  constructor(note?: Note) {
    super(note);

    this.buffer.connect("changed", () => {
      if (this.updating) {
        this.updating = false;
        return;
      }
      if (this.buffer.text == this.note!.content) return;
      this.change("content", this.buffer.text);
    });
  }

  clear_tags() {
    super.clear_tags();
    // this.change("tags", []);
  }

  apply_tag(tag: Gtk.TextTag) {
    super.apply_tag(tag);
    const tags = this.get_tags();
    if (compare_tags(tags, this.note!.tags)) return;
    this.change("tags", tags);
  }
}

const compare_tags = (a: ITag[], b: ITag[]) => {
  if (a.length != b.length) return false;
  for (const tag of a) {
    if (
      !b.find((t) =>
        t.name == tag.name && t.start == tag.start && t.end == tag.end
      )
    ) {
      return false;
    }
  }
  return true;
};
