import { Dep, createDep } from './dep'
import { DebuggerOptions, ReactiveEffect, track, trigger } from './effect'
import {
  COMPUTED_FLAG,
  DEP_FLAG,
  DirtyLevels,
  READONLY_FLAG,
  REF_FLAG,
} from './flag'
import { Ref } from './ref'
import {
  NOOP,
  defineAccessorProperty,
  defineDataProperty,
  isFunction,
  sameValue,
} from './utils/index'
import { warn } from './utils/warn'

type ComputedGetter<T> = (oldValue?: T) => T
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
  const readonly = !setter
  if (readonly) {
    setter = __DEV__
      ? () => {
          warn('Computed value is readonly.')
        }
      : NOOP
  }

  let value: T
  let dep: Dep | null = null

  const effect = new ReactiveEffect(
    () => getter(value),
    () => {
      if (dep) {
        trigger(
          dep,
          DirtyLevels.ComputedValueMaybeDirty,
          __DEV__
            ? { type: 'set', target: computedRef, key: 'value' }
            : undefined,
        )
      }
    },
  )

  if (__DEV__ && debuggerOptions) {
    effect.onTrack = debuggerOptions.onTrack
    effect.onTrigger = debuggerOptions.onTrigger
  }

  const computedRef: ComputedRef<T> = {
    get value() {
      track(
        dep || (dep = createDep(() => (dep = null), computedRef)),
        __DEV__
          ? { type: 'get', target: computedRef, key: 'value' }
          : undefined,
      )
      if (effect.dirty && !sameValue(value, (value = effect.run())) && dep) {
        trigger(
          dep,
          DirtyLevels.ComputedValueDirty,
          __DEV__
            ? { type: 'set', target: computedRef, key: 'value' }
            : undefined,
        )
      }
      return value
    },
    set value(newValue) {
      setter!(newValue)
    },
  }
  defineDataProperty(computedRef, REF_FLAG, true)
  defineDataProperty(computedRef, COMPUTED_FLAG, true)
  defineAccessorProperty(computedRef, DEP_FLAG, () => dep)
  if (readonly) {
    defineDataProperty(computedRef, READONLY_FLAG, true)
  }

  effect.computed = computedRef

  return computedRef
}

export function isComputed<T>(
  ref: ComputedRef<T> | unknown,
): ref is ComputedRef<T> {
  return !!(ref && (ref as any)[COMPUTED_FLAG] === true)
}
