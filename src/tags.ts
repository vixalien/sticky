import Gtk from "gi://Gtk?version=4.0";
import Pango from "gi://Pango";

export function get_tag_map() {
  return {
    bold: new Gtk.TextTag({
      name: "bold",
      weight: Pango.Weight.BOLD,
    }),
    underline: new Gtk.TextTag({
      name: "underline",
      underline: Pango.Underline.SINGLE,
    }),
    italic: new Gtk.TextTag({
      name: "italic",
      style: Pango.Style.ITALIC,
    }),
    strikethrough: new Gtk.TextTag({
      name: "strikethrough",
      strikethrough: true,
    }),
    link: new Gtk.TextTag({
      name: "link",
      underline: Pango.Underline.SINGLE,
    }),
  };
}
