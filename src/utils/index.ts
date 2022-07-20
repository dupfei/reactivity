export const NOOP = () => {}

export const isNative = (val: unknown): boolean =>
  typeof val === 'function' && /native code/.test(val.toString())

export const isFunction = (val: unknown): val is Function =>
  typeof val === 'function'

export const isObject = (val: unknown): val is object =>
  val !== null && typeof val === 'object'

export const isArray = Array.isArray

const toString = Object.prototype.toString

export const isPlainObject = (
  val: unknown,
): val is Record<PropertyKey, unknown> =>
  toString.call(val) === '[object Object]'

const hasOwnProperty = Object.prototype.hasOwnProperty
export const hasOwn = (
  obj: object,
  key: PropertyKey,
): key is keyof typeof obj => hasOwnProperty.call(obj, key)

export function remove<T>(arr: T[], el: T): void {
  if (arr.length < 1) return
  const index = arr.indexOf(el)
  if (index > -1) {
    arr.splice(index, 1)
  }
}

export function def(obj: object, key: PropertyKey, value: unknown): void {
  Object.defineProperty(obj, key, {
    configurable: true,
    enumerable: false,
    value,
    writable: true,
  })
}

const sameValueZero = (x: unknown, y: unknown) =>
  x === y || (x !== x && y !== y)

export const sameValue: (x: unknown, y: unknown) => boolean = (() => {
  // @ts-ignore
  if (isNative(Object.is)) return Object.is
  return (x: unknown, y: unknown): boolean => {
    if (x === y) {
      return x !== 0 || 1 / x === 1 / (y as number)
    }
    return x !== x && y !== y
  }
})()

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
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      def(obj, key, (proto as any)[key])
    }
  }
})()

export const includes: <T>(arr: T[], el: T, fromIndex?: number) => boolean =
  (() => {
    // @ts-ignore
    if (isNative(Array.prototype.includes)) {
      // @ts-ignore
      const arrayIncludes = Array.prototype.includes
      return (arr, el, fromIndex = 0) => arrayIncludes.call(arr, el, fromIndex)
    }
    return (arr, el, fromIndex = 0) => {
      const len = arr.length
      if (len < 1) return false
      const n = fromIndex | 0
      let k = Math.max(n >= 0 ? n : len + n, 0)
      while (k < len) {
        if (sameValueZero(el, arr[k++])) return true
      }
      return false
    }
  })()
