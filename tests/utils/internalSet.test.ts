import { describe, expect, test } from 'vitest'
import { InternalSet } from '../../src/utils/internalSet'

describe('internalSet', () => {
  test('原始类型值', () => {
    const set = new InternalSet()

    expect(set.size).toBe(0)
    expect(set.has(1)).toBe(false)
    // add 返回当前 set
    expect(set.add(1)).toBe(set)
    // 添加成功后 size + 1
    expect(set.size).toBe(1)
    expect(set.has(1)).toBe(true)
    // 相同的值不能被重复添加
    set.add(1)
    expect(set.size).toBe(1)
    // 删除成功返回 true
    expect(set.delete(1)).toBe(true)
    expect(set.size).toBe(0)
    expect(set.has(1)).toBe(false)
    // 删除失败返回 false
    expect(set.delete(1)).toBe(false)

    // 0、-0、'0'、'-0'
    set.clear()
    set.add(0).add(-0)
    expect(set.size).toBe(1)
    expect(set.has(0)).toBe(true)
    expect(set.has(-0)).toBe(true)
    set.add('0').add('-0')
    expect(set.size).toBe(3)
    expect(set.has('0')).toBe(true)
    expect(set.has('-0')).toBe(true)

    // NaN、'NaN'
    set.clear()
    set.add(NaN).add(NaN)
    expect(set.size).toBe(1)
    expect(set.has(NaN)).toBe(true)
    set.add('NaN')
    expect(set.size).toBe(2)
    expect(set.has('NaN')).toBe(true)

    // Symbol
    set.clear()
    const s = Symbol()
    set.add(s).add(s)
    expect(set.size).toBe(1)
    expect(set.has(s)).toBe(true)
  })

  test('函数', () => {
    const set = new InternalSet()
    const fn = () => {}
    set.add(fn).add(fn)
    expect(set.size).toBe(1)
    expect(set.has(fn)).toBe(true)
  })

  test('对象', () => {
    const set = new InternalSet<any>()

    // 普通对象
    const obj: any = {}
    set.add(obj).add(obj)
    expect(set.size).toBe(1)
    expect(set.has(obj)).toBe(true)

    // 数组
    const arr: any = []
    set.add(arr).add(arr)
    expect(set.size).toBe(2)
    expect(set.has(arr)).toBe(true)
  })

  test('不可扩展的对象', () => {
    const set = new InternalSet()
    const obj: any = Object.freeze({})
    set.add(obj).add(obj)
    expect(set.size).toBe(1)
    expect(set.has(obj)).toBe(true)
  })

  test('forEach', () => {
    const set = new InternalSet([1, 2, 3])
    const values: number[] = []
    set.forEach((val) => {
      values.push(val)
    })
    expect(values).toEqual([1, 2, 3])

    // forEach 过程中执行 delete
    set.add(4)
    values.length = 0
    set.forEach((val) => {
      values.push(val)
      if (val === 2) {
        set.delete(val)
        set.delete(1)
        set.delete(3)
      }
    })
    expect(values).toEqual([1, 2, 4])

    // forEach 过程中执行 clear
    set.clear()
    set.add(1).add(2).add(3).add(4)
    values.length = 0
    set.forEach((val) => {
      values.push(val)
      if (val === 2) {
        set.clear()
      }
    })
    expect(values).toEqual([1, 2])
  })
})
