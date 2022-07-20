import { EffectScheduler, ReactiveEffect } from './effect'
import { queueFlushJob, SchedulerJob } from './scheduler'
import { isFunction, NOOP } from './utils/index'

type WatchEffect = (onCleanup: OnCleanup) => void

type OnCleanup = (cleanupFn: () => void) => void

interface WatchEffectOptions {
  flush?: 'async' | 'sync'
}

type StopHandle = () => void

export function watchEffect(
  effect: WatchEffect,
  { flush }: WatchEffectOptions = {},
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
      console.warn('effect必须是个函数')
    }
    getter = NOOP
  }

  let cleanup: () => void
  const onCleanup: OnCleanup = (fn: () => void) => {
    if (__DEV__) {
      if (!isFunction(fn)) {
        console.warn('cleanupFn必须是个函数')
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
    // 默认为 async
    scheduler = () => queueFlushJob(job)
  }

  const _effect = new ReactiveEffect(getter, scheduler)
  _effect.run()

  return () => {
    _effect.stop()
  }
}

export function watchSyncEffect(effect: WatchEffect): StopHandle {
  return watchEffect(effect, { flush: 'sync' })
}
