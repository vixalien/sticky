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
  GLib.build_filenamev([GLib.get_user_data_dir(), pkg.name, "notes.json"]),
);

export const load_file = (file: Gio.File) => {
  try {
    NotesDir.get_parent()!.make_directory_with_parents(null);
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

  return file.load_contents_async(null)
    .then(([contents]) => {
      try {
        return JSON.parse(decoder.decode(contents));
      } catch (e: unknown) {
        throw new StickyError(
          StickyErrorType.FILE_CORRUPTED,
          "Failed to parse notes",
        );
      }
    }).catch((e: unknown) => {
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
    });
};

export const save_file = (file: Gio.File, data: any) => {
  const string = JSON.stringify(data, null, 2);
  // const etag = GLib.compute_checksum_for_string(
  //   GLib.ChecksumType.MD5,
  //   string,
  //   string.length,
  // );

  return file.replace_contents_async(
    encoder.encode(string),
    null,
    false,
    Gio.FileCreateFlags.NONE,
    null,
  ).catch(
    (e: unknown) => {
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
    },
  );
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

export const load_notes: () => Promise<LoadNotesReturn> = async () => {
  const bogus_data: LoadNotesReturn = { state: { all_notes: true }, notes: [] };

  return load_file(NotesDir)
    .then((notes) => {
      if (notes.v !== 1) {
        console.error(`Invalid notes version ${notes.v}`);
        return bogus_data;
      }
      return {
        notes: notes.notes.map((note: INote) => new Note(note)),
        state: notes.state,
      } as LoadNotesReturn;
    }).catch((e: unknown) => {
      if (e instanceof StickyError) {
        if (e.type === StickyErrorType.FILE_NOT_FOUND) {
          return bogus_data;
        } else {
          console.error(e.message);
          return bogus_data;
        }
      } else {
        console.error("Failed to load notes");
        return bogus_data;
      }
    });
};

export const save_notes = (notes: Note[], state: State) => {
  ensure_dir(NotesDir.get_parent()!);

  return save_file(NotesDir, {
    v: 1,
    notes: notes.map((note) => note.toJSON()),
    state: state,
  } as SavedNoteData);
};
