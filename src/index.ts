export {
  reactive,
  shallowReactive,
  isProxy,
  isReactive,
  isReadonly,
  isShallow,
  markRaw,
} from './reactive'
export { isRef, unref } from './ref'
export { computed } from './computed'
export { effectScope, getCurrentScope, onScopeDispose } from './effectScope'
export { nextTick } from './nextTick'

export const version = __VERSION__
