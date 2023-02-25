import Gio from "gi://Gio";
import GLib from "gi://GLib";

export interface Note {
  v: 1;
  uuid: string;
  content: string;
  style: Style;
  tags: {
    name: string;
    start: number;
    end: number;
  }[];
  modified: Date;
  width: number;
  height: number;
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

export const styles = Object.values(Style) as Style[];

export const settings = new Gio.Settings({ schema_id: "com.vixalien.sticky" });

const get_settings = () => ({
  DEFAULT_STYLE: settings.get_enum("default-style") as Style,
  DEFAULT_WIDTH: settings.get_int("default-width"),
  DEFAULT_HEIGHT: settings.get_int("default-height"),
});

export let SETTINGS = get_settings();

settings.connect("changed", () => {
  SETTINGS = get_settings();
});

export const gen_new_note = (): Note => ({
  v: 1,
  uuid: GLib.uuid_string_random(),
  content: "",
  style: SETTINGS.DEFAULT_STYLE,
  tags: [],
  modified: new Date(),
  width: SETTINGS.DEFAULT_WIDTH,
  height: SETTINGS.DEFAULT_HEIGHT,
});
