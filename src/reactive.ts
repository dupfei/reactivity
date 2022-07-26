import {
  OBSERVER_FLAG,
  RAW_FLAG,
  READONLY_FLAG,
  REF_FLAG,
  SHALLOW_FLAG,
  SKIP_FLAG,
} from './flag'
import { observe, Observer } from './observer'
import { isRef, Ref } from './ref'
import { def, isPlainObject, NOOP } from './utils/index'

export function reactive<T extends object>(target: T): T {
  makeReactive(target, false)
  return target
}

export function shallowReactive<T extends object>(target: T): T {
  makeReactive(target, true)
  return target
}

function makeReactive<T extends object>(target: T, shallow: boolean): void {
  if (isReadonly(target)) return
  if (__DEV__) {
    const existingOb: Observer | undefined =
      target && (target as any)[OBSERVER_FLAG]
    if (existingOb && existingOb.shallow !== shallow) {
      console.warn(
        `当前值已经是${
          existingOb.shallow ? 'shallowReactive' : 'reactive'
        }，不能更改为${shallow ? 'shallowReactive' : 'reactive'}`,
      )
    }
  }
  const ob = observe(target, shallow)
  if (__DEV__ && !ob) {
    console.warn('当前类型的值不能被转换为响应式')
  }
}

type Primitive = string | number | boolean | undefined | null | symbol | bigint
type Builtin = Primitive | Function | Date | Error | RegExp
type DeepReadonly<T> = T extends Builtin
  ? T
  : T extends Ref<infer U>
  ? Readonly<Ref<DeepReadonly<U>>>
  : T extends {}
  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : Readonly<T>

export function readonly<T extends object>(target: T): DeepReadonly<T> {
  return createReadonly(target, false) as DeepReadonly<T>
}

export function shallowReadonly<T extends object>(target: T): Readonly<T> {
  return createReadonly(target, true) as Readonly<T>
}

const RAW_TO_READONLY_FLAG = '$$__rawToReadonly__$$'
const RAW_TO_SHALLOW_READONLY_FLAG = '$$__rawToShallowReadonly__$$'

function createReadonly<T extends object>(
  target: T,
  shallow: boolean,
): DeepReadonly<T> | Readonly<T> {
  if (!isPlainObject(target)) {
    if (__DEV__) {
      console.warn('Target cannot be made readonly', target)
    }
    return target
  }
  if (isReadonly(target)) {
    if (__DEV__) {
      const targetIsShallowReadonly = isShallow(target)
      if (targetIsShallowReadonly !== shallow) {
        console.warn(
          `Target is already a ${
            targetIsShallowReadonly ? 'shallowReadonly' : 'readonly'
          } object, and cannot be converted to ${
            shallow ? 'shallowReadonly' : 'readonly'
          }`,
        )
      }
    }
    return target
  }

  const proxyFlag = shallow
    ? RAW_TO_SHALLOW_READONLY_FLAG
    : RAW_TO_READONLY_FLAG
  const existingProxy = target[proxyFlag]
  if (existingProxy) {
    return existingProxy as DeepReadonly<T> | Readonly<T>
  }

  const proxy = Object.create(Object.getPrototypeOf(target))
  def(target, proxyFlag, proxy)
  def(proxy, READONLY_FLAG, true)
  def(proxy, RAW_FLAG, target)
  if (isRef(target)) {
    def(proxy, REF_FLAG, true)
  }
  if (shallow || isShallow(target)) {
    def(proxy, SHALLOW_FLAG, true)
  }

  const keys = Object.keys(target)
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    Object.defineProperty(proxy, key, {
      configurable: true,
      enumerable: true,
      get() {
        let value = target[key]
        if (shallow) return value
        if (isRef(value)) {
          value = value.value
        }
        return isPlainObject(value) ? readonly(value) : value
      },
      set: __DEV__
        ? () => {
            console.warn(
              `Set operation on key "${key}" failed: target is readonly`,
            )
          }
        : NOOP,
    })
  }

  return proxy
}

export function isReactive(value: unknown): boolean {
  if (isReadonly(value)) {
    return isReactive((value as any)[RAW_FLAG])
  }
  return !!(value && (value as any)[OBSERVER_FLAG])
}

export function isReadonly(value: unknown): boolean {
  return !!(value && (value as any)[READONLY_FLAG] === true)
}

export function isProxy(value: unknown): boolean {
  return isReactive(value) || isReadonly(value)
}

export function isShallow(value: unknown): boolean {
  return !!(value && (value as any)[SHALLOW_FLAG] === true)
}

export function toRaw<T>(proxy: T): T {
  const raw = proxy && (proxy as any)[RAW_FLAG]
  return raw ? toRaw(raw) : proxy
}

export function markRaw<T extends object>(value: T): T {
  def(value, SKIP_FLAG, true)
  return value
}
