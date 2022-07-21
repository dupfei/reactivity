import { Dep, trigger } from './effect'
import { DEP_FLAG, REF_FLAG, SHALLOW_FLAG } from './flag'
import { defineReactive } from './observer'
import { def } from './utils/index'

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

  const refImpl = {} as Ref<T> | ShallowRef<T>
  const dep = defineReactive(refImpl as any, 'value', value, shallow)!
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
