import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import GLib from "gi://GLib";

import { Note, Style } from "./util.js";
import { StickyNoteView } from "./view.js";

export class StickyNoteCard extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "StickyNoteCard",
      Template: "resource:///com/vixalien/sticky/card.ui",
      InternalChildren: ["modified_label", "text_view", "menu_button"],
      Properties: {
        uuid: GObject.ParamSpec.string(
          "uuid",
          "UUID",
          "The UUID of the note",
          GObject.ParamFlags.READABLE,
          "",
        ),
      },
    }, this);
  }

  _modified_label!: Gtk.Label;
  _text_view!: Gtk.TextView;
  _menu_button!: Gtk.MenuButton;

  private _note: Note;
  view: StickyNoteView;

  constructor(note: Note) {
    super();

    this.view = new StickyNoteView(note);
    this._note = this.note = note;

    this._text_view.buffer = this.view.buffer;
  }

  clip_content(content: string) {
    const MAX_LINES = 5;
    const MAX_CHARS = 240;

    let cut = content.split("\n").slice(0, MAX_LINES).join("\n");

    if (cut.length > MAX_CHARS) {
      cut = cut.slice(0, MAX_CHARS);
    }

    return cut.length < content.length ? `${cut}…` : cut;
  }

  get note() {
    return this._note;
  }

  set note(note: Note) {
    this._note = this.view.note = {
      ...note,
      content: this.clip_content(note.content),
    };

    this.set_style(note.style);
    this.set_modified_label();
  }

  get uuid() {
    return this.note.uuid;
  }

  set_modified_label() {
    const modified = this.note.modified;

    const date = GLib.DateTime.new_from_unix_local(modified.getTime() / 1000);

    // if date is today, show time
    // otherwise, show date
    const format =
      GLib.DateTime.new_now_local().format("%F") === date.format("%F")
        ? "%R"
        : "%F";

    this._modified_label.label = date.format(format)!;
  }

  set_style(style: Style) {
    for (const s of this.get_css_classes()) {
      if (s.startsWith("style-") && s !== `style-specifity`) {
        this.remove_css_class(s);
      }
    }

    this.add_css_class(`style-${Style[style]}`);
  }
}
