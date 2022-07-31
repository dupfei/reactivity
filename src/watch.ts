import { ComputedRef } from './computed'
import { DebuggerOptions, EffectScheduler, ReactiveEffect } from './effect'
import { SKIP_FLAG } from './flag'
import { isReactive, isShallow } from './reactive'
import { isRef, Ref } from './ref'
import { queueFlushJob, SchedulerJob } from './scheduler'
import {
  isArray,
  isFunction,
  isObject,
  isPlainObject,
  NOOP,
  sameValue,
} from './utils/index'
import { createSet, InternalSet } from './utils/internalSet'

type WatchEffect = (onCleanup: OnCleanup) => void

type OnCleanup = (cleanup: () => void) => void

interface WatchEffectOptions extends DebuggerOptions {
  flush?: 'async' | 'sync'
}

type StopHandle = () => void

export function watchEffect(
  effect: WatchEffect,
  { flush, onTrack, onTrigger }: WatchEffectOptions = {},
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
      console.warn('[Reactivity] A watch effect can only be a function.')
    }
    getter = NOOP
  }

  let cleanup: () => void
  const onCleanup: OnCleanup = (fn) => {
    if (__DEV__) {
      if (!isFunction(fn)) {
        console.warn('[Reactivity] A cleanup can only be a function.')
      }
    }
    cleanup = _effect.onStop = fn
  }

  const job: SchedulerJob = () => {
    if (!_effect.active) return
    _effect.run()
  }

  let scheduler: EffectScheduler
  if (flush === 'sync') {
    scheduler = job
  } else {
    // 默认 async
    scheduler = () => queueFlushJob(job)
  }

  const _effect = new ReactiveEffect(getter, scheduler)

  if (__DEV__) {
    _effect.onTrack = onTrack
    _effect.onTrigger = onTrigger
  }

  _effect.run()

  return () => {
    _effect.stop()
  }
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
  | T extends object
  ? T
  : never // reactive object

type WatchCallback<T> = (
  value: T,
  oldValue: T | undefined,
  onCleanup: OnCleanup,
) => void

interface WatchOptions extends WatchEffectOptions {
  immediate?: boolean
  deep?: boolean
}

const INITIAL_WATCHER_VALUE = {}

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
  { immediate, deep, flush, onTrack, onTrigger }: WatchOptions = {},
): StopHandle {
  if (!isFunction(callback)) {
    if (__DEV__) {
      console.warn('[Reactivity] A watch callback can only be a function.')
    }
    callback = NOOP
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
        if (isReactive(s)) return traverse(s)
        if (isFunction(s)) return s()
        if (__DEV__) {
          console.warn(
            '[Reactivity] A watch source can only be a ref, a getter function, a reactive object, or an array of these types.',
          )
        }
      })
  } else if (isFunction(source)) {
    getter = () => source()
  } else {
    if (__DEV__) {
      console.warn(
        '[Reactivity] A watch source can only be a ref, a getter function, a reactive object, or an array of these types.',
      )
    }
    getter = NOOP
  }

  if (deep) {
    const baseGetter = getter
    getter = () => traverse(baseGetter())
  }

  let cleanup: () => void
  const onCleanup: OnCleanup = (fn) => {
    if (__DEV__) {
      if (!isFunction(fn)) {
        console.warn('[Reactivity] A cleanup can only be a function.')
      }
    }
    cleanup = effect.onStop = fn
  }

  let oldValue: unknown = isMultiSource ? [] : INITIAL_WATCHER_VALUE
  const job: SchedulerJob = () => {
    if (!effect.active) return
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
        (oldValue === INITIAL_WATCHER_VALUE ? undefined : oldValue) as T | T[],
        onCleanup,
      )
      oldValue = newValue
    }
  }
  job.allowRecurse = true

  let scheduler: EffectScheduler
  if (flush === 'sync') {
    scheduler = job
  } else {
    // 默认 async
    scheduler = () => queueFlushJob(job)
  }

  const effect = new ReactiveEffect(getter, scheduler)

  if (__DEV__) {
    effect.onTrack = onTrack
    effect.onTrigger = onTrigger
  }

  if (immediate) {
    job()
  } else {
    oldValue = effect.run()
  }

  return () => {
    effect.stop()
  }
}

function traverse(value: unknown, seen?: InternalSet<unknown>) {
  if (!isObject(value) || (value as any)[SKIP_FLAG]) return value
  seen = seen || createSet()
  if (seen.has(value)) return value
  seen.add(value)
  if (isRef(value)) {
    traverse(value.value, seen)
  } else if (isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      traverse(value[i], seen)
    }
  } else if (isPlainObject(value)) {
    for (const key in value) {
      traverse(value[key], seen)
    }
  }
  return value
}
