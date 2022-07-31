import { recordEffectScope } from './effectScope'
import { createSet, InternalSet } from './utils/internalSet'

export type Dep = InternalSet<ReactiveEffect> & {
  // 过去被追踪
  w: number
  // 最新被追踪
  n: number
}

export function createDep(): Dep {
  const dep = createSet() as Dep
  dep.w = 0
  dep.n = 0
  return dep
}

// 二进制数的每一位代表着嵌套 ReactiveEffect 中的每一层
// 每一位通过 0、1 标记依赖的追踪状态
let trackDepth = 0
const MAX_TRACK_DEPTH = 30
let trackOpBit = 1

const wasTracked = (dep: Dep): boolean => (dep.w & trackOpBit) > 0
const newTracked = (dep: Dep): boolean => (dep.n & trackOpBit) > 0

function initDepMarkers(effect: ReactiveEffect): void {
  const { deps } = effect
  for (let i = 0; i < deps.length; i++) {
    // 设置 过去被追踪 标记
    deps[i].w |= trackOpBit
  }
}

function finalizeDepMarkers(effect: ReactiveEffect): void {
  const { deps } = effect
  if (deps.length > 0) {
    let newIndex = 0
    for (let i = 0; i < deps.length; i++) {
      const dep = deps[i]
      if (wasTracked(dep) && !newTracked(dep)) {
        dep.delete(effect)
      } else {
        // 最新被追踪
        deps[newIndex++] = dep
      }
      // 清除 过去被追踪 和 最新被追踪 标记
      dep.w &= ~trackOpBit
      dep.n &= ~trackOpBit
    }
    deps.length = newIndex
  }
}

export type EffectScheduler = () => void

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
  active = true
  deps: Dep[] = []
  computed?: boolean
  private deferStop?: boolean
  onStop?: () => void

  onTrack?: DebuggerOptions['onTrack']
  onTrigger?: DebuggerOptions['onTrigger']

  constructor(
    public fn: () => T,
    public scheduler: EffectScheduler | undefined,
  ) {
    recordEffectScope(this)
  }

  run(): T {
    if (!this.active) {
      return this.fn()
    }

    const currentEffect = activeEffect
    activeEffect = this

    trackOpBit = 1 << ++trackDepth
    if (trackDepth <= MAX_TRACK_DEPTH) {
      initDepMarkers(this)
    } else {
      cleanupDeps(this)
    }

    try {
      return this.fn()
    } finally {
      if (trackDepth <= MAX_TRACK_DEPTH) {
        finalizeDepMarkers(this)
      }
      trackOpBit = 1 << --trackDepth

      activeEffect = currentEffect

      if (this.deferStop) {
        this.stop()
      }
    }
  }

  stop(): void {
    // run 过程中调用 stop，延迟到 run 结束后再执行
    if (activeEffect === this) {
      this.deferStop = true
    } else if (this.active) {
      cleanupDeps(this)
      if (this.onStop) {
        this.onStop()
      }
      this.active = false
    }
  }
}

function cleanupDeps(effect: ReactiveEffect): void {
  const { deps } = effect
  if (deps.length > 0) {
    for (let i = 0; i < deps.length; i++) {
      deps[i].delete(effect)
    }
    deps.length = 0
  }
}

export function track(
  dep: Dep,
  debuggerEventExtraInfo?: DebuggerEventExtraInfo<TrackOpTypes>,
): void {
  if (activeEffect) {
    let shouldTrack = false
    if (trackDepth <= MAX_TRACK_DEPTH) {
      if (!newTracked(dep)) {
        // 设置 最新被追踪 标记
        dep.n |= trackOpBit
        shouldTrack = !wasTracked(dep)
      }
    } else {
      shouldTrack = !dep.has(activeEffect)
    }
    if (shouldTrack) {
      dep.add(activeEffect)
      activeEffect.deps.push(dep)
      if (__DEV__ && activeEffect.onTrack) {
        activeEffect.onTrack({
          effect: activeEffect,
          // @ts-ignore
          ...debuggerEventExtraInfo!,
        })
      }
    }
  }
}

export function trigger(
  dep: Dep,
  debuggerEventExtraInfo?: DebuggerEventExtraInfo<TriggerOpTypes>,
): void {
  // 固定本次要触发的 effects，触发过程中新增的 effect 不在本次触发
  const effects: ReactiveEffect[] = []
  const computedEffects: ReactiveEffect[] = []
  dep.forEach((effect) => {
    if (effect.computed) {
      computedEffects.push(effect)
    } else {
      effects.push(effect)
    }
  })
  // 优先触发 computedEffect，确保其它 effect 触发时其中的 computed 值已经更新
  triggerEffects(computedEffects, __DEV__ ? debuggerEventExtraInfo : undefined)
  triggerEffects(effects, __DEV__ ? debuggerEventExtraInfo : undefined)
}

function triggerEffects(
  effects: ReactiveEffect[],
  debuggerEventExtraInfo?: DebuggerEventExtraInfo<TriggerOpTypes>,
): void {
  for (let i = 0; i < effects.length; i++) {
    const effect = effects[i]
    if (effect !== activeEffect) {
      if (__DEV__ && effect.onTrigger) {
        effect.onTrigger({
          effect,
          // @ts-ignore
          ...debuggerEventExtraInfo!,
        })
      }
      if (effect.scheduler) {
        effect.scheduler()
      } else {
        effect.run()
      }
    }
  }
}
