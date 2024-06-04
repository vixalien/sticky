import GLib from "gi://GLib";
import Gio from "gi://Gio";
import GObject from "gi://GObject";

export type ActionEntry = {
  name: string;
  parameter_type?: string;
  state?: string;
  activate?: (
    _source: Gio.SimpleAction,
    parameter: GLib.Variant | null,
  ) => void;
  change_state?: (
    _source: Gio.SimpleAction,
    value: GLib.Variant | null,
  ) => void;
};

export type AddActionEntries = (entries: ActionEntry[]) => void;

export interface ActionDeclaration {
  name: string;
  parameter_type: GLib.VariantType<any> | null;
  state?: GLib.Variant<any> | null;
  activate?(action: Gio.SimpleAction, parameter: GLib.Variant<any>): void;
  bind_state_full?: [
    object: GObject.Object,
    property: string,
    transform: (
      binding: GObject.Binding,
      from_value: any,
    ) => [boolean, GLib.Variant],
  ];
  bind_enabled?: [
    object: GObject.Object,
    property: string,
  ];
}
