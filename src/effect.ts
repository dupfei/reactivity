import { ComputedRef } from './computed'
import { Dep } from './dep'
import { EffectScopeImpl, recordEffectScope } from './effectScope'
import { DirtyLevels } from './flag'

export let shouldTrack = true
const trackStack: boolean[] = []
export function pauseTracking() {
  trackStack.push(shouldTrack)
  shouldTrack = false
}
export function enableTracking() {
  trackStack.push(shouldTrack)
  shouldTrack = true
}
export function resetTracking() {
  shouldTrack = trackStack.length > 0 ? trackStack.pop()! : true
}

export let pauseScheduleStack = 0
const queueEffectSchedulers: EffectScheduler[] = []
export function pauseScheduling() {
  pauseScheduleStack++
}
export function resetScheduling() {
  pauseScheduleStack--
  // 每次都要判断 pauseScheduleStack < 1，确保在正在执行的 scheduler 内部调用 pauseScheduling() 也能生效
  while (pauseScheduleStack < 1 && queueEffectSchedulers.length > 0) {
    queueEffectSchedulers.shift()!()
  }
}

export type EffectScheduler = () => void

export type EffectTrigger = () => void

export let activeEffect: ReactiveEffect | undefined

type DebuggerEvent<Type> = {
  effect: ReactiveEffect
} & DebuggerEventExtraInfo<Type>

type TrackOpTypes = 'get'
type TriggerOpTypes = 'set' | 'add' | 'delete' | 'array-mutation'

type DebuggerEventExtraInfo<Type> = {
  type: Type
  target: object
  key: PropertyKey
  newValue?: unknown
  oldValue?: unknown
}

export interface DebuggerOptions {
  onTrack?: (event: DebuggerEvent<TrackOpTypes>) => void
  onTrigger?: (event: DebuggerEvent<TriggerOpTypes>) => void
}

export class ReactiveEffect<T = unknown> {
  _dirtyLevel = DirtyLevels.Dirty
  _trackId = 0
  _running = 0
  _querying = 0
  _depsLength = 0

  active = true
  deps: Dep[] = []
  computed?: ComputedRef
  allowRecurse?: boolean
  onStop?: () => void

  onTrack?: DebuggerOptions['onTrack']
  onTrigger?: DebuggerOptions['onTrigger']

  constructor(
    public fn: () => T,
    public scheduler?: EffectScheduler,
    public trigger?: EffectTrigger,
    scope?: EffectScopeImpl,
  ) {
    recordEffectScope(this, scope)
  }

  get dirty() {
    if (this._dirtyLevel === DirtyLevels.ComputedValueMaybeDirty) {
      this._dirtyLevel = DirtyLevels.NotDirty
      this._querying++
      pauseTracking()
      const { deps } = this
      for (let i = 0, len = deps.length; i < len; i++) {
        const dep = deps[i]
        if (dep.computed) {
          triggerComputed(dep.computed)
          if (this._dirtyLevel >= DirtyLevels.ComputedValueDirty) break
        }
      }
      resetTracking()
      this._querying--
    }
    return this._dirtyLevel >= DirtyLevels.ComputedValueDirty
  }

  set dirty(newDirty: DirtyLevels | boolean) {
    this._dirtyLevel = newDirty ? DirtyLevels.Dirty : DirtyLevels.NotDirty
  }

  run(): T {
    this._dirtyLevel = DirtyLevels.NotDirty

    if (!this.active) {
      return this.fn()
    }

    const lastShouldTrack = shouldTrack
    const currentEffect = activeEffect

    try {
      shouldTrack = true
      activeEffect = this
      this._running++
      preCleanupEffect(this)

      return this.fn()
    } finally {
      postCleanupEffect(this)
      this._running--
      activeEffect = currentEffect
      shouldTrack = lastShouldTrack
    }
  }

  stop(): void {
    if (this.active) {
      preCleanupEffect(this)
      postCleanupEffect(this)
      if (this.onStop) this.onStop()
      this.active = false
    }
  }
}

function triggerComputed(computed: ComputedRef): unknown {
  return computed.value
}

function preCleanupEffect(effect: ReactiveEffect): void {
  effect._trackId++
  effect._depsLength = 0
}

function postCleanupEffect(effect: ReactiveEffect): void {
  const { deps, _depsLength } = effect
  if (deps.length > _depsLength) {
    for (let i = _depsLength, len = deps.length; i < len; i++) {
      cleanupDepEffect(deps[i], effect)
    }
    deps.length = _depsLength
  }
}

function cleanupDepEffect(dep: Dep, effect: ReactiveEffect): void {
  if (dep.get(effect) !== effect._trackId) {
    dep.delete(effect)
    if (dep.size < 1) {
      dep.cleanup()
    }
  }
}

export function track(
  dep: Dep,
  debuggerEventExtraInfo?: DebuggerEventExtraInfo<TrackOpTypes>,
): void {
  if (shouldTrack && activeEffect) {
    trackEffect(activeEffect, dep, debuggerEventExtraInfo)
  }
}

export function trackEffect(
  effect: ReactiveEffect,
  dep: Dep,
  debuggerEventExtraInfo?: DebuggerEventExtraInfo<TrackOpTypes>,
) {
  if (dep.get(effect) !== effect._trackId) {
    dep.set(effect, effect._trackId)
    const oldDep = effect.deps[effect._depsLength]
    if (oldDep !== dep) {
      if (oldDep) {
        cleanupDepEffect(oldDep, effect)
      }
      effect.deps[effect._depsLength] = dep
    }
    effect._depsLength++
    if (__DEV__ && effect.onTrack) {
      effect.onTrack({
        effect,
        // @ts-ignore
        ...debuggerEventExtraInfo!,
      })
    }
  }
}

export function trigger(
  dep: Dep,
  dirtyLevel = DirtyLevels.Dirty,
  debuggerEventExtraInfo?: DebuggerEventExtraInfo<TriggerOpTypes>,
): void {
  pauseScheduling()
  triggerEffect(dep, dirtyLevel, debuggerEventExtraInfo)
  resetScheduling()
}

function triggerEffect(
  dep: Dep,
  dirtyLevel: DirtyLevels,
  debuggerEventExtraInfo?: DebuggerEventExtraInfo<TriggerOpTypes>,
): void {
  pauseScheduling()
  dep.forEach((_, effect) => {
    if (!effect.allowRecurse && effect._running) return
    if (
      effect._dirtyLevel < dirtyLevel &&
      (!effect._running || dirtyLevel !== DirtyLevels.ComputedValueDirty)
    ) {
      const lastDirtyLevel = effect._dirtyLevel
      effect._dirtyLevel = dirtyLevel
      if (
        lastDirtyLevel === DirtyLevels.NotDirty &&
        (!effect._querying || dirtyLevel !== DirtyLevels.ComputedValueDirty)
      ) {
        if (__DEV__ && effect.onTrigger) {
          effect.onTrigger({
            effect,
            // @ts-ignore
            ...debuggerEventExtraInfo!,
          })
        }
        if (effect.trigger) effect.trigger()
        if (effect.scheduler) queueEffectSchedulers.push(effect.scheduler)
      }
    }
  })
  resetScheduling()
}
