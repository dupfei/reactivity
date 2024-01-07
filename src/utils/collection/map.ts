import { isNative } from '../index'
import {
  Collection,
  Entry,
  EntryKey,
  // collectionClear,
  collectionDelete,
  collectionForEach,
  collectionGet,
  // collectionHas,
  collectionInitialize,
  collectionSet,
} from './common'

export const createMap: <K = unknown, V = unknown>(
  entries?: [K, V][],
) => InternalMap<K, V> = isNative(
  // @ts-ignore
  Map,
)
  ? (entries) =>
      // @ts-ignore
      new Map(entries)
  : (entries) => new InternalMap(entries)

class InternalMap<K = unknown, V = unknown> implements Collection<K, V> {
  _e!: Record<EntryKey, Entry<K, V>>
  _f?: Entry<K, V>
  _l?: Entry<K, V>
  _s!: number

  constructor(entries?: [K, V][]) {
    collectionInitialize(this, true, entries)
  }

  get size(): number {
    return this._s
  }

  /* has(key: K): boolean {
    return collectionHas(this, key)
  } */

  get(key: K): V | undefined {
    return collectionGet(this, key)
  }

  set(key: K, value: V): this {
    collectionSet(this, key, value)
    return this
  }

  delete(key: K): boolean {
    return collectionDelete(this, key)
  }

  forEach(callback: (value: V, key: K) => void): void {
    collectionForEach(this, callback)
  }

  /* clear(): void {
    collectionClear(this)
  } */
}

export type { InternalMap }
