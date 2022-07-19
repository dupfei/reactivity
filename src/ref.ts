import { REF_FLAG } from './flag'

export interface Ref<T = unknown> {
  value: T
}

export function isRef<T>(value: Ref<T> | unknown): value is Ref<T> {
  return !!(value && (value as any)[REF_FLAG] === true)
}

export function unref<T>(ref: T | Ref<T>): T {
  return isRef(ref) ? ref.value : ref
}
