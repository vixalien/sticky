import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import Adw from "gi://Adw";
import Gio from "gi://Gio";

import type { Application } from "./application.js";
import { StickyNoteCard } from "./card.js";
import { Note } from "./util.js";

export class StickyNotes extends Adw.ApplicationWindow {
  static {
    GObject.registerClass(
      {
        Template: "resource:///com/vixalien/sticky/notes.ui",
        GTypeName: "StickyNotes",
        InternalChildren: [
          "search",
          "notes_box",
          "no_notes",
          "no_results",
          "search_entry",
        ],
        Signals: {
          "note-activated": {
            param_types: [GObject.TYPE_STRING],
          },
          deleted: {
            param_types: [GObject.TYPE_STRING],
          },
        },
      },
      this,
    );
  }

  _search!: Gtk.Box;
  _search_entry!: Gtk.SearchEntry;
  _notes_box!: Gtk.ListView;
  _no_notes!: Adw.StatusPage;
  _no_results!: Adw.StatusPage;

  cards: StickyNoteCard[] = [];

  old_query = "";

  last_model: Gtk.SelectionModel<Note>;
  sorter: Gtk.Sorter;

  get query() {
    return this._search_entry.text.toLowerCase();
  }

  setup_cb(_factory: Gtk.ListItemFactory, list_item: Gtk.ListItem) {
    const card = new StickyNoteCard(this);

    list_item.set_child(card);
  }

  bind_cb(_factory: Gtk.ListItemFactory, list_item: Gtk.ListItem) {
    const card = list_item.get_child() as StickyNoteCard;
    const note = list_item.get_item() as Note;

    card.show_visible_image = note.open;
    card.connect("deleted", (_) => this.emit("deleted", note.uuid));

    card.note = note;

    note.connect("notify::modified", () => {
      card.update_modified_label();
      this.sorter.changed(Gtk.SorterChange.DIFFERENT);
    });

    note.connect("notify::open", (_) => {
      card.show_visible_image = note.open;
    });

    note.connect("notify::style", () => {
      card.set_style(note.style);
    })
  }

  unbind_cb(_factory: Gtk.ListItemFactory, list_item: Gtk.ListItem) {
    const card = new StickyNoteCard(this);

    card.view.remove_listeners();
  }

  activate_cb(list: Gtk.ListView, position: number) {
    const item = list.get_model()?.get_item(position) as Note | undefined;
    if (!item) return;
    this.emit("note-activated", item.uuid);
  }

  constructor(
    params: Partial<Gtk.Window.ConstructorProperties>,
  ) {
    super(params);

    const factory = new Gtk.SignalListItemFactory();
    factory.connect("setup", this.setup_cb.bind(this));
    factory.connect("bind", this.bind_cb.bind(this));
    factory.connect("unbind", this.unbind_cb.bind(this));

    const filter = Gtk.CustomFilter.new((note) => {
      const query = this.query;
      const content = (note as Note).content.toLowerCase();
      if (!query.replace(/\s/g, "")) return true;
      return content.includes(query);
    });

    const filter_model = Gtk.FilterListModel.new(
      (this.application as Application).notes_list,
      filter,
    );

    this.sorter = Gtk.CustomSorter.new((note1, note2) => {
      const date1 = (note1 as Note).modified;
      const date2 = (note2 as Note).modified;
      return date2.compare(date1);
    });

    const sorter_model = Gtk.SortListModel.new(filter_model, this.sorter);

    this.last_model = Gtk.SingleSelection.new(
      sorter_model,
    ) as Gtk.SingleSelection<Note>;

    this.last_model.connect("items-changed", () => {
      this.set_status();
    });

    this._notes_box.connect("activate", this.activate_cb.bind(this));

    this._notes_box.set_factory(factory);
    this._notes_box.set_model(this.last_model);

    this._search_entry.connect("search-changed", () => {
      const query = this.query.toLowerCase();
      const old_query = this.old_query.toLowerCase();

      if (query.includes(old_query)) {
        filter.emit("changed", Gtk.FilterChange.MORE_STRICT);
      } else if (old_query.includes(query)) {
        filter.emit("changed", Gtk.FilterChange.LESS_STRICT);
      } else {
        filter.emit("changed", Gtk.FilterChange.DIFFERENT);
      }

      this.old_query = query;
    });

    this.set_status();
  }

  set_status() {
    if (this.last_model.get_n_items() > 0) {
      this.set_visible_child("notes_box");
    } else {
      if (this.query) {
        this.set_visible_child("no_results");
      } else {
        this.set_visible_child("no_notes");
      }
    }
  }

  set_note_visible(uuid: string, visible: boolean) {
    const card = this.cards.find((card) => card.note.uuid === uuid);

    if (!card) return;

    card.show_visible_image = visible;
  }

  set_visible_child(child: "no_notes" | "no_results" | "notes_box") {
    this._no_notes.visible = child === "no_notes";
    this._no_results.visible = child === "no_results";
    this._notes_box.visible = child === "notes_box";
    this._search.visible = child === "notes_box" || child === "no_results";
  }
}
