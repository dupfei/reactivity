import { hasOwn, isArray, isFunction, isNative, isObject } from './index'

type EntryKey = string | symbol

interface Entry<T> {
  key: EntryKey
  value: T
  removed: boolean
  previous: Entry<T> | undefined
  next: Entry<T> | undefined
}

export class InternalSet<T> {
  private _entries: Record<EntryKey, Entry<T>> = Object.create(null)
  private _first: Entry<T> | undefined = undefined
  private _last: Entry<T> | undefined = undefined
  private _size = 0

  constructor(values?: T[]) {
    if (isArray(values)) {
      for (let i = 0; i < values.length; i++) {
        this.add(values[i])
      }
    }
  }

  private _getEntry(value: T): Entry<T> | undefined {
    const key = valueToKey(value)
    if (key !== 'F') {
      return this._entries[key]
    }
    // 对于不可扩展的对象采用遍历查找
    for (let entry = this._first; entry; entry = entry.next) {
      if (entry.value === value) return entry
    }
  }

  get size(): number {
    return this._size
  }

  add(value: T): this {
    if (!this._getEntry(value)) {
      const key = valueToKey(value, true)
      const previous = this._last
      const entry: Entry<T> = {
        key,
        value,
        removed: false,
        previous,
        next: undefined,
      }
      if (previous) {
        previous.next = entry
      }
      this._last = entry
      if (!this._first) {
        this._first = entry
      }
      if (key !== 'F') {
        this._entries[key] = entry
      }
      this._size++
    }
    return this
  }

  delete(value: T): boolean {
    const entry = this._getEntry(value)
    if (entry) {
      entry.removed = true
      delete this._entries[entry.key]
      const { previous, next } = entry
      if (previous) {
        previous.next = next
      }
      if (next) {
        next.previous = previous
      }
      if (this._first === entry) {
        this._first = next
      }
      if (this._last === entry) {
        this._last = previous
      }
      this._size--
    }
    return !!entry
  }

  has(value: T): boolean {
    return !!this._getEntry(value)
  }

  forEach(callback: (value: T) => void): void {
    for (
      let entry = this._first;
      entry;
      entry = entry ? entry.next : this._first
    ) {
      callback(entry.value)
      // 处理 forEach 过程中调用 delete 或 clear 的情况
      while (entry && entry.removed) {
        entry = entry.previous
      }
    }
  }

  clear(): void {
    for (let entry = this._first; entry; entry = entry.next) {
      entry.removed = true
      delete this._entries[entry.key]
      if (entry.previous) {
        entry.previous = entry.previous.next = undefined
      }
    }
    this._first = this._last = undefined
    this._size = 0
  }
}

const metadataKey = `InternalSetMetadata_${Math.random().toString(36).slice(2)}`
let uid = 0

function valueToKey(value: unknown, create?: boolean): EntryKey {
  if (isObject(value) || isFunction(value)) {
    if (!hasOwn(value, metadataKey)) {
      if (!Object.isExtensible(value)) return 'F'
      if (!create) return 'E'
      Object.defineProperty(value, metadataKey, {
        configurable: false,
        enumerable: false,
        value: `O${uid++}`,
        writable: false,
      })
    }
    return (value as any)[metadataKey]
  }
  switch (typeof value) {
    case 'string':
      return `S${value}`
    case 'symbol':
      return value
    default:
      return `P${value}`
  }
}

export const createSet: <T>(values?: T[]) => InternalSet<T> =
  // @ts-ignore
  isNative(Set)
    ? // @ts-ignore
      (values) => new Set(values) as InternalSet<T>
    : (values) => new InternalSet(values)
