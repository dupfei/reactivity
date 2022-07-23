import { createDep, ReactiveEffect, track, trigger } from './effect'
import { DEP_FLAG, READONLY_FLAG, REF_FLAG } from './flag'
import { Ref } from './ref'
import { def, isFunction, NOOP } from './utils/index'

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

export type ComputedRef<T = unknown> =
  | ReadonlyComputedRef<T>
  | WritableComputedRef<T>

export function computed<T>(getter: ComputedGetter<T>): ReadonlyComputedRef<T>
export function computed<T>(
  options: WritableComputedOptions<T>,
): WritableComputedRef<T>
export function computed<T>(
  getterOrOptions: ComputedGetter<T> | WritableComputedOptions<T>,
): ComputedRef<T> {
  let getter: ComputedGetter<T>
  let setter: ComputedSetter<T> | undefined
  if (isFunction(getterOrOptions)) {
    getter = getterOrOptions
  } else {
    getter = getterOrOptions.get
    setter = getterOrOptions.set
  }
  return createComputedRef(getter, setter)
}

function createComputedRef<T>(
  getter: ComputedGetter<T>,
  setter?: ComputedSetter<T>,
): ComputedRef<T> {
  const isReadonly = !setter
  if (isReadonly) {
    setter = __DEV__
      ? () => {
          console.warn('computed值是只读的')
        }
      : NOOP
  }

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
      setter!(newValue)
    },
  } as ComputedRef<T>
  def(computedRef, REF_FLAG, true)
  def(computedRef, DEP_FLAG, dep)
  if (isReadonly) {
    def(computedRef, READONLY_FLAG, true)
  }

  return computedRef
}
