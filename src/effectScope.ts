import { ReactiveEffect } from './effect'
import { remove } from './utils'

let activeEffectScope: EffectScope | undefined

class EffectScope {
  active = true
  effects: ReactiveEffect[] = []
  cleanups: (() => void)[] = []
  parent: EffectScope | undefined
  scopes: EffectScope[] = []

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
    }
  }

  stop(): void {
    if (this.active) {
      const { effects, cleanups, scopes } = this
      let i: number
      for (i = 0; i < effects.length; i++) {
        effects[i].stop()
      }
      for (i = 0; i < cleanups.length; i++) {
        cleanups[i]()
      }
      for (i = 0; i < scopes.length; i++) {
        scopes[i].stop()
      }
      if (this.parent) {
        remove(this.parent.scopes, this)
      }
      this.active = false
    }
  }
}

export function effectScope(detached?: boolean): EffectScope {
  return new EffectScope(detached)
}

export function recordEffectScope(
  effect: ReactiveEffect,
  scope: EffectScope | undefined = activeEffectScope,
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
  }
}
