const FLAG_PREFIX = '$$__ReactivityInternalFlag-'
const FLAG_SUFFIX = '__$$'

type Flag<S extends string> = `${typeof FLAG_PREFIX}${S}${typeof FLAG_SUFFIX}`

export const createFlag = <S extends string>(name: S): Flag<S> =>
  `${FLAG_PREFIX}${name}${FLAG_SUFFIX}`

export const OBSERVER_FLAG = createFlag('observer')
export const SHALLOW_FLAG = createFlag('shallow')
export const SKIP_FLAG = createFlag('skip')
export const REF_FLAG = createFlag('ref')
export const COMPUTED_FLAG = createFlag('computed')
export const DEP_FLAG = createFlag('dep')
export const READONLY_FLAG = createFlag('readonly')
export const RAW_FLAG = createFlag('raw')

export const OBJECT_ID = createFlag('objectId')

export enum DirtyLevels {
  NotDirty = 0,
  ComputedValueMaybeDirty = 1,
  ComputedValueDirty = 2,
  Dirty = 3,
}
