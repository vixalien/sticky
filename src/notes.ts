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

import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import Adw from "gi://Adw";
import Gio from "gi://Gio";

import type { Application } from "./application.js";
import { StickyNoteCard } from "./card.js";
import { Note, settings } from "./util/index.js";

import { ThemeSelector } from "./themeselector.js";

export class StickyAllNotesWindow extends Adw.ApplicationWindow {
  static {
    GObject.registerClass(
      {
        Template: "resource:///com/vixalien/sticky/ui/notes.ui",
        GTypeName: "StickyAllNotesWindow",
        InternalChildren: [
          "search",
          "notes_box",
          "no_notes",
          "no_results",
          "search_entry",
          "scrolled",
          "menu_button",
          "stack",
        ],
      },
      this,
    );
  }

  private _search!: Gtk.Box;
  private _search_entry!: Gtk.SearchEntry;
  private _notes_box!: Gtk.ListView;
  private _no_notes!: Adw.StatusPage;
  private _no_results!: Adw.StatusPage;
  private _scrolled!: Gtk.ScrolledWindow;
  private _menu_button!: Gtk.MenuButton;
  private _stack!: Gtk.Stack;

  private old_query = "";

  private last_model: Gtk.SelectionModel<Note>;
  private sorter: Gtk.Sorter;
  private filter = Gtk.CustomFilter.new((note) => {
    const query = this.query;
    const content = (note as Note).content.toLowerCase();
    if (!query.replace(/\s/g, "")) return true;
    return content.includes(query);
  });

  get query() {
    return this._search_entry.text.toLowerCase();
  }

  constructor(
    params: Partial<Gtk.Window.ConstructorProperties>,
  ) {
    super(params);

    settings.bind(
      "default-height",
      this,
      "default-height",
      Gio.SettingsBindFlags.DEFAULT,
    );

    settings.bind(
      "default-width",
      this,
      "default-width",
      Gio.SettingsBindFlags.DEFAULT,
    );

    // make it transparent
    this._notes_box.remove_css_class("view");

    const factory = new Gtk.SignalListItemFactory();
    factory.connect("setup", this.setup_cb.bind(this));
    factory.connect("bind", this.bind_cb.bind(this));
    factory.connect("unbind", this.unbind_cb.bind(this));

    const filter_model = Gtk.FilterListModel.new(
      (this.application as Application).notes,
      this.filter,
    );

    this.sorter = Gtk.CustomSorter.new((note1, note2) => {
      const date1 = (note1 as Note).modified;
      const date2 = (note2 as Note).modified;
      return date2.compare(date1);
    });

    const sorted_model = Gtk.SortListModel.new(filter_model, this.sorter);

    this.last_model = Gtk.SingleSelection.new(
      sorted_model,
    ) as Gtk.SingleSelection<Note>;

    // @ts-expect-error incorrect types
    this.last_model.bind_property_full(
      "n-items",
      this._stack,
      "visible-child",
      GObject.BindingFlags.SYNC_CREATE,
      (_, items: number) => {
        let child;
        if (items > 0) {
          child = this._notes_box;
        } else if (this.query) {
          child = this._no_results;
        } else {
          child = this._no_notes;
        }

        return [true, child];
      },
      null,
    );

    // @ts-expect-error incorrect types
    this.last_model.bind_property_full(
      "n-items",
      this._search,
      "visible",
      GObject.BindingFlags.SYNC_CREATE,
      (_, items: number) => {
        return [true, !!this.query || items > 0];
      },
      null,
    );

    this._notes_box.set_factory(factory);
    this._notes_box.set_model(this.last_model);

    // Popover menu theme switcher
    const popover = this._menu_button.get_popover() as Gtk.PopoverMenu;
    popover.add_child(new ThemeSelector(), "themeswitcher");
  }

  private search_changed_cb() {
    const query = this.query.toLowerCase();
    const old_query = this.old_query.toLowerCase();

    if (query.includes(old_query)) {
      this.filter.emit("changed", Gtk.FilterChange.MORE_STRICT);
    } else if (old_query.includes(query)) {
      this.filter.emit("changed", Gtk.FilterChange.LESS_STRICT);
    } else {
      this.filter.emit("changed", Gtk.FilterChange.DIFFERENT);
    }

    this.old_query = query;
  }

  setup_cb(_factory: Gtk.ListItemFactory, list_item: Gtk.ListItem) {
    const card = new StickyNoteCard(this);

    list_item.set_child(card);
  }

  bind_cb(_factory: Gtk.ListItemFactory, list_item: Gtk.ListItem) {
    const card = list_item.get_child() as StickyNoteCard;
    const note = list_item.get_item() as Note;

    card.show_note(note);
  }

  unbind_cb(_factory: Gtk.ListItemFactory, _list_item: Gtk.ListItem) {
    const card = new StickyNoteCard(this);

    card.clear();
  }

  activate_cb(list: Gtk.ListView, position: number) {
    const note = list.model.get_item(position) as Note | undefined;
    if (!note) return;

    note.open = true;
  }
}
