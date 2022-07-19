import { activeEffect, createDep, Dep, track, trigger } from './effect'
import { DEP_FLAG, REF_FLAG, SHALLOW_FLAG } from './flag'
import { observe, Observer, trackArray } from './observer'
import { def, isArray, sameValue } from './utils/index'

export interface Ref<T = unknown> {
  value: T
}

export function ref<T>(value: T): Ref<T> {
  return createRef(value, false)
}

interface ShallowRef<T = unknown> extends Ref<T> {}

export function shallowRef<T>(value: T): ShallowRef<T> {
  return createRef(value, true)
}

function createRef<T>(value: T, shallow: boolean): Ref<T> | ShallowRef<T> {
  if (isRef(value)) {
    return value as Ref<T> | ShallowRef<T>
  }

  const dep = createDep()
  let needDeepObserve = !shallow
  let childOb: Observer | undefined

  const refImpl = {
    get value(): T {
      // 访问时进行深层响应式
      if (needDeepObserve) {
        needDeepObserve = false
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
      return isRef(value) && !shallow ? (value.value as T) : value
    },
    set value(newValue: T) {
      if (!sameValue(newValue, value)) {
        if (isRef(value) && !isRef(newValue)) {
          value.value = newValue
          return
        }
        value = newValue
        needDeepObserve = !shallow
        trigger(dep)
      }
    },
  } as Ref<T> | ShallowRef<T>
  def(refImpl, REF_FLAG, true)
  def(refImpl, DEP_FLAG, dep)
  if (shallow) {
    def(refImpl, SHALLOW_FLAG, true)
  }

  return refImpl
}

export function isRef<T>(value: Ref<T> | unknown): value is Ref<T> {
  return !!(value && (value as any)[REF_FLAG] === true)
}

export function triggerRef(ref: ShallowRef): void {
  if (ref && (ref as any)[DEP_FLAG]) {
    trigger((ref as any)[DEP_FLAG] as Dep)
  }
}

export function unref<T>(ref: T | Ref<T>): T {
  return isRef(ref) ? ref.value : ref
}
