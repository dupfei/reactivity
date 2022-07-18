export const NOOP = () => {}

export const isNative = (val: unknown): boolean =>
  typeof val === 'function' && /native code/.test(val.toString())

export const isFunction = (val: unknown): val is Function =>
  typeof val === 'function'

export const isObject = (val: unknown): val is object =>
  val !== null && typeof val === 'object'

export const isArray = Array.isArray

const hasOwnProperty = Object.prototype.hasOwnProperty
export const hasOwn = (
  obj: object,
  key: PropertyKey,
): key is keyof typeof obj => hasOwnProperty.call(obj, key)

export function remove<T>(arr: T[], el: T): void {
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
