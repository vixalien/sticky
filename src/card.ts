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
      InternalChildren: ["modified_label", "menu_button", "view_image"],
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
  _menu_button!: Gtk.MenuButton;
  _view_image!: Gtk.Image;

  private _note?: Note;
  view: StickyNoteView;

  set show_visible_image(visible: boolean) {
    this._view_image.visible = visible;
  }

  constructor(note?: Note) {
    super();

    this.view = new StickyNoteView(note, false);
    this.view.set_css_classes([...this.view.css_classes, "card-text-view"]);
    this.view.editable = false;
    this.view.cursor_visible = false;
    this.view.wrap_mode = Gtk.WrapMode.WORD_CHAR;

    this.append(this.view);

    if (note) this._note = this.note = note;
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

  set note(note: Note) {
    if (note?.style !== this._note?.style) this.set_style(note.style);

    const note2 = note.copy();
    note2.content = this.clip_content(note.content);

    this._note = this.view.note = note2;

    if (!this._note.content.replace(/\s/g, "")) {
      this.view.buffer.text = "";
      this.view.buffer.insert_markup(
        this.view.buffer.get_start_iter(),
        "<i>(Empty note)</i>",
        -1,
      );
    }

    this.set_modified_label();
  }

  get uuid() {
    return this._note?.uuid;
  }

  set_modified_label() {
    const modified = this._note?.modified?.to_local();

    if (!modified) return;

    // if date is today, show time
    // otherwise, show date
    const format =
      GLib.DateTime.new_now_local().format("%F") === modified.format("%F")
        ? "%R"
        : "%F";

    this._modified_label.label = modified.format(format)!;
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
