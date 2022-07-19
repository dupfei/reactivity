import { OBSERVER_FLAG, READONLY_FLAG, SHALLOW_FLAG, SKIP_FLAG } from './flag'
import { observe, Observer } from './observer'
import { def } from './utils/index'

export function reactive<T extends object>(target: T): T {
  makeReactive(target, false)
  return target
}

export function shallowReactive<T extends object>(target: T): T {
  makeReactive(target, true)
  return target
}

function makeReactive<T extends object>(target: T, shallow: boolean): void {
  if (__DEV__) {
    const existingOb: Observer | undefined =
      target && (target as any)[OBSERVER_FLAG]
    if (existingOb && existingOb.shallow !== shallow) {
      console.warn(
        `当前值已经是${
          existingOb.shallow ? 'shallowReactive' : 'reactive'
        }，不能更改为${shallow ? 'shallowReactive' : 'reactive'}`,
      )
    }
  }
  const ob = observe(target, shallow)
  if (__DEV__ && !ob) {
    console.warn('当前类型的值不能被转换为响应式')
  }
}

export function isReactive(value: unknown): boolean {
  return !!(value && (value as any)[OBSERVER_FLAG])
}

export function isReadonly(value: unknown): boolean {
  return !!(value && (value as any)[READONLY_FLAG] === true)
}

export function isProxy(value: unknown): boolean {
  return isReactive(value) || isReadonly(value)
}

export function isShallow(value: unknown): boolean {
  return !!(value && (value as any)[SHALLOW_FLAG] === true)
}

export function markRaw<T extends object>(value: T): T {
  def(value, SKIP_FLAG, true)
  return value
}
