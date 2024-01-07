import { pauseTracking, resetTracking } from '../effect'

export function warn(msg: string, ...args: unknown[]): void {
  pauseTracking()
  console.warn(
    `[Reactivity]: ${msg}`,
    // @ts-ignore
    ...args,
  )
  resetTracking()
}
