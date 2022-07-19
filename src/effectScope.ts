import { ReactiveEffect } from './effect'
import { remove } from './utils/index'

let activeEffectScope: EffectScopeImpl | undefined

class EffectScopeImpl {
  active = true
  effects: ReactiveEffect[] = []
  cleanups: (() => void)[] = []
  parent: EffectScopeImpl | undefined
  scopes: EffectScopeImpl[] = []

  constructor(detached?: boolean) {
    if (!detached && activeEffectScope) {
      this.parent = activeEffectScope
      activeEffectScope.scopes.push(this)
    }
  }

  run<T>(fn: () => T): T | undefined {
    if (this.active) {
      const currentEffectScope = activeEffectScope
      activeEffectScope = this
      try {
        return fn()
      } finally {
        activeEffectScope = currentEffectScope
      }
    } else if (__DEV__) {
      console.warn('不能对不活跃的effectScope执行run')
    }
  }

  stop(fromParent?: boolean): void {
    if (this.active) {
      const { effects, cleanups, scopes } = this
      let i = 0
      for (; i < effects.length; i++) {
        effects[i].stop()
      }
      for (i = 0; i < cleanups.length; i++) {
        cleanups[i]()
      }
      for (i = 0; i < scopes.length; i++) {
        scopes[i].stop(true)
      }
      if (this.parent && !fromParent) {
        remove(this.parent.scopes, this)
      }
      this.active = false
    }
  }
}

interface EffectScope {
  run<T>(fn: () => T): T | undefined
  stop(): void
}

export function effectScope(detached?: boolean): EffectScope {
  return new EffectScopeImpl(detached)
}

export function recordEffectScope(
  effect: ReactiveEffect,
  scope: EffectScopeImpl | undefined = activeEffectScope,
): void {
  if (scope && scope.active) {
    scope.effects.push(effect)
  }
}

export function getCurrentScope(): EffectScope | undefined {
  return activeEffectScope
}

export function onScopeDispose(fn: () => void): void {
  if (activeEffectScope) {
    activeEffectScope.cleanups.push(fn)
  } else if (__DEV__) {
    console.warn('没有活跃的effectScope可以关联')
  }
}
