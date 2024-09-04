/* MIT License
 *
 * Copyright (c) 2023 Angelo Verlain, Chris Davis
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * SPDX-License-Identifier: MIT
 */

// Adapted from https://github.com/sonnyp/troll/blob/63392a57392fb8ed944e859269a3751f649f64ec/src/widgets/ThemeSelector.js

import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";

import { Style, StyleNames, styles } from "./util/index.js";

class StyleButton extends Gtk.CheckButton {
  style: Style;

  constructor(style: Style, group?: Gtk.CheckButton) {
    const style_name = Style[style];
    const display_name = StyleNames.get(style)!;

    super({
      // focus_on_click: false,
      tooltip_text: _("Switch to %s style").format(display_name),
      width_request: 44,
      height_request: 44,
      hexpand: true,
      halign: Gtk.Align.CENTER,
      action_name: "style-selector.style",
      action_target: GLib.Variant.new_uint32(style),
    });

    if (group) this.set_group(group)

    this.style = style;

    this.add_css_class("styled");
    this.add_css_class(`style-${style_name}`);
  }

  static {
    GObject.registerClass({}, this);
  }
}

const props = {
  orientation: Gtk.Orientation.HORIZONTAL,
  spacing: 12,
  hexpand: true,
};

export class StyleSelector extends Gtk.Box {
  box1 = new Gtk.Box(props);
  box2 = new Gtk.Box(props);
  box = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 12,
  });

  private _style: Style;

  get style() {
    return this._style;
  }

  set style(value: Style) {
    if (this.style === value) return;

    this._style = value;
    this.notify("style");
  }

  constructor(params: { style?: Style } = {}) {
    super();

    this.box.append(this.box1);
    this.box.append(this.box2);

    this.append(this.box);

    this._style = params.style ?? Style.yellow;
    this.build_styles();
    this.hexpand = true;

    this.add_actions();
  }

  add_actions() {
    const action_group = Gio.SimpleActionGroup.new();

    const action = Gio.PropertyAction.new("style", this, "style");
    action_group.add_action(action);

    this.insert_action_group("style-selector", action_group);
  }

  build_styles() {
    let group: Gtk.CheckButton | undefined = undefined;

    styles.forEach((style, i) => {
      const button = new StyleButton(style, group);
      button.active = style === this.style;

      group ??= button;

      (i < 4 ? this.box1 : this.box2).append(button);
    });
  }

  static {
    GObject.registerClass({
      CssName: "styleselector",
      Properties: {
        style: GObject.param_spec_uint(
          "style",
          "style",
          "The style of this card",
          0,
          Style.accent,
          0,
          GObject.ParamFlags.READWRITE,
        ),
      },
    }, this);
  }
}

export function get_style_css_name(style: Style) {
  return `style-${Style[style]}`;
}
