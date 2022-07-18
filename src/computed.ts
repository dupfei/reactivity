import { createDep, ReactiveEffect, track, trigger } from './effect'
import { DEP_FLAG, READONLY_FLAG, REF_FLAG } from './flag'
import { Ref } from './ref'
import { def, isFunction } from './utils'

type ComputedGetter<T> = () => T
type ComputedSetter<T> = (newValue: T) => void

interface WritableComputedOptions<T> {
  get: ComputedGetter<T>
  set: ComputedSetter<T>
}

interface WritableComputedRef<T> extends Ref<T> {}

interface ReadonlyComputedRef<T> extends WritableComputedRef<T> {
  readonly value: T
}

type ComputedRef<T = unknown> = ReadonlyComputedRef<T> | WritableComputedRef<T>

const defaultSetter = () => {
  console.warn('Write operation failed: computed value is readonly')
}

export function computed<T>(getter: ComputedGetter<T>): ReadonlyComputedRef<T>
export function computed<T>(
  options: WritableComputedOptions<T>,
): WritableComputedRef<T>
export function computed<T>(
  getterOrOptions: ComputedGetter<T> | WritableComputedOptions<T>,
): ComputedRef<T> {
  let getter: ComputedGetter<T>
  let setter: ComputedSetter<T>
  const onlyGetter = isFunction(getterOrOptions)
  if (onlyGetter) {
    getter = getterOrOptions
    setter = defaultSetter
  } else {
    getter = getterOrOptions.get
    setter = getterOrOptions.set || defaultSetter
  }
  return createComputedRef(getter, setter, onlyGetter)
}

function createComputedRef<T>(
  getter: ComputedGetter<T>,
  setter: ComputedSetter<T>,
  isReadonly: boolean,
): ComputedRef<T> {
  let value: T
  let dirty = true
  const dep = createDep()

  const effect = new ReactiveEffect(getter, () => {
    if (!dirty) {
      dirty = true
      trigger(dep)
    }
  })
  effect.computed = true

  const computedRef = {
    get value(): T {
      track(dep)
      if (dirty) {
        dirty = false
        value = effect.run()
      }
      return value
    },
    set value(newValue: T) {
      setter(newValue)
    },
  } as ComputedRef<T>
  def(computedRef, REF_FLAG, true)
  def(computedRef, DEP_FLAG, dep)
  def(computedRef, READONLY_FLAG, isReadonly)

  return computedRef
}
