import { isComputed } from './computed'
import {
  COMPUTED_FLAG,
  createFlag,
  OBSERVER_FLAG,
  RAW_FLAG,
  READONLY_FLAG,
  REF_FLAG,
  SHALLOW_FLAG,
  SKIP_FLAG,
} from './flag'
import { observe, Observer } from './observer'
import { isRef, Ref } from './ref'
import {
  defineAccessorProperty,
  defineDataProperty,
  isArray,
  isPlainObject,
  objectCreate,
  objectKeys,
} from './utils/index'
import { warn } from './utils/warn'

// TODO: unwrap ref type 完善
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
    if (isArray(target)) {
      warn(
        `Avoid using Array as root value for ${
          shallow ? 'shallowReactive()' : 'reactive()'
        } as it cannot be tracked in watch() or watchEffect(). Use ${
          shallow ? `shallowRef()` : `ref()`
        } instead.`,
      )
    }
    const existingOb: Observer | undefined =
      target && (target as any)[OBSERVER_FLAG]
    if (existingOb && existingOb.shallow !== shallow) {
      warn(
        `Target is already a ${
          existingOb.shallow ? 'shallowReactive' : 'reactive'
        } object, and cannot be converted to ${
          shallow ? 'shallowReactive' : 'reactive'
        }.`,
      )
    }
  }
  const ob = observe(target, shallow)
  if (__DEV__) {
    if (!ob) {
      warn('Target cannot be made reactive.')
    }
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

// TODO: unwrap ref type 完善
export function readonly<T extends object>(target: T): DeepReadonly<T> {
  return createReadonly(target, false) as DeepReadonly<T>
}

export function shallowReadonly<T extends object>(target: T): Readonly<T> {
  return createReadonly(target, true) as Readonly<T>
}

const RAW_TO_READONLY_FLAG = createFlag('rawToReadonly')
const RAW_TO_SHALLOW_READONLY_FLAG = createFlag('rawToShallowReadonly')

function createReadonly<T extends object>(
  target: T,
  shallow: boolean,
): DeepReadonly<T> | Readonly<T> {
  if (!isPlainObject(target)) {
    if (__DEV__) {
      warn('Target cannot be made readonly.')
    }
    return target
  }
  if (isReadonly(target)) {
    if (__DEV__) {
      const targetIsShallowReadonly = isShallow(target)
      if (targetIsShallowReadonly !== shallow) {
        warn(
          `Target is already a ${
            targetIsShallowReadonly ? 'shallowReadonly' : 'readonly'
          } object, and cannot be converted to ${
            shallow ? 'shallowReadonly' : 'readonly'
          }.`,
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

  const proxy = objectCreate(Object.getPrototypeOf(target))
  defineDataProperty(target, proxyFlag, proxy)
  defineDataProperty(proxy, READONLY_FLAG, true)
  defineDataProperty(proxy, RAW_FLAG, target)
  if (isRef(target)) {
    defineDataProperty(proxy, REF_FLAG, true)
  }
  if (isComputed(target)) {
    defineDataProperty(proxy, COMPUTED_FLAG, true)
  }
  if (shallow || isShallow(target)) {
    defineDataProperty(proxy, SHALLOW_FLAG, true)
  }

  const keys = objectKeys(target)
  for (let i = 0, len = keys.length; i < len; i++) {
    const key = keys[i]
    defineAccessorProperty(
      proxy,
      key,
      () => {
        let value = target[key]
        if (shallow) return value
        if (isRef(value)) {
          value = value.value
        }
        return isPlainObject(value) ? readonly(value) : value
      },
      __DEV__
        ? () => {
            warn('Target is readonly.')
          }
        : undefined,
    )
  }

  return proxy
}

type ReactiveObject<T extends object = object> = T & {
  [OBSERVER_FLAG]: Observer
}

export function isReactive(value: unknown): value is ReactiveObject<object> {
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
  defineDataProperty(value, SKIP_FLAG, true)
  return value
}
