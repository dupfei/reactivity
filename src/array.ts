import { createDep } from './dep'
import { track, trigger } from './effect'
import { OBSERVER_FLAG } from './flag'
import { Observer, observe } from './observer'
import { createSet } from './utils/collection/set'
import {
  defineDataProperty,
  isArray,
  objectCreate,
  setPrototypeOf,
} from './utils/index'

export function observeArray(arr: unknown[], shallow: boolean): void {
  setPrototypeOf(arr, arrayProto)
  if (!shallow) {
    observeArrayItems(arr, shallow)
  }
}

function observeArrayItems(arr: unknown[], shallow: boolean): void {
  for (let i = 0, len = arr.length; i < len; i++) {
    observe(arr[i], shallow)
  }
}

const rawArrayProto = Array.prototype
const arrayProto = objectCreate(rawArrayProto)
const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse',
]
methodsToPatch.forEach((method) => {
  const rawMethod: Function = (rawArrayProto as any)[method]
  defineDataProperty(
    arrayProto,
    method,
    function (
      this: unknown[] & { [OBSERVER_FLAG]: Observer },
      ...args: unknown[]
    ) {
      const ret = rawMethod.apply(this, args)
      const ob = this[OBSERVER_FLAG]
      if (!ob.shallow) {
        let inserted: unknown[] | undefined
        switch (method) {
          case 'push':
          case 'unshift':
            inserted = args
            break
          case 'splice':
            inserted = args.slice(2)
            break
        }
        if (inserted) {
          observeArrayItems(inserted, false)
        }
      }
      if (ob.dep) {
        trigger(
          ob.dep,
          undefined,
          __DEV__
            ? { type: 'array-mutation', target: this, key: method }
            : undefined,
        )
      }
      return ret
    },
  )
})

export function trackArrayItems<T = unknown>(
  arr: T[],
  seen = createSet<T[]>(),
) {
  if (seen.has(arr)) return
  seen.add(arr)

  for (let i = 0, len = arr.length; i < len; i++) {
    const item = arr[i]
    const ob: Observer | undefined = item && (item as any)[OBSERVER_FLAG]
    if (ob) {
      track(ob.dep || (ob.dep = createDep(() => (ob.dep = null))))
    }
    if (isArray(item)) {
      trackArrayItems(item, seen)
    }
  }
}
