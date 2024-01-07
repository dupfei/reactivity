import { observeArray, trackArrayItems } from './array'
import { Dep, createDep } from './dep'
import { activeEffect, track, trigger } from './effect'
import { OBSERVER_FLAG, SHALLOW_FLAG, SKIP_FLAG } from './flag'
import { isReadonly } from './reactive'
import { isRef } from './ref'
import {
  UNINITIALIZED_VALUE,
  defineAccessorProperty,
  defineDataProperty,
  hasOwn,
  isArray,
  isObject,
  isPlainObject,
  isValidArrayIndex,
  objectIsExtensible,
  objectKeys,
  sameValue,
} from './utils/index'
import { warn } from './utils/warn'

export function observe(
  value: unknown,
  shallow: boolean,
): Observer | undefined {
  if (!isObject(value) || isRef(value)) return
  if (
    hasOwn(value, OBSERVER_FLAG) &&
    (value as any)[OBSERVER_FLAG] instanceof Observer
  ) {
    return value[OBSERVER_FLAG] as Observer
  }
  if (
    (isArray(value) || isPlainObject(value)) &&
    objectIsExtensible(value) &&
    !(value as any)[SKIP_FLAG]
  ) {
    return new Observer(value, shallow)
  }
}

export class Observer<T = unknown> {
  dep: Dep | null = null

  constructor(
    public value: Record<PropertyKey, T> | T[],
    public shallow: boolean,
  ) {
    defineDataProperty(value, OBSERVER_FLAG, this)
    if (shallow) {
      defineDataProperty(value, SHALLOW_FLAG, true)
    }

    if (isArray(value)) {
      observeArray(value, shallow)
    } else {
      const keys = objectKeys(value)
      for (let i = 0, len = keys.length; i < len; i++) {
        defineReactive(value, keys[i], UNINITIALIZED_VALUE as T, shallow)
      }
    }
  }
}

export function defineReactive<T>(
  obj: object,
  key: PropertyKey,
  val: T,
  shallow: boolean,
): (() => Dep | null) | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(obj, key)
  if (descriptor && descriptor.configurable === false) return

  const getter = descriptor && descriptor.get
  const setter = descriptor && descriptor.set
  const isAccessorProperty = getter || setter
  const readonly = isAccessorProperty
    ? !setter
    : !!descriptor && descriptor.writable === false

  if (!isAccessorProperty && val === UNINITIALIZED_VALUE) {
    val = (obj as any)[key]
  }

  let dep: Dep | null = null
  let shouldObserveChild = true
  let childOb: Observer | undefined

  function reactiveGetter(): T {
    const value = isAccessorProperty
      ? getter
        ? getter.call(obj)
        : undefined
      : val
    // 非 shallow 时，
    // 直到访问属性值时才进行深层 observe，
    // 如果存在 getter，每次都要对返回值进行深层 observe
    if (!shallow && (shouldObserveChild || getter)) {
      shouldObserveChild = false
      childOb = observe(value, false)
    }
    if (activeEffect) {
      // track obj property
      track(
        dep || (dep = createDep(() => (dep = null))),
        __DEV__ ? { type: 'get', target: obj, key } : undefined,
      )
      if (childOb) {
        // track child object/array self
        track(
          childOb.dep ||
            (childOb.dep = createDep(
              (
                (ob) => () =>
                  (ob.dep = null)
              )(childOb),
            )),
        )
        if (isArray(value)) {
          // track array items
          trackArrayItems(value)
        }
      }
    }
    return !shallow && isRef(value) ? value.value : value
  }

  function reactiveSetter(newValue: T): void {
    // 访问器属性比较复杂，很难确定 getter 和 setter 之间的关系
    // 每次触发 setter 时都会调用 trigger，不管 getter 返回的值是否变化
    if (setter) {
      setter.call(obj, newValue)
      if (dep) {
        trigger(
          dep,
          undefined,
          __DEV__ ? { type: 'set', target: obj, key, newValue } : undefined,
        )
      }
      return
    }
    if (!sameValue(newValue, val)) {
      if (!shallow && isRef(val) && !isRef(newValue)) {
        // trigger ref.value
        val.value = newValue
      } else {
        const oldValue = val
        val = newValue
        shouldObserveChild = true
        if (dep) {
          trigger(
            dep,
            undefined,
            __DEV__
              ? { type: 'set', target: obj, key, newValue, oldValue }
              : undefined,
          )
        }
      }
    }
  }

  defineAccessorProperty(
    obj,
    key,
    reactiveGetter,
    readonly ? undefined : reactiveSetter,
    true,
  )

  return () => dep
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
  if (__DEV__ && !isArray(target) && !isPlainObject(target)) {
    warn('Only array or plain object can set reactive property.')
  }

  if (isReadonly(target)) {
    if (__DEV__) {
      warn('Target is readonly.')
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
    !(ob = (target as any)[OBSERVER_FLAG])
  ) {
    ;(target as any)[key] = value
    return
  }

  defineReactive(ob.value, key, value, ob.shallow)
  if (ob.dep) {
    trigger(
      ob.dep,
      undefined,
      __DEV__
        ? { type: 'add', target, key, newValue: value, oldValue: undefined }
        : undefined,
    )
  }
}

export function del<T>(array: T[], key: number): void
export function del<T>(object: Record<PropertyKey, T>, key: PropertyKey): void
export function del<T>(
  target: T[] | Record<PropertyKey, T>,
  key: PropertyKey,
): void {
  if (__DEV__ && !isArray(target) && !isPlainObject(target)) {
    warn('Only array or plain object can delete reactive property.')
  }

  if (isReadonly(target)) {
    if (__DEV__) {
      warn('Target is readonly.')
    }
    return
  }

  if (isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }

  if (!hasOwn(target, key)) return

  delete target[key]
  const ob: Observer | undefined = (target as any)[OBSERVER_FLAG]
  if (ob && ob.dep) {
    trigger(
      ob.dep,
      undefined,
      __DEV__ ? { type: 'delete', target, key } : undefined,
    )
  }
}
