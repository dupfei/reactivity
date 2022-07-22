import { describe, expect, test } from 'vitest'
import { OBSERVER_FLAG } from '../src/flag'
import { observe, Observer } from '../src/observer'
import { markRaw } from '../src/reactive'

describe('observer', () => {
  test('不能被 observe', () => {
    // 原始类型值
    expect(observe(1)).toBeUndefined()
    // 不可扩展的对象
    expect(observe(Object.preventExtensions({}))).toBeUndefined()
    expect(observe(Object.seal({}))).toBeUndefined()
    expect(observe(Object.freeze({}))).toBeUndefined()
    // 被 markRaw 标记的对象
    expect(observe(markRaw({}))).toBeUndefined()
  })

  test('普通对象', () => {
    const obj: any = { a: {}, b: [] }

    const ob1 = observe(obj)!
    expect(ob1).toBeInstanceOf(Observer)
    expect(ob1.value).toBe(obj)
    expect(obj[OBSERVER_FLAG]).toBe(ob1)
    // 返回已经被 observe 对象的 observer
    expect(observe(obj)).toBe(ob1)

    // 深层 observe
    expect(obj.a[OBSERVER_FLAG]).toBeInstanceOf(Observer)
    expect(obj.b[OBSERVER_FLAG]).toBeInstanceOf(Observer)
  })

  test('属性被标记为不可 configurable', () => {
    const obj: any = {}
    Object.defineProperty(obj, 'a', {
      configurable: false,
      enumerable: true,
      value: {},
    })

    const ob1 = observe(obj)!
    expect(ob1).toBeInstanceOf(Observer)
    expect(ob1.value).toBe(obj)
    expect(obj[OBSERVER_FLAG]).toBe(ob1)
    expect(observe(obj)).toBe(ob1)

    // 属性不能被 observe
    expect(obj.a[OBSERVER_FLAG]).toBeUndefined()
    const d = Object.getOwnPropertyDescriptor(obj, 'a')!
    expect(d.configurable).toBe(false)
    expect(d.enumerable).toBe(true)
    expect(d.value).toEqual({})
    expect(d.get).toBeUndefined()
    expect(d.set).toBeUndefined()
  })

  test('属性被标记为不可 enumerable', () => {
    const obj: any = {}
    Object.defineProperty(obj, 'a', {
      configurable: true,
      enumerable: false,
      value: {},
    })

    const ob1 = observe(obj)!
    expect(ob1).toBeInstanceOf(Observer)
    expect(ob1.value).toBe(obj)
    expect(obj[OBSERVER_FLAG]).toBe(ob1)
    expect(observe(obj)).toBe(ob1)

    // 属性不能被 observe
    expect(obj.a[OBSERVER_FLAG]).toBeUndefined()
    const d = Object.getOwnPropertyDescriptor(obj, 'a')!
    expect(d.configurable).toBe(true)
    expect(d.enumerable).toBe(false)
    expect(d.value).toEqual({})
    expect(d.get).toBeUndefined()
    expect(d.set).toBeUndefined()
  })

  test('属性已经存在 getter 和 setter', () => {
    const obj: any = {}
    let val = 0
    let getCount = 0
    Object.defineProperty(obj, 'a', {
      configurable: true,
      enumerable: true,
      get() {
        getCount++
        return val
      },
      set(newValue) {
        val = newValue
      },
    })

    const ob1 = observe(obj)!
    expect(ob1).toBeInstanceOf(Observer)
    expect(ob1.value).toBe(obj)
    expect(obj[OBSERVER_FLAG]).toBe(ob1)
    expect(observe(obj)).toBe(ob1)

    // 还未触发过属性原有的 getter
    expect(getCount).toBe(0)
    // 每次访问属性 a 都应该只触发一次属性原有的 getter
    obj.a
    expect(getCount).toBe(1)
    obj.a
    expect(getCount).toBe(2)

    // 触发属性原有的 setter
    getCount = 0
    obj.a = 10
    expect(val).toBe(10)
    expect(getCount).toBe(0)
  })

  test('属性只有 getter', () => {
    const obj: any = {}
    Object.defineProperty(obj, 'a', {
      configurable: true,
      enumerable: true,
      get() {
        return 1
      },
    })

    const ob1 = observe(obj)!
    expect(ob1).toBeInstanceOf(Observer)
    expect(ob1.value).toBe(obj)
    expect(obj[OBSERVER_FLAG]).toBe(ob1)
    expect(observe(obj)).toBe(ob1)

    // 触发属性原有的 getter
    expect(obj.a).toBe(1)

    // 不能被修改
    expect(() => (obj.a = 100)).toThrowError()
    expect(obj.a).toBe(1)
  })

  test('属性只有 setter', () => {
    const obj: any = {}
    let val = 10
    Object.defineProperty(obj, 'a', {
      configurable: true,
      enumerable: true,
      set(newValue) {
        val = newValue
      },
    })

    const ob1 = observe(obj)!
    expect(ob1).toBeInstanceOf(Observer)
    expect(ob1.value).toBe(obj)
    expect(obj[OBSERVER_FLAG]).toBe(ob1)
    expect(observe(obj)).toBe(ob1)

    // 访问值为 undefined
    expect(obj.a).toBeUndefined()

    // 触发属性原有的 setter
    obj.a = 100
    expect(val).toBe(100)
    expect(obj.a).toBeUndefined()
  })

  test('属性被标记为不可 writable', () => {
    const obj: any = {}
    Object.defineProperty(obj, 'a', {
      configurable: true,
      enumerable: true,
      value: 1,
      writable: false,
    })

    const ob1 = observe(obj)!
    expect(ob1).toBeInstanceOf(Observer)
    expect(ob1.value).toBe(obj)
    expect(obj[OBSERVER_FLAG]).toBe(ob1)
    expect(observe(obj)).toBe(ob1)

    // 可以访问值
    expect(obj.a).toBe(1)

    // 不能被修改
    expect(() => (obj.a = 100)).toThrowError()
    expect(obj.a).toBe(1)
  })

  test('数组', () => {
    const arr: any = [{}, []]
    const ob1 = observe(arr)!
    expect(ob1).toBeInstanceOf(Observer)
    expect(ob1.value).toBe(arr)
    expect(arr[OBSERVER_FLAG]).toBe(ob1)

    // 深层 observe
    expect(arr[0][OBSERVER_FLAG]).toBeInstanceOf(Observer)
    expect(arr[1][OBSERVER_FLAG]).toBeInstanceOf(Observer)
  })

  test('浅层 observe', () => {
    const obj: any = { a: {}, b: [] }
    const ob1 = observe(obj, true)!
    expect(ob1).toBeInstanceOf(Observer)
    expect(ob1.value).toBe(obj)
    expect(obj[OBSERVER_FLAG]).toBe(ob1)
    expect(observe(obj)).toBe(ob1)

    // 浅层 observe
    expect(obj.a[OBSERVER_FLAG]).toBeUndefined()
    expect(obj.b[OBSERVER_FLAG]).toBeUndefined()
  })

  test('延迟到访问属性时才对属性值做深层 observe', () => {
    const obj1: any = {}
    const obj: any = { a: obj1 }
    const ob1 = observe(obj)!
    expect(ob1).toBeInstanceOf(Observer)
    expect(obj[OBSERVER_FLAG]).toBe(ob1)
    // 没有被 observe
    expect(obj1[OBSERVER_FLAG]).toBeUndefined()
    obj.a
    // 已经被 observe
    expect(obj1[OBSERVER_FLAG]).toBeInstanceOf(Observer)
  })
})
