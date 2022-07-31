import { isNative, NOOP } from './utils/index'

const inBrowser = typeof window !== 'undefined'
const UA = inBrowser && window.navigator.userAgent.toLowerCase()
const isIOS = UA && /iphone|ipad|ipod|ios/.test(UA)
const isIE = UA && /msie|trident/.test(UA)

let pendingCallbacks: (() => void)[] = []
let flushingCallbacks: (() => void)[] = []
let pending = false

function flushCallbacks(): void {
  pending = false
  const temp = flushingCallbacks
  flushingCallbacks = pendingCallbacks
  pendingCallbacks = temp
  for (let i = 0; i < flushingCallbacks.length; i++) {
    flushingCallbacks[i]()
  }
  flushingCallbacks.length = 0
}

const timerFunc: () => void = (() => {
  // @ts-ignore
  if (isNative(Promise)) {
    // @ts-ignore
    const p = Promise.resolve()
    return () => {
      p.then(flushCallbacks)
      if (isIOS) {
        setTimeout(NOOP)
      }
    }
  }
  if (!isIE && isNative(MutationObserver)) {
    let num = 1
    const observer = new MutationObserver(flushCallbacks)
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
      setImmediate(flushCallbacks)
    }
  }
  return () => {
    setTimeout(flushCallbacks, 0)
  }
})()

export function nextTick(): Promise<void>
export function nextTick(callback: () => void): void
export function nextTick(callback?: () => void): Promise<void> | void {
  let resolve: (() => void) | undefined
  pendingCallbacks.push(() => {
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

  if (
    !callback &&
    // @ts-ignore
    typeof Promise !== 'undefined'
  ) {
    // @ts-ignore
    return new Promise((_resolve) => {
      resolve = _resolve
    })
  }
}
