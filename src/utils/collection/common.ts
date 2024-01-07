import {
  defineDataProperty,
  hasOwn,
  isArray,
  objectCreate,
  objectIsExtensible,
} from '../index'
import { OBJECT_ID } from '../../flag'

export type EntryKey = string | symbol

export type Entry<K = unknown, V = unknown> = {
  /**
   * key
   */
  k: EntryKey
  /**
   * keyValue
   */
  kv: K
  /**
   * value
   */
  v: V
  /**
   * previous
   */
  p?: Entry<K, V>
  /**
   * next
   */
  n?: Entry<K, V>
  /**
   * removed
   */
  r?: boolean
}

export interface Collection<K = unknown, V = unknown> {
  /**
   * entries
   */
  _e: Record<EntryKey, Entry<K, V>>
  /**
   * first
   */
  _f?: Entry<K, V>
  /**
   * last
   */
  _l?: Entry<K, V>
  /**
   * size
   */
  _s: number
}

export function collectionInitialize<K = unknown, V = unknown>(
  instance: Collection<K, V>,
  isMap: boolean,
  entries?: [K, V][] | V[],
): void {
  instance._e = objectCreate(null)
  instance._f = instance._l = undefined
  instance._s = 0

  if (isArray(entries)) {
    for (let i = 0, len = entries.length; i < len; i++) {
      const entry = entries[i]
      collectionSet(
        instance,
        isMap ? (entry as [K, V])[0] : (entry as V),
        isMap ? (entry as [K, V])[1] : (entry as V),
      )
    }
  }
}

let objectUid = 0
function getEntryKey<K = unknown>(keyValue: K, create?: boolean): EntryKey {
  switch (typeof keyValue) {
    case 'object': {
      if (keyValue === null) break
    }
    // eslint-disable-next-line no-fallthrough
    case 'function': {
      // handle object or function
      if (!hasOwn(keyValue, OBJECT_ID)) {
        if (!objectIsExtensible(keyValue)) return 'F' // freeze or seal or preventExtensions object
        if (!create) return 'E' // empty
        defineDataProperty(keyValue, OBJECT_ID, `O${++objectUid}`)
      }
      return (keyValue as any)[OBJECT_ID] as string
    }

    case 'symbol': {
      return keyValue as symbol
    }
    case 'string': {
      return `S${keyValue}`
    }
  }

  return `P${keyValue}`
}

function getEntry<K = unknown, V = unknown>(
  instance: Collection<K, V>,
  keyValue: K,
): Entry<K, V> | undefined {
  const key = getEntryKey(keyValue)
  if (key === 'E') return
  if (key !== 'F') return instance._e[key]

  // look up entry for non-extensible object
  for (let entry = instance._f; entry; entry = entry.n) {
    if (entry.kv === keyValue) return entry
  }
}

export function collectionHas<K = unknown, V = unknown>(
  instance: Collection<K, V>,
  keyValue: K,
): boolean {
  return !!getEntry(instance, keyValue)
}

export function collectionGet<K = unknown, V = unknown>(
  instance: Collection<K, V>,
  keyValue: K,
): V | undefined {
  const entry = getEntry(instance, keyValue)
  return entry && entry.v
}

export function collectionSet<K = unknown, V = unknown>(
  instance: Collection<K, V>,
  keyValue: K,
  value: V,
): void {
  // both 0 and +0 and -0 use 0 as the key value
  if (keyValue === 0) (keyValue as number) = 0
  let entry = getEntry(instance, keyValue)
  if (entry) {
    entry.v = value
  } else {
    const key = getEntryKey(keyValue, true)
    const p = instance._l
    entry = { k: key, kv: keyValue, v: value, p, n: undefined }
    if (p) p.n = entry
    if (!instance._f) instance._f = entry
    instance._l = entry
    if (key !== 'F') instance._e[key] = entry
    instance._s++
  }
}

export function collectionDelete<K = unknown, V = unknown>(
  instance: Collection<K, V>,
  keyValue: K,
): boolean {
  const entry = getEntry(instance, keyValue)
  if (entry) {
    entry.r = true
    const { p, n } = entry
    if (p) p.n = n
    if (n) n.p = p
    if (instance._f === entry) instance._f = n
    if (instance._l === entry) instance._l = p
    delete instance._e[entry.k]
    instance._s--
  }
  return !!entry
}

export function collectionForEach<K = unknown, V = unknown>(
  instance: Collection<K, V>,
  callback: (value: V, key: K) => void,
): void {
  let entry: Entry<K, V> | undefined
  while ((entry = entry ? entry.n : instance._f)) {
    callback(entry.v, entry.kv)
    // handle calls either delete or clear in forEach callback
    while (entry && entry.r) entry = entry.p
  }
}

export function collectionClear<K = unknown, V = unknown>(
  instance: Collection<K, V>,
): void {
  for (let entry = instance._f; entry; entry = entry.n) {
    entry.r = true
    if (entry.p) entry.p = entry.p.n = undefined
    delete instance._e[entry.k]
  }
  instance._f = instance._l = undefined
  instance._s = 0
}
