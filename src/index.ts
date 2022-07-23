export const version = __VERSION__

export {
  reactive,
  shallowReactive,
  isProxy,
  isReactive,
  isReadonly,
  isShallow,
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
export { computed } from './computed'
export { watchEffect, watchSyncEffect } from './watch'
export { effectScope, getCurrentScope, onScopeDispose } from './effectScope'
export { nextTick } from './nextTick'
