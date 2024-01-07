export const NOOP = (): void => {}

export const EMPTY_OBJECT = {}

export const UNINITIALIZED_VALUE = {}

export const isNative = (val: unknown): boolean =>
  typeof val === 'function' && /native code/.test(val.toString())

export const isFunction = (val: unknown): val is Function =>
  typeof val === 'function'

export const isObject = (val: unknown): val is object =>
  typeof val === 'object' && val !== null

export const isArray = Array.isArray

const { defineProperty } = Object

export const {
  create: objectCreate,
  isExtensible: objectIsExtensible,
  keys: objectKeys,
} = Object

const toString = Object.prototype.toString
export const isPlainObject = (
  val: unknown,
): val is Record<PropertyKey, unknown> =>
  toString.call(val) === '[object Object]'

const hasOwnProperty = Object.prototype.hasOwnProperty
export const hasOwn: <O extends object = object>(
  obj: O,
  key: PropertyKey,
) => key is keyof O = isNative(
  // @ts-ignore
  Object.hasOwn,
)
  ? // @ts-ignore
    Object.hasOwn
  : (obj, key) => hasOwnProperty.call(obj, key)

export function remove<T>(arr: T[], el: T): void {
  if (arr.length < 1) return
  if (arr[arr.length - 1] === el) {
    arr.length = arr.length - 1
    return
  }
  const index = arr.indexOf(el)
  if (index > -1) {
    arr.splice(index, 1)
  }
}

export function defineDataProperty(
  obj: object,
  key: PropertyKey,
  value: PropertyDescriptor['value'],
  writable = false,
  enumerable = false,
): void {
  defineProperty(obj, key, {
    configurable: true,
    enumerable,
    value,
    writable,
  })
}

export function defineAccessorProperty(
  obj: object,
  key: PropertyKey,
  getter: PropertyDescriptor['get'],
  setter?: PropertyDescriptor['set'],
  enumerable = false,
): void {
  defineProperty(obj, key, {
    configurable: true,
    enumerable,
    get: getter,
    set: setter,
  })
}

const sameValueZero = (x: unknown, y: unknown): boolean =>
  x === y || (x !== x && y !== y)

export const sameValue: (x: unknown, y: unknown) => boolean = isNative(
  // @ts-ignore
  Object.is,
)
  ? // @ts-ignore
    Object.is
  : (x, y) =>
      x === y ? x !== 0 || 1 / x === 1 / (y as number) : x !== x && y !== y

export const setPrototypeOf: (obj: object, proto: object) => void = (() => {
  // @ts-ignore
  if (isNative(Object.setPrototypeOf)) return Object.setPrototypeOf
  if ('__proto__' in {}) {
    return (obj, proto) => {
      ;(obj as any).__proto__ = proto
    }
  }
  return (obj, proto) => {
    const keys = Object.getOwnPropertyNames(proto)
    for (let i = 0, len = keys.length; i < len; i++) {
      const key = keys[i]
      defineDataProperty(obj, key, (proto as any)[key])
    }
  }
})()

export const includes: <T>(arr: T[], el: T, fromIndex?: number) => boolean =
  (() => {
    // @ts-ignore
    if (isNative(Array.prototype.includes)) {
      // @ts-ignore
      return (arr, el, fromIndex) => arr.includes(el, fromIndex)
    }
    return (arr, el, fromIndex) => {
      const len = arr.length
      if (len < 1) return false
      // 如果 fromIndex 是 undefined，这一步会处理成 0
      const n = (fromIndex as number) | 0
      for (let k = Math.max(n >= 0 ? n : len + n, 0); k < len; k++) {
        if (sameValueZero(el, arr[k])) return true
      }
      return false
    }
  })()

export function isValidArrayIndex(val: unknown): val is number {
  const s = String(val)
  const n = parseInt(s, 10)
  return n >= 0 && isFinite(n) && String(n) === s
}
