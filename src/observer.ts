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
  const writable = !descriptor || descriptor.writable !== false
  const nonWritable = (!setter && getter) || (!setter && !getter && !writable)
  if (!getter && val === NO_INITIAL_VALUE) {
    val = obj[key]
  }

  const dep = createDep()
  let needDeepObserve = !shallow
  let childOb: Observer | undefined

  Object.defineProperty(obj, key, {
    configurable: true,
    enumerable: true,
    get: function reactiveGetter() {
      if (getter) {
        val = getter.call(obj)
      }
      // 访问时进行深层响应式
      if (needDeepObserve) {
        needDeepObserve = false
        childOb = observe(val, false)
      }
      if (activeEffect) {
        track(dep)
        if (childOb) {
          track(childOb.dep)
          if (isArray(val)) {
            trackArray(val)
          }
        }
      }
      return isRef(val) && !shallow ? val.value : val
    },
    set: function reactiveSetter(newValue) {
      if (nonWritable) return
      if (val === NO_INITIAL_VALUE) {
        val = getter!.call(obj)
      }
      if (sameValue(newValue, val)) return
      if (setter) {
        setter.call(obj, newValue)
      } else if (
        !shallow &&
        !isReadonly(newValue) &&
        isRef(val) &&
        !isRef(newValue)
      ) {
        val.value = newValue
        return
      } else {
        val = newValue
      }
      needDeepObserve = !shallow
      trigger(dep)
    },
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
