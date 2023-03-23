import Gio from "gi://Gio";
import GLib from "gi://GLib";

import { StickyError, StickyErrorType } from "./errors.js";
import { INote, Note } from "./util.js";

Gio._promisify(
  Gio.File.prototype,
  "load_contents_async",
  "load_contents_finish",
);

Gio._promisify(
  Gio.File.prototype,
  "replace_contents_async",
  "replace_contents_finish",
);

const decoder = new TextDecoder();
const encoder = new TextEncoder();

interface SavedNoteData {
  v: 1;
  notes: INote[];
  state: State;
}

interface LoadNotesReturn {
  notes: Note[];
  state: State;
}

interface State {
  all_notes: boolean;
}

export const NotesDir = Gio.file_new_for_path(
  GLib.build_filenamev([GLib.get_user_data_dir(), pkg.name]),
);

export const NewNotesDir = Gio.file_new_for_path(
  GLib.build_filenamev([GLib.get_user_data_dir(), pkg.name, "notes"]),
);

export const Notes = Gio.file_new_for_path(
  GLib.build_filenamev([NotesDir.get_path()!, "notes.json"]),
);

export const load_file = (file: Gio.File) => {
  try {
    Notes.get_parent()!.make_directory_with_parents(null);
  } catch (e: unknown) {
    if (e instanceof GLib.Error) {
      if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS)) {
        throw new StickyError(
          StickyErrorType.NO_PERMISSION,
          "Failed to create notes directory",
        );
      }
    }
  }

  try {
    const [_, contents] = file.load_contents(null);

    try {
      return JSON.parse(decoder.decode(contents));
    } catch (e: unknown) {
      throw new StickyError(
        StickyErrorType.FILE_CORRUPTED,
        "Failed to parse notes",
      );
    }
  } catch (e) {
    if (e instanceof GLib.Error) {
      if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND)) {
        throw new StickyError(
          StickyErrorType.FILE_NOT_FOUND,
          "Failed to load notes",
        );
      } else {
        throw new StickyError(
          StickyErrorType.UNKNOWN,
          "Failed to load notes",
        );
      }
    }
  }
};

export const save_file = (file: Gio.File, data: any) => {
  const string = JSON.stringify(data, null, 2);
  // const etag = GLib.compute_checksum_for_string(
  //   GLib.ChecksumType.MD5,
  //   string,
  //   string.length,
  // );

  try {
    return file.replace_contents(
      encoder.encode(string),
      null,
      true,
      Gio.FileCreateFlags.NONE,
      null,
    );
  } catch (e) {
    if (e instanceof GLib.Error) {
      if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.PERMISSION_DENIED)) {
        throw new StickyError(
          StickyErrorType.NO_PERMISSION,
          "Failed to save notes",
        );
      } else {
        throw new StickyError(
          StickyErrorType.UNKNOWN,
          "Failed to save notes",
        );
      }
    }
  }
};

export const ensure_dir = (dir: Gio.File) => {
  try {
    dir.make_directory_with_parents(null);
  } catch (e: unknown) {
    if (e instanceof GLib.Error) {
      if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS)) {
        throw new StickyError(
          StickyErrorType.NO_PERMISSION,
          "Failed to create notes directory",
        );
      }
    }
  }
};

const bogus_data: LoadNotesReturn = { state: { all_notes: true }, notes: [] };

const load_notes_v1 = (notes: any) => {
  if (notes.v !== 1) {
    console.error(`Invalid notes version ${notes.v}`);
    return bogus_data;
  }
  return {
    notes: notes.notes.map((note: INote) => new Note(note)),
    state: notes.state,
  } as LoadNotesReturn;
};

export function load_notes() {
  let index = null;

  try {
    index = load_file(Notes) ?? null;
  } catch (e) {
    if (e instanceof StickyError) {
      if (
        e.type == StickyErrorType.FILE_NOT_FOUND ||
        e.type == StickyErrorType.FILE_CORRUPTED
      ) {
        // ignore
      } else {
        throw e;
      }
    }
  }

  if (index !== null) {
    // if the index exists, load the notes from the index
    const notes = load_notes_v1(index).notes;
    Notes.delete(null);
    save_notes(notes);
    return notes;
  }

  ensure_dir(NewNotesDir);

  const files = list_files(NewNotesDir);

  return files
    .filter((file) => file.get_basename()!.endsWith(".json"))
    .map((file) => load_file(file))
    .map((note) => new Note(note));
}

export const list_files = (dir: Gio.File) => {
  const enumerator = dir.enumerate_children(
    "standard::name,standard::type",
    Gio.FileQueryInfoFlags.NONE,
    null,
  );

  const files: Gio.File[] = [];

  let info: Gio.FileInfo | null;

  while ((info = enumerator.next_file(null)) !== null) {
    const file = enumerator.get_child(info);
    files.push(file);
  }

  return files;
};

export function save_notes(notes: Note[]) {
  ensure_dir(NewNotesDir);

  const files = list_files(NewNotesDir);

  let writes: [Note, Gio.File][] = [];
  const deletes: Gio.File[] = [];

  for (const file of files) {
    const basename = file.get_basename()!;

    if (basename.endsWith(".json")) {
      const uuid = basename.slice(0, -5);

      if (uuid.length !== 36) {
        deletes.push(file);
        continue;
      }

      const note = notes.find((note) => note.uuid === uuid);
      if (note) {
        writes.push([note, file]);
      } else {
        deletes.push(file);
      }
    } else {
      // deletes.push(file);
    }
  }

  for (const note of notes) {
    if (!writes.some(([n]) => n.uuid === note.uuid)) {
      const file = NewNotesDir.get_child(`${note.uuid}.json`);
      writes.push([note, file]);
    }
  }

  for (const file of deletes) {
    file.delete(null);
  }

  return writes.map(([note, file]) => save_file(file, note));
}

export function save_note(note: Note) {
  const file = NewNotesDir.get_child(`${note.uuid}.json`);

  return save_file(file, note);
}

export function delete_note(uuid: string) {
  const file = NewNotesDir.get_child(`${uuid}.json`);

  try {
    return file.delete(null);
  } catch {}
}
