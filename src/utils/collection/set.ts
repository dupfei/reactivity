import { isNative } from '../index'
import {
  Collection,
  Entry,
  EntryKey,
  // collectionClear,
  // collectionDelete,
  // collectionForEach,
  collectionHas,
  collectionInitialize,
  collectionSet,
} from './common'

export const createSet: <V = unknown>(entries?: V[]) => InternalSet<V> =
  isNative(
    // @ts-ignore
    Set,
  )
    ? (entries) =>
        // @ts-ignore
        new Set(entries)
    : (entries) => new InternalSet(entries)

class InternalSet<V = unknown> implements Collection<V, V> {
  _e!: Record<EntryKey, Entry<V, V>>
  _f?: Entry<V, V>
  _l?: Entry<V, V>
  _s!: number

  constructor(entries?: V[]) {
    collectionInitialize(this, false, entries)
  }

  /* get size(): number {
    return this._s
  } */

  has(value: V): boolean {
    return collectionHas(this, value)
  }

  add(value: V): this {
    collectionSet(this, value, value)
    return this
  }

  /* delete(value: V): boolean {
    return collectionDelete(this, value)
  } */

  /* forEach(callback: (value: V, key: V) => void): void {
    collectionForEach(this, callback)
  } */

  /* clear(): void {
    collectionClear(this)
  } */
}

export type { InternalSet }
