import { ReactiveEffect } from './effect'
import { warn } from './utils/warn'

export let activeEffectScope: EffectScopeImpl | undefined

export class EffectScopeImpl {
  private _active = true
  effects: ReactiveEffect[] = []
  cleanups: (() => void)[] | undefined
  parent: EffectScopeImpl | undefined
  scopes: EffectScopeImpl[] | undefined
  private index: number | undefined

  constructor(public detached: boolean) {
    this.parent = activeEffectScope
    if (!detached && activeEffectScope) {
      this.index =
        (activeEffectScope.scopes || (activeEffectScope.scopes = [])).push(
          this,
        ) - 1
    }
  }

  get active() {
    return this._active
  }

  run<T>(fn: () => T): T | undefined {
    if (this._active) {
      const currentEffectScope = activeEffectScope
      try {
        activeEffectScope = this
        return fn()
      } finally {
        activeEffectScope = currentEffectScope
      }
    } else if (__DEV__) {
      warn('Cannot run an inactive effect scope.')
    }
  }

  stop(fromParent?: boolean): void {
    if (this.active) {
      const { effects, cleanups, scopes } = this
      let i, len
      for (i = 0, len = effects.length; i < len; i++) {
        effects[i].stop()
      }
      if (cleanups) {
        for (i = 0, len = cleanups.length; i < len; i++) {
          cleanups[i]()
        }
      }
      if (scopes) {
        for (i = 0, len = scopes.length; i < len; i++) {
          scopes[i].stop(true)
        }
      }
      if (!this.detached && this.parent && !fromParent) {
        const last = this.parent.scopes!.pop()
        if (last && last !== this) {
          this.parent.scopes![this.index!] = last
          last.index = this.index!
        }
      }
      this.parent = undefined
      this._active = false
    }
  }
}

interface EffectScope {
  run<T>(fn: () => T): T | undefined
  stop(): void
}

export function effectScope(detached?: boolean): EffectScope {
  return new EffectScopeImpl(!!detached)
}

export function recordEffectScope(
  effect: ReactiveEffect,
  scope: EffectScopeImpl | undefined = activeEffectScope,
): void {
  if (scope && scope.active) {
    scope.effects.push(effect)
  }
}

export function getCurrentScope(): EffectScopeImpl | undefined {
  return activeEffectScope
}

export function onScopeDispose(fn: () => void): void {
  if (activeEffectScope) {
    ;(activeEffectScope.cleanups || (activeEffectScope.cleanups = [])).push(fn)
  } else if (__DEV__) {
    warn('No active effect scope to be associated with.')
  }
}
