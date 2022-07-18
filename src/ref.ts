import { Dep } from './effect'
import { DEP_FLAG, REF_FLAG } from './flag'

export interface Ref<T = unknown> {
  value: T
  [REF_FLAG]: true
  [DEP_FLAG]: Dep
}
