import { describe, expect, test } from 'vitest'
import { nextTick } from '../src/nextTick'
import { queueFlushJob } from '../src/scheduler'

describe('scheduler', () => {
  test('queueFlushJob', async () => {
    const calls: string[] = []
    const job1 = () => {
      calls.push('job1')
    }
    const job2 = () => {
      calls.push('job2')
    }
    queueFlushJob(job1)
    queueFlushJob(job2)
    expect(calls).toEqual([])
    await nextTick()
    expect(calls).toEqual(['job1', 'job2'])
  })

  test('过滤重复的队列任务', async () => {
    const calls: string[] = []
    const job1 = () => {
      calls.push('job1')
    }
    const job2 = () => {
      calls.push('job2')
    }
    queueFlushJob(job1)
    queueFlushJob(job2)
    queueFlushJob(job1)
    queueFlushJob(job2)
    expect(calls).toEqual([])
    await nextTick()
    expect(calls).toEqual(['job1', 'job2'])
  })

  test('链式队列任务', async () => {
    const calls: string[] = []
    const job1 = () => {
      calls.push('job1')
      // job2 将会在 job1 之后的同一个 tick 内执行
      queueFlushJob(job2)
    }
    const job2 = () => {
      calls.push('job2')
    }
    queueFlushJob(job1)
    expect(calls).toEqual([])
    await nextTick()
    expect(calls).toEqual(['job1', 'job2'])
  })
})
