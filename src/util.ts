import Gio from "gi://Gio";

export interface Note {
  v: 1;
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
