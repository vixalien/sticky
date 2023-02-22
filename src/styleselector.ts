// Adapted from https://github.com/sonnyp/troll/blob/63392a57392fb8ed944e859269a3751f649f64ec/src/widgets/ThemeSelector.js

import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import Adw from "gi://Adw";
import Gdk from "gi://Gdk?version=4.0";

let provider: Gtk.CssProvider | null = null;

const capitalize = (str: string) => str[0].toUpperCase() + str.slice(1);

class StyleButton extends Gtk.CheckButton {
  style: string;

  constructor(style: string, group?: Gtk.CheckButton) {
    super({
      // focus_on_click: false,
      tooltip_text: `Switch to ${capitalize(style)} style`,
      width_request: 44,
      height_request: 44,
      hexpand: true,
      halign: Gtk.Align.CENTER,
    });

    if (group) {
      this.set_group(group);
    }

    this.style = style;

    this.set_css_classes([
      ...this.css_classes,
      `style-selector`,
      `style-${style}`,
    ]);
  }

  static {
    GObject.registerClass({
      // CssName: "stylebutton",
    }, this);
  }
}

export const styles = [
  "accent",
  "destructive",
  "success",
  "warning",
  "error",
  "window",
] as const;

export type Style = typeof styles[number];

export class StyleSelector extends Gtk.Box {
  box = new Gtk.FlowBox({
    orientation: Gtk.Orientation.HORIZONTAL,
    max_children_per_line: 3,
    min_children_per_line: 3,
    row_spacing: 12,
    column_spacing: 12,
    selection_mode: Gtk.SelectionMode.NONE,
    hexpand: true,
  });

  _style: Style = "window";

  get style() {
    return this._style;
  }

  set style(style: Style) {
    if (this._style === style) {
      return;
    }

    this._style = style;
    this.notify("style");
    this.emit("style-changed", style);

    this.set_selected_style(style);
  }

  constructor(params: { style?: Style } = {}) {
    super();

    this.append(this.box);
    this.build_styles();
    this.style = params.style ?? "window";
    this.hexpand = true;

    if (!provider) {
      provider = new Gtk.CssProvider();
      provider.load_from_resource(
        "/org/example/TypescriptTemplate/style-selector.css",
      );
      Gtk.StyleContext.add_provider_for_display(
        Gdk.Display.get_default()!,
        provider,
        Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION,
      );
    }
  }

  build_styles() {
    let group: Gtk.CheckButton | undefined = undefined;

    styles.forEach((style) => {
      const button = new StyleButton(style, group);
      button.connect("toggled", () => {
        if (button.active) {
          this.style = style;
        }
      });
      if (!group) {
        group = button;
      }
      this.box.append(button);
    });
  }

  private set_selected_style(style: Style) {
    let child = this.box.get_first_child();

    while (child) {
      const button = child as StyleButton;
      button.active = button.style === style;
      child = child.get_next_sibling();
    }
  }

  static {
    // StyleSelector.set_layout_manager_type(Gtk.BinLayout.$gtype);

    GObject.registerClass({
      CssName: "styleselector",
      Properties: {
        style: GObject.ParamSpec.string(
          "style",
          "Style",
          "The current style",
          GObject.ParamFlags.READWRITE,
          "window",
        ),
      },
      Signals: {
        "style-changed": {
          param_types: [GObject.TYPE_STRING],
        },
      },
    }, this);
  }
}
