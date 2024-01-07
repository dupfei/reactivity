import { ComputedRef } from './computed'
import { ReactiveEffect } from './effect'
import { InternalMap, createMap } from './utils/collection/index'

type Cleanup = () => void

export type Dep = InternalMap<ReactiveEffect, number> & {
  cleanup: Cleanup
  computed?: ComputedRef
}

export function createDep(cleanup: Cleanup, computed?: ComputedRef): Dep {
  const dep = createMap() as Dep
  dep.cleanup = cleanup
  dep.computed = computed
  return dep
}
