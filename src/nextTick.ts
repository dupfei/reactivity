import { isNative, NOOP } from './utils/index'

const inBrowser = typeof window !== 'undefined'
const UA = inBrowser && window.navigator.userAgent.toLowerCase()
const isIOS = UA && /iphone|ipad|ipod|ios/.test(UA)
const isIE = UA && /msie|trident/.test(UA)

let pendingCbs: (() => void)[] = []
let flushingCbs: (() => void)[] = []
let pending = false

function flushCbs(): void {
  pending = false
  const temp = flushingCbs
  flushingCbs = pendingCbs
  pendingCbs = temp
  for (let i = 0; i < flushingCbs.length; i++) {
    flushingCbs[i]()
  }
  flushingCbs.length = 0
}

const timerFunc: () => void = (() => {
  // @ts-ignore
  if (isNative(Promise)) {
    // @ts-ignore
    const p = Promise.resolve()
    return () => {
      p.then(flushCbs)
      if (isIOS) {
        setTimeout(NOOP)
      }
    }
  }
  if (!isIE && isNative(MutationObserver)) {
    let num = 1
    const observer = new MutationObserver(flushCbs)
    const textNode = document.createTextNode(String(num))
    observer.observe(textNode, { characterData: true })
    return () => {
      textNode.data = String(++num)
    }
  }
  // @ts-ignore
  if (isNative(setImmediate)) {
    return () => {
      // @ts-ignore
      setImmediate(flushCbs)
    }
  }
  return () => {
    setTimeout(flushCbs, 0)
  }
})()

export function nextTick(): Promise<void>
export function nextTick(callback: () => void): void
export function nextTick(callback?: () => void): Promise<void> | void {
  let resolve: (() => void) | undefined
  pendingCbs.push(() => {
    if (callback) {
      callback()
    } else if (resolve) {
      resolve()
    }
  })
  if (!pending) {
    pending = true
    timerFunc()
  }
  // @ts-ignore
  if (!callback && typeof Promise !== 'undefined') {
    // @ts-ignore
    return new Promise((_resolve) => {
      resolve = _resolve
    })
  }
}
