import GObject from "gi://GObject";
import Gio from "gi://Gio";

export type ListForeachCallback<Item extends GObject.Object> = (
  item: Item,
  index: number,
) => void | boolean;

export function list_foreach<
  Item extends GObject.Object,
>(list: Gio.ListModel<Item>, callback: ListForeachCallback<Item>) {
  let id = 0;

  while (id < list.get_n_items()) {
    if (callback(list.get_item(id)!, id)) break;
    id++;
  }
}

export type ListFindFn<Item extends GObject.Object> = (
  item1: Item,
) => boolean;

export type FindItemResult<Item extends GObject.Object> = [false, null] | [
  number,
  Item,
];

export function find_item<
  Item extends GObject.Object,
>(list: Gio.ListStore<Item>, fn: ListFindFn<Item>): FindItemResult<Item> {
  let i = 0;

  for (let i = 0; i < list.n_items; i++) {
    const item = list.get_item(i);

    if (item && fn(item)) return [i, item];
  }

  return [false, null];
}

export function list_model_to_array<T extends GObject.Object>(
  list: Gio.ListModel<T>,
) {
  const items: T[] = [];

  for (let i = 0; i < list.get_n_items(); i++) {
    const item = list.get_item(i);
    if (!item) continue;
    items.push(item);
  }

  return items;
}
