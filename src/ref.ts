import { createDep, Dep, track, trigger } from './effect'
import { DEP_FLAG, REF_FLAG, SHALLOW_FLAG } from './flag'
import { defineReactive } from './observer'
import { def, isArray } from './utils/index'

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

export function unref<T>(ref: Ref<T> | T): T {
  return isRef(ref) ? ref.value : ref
}

type CustomRefFactory<T> = (
  track: () => void,
  trigger: () => void,
) => {
  get: () => T
  set: (value: T) => void
}

export function customRef<T>(factory: CustomRefFactory<T>): Ref<T> {
  const dep = createDep()

  const { get, set } = factory(
    () => track(dep),
    () => trigger(dep),
  )

  const customRefImpl: Ref<T> = {
    get value() {
      return get()
    },
    set value(newValue) {
      set(newValue)
    },
  }
  def(customRefImpl, REF_FLAG, true)
  def(customRefImpl, DEP_FLAG, dep)

  return customRefImpl
}

type ToRef<T = unknown> = Ref<T>

export function toRef<T extends object, K extends keyof T>(
  object: T,
  key: K,
  defaultValue?: T[K],
): ToRef<T[K]> {
  const value = object[key]
  if (isRef(value)) {
    return value as ToRef<T[K]>
  }

  const objectRefImpl: ToRef<T[K]> = {
    get value() {
      const value = object[key]
      return value === undefined ? defaultValue! : value
    },
    set value(newValue) {
      object[key] = newValue
    },
  }
  def(objectRefImpl, REF_FLAG, true)

  return objectRefImpl
}

type ToRefs<T = unknown> = {
  [K in keyof T]: ToRef<T[K]>
}

export function toRefs<T extends object>(object: T): ToRefs<T> {
  const ret: any = isArray(object) ? new Array(object.length) : {}
  for (const key in object) {
    ret[key] = toRef(object, key)
  }
  return ret
}
