/** `list` with `item` added — or removed, when it is already there (multi-select chips). */
export function toggleItem<T>(list: readonly T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : list.concat([item]);
}
