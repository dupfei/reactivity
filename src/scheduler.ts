import { nextTick } from './nextTick'
import { includes } from './utils/index'

export type SchedulerJob = (() => void) & {
  allowRecurse?: boolean
}

let pendingJobs: SchedulerJob[] = []
let flushingJobs: SchedulerJob[] = []
let flushingIndex = 0
let waitingForFlushEnd = false

export function queueFlushJob(job: SchedulerJob): void {
  if (
    (flushingJobs.length < 1 ||
      !includes(
        flushingJobs,
        job,
        job.allowRecurse ? flushingIndex + 1 : flushingIndex,
      )) &&
    !includes(pendingJobs, job)
  ) {
    pendingJobs.push(job)
    if (!waitingForFlushEnd) {
      waitingForFlushEnd = true
      nextTick(flushJobs)
    }
  }
}

function flushJobs() {
  while (pendingJobs.length > 0) {
    const temp = flushingJobs
    flushingJobs = pendingJobs
    pendingJobs = temp
    for (; flushingIndex < flushingJobs.length; flushingIndex++) {
      flushingJobs[flushingIndex]()
    }
    flushingJobs.length = flushingIndex = 0
  }
  waitingForFlushEnd = false
}
