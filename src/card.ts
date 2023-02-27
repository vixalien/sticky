import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import GLib from "gi://GLib";

import { confirm_delete, Note, Style } from "./util.js";
import { ReadonlyStickyNote } from "./view.js";

export class StickyNoteCard extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "StickyNoteCard",
      Template: "resource:///com/vixalien/sticky/card.ui",
      InternalChildren: ["modified_label", "view_image", "delete_button"],
      Properties: {
        uuid: GObject.ParamSpec.string(
          "uuid",
          "UUID",
          "The UUID of the note",
          GObject.ParamFlags.READABLE,
          "",
        ),
      },
      Signals: {
        deleted: {},
      },
    }, this);
  }

  _modified_label!: Gtk.Label;
  _view_image!: Gtk.Image;
  _delete_button!: Gtk.Button;

  private _note?: Note;
  view: ReadonlyStickyNote;

  set show_visible_image(visible: boolean) {
    this._view_image.visible = visible;
  }

  constructor(public window: Gtk.Window, note?: Note) {
    super();

    this.view = new ReadonlyStickyNote(note);
    this.view.set_css_classes([...this.view.css_classes, "card-text-view"]);
    this.view.wrap_mode = Gtk.WrapMode.WORD_CHAR;

    this.append(this.view);

    this._delete_button.connect("clicked", this.delete.bind(this));

    if (note) this._note = this.note = note;
  }

  set note(note: Note) {
    if (note?.style !== this._note?.style) this.set_style(note.style);

    this._note = this.view.note = note

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

  delete() {
    if (!this._note) return;
    confirm_delete(this.window, () => {
      this.emit("deleted");
    });
  }
}
