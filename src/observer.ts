import { activeEffect, createDep, Dep, track, trigger } from './effect'
import { OBSERVER_FLAG, SHALLOW_FLAG, SKIP_FLAG } from './flag'
import { isReadonly } from './reactive'
import { isRef } from './ref'
import {
  def,
  hasOwn,
  isArray,
  isObject,
  isPlainObject,
  isValidArrayIndex,
  NOOP,
  sameValue,
  setPrototypeOf,
} from './utils/index'
import { createSet, InternalSet } from './utils/internalSet'

export function observe(value: unknown, shallow = false): Observer | undefined {
  if (!isObject(value) || isRef(value)) return
  if (
    hasOwn(value, OBSERVER_FLAG) &&
    (value as any)[OBSERVER_FLAG] instanceof Observer
  ) {
    return value[OBSERVER_FLAG]
  }
  if (
    (isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    (value as any)[SKIP_FLAG] !== true
  ) {
    return new Observer(value, shallow)
  }
}

const arrayProto = Array.prototype
const arrayMethods = Object.create(arrayProto)
const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse',
]
methodsToPatch.forEach((method) => {
  const original = (arrayProto as any)[method] as Function
  def(
    arrayMethods,
    method,
    function (
      this: unknown[] & { [OBSERVER_FLAG]: Observer },
      ...args: unknown[]
    ): unknown {
      const result = original.apply(this, args)
      const ob = this[OBSERVER_FLAG]
      if (!ob.shallow) {
        let inserted: unknown[] | undefined
        switch (method) {
          case 'push':
          case 'unshift':
            inserted = args
            break
          case 'splice':
            inserted = args.slice(2)
            break
        }
        if (inserted) {
          observeArray(inserted)
        }
      }
      trigger(ob.dep)
      return result
    },
  )
})

function observeArray(arr: unknown[]): void {
  for (let i = 0; i < arr.length; i++) {
    observe(arr[i], false)
  }
}

const NO_INITIAL_VALUE = {}

export class Observer {
  dep = createDep()

  constructor(
    public value: Record<PropertyKey, unknown> | unknown[],
    public shallow: boolean,
  ) {
    def(value, OBSERVER_FLAG, this)
    if (shallow) {
      def(value, SHALLOW_FLAG, true)
    }

    if (isArray(value)) {
      setPrototypeOf(value, arrayMethods)
      if (!shallow) {
        observeArray(value)
      }
    } else {
      const keys = Object.keys(value)
      for (let i = 0; i < keys.length; i++) {
        defineReactive(value, keys[i], NO_INITIAL_VALUE, shallow)
      }
    }
  }
}

export function defineReactive(
  obj: Record<PropertyKey, unknown>,
  key: keyof typeof obj,
  val: unknown,
  shallow: boolean,
): Dep | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(obj, key)
  if (descriptor && !descriptor.configurable) return

  const getter = descriptor && descriptor.get
  const setter = descriptor && descriptor.set
  const isAccessorProperty = getter || setter
  const isReadonly = isAccessorProperty
    ? !setter
    : !!descriptor && descriptor.writable === false

  if (!isAccessorProperty && val === NO_INITIAL_VALUE) {
    val = obj[key]
  }

  const dep = createDep()
  let shouldObserveChild = true
  let childOb: Observer | undefined

  function reactiveGetter(): unknown {
    const value = isAccessorProperty
      ? getter
        ? getter.call(obj)
        : undefined
      : val
    // 非 shallow 时，
    // 直到访问对属性值时才进行深层 observe，
    // 如果存在 getter，每次都要对返回值进行深层 observe
    if (!shallow && (shouldObserveChild || getter)) {
      shouldObserveChild = false
      childOb = observe(value, false)
    }
    if (activeEffect) {
      track(dep)
      if (childOb) {
        track(childOb.dep)
        if (isArray(value)) {
          trackArray(value)
        }
      }
    }
    return !shallow && isRef(value) ? value.value : value
  }

  function reactiveSetter(newValue: unknown): void {
    // 访问器属性的情况是复杂的，很难确定 getter 和 setter 之间的联系
    // 每次触发 setter 时都会调用 trigger，不管 getter 返回的值是否发生改变
    if (setter) {
      setter.call(obj, newValue)
      trigger(dep)
      return
    }
    if (!sameValue(newValue, val)) {
      if (!shallow && isRef(val) && !isRef(newValue)) {
        val.value = newValue
      } else {
        val = newValue
        shouldObserveChild = true
        trigger(dep)
      }
    }
  }

  Object.defineProperty(obj, key, {
    configurable: true,
    enumerable: true,
    get: reactiveGetter,
    set: isReadonly ? NOOP : reactiveSetter,
  })

  return dep
}

export function trackArray(arr: unknown[], seen?: InternalSet<unknown[]>) {
  seen = seen || createSet()
  if (seen.has(arr)) return
  seen.add(arr)
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i]
    if (item && (item as any)[OBSERVER_FLAG]) {
      track(((item as any)[OBSERVER_FLAG] as Observer).dep)
    }
    if (isArray(item)) {
      trackArray(item, seen)
    }
  }
}

export function set<T>(array: T[], index: number, value: T): void
export function set<T>(
  object: Record<PropertyKey, T>,
  key: PropertyKey,
  value: T,
): void
export function set<T>(
  target: T[] | Record<PropertyKey, T>,
  key: PropertyKey,
  value: T,
): void {
  if (__DEV__) {
    if (!isArray(target) && !isPlainObject(target)) {
      console.warn(
        '[Reactivity] Only array or plain object can set reactive property.',
      )
    }
  }
  if (isReadonly(target)) {
    if (__DEV__) {
      console.warn('[Reactivity] Target is readonly.')
    }
    return
  }
  if (isArray(target) && isValidArrayIndex(key)) {
    target.length = Math.max(target.length, key)
    target.splice(key, 1, value)
    return
  }
  let ob: Observer | undefined
  if (
    (key in target && !(key in Object.prototype)) ||
    !(ob = target[OBSERVER_FLAG as any] as any as Observer | undefined)
  ) {
    target[key as any] = value
    return
  }
  defineReactive(ob.value as any, key, value, ob.shallow)
  trigger(ob.dep)
}

export function del<T>(array: T[], key: number): void
export function del<T>(object: Record<PropertyKey, T>, key: PropertyKey): void
export function del<T>(
  target: T[] | Record<PropertyKey, T>,
  key: PropertyKey,
): void {
  if (__DEV__) {
    if (!isArray(target) && !isPlainObject(target)) {
      console.warn(
        '[Reactivity] Only array or plain object can delete reactive property.',
      )
    }
  }
  if (isReadonly(target)) {
    if (__DEV__) {
      console.warn('[Reactivity] Target is readonly.')
    }
    return
  }
  if (isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }
  if (!hasOwn(target, key)) return
  delete target[key]
  const ob = target[OBSERVER_FLAG as any] as any as Observer | undefined
  if (ob) {
    trigger(ob.dep)
  }
}
