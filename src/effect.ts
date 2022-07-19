import { recordEffectScope } from './effectScope'
import { createSet, InternalSet } from './utils/internalSet'

export type Dep = InternalSet<ReactiveEffect> & {
  w: number
  n: number
}

export function createDep(): Dep {
  const dep = createSet() as Dep
  dep.w = 0
  dep.n = 0
  return dep
}

let trackDepth = 0
const MAX_TRACK_DEPTH = 30
let trackOpBit = 1

const wasTracked = (dep: Dep): boolean => (dep.w & trackOpBit) > 0
const newTracked = (dep: Dep): boolean => (dep.n & trackOpBit) > 0

function initDepMarkers(effect: ReactiveEffect): void {
  const { deps } = effect
  if (deps.length > 0) {
    for (let i = 0; i < deps.length; i++) {
      // 设置 wasTracked 标记
      deps[i].w |= trackOpBit
    }
  }
}

function finalizeDepMarkers(effect: ReactiveEffect): void {
  const { deps } = effect
  if (deps.length > 0) {
    let j = 0
    for (let i = 0; i < deps.length; i++) {
      const dep = deps[i]
      if (wasTracked(dep) && !newTracked(dep)) {
        dep.delete(effect)
      } else {
        deps[j++] = dep
      }
      // 清除 wasTracked 和 newTracked 标记
      dep.w &= ~trackOpBit
      dep.n &= ~trackOpBit
    }
    deps.length = j
  }
}

type EffectScheduler = () => void

export let activeEffect: ReactiveEffect | undefined

export class ReactiveEffect<T = unknown> {
  active = true
  deps: Dep[] = []
  computed?: boolean
  private deferStop?: boolean
  onStop?: () => void

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

export function track(dep: Dep): void {
  if (activeEffect) {
    let shouldTrack = false
    if (trackDepth <= MAX_TRACK_DEPTH) {
      if (!newTracked(dep)) {
        // 设置 newTracked 标记
        dep.n |= trackOpBit
        shouldTrack = !wasTracked(dep)
      }
    } else {
      shouldTrack = !dep.has(activeEffect)
    }
    if (shouldTrack) {
      dep.add(activeEffect)
      activeEffect.deps.push(dep)
    }
  }
}

export function trigger(dep: Dep): void {
  // 固定本次要触发的 effects，触发过程中新增的 effect 本次不触发
  const effects: ReactiveEffect[] = []
  const computedEffects: ReactiveEffect[] = []
  dep.forEach((effect) => {
    if (effect.computed) {
      computedEffects.push(effect)
    } else {
      effects.push(effect)
    }
  })
  // 优先触发 computedEffect，保证其它 effect 触发时 computed 值已经更新
  triggerEffects(computedEffects)
  triggerEffects(effects)
}

function triggerEffects(effects: ReactiveEffect[]): void {
  for (let i = 0; i < effects.length; i++) {
    const effect = effects[i]
    if (effect !== activeEffect) {
      if (effect.scheduler) {
        effect.scheduler()
      } else {
        effect.run()
      }
    }
  }
}
