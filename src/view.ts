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

import { find } from "linkifyjs";

import { ITag, Note } from "./util.js";
import { style_manager } from "./themeselector.js";
import { Style } from "./util.js";

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
          "link-selected": {
            param_types: [GObject.TYPE_STRING],
          },
          "link-unselected": {},
        },
      },
      this,
    );
  }

  bold_tag = Gtk.TextTag.new("bold");
  underline_tag = Gtk.TextTag.new("underline");
  italic_tag = Gtk.TextTag.new("italic");
  strikethrough_tag = Gtk.TextTag.new("strikethrough");
  link_tag = Gtk.TextTag.new("link");

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

    this.update_link_tag_color();
    this.remove_listeners();
    this.init_listeners();
  }

  listeners = new Set<number>();

  init_listeners() {
    if (!this.note) return;

    this.listeners.add(this.note.connect("notify::style", () => {
      this.update_link_tag_color();
    }));
  }

  remove_listeners() {}

  constructor(
    note?: Note,
  ) {
    super();

    this.buffer = new Gtk.TextBuffer();

    this.register_tags();
    if (note) this.note = note;

    this.buffer.connect("mark-set", (_buffer, _loc, mark) => {
      if (!this.note) return;

      if (
        mark.name === "insert" || mark.name === "selection_bound" ||
        this.buffer.get_iter_at_mark(mark).equal(
          this.buffer.get_iter_at_mark(this.buffer.get_insert()),
        )
      ) {
        this.emit("selection-changed");
      }

      this.check_link_selected();
    });
  }

  last_link: number | false = false;
  last_link_end: number = 0;

  check_link_selected() {
    const has_link = this.has_tag(this.link_tag);

    if (has_link) {
      const start = this.buffer.get_iter_at_offset(has_link);

      if (!start.starts_tag(this.link_tag)) {
        start.backward_to_tag_toggle(this.link_tag);
      }

      const end = start.copy();
      end.forward_to_tag_toggle(this.link_tag);

      if (
        start.get_offset() !== this.last_link ||
        end.get_offset() !== this.last_link_end
      ) {
        const text = this.buffer.get_text(start, end, false)
          .replace(/\u200B/g, "");

        this.emit("link-selected", text);

        this.last_link = start.get_offset();
        this.last_link_end = end.get_offset();
      }
    } else if (has_link !== this.last_link) {
      this.emit("link-unselected");
      this.last_link = false;
    }
  }

  update_link_tag_color() {
    if (!this.note) return;
    let color;

    if (style_manager.dark) {
      const accent_color = this.get_style_context().lookup_color(
        "accent_fg_color",
      );
      if (accent_color[0]) {
        color = accent_color[1].to_string();
      } else {
        color = "#0000ff";
      }
    } else {
      const accent_color = this.get_style_context().lookup_color(
        `link_color_${Style[this.note.style]}`,
      );
      if (accent_color[0]) {
        color = accent_color[1].to_string();
      } else {
        color = "#0000ff";
      }
    }

    this.link_tag.foreground = color;
  }

  private register_tags() {
    this.bold_tag.weight = Pango.Weight.BOLD;
    this.underline_tag.underline = Pango.Underline.SINGLE;
    this.italic_tag.style = Pango.Style.ITALIC;
    this.strikethrough_tag.strikethrough = true;

    this.link_tag.underline = Pango.Underline.SINGLE;

    if (style_manager.system_supports_color_schemes) {
      style_manager.connect(
        "notify::dark",
        this.update_link_tag_color.bind(this),
      );
    }

    this.buffer.tag_table.add(this.bold_tag);
    this.buffer.tag_table.add(this.underline_tag);
    this.buffer.tag_table.add(this.italic_tag);
    this.buffer.tag_table.add(this.strikethrough_tag);
    this.buffer.tag_table.add(this.link_tag);
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
      if (start.has_tag(tag) !== false) {
        return start.get_offset();
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
      const get_cursor_position = () => this.buffer.cursor_position;

      this.buffer.insert_at_cursor("\u200B\u200B\u200B", 9);
      start = this.buffer.get_iter_at_offset(get_cursor_position() - 3);
      end = this.buffer.get_iter_at_offset(get_cursor_position() - 1);
      const selec = this.buffer.get_iter_at_offset(get_cursor_position());
      selec.backward_chars(2);
      this.buffer.place_cursor(selec);
    }

    const has_tag = this.has_tag(tag);

    if (this.has_tag(tag) !== false) {
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
    const tags: Note["tags"] = [];

    this.buffer.get_tag_table().foreach((tag) => {
      const start = this.buffer.get_start_iter();

      do {
        if (!start.starts_tag(tag)) continue;

        const begin = start.copy();
        start.forward_to_tag_toggle(tag);

        tags.push({
          name: tag.name,
          start: begin.get_offset(),
          end: start.get_offset(),
        });
      } while (start.forward_to_tag_toggle(tag));
    });

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

  constructor(note?: Note) {
    super(note);

    this.note = note;
    this.editable = false;
    this.cursor_visible = false;
    this.show_content();
  }

  set note(note: Note | undefined) {
    this._note = super.note = note;

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
    super.init_listeners();

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
    super.remove_listeners();

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
      this.update_links();
      if (this.buffer.text == this.note!.content) return;
      this.change("content", this.buffer.text);
    });

    this.buffer.connect("mark-set", () => {
      if (!this.note) return;

      const tags = this.get_tags();
      if (compare_tags(tags, this.note.tags)) return;
      this.note.tags = tags;
    });
  }

  clear_links() {
    this.buffer.remove_tag(
      this.link_tag,
      this.buffer.get_start_iter(),
      this.buffer.get_end_iter(),
    );
    this.emit("tag-toggle", "link", false);
  }

  update_links() {
    const text = this.buffer.text;

    this.clear_links();

    find(text)
      .forEach((match) => {
        const start = this.buffer.get_iter_at_offset(match.start);
        const end = this.buffer.get_iter_at_offset(match.end);

        this.buffer.apply_tag(this.link_tag, start, end);
      });

    this.emit("tag-toggle", "link", true);
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
