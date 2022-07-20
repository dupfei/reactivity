import { describe, expect, test } from 'vitest'
import { nextTick } from '../src/nextTick'

describe('nextTick', () => {
  test('基本使用', () => {
    let count = 0
    // 传入回调函数时返回 undefined
    expect(
      nextTick(() => {
        count++
      }),
    ).toBeUndefined()
    // nextTick 回调函数不会立即执行
    expect(count).toBe(0)
    // 使用 setTimeout 延迟到 next tick
    setTimeout(() => {
      expect(count).toBe(1)
    }, 0)
  })

  test('未传入回调函数时返回 Promise', () => {
    expect(nextTick()).toBeInstanceOf(Promise)
  })

  test('按照顺序调用', () => {
    const values: any = []
    nextTick(() => {
      values.push(1)
    })
    nextTick().then(() => {
      values.push(2)
      expect(values).toEqual([1, 2])
    })
  })
})
