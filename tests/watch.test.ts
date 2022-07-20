import { describe, expect, test, vi } from 'vitest'
import { nextTick } from '../src/nextTick'
import { reactive } from '../src/reactive'
import { ref } from '../src/ref'
import { watchEffect, watchSyncEffect } from '../src/watch'

describe('watch', () => {
  test('watchEffect', async () => {
    const state = reactive({ count: 0 })
    let count
    watchEffect(() => {
      count = state.count
    })
    // 立即执行一次
    expect(count).toBe(0)
    state.count++
    // 默认 flush: async
    expect(count).toBe(0)
    await nextTick()
    expect(count).toBe(1)
  })

  test('停止 watchEffect', async () => {
    const state = reactive({ count: 0 })
    let count
    const stop = watchEffect(() => {
      count = state.count
    })
    expect(count).toBe(0)
    stop()
    state.count++
    await nextTick()
    expect(count).toBe(0)
  })

  test('为 watchEffect 注册清理函数', async () => {
    const state = reactive({ count: 0 })
    const cleanup = vi.fn()
    let count
    const stop = watchEffect((onCleanup) => {
      onCleanup(cleanup)
      count = state.count
    })
    expect(count).toBe(0)
    state.count++
    await nextTick()
    expect(cleanup).toHaveBeenCalledTimes(1)
    expect(count).toBe(1)
    // 停止 watchEffect 立即调用 cleanup
    stop()
    expect(cleanup).toHaveBeenCalledTimes(2)
  })

  test('watchEffect 不能循环触发自身', async () => {
    const fn = vi.fn()
    const count = ref(0)
    const values = ref<number[]>([])
    watchEffect(() => {
      values.value.push(count.value)
      fn()
    })
    await nextTick()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  test('watchSyncEffect', () => {
    const state = reactive({ count: 0 })
    let count
    watchSyncEffect(() => {
      count = state.count
    })
    expect(count).toBe(0)
    state.count++
    // flush: sync
    expect(count).toBe(1)
  })
})
