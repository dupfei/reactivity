import { ComputedRef } from './computed'
import { createDep } from './dep'
import {
  DebuggerOptions,
  EffectScheduler,
  ReactiveEffect,
  track,
} from './effect'
import { activeEffectScope } from './effectScope'
import { OBSERVER_FLAG, SKIP_FLAG } from './flag'
import { Observer } from './observer'
import { isReactive, isShallow } from './reactive'
import { isRef, Ref } from './ref'
import { SchedulerJob, queueJob, queuePostFlushJob } from './scheduler'
import { createSet } from './utils/collection/index'
import {
  EMPTY_OBJECT,
  isArray,
  isFunction,
  isObject,
  isPlainObject,
  NOOP,
  remove,
  sameValue,
  UNINITIALIZED_VALUE,
} from './utils/index'
import { warn } from './utils/warn'

type WatchEffect = (onCleanup: OnCleanup) => void

type OnCleanup = (cleanup: () => void) => void

interface WatchEffectOptions extends DebuggerOptions {
  flush?: 'pre' | 'post' | 'sync'
}

type StopHandle = () => void

export function watchEffect(
  effect: WatchEffect,
  { flush, onTrack, onTrigger }: WatchEffectOptions = EMPTY_OBJECT,
): StopHandle {
  let getter: () => unknown
  if (isFunction(effect)) {
    getter = () => {
      if (cleanup) {
        cleanup()
      }
      effect(onCleanup)
    }
  } else {
    if (__DEV__) {
      warn('A watch effect can only be a function.')
    }
    getter = NOOP
  }

  let cleanup: (() => void) | undefined
  const onCleanup: OnCleanup = (fn) => {
    if (__DEV__) {
      if (!isFunction(fn)) {
        warn('A cleanup can only be a function.')
      }
    }
    cleanup = _effect.onStop = () => {
      fn()
      cleanup = _effect.onStop = undefined
    }
  }

  const job: SchedulerJob = () => {
    if (!_effect.active || !_effect.dirty) return
    _effect.run()
  }

  let scheduler: EffectScheduler
  if (flush === 'sync') {
    scheduler = job
  } else if (flush === 'post') {
    scheduler = () => queuePostFlushJob(job)
  } else {
    // 默认 pre
    scheduler = () => queueJob(job)
  }

  const _effect = new ReactiveEffect(getter, scheduler)

  if (__DEV__) {
    _effect.onTrack = onTrack
    _effect.onTrigger = onTrigger
  }

  const scope = activeEffectScope
  const unwatch = () => {
    _effect.stop()
    if (scope) {
      remove(scope.effects, _effect)
    }
  }

  if (flush === 'post') {
    queuePostFlushJob(() => _effect.run())
  } else {
    _effect.run()
  }

  return unwatch
}

export function watchPostEffect(
  effect: WatchEffect,
  debuggerOptions?: DebuggerOptions,
): StopHandle {
  return watchEffect(
    effect,
    __DEV__
      ? {
          // @ts-ignore
          ...debuggerOptions!,
          flush: 'post',
        }
      : { flush: 'post' },
  )
}

export function watchSyncEffect(
  effect: WatchEffect,
  debuggerOptions?: DebuggerOptions,
): StopHandle {
  return watchEffect(
    effect,
    __DEV__
      ? {
          // @ts-ignore
          ...debuggerOptions,
          flush: 'sync',
        }
      : { flush: 'sync' },
  )
}

type WatchSource<T> =
  | Ref<T> // ref
  | ComputedRef<T> // computed ref
  | (() => T) // getter
  | (T extends object ? T : never) // reactive object

type WatchCallback<T> = (
  value: T,
  oldValue: T | undefined,
  onCleanup: OnCleanup,
) => void

interface WatchOptions extends WatchEffectOptions {
  immediate?: boolean
  deep?: boolean
  once?: boolean
}

export function watch<T>(
  source: WatchSource<T>,
  callback: WatchCallback<T>,
  options?: WatchOptions,
): StopHandle
export function watch<T>(
  sources: WatchSource<T>[],
  callback: WatchCallback<T[]>,
  options?: WatchOptions,
): StopHandle
export function watch<T>(
  source: WatchSource<T> | WatchSource<T>[],
  callback: WatchCallback<T | T[]>,
  {
    immediate,
    deep,
    flush,
    once,
    onTrack,
    onTrigger,
  }: WatchOptions = EMPTY_OBJECT,
): StopHandle {
  if (!isFunction(callback)) {
    if (__DEV__) {
      warn('A watch callback can only be a function.')
    }
    callback = NOOP
  }

  if (once) {
    const rawCallback = callback
    callback = function (this: unknown) {
      rawCallback.apply(
        this,
        // @ts-ignore
        // eslint-disable-next-line prefer-rest-params
        arguments,
      )
      unwatch()
    }
  }

  let getter: () => unknown
  let forceTrigger = false
  let isMultiSource = false

  if (isRef(source)) {
    getter = () => source.value
    forceTrigger = isShallow(source)
  } else if (isReactive(source)) {
    getter = () => source
    deep = true
  } else if (isArray(source)) {
    isMultiSource = true
    forceTrigger = source.some((s) => isReactive(s) || isShallow(s))
    getter = () =>
      source.map((s) => {
        if (isRef(s)) return s.value
        if (isReactive(s)) {
          trackObjectSelf(s)
          traverse(s)
          return s
        }
        if (isFunction(s)) return s()
        if (__DEV__) {
          warn(
            'A watch source can only be a ref, a getter function, a reactive object, or an array of these types.',
          )
        }
      })
  } else if (isFunction(source)) {
    getter = () => source()
  } else {
    if (__DEV__) {
      warn(
        'A watch source can only be a ref, a getter function, a reactive object, or an array of these types.',
      )
    }
    getter = NOOP
  }

  if (deep) {
    const baseGetter = getter
    getter = () => {
      const ret = baseGetter()

      const values: unknown[] = isMultiSource ? (ret as unknown[]) : [ret]
      for (let i = 0, len = values.length; i < len; i++) {
        const value = values[i]
        if (isObject(value)) {
          // track value self
          trackObjectSelf(value)
          // track value props/items
          traverse(value)
        }
      }

      return ret
    }
  }

  let cleanup: (() => void) | undefined
  const onCleanup: OnCleanup = (fn) => {
    if (__DEV__) {
      if (!isFunction(fn)) {
        warn('A cleanup can only be a function.')
      }
    }
    cleanup = effect.onStop = () => {
      fn()
      cleanup = effect.onStop = undefined
    }
  }

  let oldValue: unknown = isMultiSource ? [] : UNINITIALIZED_VALUE
  const job: SchedulerJob = () => {
    if (!effect.active || !effect.dirty) return
    const newValue = effect.run()
    if (
      deep ||
      forceTrigger ||
      (isMultiSource
        ? (newValue as unknown[]).some(
            (v, i) => !sameValue(v, (oldValue as unknown[])[i]),
          )
        : !sameValue(newValue, oldValue))
    ) {
      if (cleanup) {
        cleanup()
      }
      callback(
        newValue as T | T[],
        (oldValue === UNINITIALIZED_VALUE ? undefined : oldValue) as T | T[],
        onCleanup,
      )
      oldValue = newValue
    }
  }
  job.allowRecurse = true

  let scheduler: EffectScheduler
  if (flush === 'sync') {
    scheduler = job
  } else if (flush === 'post') {
    scheduler = () => queuePostFlushJob(job)
  } else {
    // 默认 pre
    scheduler = () => queueJob(job)
  }

  const effect = new ReactiveEffect(getter, scheduler)

  if (__DEV__) {
    effect.onTrack = onTrack
    effect.onTrigger = onTrigger
  }

  const scope = activeEffectScope
  const unwatch = () => {
    effect.stop()
    if (scope) remove(scope.effects, effect)
  }

  if (immediate) {
    job()
  } else {
    oldValue = effect.run()
  }

  return unwatch
}

function trackObjectSelf(value: object) {
  if ((value as any)[SKIP_FLAG]) return
  const ob: Observer | undefined = (value as any)[OBSERVER_FLAG]
  if (ob) {
    track(ob.dep || (ob.dep = createDep(() => (ob.dep = null))))
  }
}

function traverse(value: unknown, seen = createSet()) {
  if (!isObject(value) || (value as any)[SKIP_FLAG]) return

  if (seen.has(value)) return
  seen.add(value)

  if (isRef(value)) {
    traverse(value.value, seen)
  } else if (isArray(value)) {
    for (let i = 0, len = value.length; i < len; i++) {
      traverse(value[i], seen)
    }
  } else if (isPlainObject(value)) {
    for (const key in value) {
      traverse(value[key], seen)
    }
  }
}
