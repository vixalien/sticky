import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import Adw from "gi://Adw";
import Gdk from "gi://Gdk?version=4.0";

export class ThemeSelector extends Gtk.Widget {
  static {
    GObject.registerClass(
      {
        GTypeName: "ThemeSelector",
        Template: "resource:///com/vixalien/sticky/ui/theme-selector.ui",
        CssName: "themeselector",
        InternalChildren: ["follow"],
        Properties: {
          theme: GObject.ParamSpec.string(
            "theme", // Name
            "Theme", // Nick
            "Theme", // Blurb
            GObject.ParamFlags.READWRITE,
            /// @ts-expect-error
            null, // Default value
          ),
        },
      },
      this,
    );

    this.set_layout_manager_type(Gtk.BinLayout.$gtype);
  }

  theme: string;

  declare _follow: Gtk.CheckButton;

  style_manager: Adw.StyleManager;

  constructor(params = {}) {
    super(params);

    this.style_manager = Adw.StyleManager.get_default();

    this.style_manager.connect(
      "notify::system-supports-color-schemes",
      this._on_notify_system_supports_color_schemes.bind(this),
    );
    this._on_notify_system_supports_color_schemes();

    const dark = this.style_manager.get_dark();
    this.theme = dark ? "dark" : "light";

    this.style_manager.connect("notify::dark", this._on_notify_dark.bind(this));
    this._on_notify_dark();

    const provider = new Gtk.CssProvider();
    provider.load_from_resource("/com/vixalien/sticky/theme-selector.css");
    Gtk.StyleContext.add_provider_for_display(
      Gdk.Display.get_default()!,
      provider,
      Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION,
    );
  }

  _on_notify_system_supports_color_schemes() {
    this._follow.set_visible(
      this.style_manager.get_system_supports_color_schemes(),
    );
  }

  _on_notify_dark() {
    if (this.style_manager.get_dark()) this.add_css_class("dark");
    else this.remove_css_class("dark");
  }
}
