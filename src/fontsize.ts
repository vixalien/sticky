import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import Gdk from "gi://Gdk?version=4.0";

const font_sizes = [
  { size: 10, label: _("Small") },
  { size: 12, label: _("Normal") },
  { size: 14, label: _("Large") },
  { size: 16, label: _("X-Large") },
];

let provider: Gtk.CssProvider | null = null;

class FontSizeButton extends Gtk.Overlay {
  size: number;
  button: Gtk.ToggleButton;
  tick: Gtk.Image;

  constructor(size: number, label: string) {
    super({
      width_request: 50,
      height_request: 32,
      halign: Gtk.Align.CENTER,
      valign: Gtk.Align.CENTER,
    });

    this.button = new Gtk.ToggleButton({
      label,
      tooltip_text: `${label} (${size}pt)`,
      halign: Gtk.Align.FILL,
      valign: Gtk.Align.FILL,
      hexpand: true,
      vexpand: true,
    });
    this.button.add_css_class("font-size-button");
    this.add_css_class("font-size-item");

    this.tick = new Gtk.Image({
      icon_name: "object-select-symbolic",
      halign: Gtk.Align.END,
      valign: Gtk.Align.END,
      visible: false,
    });
    this.tick.add_css_class("font-size-tick");

    this.set_child(this.button);
    this.add_overlay(this.tick);

    this.size = size;

    this.button.connect("notify::active", () => {
      this.tick.visible = this.active;
      if (this.active) {
        this.add_css_class("selected");
        this.button.add_css_class("selected");
      } else {
        this.remove_css_class("selected");
        this.button.remove_css_class("selected");
      }
    });
  }

  get active() {
    return this.button.active;
  }

  set active(value: boolean) {
    this.button.active = value;
  }

  static {
    GObject.registerClass({}, this);
  }
}

export class FontSizeSelector extends Gtk.Box {
  private buttons: FontSizeButton[] = [];
  private current_size: number;
  private syncing = false;

  static {
    GObject.registerClass(
      {
        GTypeName: "FontSizeSelector",
        CssName: "fontsizeselector",
        Signals: {
          "font-size-changed": {
            param_types: [GObject.TYPE_INT],
          },
        },
      },
      this,
    );
  }

  constructor({ font_size, label_text, ...params }: { font_size: number; label_text?: string } & Partial<Gtk.Box.ConstructorProps>) {
    super({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 4,
      margin_top: 6,
      margin_bottom: 6,
      margin_start: 12,
      margin_end: 12,
      ...params,
    });

    this.current_size = font_size;

    if (label_text) {
      const label = new Gtk.Label({
        label: label_text,
        xalign: 0,
      });
      label.add_css_class("dim-label");
      label.add_css_class("caption");
      this.append(label);
    }

    const buttons_box = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 6,
    });

    font_sizes.forEach(({ size, label }) => {
      const button = new FontSizeButton(size, label);
      button.active = size === this.current_size;
      button.button.connect("toggled", () => {
        if (this.syncing) {
          return;
        }

        if (button.active) {
          if (size === this.current_size) {
            return;
          }

          this.syncing = true;
          this.buttons.forEach((other) => {
            if (other !== button) {
              other.active = false;
            }
          });
          this.syncing = false;

          this.current_size = size;
          this.emit("font-size-changed", size);
        } else if (!this.buttons.some((b) => b.active)) {
          // Keep one option selected at all times.
          this.syncing = true;
          button.active = true;
          this.syncing = false;
        }
      });
      this.buttons.push(button);
      buttons_box.append(button);
    });

    this.append(buttons_box);

    // Load CSS styling
    if (!provider) {
      provider = new Gtk.CssProvider();
      provider.load_from_resource("/com/vixalien/sticky/font-size-selector.css");
      Gtk.StyleContext.add_provider_for_display(
        Gdk.Display.get_default()!,
        provider,
        Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION,
      );
    }

    this.set_font_size(this.current_size);
  }

  set_font_size(size: number) {
    if (size === this.current_size && this.buttons.some((button) => button.active && button.size === size)) {
      return;
    }

    this.current_size = size;

    this.syncing = true;
    this.buttons.forEach((button) => {
      button.active = button.size === size;
    });
    this.syncing = false;
  }
}

