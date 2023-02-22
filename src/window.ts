/* MIT License
 *
 * Copyright (c) 2023 Chris Davis
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

type Style =
  | "accent"
  | "destructive"
  | "success"
  | "warning"
  | "error"
  | "window";

interface Note {
  content: string;
  style: Style;
}

import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import Adw from "gi://Adw";

export class Window extends Adw.ApplicationWindow {
  _container!: Gtk.Box;
  _text!: Gtk.TextView;

  buffer = new Gtk.TextBuffer();

  static {
    GObject.registerClass(
      {
        Template: "resource:///org/example/TypescriptTemplate/window.ui",
        GTypeName: "StickyNoteWindow",
        InternalChildren: ["container", "text"],
      },
      this,
    );
  }

  constructor(params?: Partial<Adw.ApplicationWindow.ConstructorProperties>) {
    super(params);

    this.set_style("warning");
  }

  set_style(style: Style) {
    for (const s of this.css_classes) {
      if (s.startsWith("style-")) {
        this._container.remove_css_class(s);
      }
    }

    this._container.add_css_class(`style-${style}`);
  }
}
