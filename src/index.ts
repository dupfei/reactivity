export const version = __VERSION__
export {
  reactive,
  shallowReactive,
  readonly,
  shallowReadonly,
  isProxy,
  isReactive,
  isReadonly,
  isShallow,
  toRaw,
  markRaw,
} from './reactive'
export { set, del } from './observer'
export {
  ref,
  shallowRef,
  triggerRef,
  customRef,
  isRef,
  unref,
  toRef,
  toRefs,
} from './ref'
export { computed, isComputed } from './computed'
export { watch, watchEffect, watchSyncEffect } from './watch'
export { effectScope, getCurrentScope, onScopeDispose } from './effectScope'
export { nextTick } from './nextTick'
