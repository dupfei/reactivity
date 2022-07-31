import {
  createDep,
  DebuggerOptions,
  ReactiveEffect,
  track,
  trigger,
} from './effect'
import { COMPUTED_FLAG, DEP_FLAG, READONLY_FLAG, REF_FLAG } from './flag'
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

export function computed<T>(
  getter: ComputedGetter<T>,
  debuggerOptions?: DebuggerOptions,
): ReadonlyComputedRef<T>
export function computed<T>(
  options: WritableComputedOptions<T>,
  debuggerOptions?: DebuggerOptions,
): WritableComputedRef<T>
export function computed<T>(
  getterOrOptions: ComputedGetter<T> | WritableComputedOptions<T>,
  debuggerOptions?: DebuggerOptions,
): ComputedRef<T> {
  let getter: ComputedGetter<T>
  let setter: ComputedSetter<T> | undefined
  if (isFunction(getterOrOptions)) {
    getter = getterOrOptions
  } else {
    getter = getterOrOptions.get
    setter = getterOrOptions.set
  }
  return createComputedRef(
    getter,
    setter,
    __DEV__ ? debuggerOptions : undefined,
  )
}

function createComputedRef<T>(
  getter: ComputedGetter<T>,
  setter?: ComputedSetter<T>,
  debuggerOptions?: DebuggerOptions,
): ComputedRef<T> {
  const isReadonly = !setter
  if (isReadonly) {
    setter = __DEV__
      ? () => {
          console.warn('[Reactivity] Computed value is readonly.')
        }
      : NOOP
  }

  let value: T
  let dirty = true
  const dep = createDep()

  const effect = new ReactiveEffect(getter, () => {
    if (!dirty) {
      dirty = true
      trigger(
        dep,
        __DEV__
          ? { type: 'set', target: computedRef, key: 'value' }
          : undefined,
      )
    }
  })
  effect.computed = true

  if (__DEV__ && debuggerOptions) {
    effect.onTrack = debuggerOptions.onTrack
    effect.onTrigger = debuggerOptions.onTrigger
  }

  const computedRef: ComputedRef<T> = {
    get value() {
      track(
        dep,
        __DEV__
          ? { type: 'get', target: computedRef, key: 'value' }
          : undefined,
      )
      if (dirty) {
        dirty = false
        value = effect.run()
      }
      return value
    },
    set value(newValue) {
      setter!(newValue)
    },
  }
  def(computedRef, REF_FLAG, true)
  def(computedRef, COMPUTED_FLAG, true)
  def(computedRef, DEP_FLAG, dep)
  if (isReadonly) {
    def(computedRef, READONLY_FLAG, true)
  }

  return computedRef
}

export function isComputed<T>(
  ref: ComputedRef<T> | unknown,
): ref is ComputedRef<T> {
  return !!(ref && (ref as any)[COMPUTED_FLAG] === true)
}
