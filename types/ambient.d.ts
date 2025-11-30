declare function _(
  id: string,
): string & { printf: (...reps: string[]) => string };

declare const pkg: {
  version: string;
  name: string;
};

declare module "gi://GObject?version=2.0" {
  namespace GObject {
    interface Object {
      bind_property_full(
        source_property: string,
        target: Object,
        target_property: string,
        flags: BindingFlags | null,
        transform_to: Closure | null,
        transform_from: Closure | null,
      ): Binding;
    }
  }
}

declare module "gi://Gtk?version=4.0" {
  namespace Gtk {
    interface TextCharPredicate {
      (ch: string): boolean;
    }
  }
}
