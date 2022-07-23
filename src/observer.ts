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
  const nonWritable = isAccessorProperty
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
    // 如果是非浅层 observe，访问时对属性值进行深层 observe
    // 存在 getter 时每次都要对返回值进行深层 observe
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
    // 每次修改都会触发原有的 setter
    if (setter) {
      setter.call(obj, newValue)
    }
    // 对于访问器属性，很难猜测 get 和 set 之间的联系，默认认为每次 set 的值改变后，get 的值也会改变
    // 关于首次 set，很难找到合适的值进行比对，默认认为是全新的值
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
    set: nonWritable ? undefined : reactiveSetter,
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
        'Only array or plain object can set reactive property',
        target,
      )
    }
  }
  if (isReadonly(target)) {
    if (__DEV__) {
      console.warn(
        `Set operation on key "${key as string}" failed: target is readonly`,
      )
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
  defineReactive(ob.value as Record<PropertyKey, T>, key, value, ob.shallow)
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
        'Only array or plain object can del reactive property',
        target,
      )
    }
  }
  if (isReadonly(target)) {
    if (__DEV__) {
      console.warn(
        `Del operation on key "${key as string}" failed: target is readonly`,
      )
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
