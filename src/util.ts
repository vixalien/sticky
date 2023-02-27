import Adw from "gi://Adw";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";

export interface ITag {
  name: string;
  start: number;
  end: number;
}

export interface INote {
  v: 1;
  uuid: string;
  content: string;
  style: Style;
  tags: ITag[];
  modified: Date;
  width: number;
  height: number;
  open: boolean;
}

export enum Style {
  "yellow" = 1,
  "pink",
  "green",
  "purple",
  "blue",
  "gray",
  "charcoal",
  "window",
}

export const styles = Object.values(Style).filter(
  (style) => typeof style === "number",
) as Style[];

export const settings = new Gio.Settings({ schema_id: "com.vixalien.sticky" });

const get_settings = () => ({
  DEFAULT_STYLE: settings.get_enum("default-style") as Style,
  DEFAULT_WIDTH: settings.get_int("default-width"),
  DEFAULT_HEIGHT: settings.get_int("default-height"),
  CONFIRM_DELETE: settings.get_boolean("confirm-delete"),
});

export let SETTINGS = get_settings();

settings.connect("changed", () => {
  SETTINGS = get_settings();
});

export class Tag extends GObject.Object {
  static $gtype: GObject.GType<Tag>;

  name: string;
  start: number;
  end: number;

  constructor(name: string, start: number = 0, end: number = 0) {
    super();
    this.name = name;
    this.start = start;
    this.end = end;
  }

  static {
    GObject.registerClass({
      GTypeName: "TagObject",
      Properties: {
        // deno-fmt-ignore
        name: GObject.ParamSpec.string("name", "Name", "The name of the tag", GObject.ParamFlags.READWRITE, ""),
        // deno-fmt-ignore
        start: GObject.ParamSpec.int("start", "Start", "Starting position of the tag", GObject.ParamFlags.READWRITE, 0, 100, 0),
        // deno-fmt-ignore
        end: GObject.ParamSpec.int("end", "End", "Ending position of the tag", GObject.ParamFlags.READWRITE, 0, 100, 0),
      },
    }, this);
  }
}

export class Note extends GObject.Object {
  private static tag_list_pspec = GObject.ParamSpec.object(
    "tag_list",
    "Tags",
    "Tags of the note",
    GObject.ParamFlags.READWRITE,
    Gio.ListStore,
  );

  static $gtype: GObject.GType<Note>;

  v: 1;
  uuid: string;
  content: string;
  style: Style;
  tag_list: Gio.ListStore<Tag>;
  modified: GLib.DateTime;
  width: number;
  height: number;
  open: boolean;

  get tags() {
    const items = [];

    for (let i = 0; i < this.tag_list.get_n_items(); i++) {
      const tag = this.tag_list.get_item(i)!;
      items.push({
        name: tag.name,
        start: tag.start,
        end: tag.end,
      });
    }

    return items;
  }

  set tags(tags: INote["tags"]) {
    this.tag_list.remove_all();

    for (const tag of tags) {
      const tag_object = new Tag(tag.name, tag.start, tag.end);
      this.tag_list.append(tag_object);
    }

    this.emit("notify::tag_list", Note.tag_list_pspec);
  }

  get modified_date() {
    return new Date(this.modified.to_unix() * 1000);
  }

  // anything the constructor of date accepts
  set modified_date(date: Date) {
    this.modified = GLib.DateTime.new_from_iso8601(
      new Date(date).toISOString(),
      null,
    );
  }

  constructor(note: INote) {
    super();
    this.v = note.v;
    this.uuid = note.uuid;
    this.content = note.content;
    this.style = note.style;
    this.tag_list = Gio.ListStore.new(Tag.$gtype) as Gio.ListStore<Tag>;
    this.tags = note.tags;
    this.modified = GLib.DateTime.new_from_iso8601(
      new Date(note.modified).toISOString(),
      null,
    );
    this.width = note.width;
    this.height = note.height;
    this.open = note.open ?? false;
  }

  static generate() {
    return new this({
      v: 1,
      uuid: GLib.uuid_string_random(),
      content: "",
      style: SETTINGS.DEFAULT_STYLE,
      tags: [],
      modified: new Date(),
      width: SETTINGS.DEFAULT_WIDTH,
      height: SETTINGS.DEFAULT_HEIGHT,
      open: false,
    });
  }

  copy() {
    return new Note({
      v: this.v,
      uuid: this.uuid,
      content: this.content,
      style: this.style,
      tags: this.tags.map((tag) => ({
        name: tag.name,
        start: tag.start,
        end: tag.end,
      })),
      modified: new Date(this.modified.to_unix() * 1000),
      width: this.width,
      height: this.height,
      open: this.open,
    });
  }

  toJSON(): INote {
    return {
      v: this.v,
      uuid: this.uuid,
      content: this.content,
      style: this.style,
      tags: this.tags,
      modified: this.modified_date,
      width: this.width,
      height: this.height,
      open: this.open,
    };
  }

  static {
    GObject.registerClass({
      GTypeName: "NoteObject",
      Properties: {
        // deno-fmt-ignore
        v: GObject.ParamSpec.int("v", "Version", "Version of the note", GObject.ParamFlags.READWRITE, 0, 100, 0),
        // deno-fmt-ignore
        uuid: GObject.ParamSpec.string("uuid", "UUID", "UUID of the note", GObject.ParamFlags.READWRITE, ""),
        // deno-fmt-ignore
        content: GObject.ParamSpec.string("content", "Content", "Content of the note", GObject.ParamFlags.READWRITE, ""),
        // deno-fmt-ignore
        style: GObject.ParamSpec.int("style", "Style", "Style of the note", GObject.ParamFlags.READWRITE, 0, 100, 0),
        // deno-fmt-ignore
        tag_list: this.tag_list_pspec,
        // // deno-fmt-ignore
        modified: GObject.ParamSpec.boxed("modified", "Modified", "Date the note was modified", GObject.ParamFlags.READWRITE, GLib.DateTime),
        // deno-fmt-ignore
        width: GObject.ParamSpec.int("width", "Width", "Width of the note", GObject.ParamFlags.READWRITE, 0, 100, 0),
        // deno-fmt-ignore
        height: GObject.ParamSpec.int("height", "Height", "Height of the note", GObject.ParamFlags.READWRITE, 0, 100, 0),
        // deno-fmt-ignore
        open: GObject.ParamSpec.boolean("open", "Open", "Whether the note was open when the application was closed", GObject.ParamFlags.READWRITE, false),
      },
    }, this);
  }
}

export const confirm_delete = (window: Gtk.Window, cb: () => void) => {
  if (SETTINGS.CONFIRM_DELETE) {
    const dialog = Adw.MessageDialog.new(
      window,
      "Are you sure you want to delete this note?",
      "This action cannot be undone. If you want to hide the note, you can close it instead.",
    );
    dialog.add_response("cancel", "Cancel");
    dialog.add_response("delete", "Delete");
    dialog.set_response_appearance(
      "delete",
      Adw.ResponseAppearance.DESTRUCTIVE,
    );
    dialog.set_default_response("cancel");
    dialog.set_close_response("cancel");
    dialog.connect("response", (_dialog, response) => {
      if (response === "delete") {
        cb();
      }
    });
    dialog.present();
  } else {
    cb();
  }
};

export const NotesDir = Gio.file_new_for_path(
  GLib.build_filenamev([GLib.get_user_data_dir(), pkg.name, "notes.json"]),
);

const decoder = new TextDecoder();

interface SavedNoteData {
  v: 1;
  notes: INote[];
  state: State;
}

interface LoadNotesReturn {
  notes: Note[];
  state: State;
}

export const load_notes: () => LoadNotesReturn = () => {
  const bogus_data: LoadNotesReturn = { state: { all_notes: true }, notes: [] };

  try {
    NotesDir.get_parent()!.make_directory_with_parents(null);
  } catch (e: unknown) {
    if (e instanceof GLib.Error) {
      if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS)) {
        console.error(`Failed to create directory ${e}`);
      }
    }
  }

  const file = NotesDir;
  try {
    const [success, contents] = file.load_contents(null);
    if (success) {
      const data = JSON.parse(decoder.decode(contents)) as SavedNoteData;
      if (data.v !== 1) {
        console.error(`Invalid notes version ${data.v}`);
        return bogus_data;
      }
      return {
        notes: data.notes.map((note) => new Note(note)),
        state: data.state,
      };
    } else {
      return bogus_data;
    }
  } catch (e: unknown) {
    if (e instanceof GLib.Error) {
      if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND)) {
        return bogus_data;
      } else {
        console.error(`Failed to load notes ${e}`);
        return bogus_data;
      }
    }
  }

  return bogus_data;
};

interface State {
  all_notes: boolean;
}

export const save_notes = (notes: Note[], state: State) => {
  try {
    NotesDir.get_parent()!.make_directory_with_parents(null);
  } catch (e: unknown) {
    if (e instanceof GLib.Error) {
      if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS)) {
        console.error(`Failed to create directory ${e}`);
      }
    }
  }

  const file = NotesDir;
  const contents = JSON.stringify(
    {
      v: 1,
      notes: notes.map((note) => note.toJSON()),
      state: state,
    } as SavedNoteData,
    null,
    2,
  );
  file.replace_contents(
    contents,
    null,
    false,
    Gio.FileCreateFlags.REPLACE_DESTINATION,
    null,
  );
};
