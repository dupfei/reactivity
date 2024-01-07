import { nextTick } from './nextTick'
import { createSet } from './utils/collection/index'
import { includes } from './utils/index'

export type SchedulerJob = {
  (): void
  allowRecurse?: boolean
}

export function queueJob(job: SchedulerJob): void {
  if (
    queue.length < 1 ||
    !includes(
      queue,
      job,
      isFlushing && job.allowRecurse ? flushIndex + 1 : flushIndex,
    )
  ) {
    queue.push(job)
    queueFlush()
  }
}

export function queuePostFlushJob(job: SchedulerJob) {
  if (
    !activePostFlushJobs ||
    activePostFlushJobs.length < 1 ||
    !includes(
      activePostFlushJobs,
      job,
      job.allowRecurse ? postFlushIndex + 1 : postFlushIndex,
    )
  ) {
    pendingPostFlushJobs.push(job)
  }
  queueFlush()
}

const queue: SchedulerJob[] = []

let isFlushPending = false
let isFlushing = false
let flushIndex = 0

function queueFlush() {
  if (!isFlushing && !isFlushPending) {
    isFlushPending = true
    nextTick(flushJobs)
  }
}

function flushJobs() {
  isFlushPending = false
  isFlushing = true

  try {
    // 动态获取 queue.length 支持动态添加 job
    for (flushIndex = 0; flushIndex < queue.length; flushIndex++) {
      queue[flushIndex]()
    }
  } finally {
    flushIndex = 0
    queue.length = 0

    flushPostFlushJobs()

    isFlushing = false

    if (queue.length > 0 || pendingPostFlushJobs.length > 0) {
      flushJobs()
    }
  }
}

const pendingPostFlushJobs: SchedulerJob[] = []
let activePostFlushJobs: SchedulerJob[] | null = null
let postFlushIndex = 0

function flushPostFlushJobs() {
  if (pendingPostFlushJobs.length > 0) {
    const hasActivePostFlushJobs = !!activePostFlushJobs

    if (!hasActivePostFlushJobs) {
      activePostFlushJobs = []
    }
    for (
      let i = 0, len = pendingPostFlushJobs.length, seen = createSet();
      i < len;
      i++
    ) {
      const job = pendingPostFlushJobs[i]
      if (!seen.has(job)) {
        seen.add(job)
        activePostFlushJobs!.push(job)
      }
    }
    pendingPostFlushJobs.length = 0

    if (!hasActivePostFlushJobs) {
      // 动态获取 activePostFlushJobs.length 支持动态添加 job
      for (
        postFlushIndex = 0;
        postFlushIndex < activePostFlushJobs!.length;
        postFlushIndex++
      ) {
        activePostFlushJobs![postFlushIndex]()
      }
      activePostFlushJobs = null
      postFlushIndex = 0
    }
  }
}
