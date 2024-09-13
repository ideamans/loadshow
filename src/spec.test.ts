import test from 'ava'

import { boolish, mergeDeepProperties, SpecObject, splitQuotedStrings, updateDeepProperty } from './spec.js'

test('boolish', (t) => {
  t.is(boolish(true), true)
  t.is(boolish(false), false)
  t.is(boolish('true'), true)
  t.is(boolish('false'), false)
  t.is(boolish('TRUE'), true)
  t.is(boolish('FALSE'), false)
  t.is(boolish('yes'), true)
  t.is(boolish('no'), false)
  t.is(boolish('YES'), true)
  t.is(boolish('NO'), false)
  t.is(boolish('1'), true)
  t.is(boolish('0'), false)
})

test('splitQuotedStrings', (t) => {
  const result = splitQuotedStrings(`a,b,"c,d",'e,
f',"g\\'\\"\\\\",`)

  // ignore
  t.deepEqual(result, ['a', 'b', 'c,d', 'e,\nf', 'g\'"\\', ''])
})

test('updateDeepProperty', (t) => {
  const reference: SpecObject = {
    string: 'string',
    number: 1,
    boolean: false,
    strings: ['a', 'b', 'c'],
    stringOnly: {
      string: 'string',
      number: 'string',
      boolean: 'false',
      strings: 'string',
    },
    numberOnly: {
      string: 1,
      number: 2,
    },
    booleanOnly: {
      string: false,
      number: false,
      boolean: false,
    },
    stringsOnly: {
      string: ['a', 'b', 'c'],
      number: ['a', 'b', 'c'],
      boolean: ['a', 'b', 'c'],
    },
    stringsMap: {
      force: {},
    },
  }

  const obj: SpecObject = {}
  const forcePrefixes = ['stringsMap.force.']

  updateDeepProperty(obj, 'string', 'new string', reference)
  updateDeepProperty(obj, 'number', 10, reference)
  updateDeepProperty(obj, 'boolean', true, reference)
  updateDeepProperty(obj, 'strings', ['x', 'y', 'z'], reference)

  updateDeepProperty(obj, 'stringOnly.string', 'new string', reference)
  updateDeepProperty(obj, 'stringOnly.number', 15, reference)
  updateDeepProperty(obj, 'stringOnly.boolean', true, reference)
  updateDeepProperty(obj, 'stringOnly.strings', ['x', 'y', 'z'], reference)

  updateDeepProperty(obj, 'numberOnly.string', '20', reference)
  updateDeepProperty(obj, 'numberOnly.number', 25, reference)

  updateDeepProperty(obj, 'booleanOnly.string', 'true', reference)
  updateDeepProperty(obj, 'booleanOnly.number', 1, reference)
  updateDeepProperty(obj, 'booleanOnly.boolean', true, reference)

  updateDeepProperty(obj, 'stringsOnly.string', 'x,y,z', reference)
  updateDeepProperty(obj, 'stringsOnly.number', 30, reference)
  updateDeepProperty(obj, 'stringsOnly.boolean', true, reference)

  // With forcePrefixes
  updateDeepProperty(obj, 'stringsMap.force.string', 'new string', reference, forcePrefixes)

  t.deepEqual(obj, {
    string: 'new string',
    number: 10,
    boolean: true,
    strings: ['a', 'b', 'c', 'x', 'y', 'z'],
    stringOnly: {
      string: 'new string',
      number: '15',
      boolean: 'true',
      strings: 'x,y,z',
    },
    numberOnly: { string: 20, number: 25 },
    booleanOnly: { string: true, number: true, boolean: true },
    stringsOnly: {
      string: ['a', 'b', 'c', 'x', 'y', 'z'],
      number: ['a', 'b', 'c', '30'],
      boolean: ['a', 'b', 'c', 'true'],
    },
    stringsMap: {
      force: {
        string: 'new string',
      },
    },
  })
})

test('mergeDeepProperties', (t) => {
  const reference: SpecObject = {
    string: 'string',
    number: 1,
    boolean: false,
    strings: ['a', 'b', 'c'],
    stringOnly: {
      string: 'string',
      number: 'string',
      boolean: 'false',
      strings: 'string',
    },
    numberOnly: {
      string: 1,
      number: 2,
    },
    booleanOnly: {
      string: false,
      number: false,
      boolean: false,
    },
    stringsOnly: {
      string: ['a', 'b', 'c'],
      number: ['a', 'b', 'c'],
      boolean: ['a', 'b', 'c'],
    },
  }

  const merge: SpecObject = {
    string: 'new string',
    number: 10,
    boolean: true,
    strings: ['x', 'y', 'z'],
    stringOnly: {
      string: 'new string',
      number: '15',
      boolean: 'true',
      strings: ['x', 'y', 'z'],
    },
    numberOnly: { string: 20, number: 25 },
    booleanOnly: { string: true, number: true, boolean: true },
    stringsOnly: {
      string: ['x', 'y', 'z'],
      number: ['30', '35'],
      boolean: ['true', 'false'],
    },
    stringsMap: {
      force: {
        string: 'new string 2',
      },
    },
  }

  const obj: SpecObject = {}
  const forcePrefixes = ['stringsMap.force']
  mergeDeepProperties(obj, merge, reference, forcePrefixes)

  t.deepEqual(obj, {
    string: 'new string',
    number: 10,
    boolean: true,
    strings: ['a', 'b', 'c', 'x', 'y', 'z'],
    stringOnly: {
      string: 'new string',
      number: '15',
      boolean: 'true',
      strings: 'x,y,z',
    },
    numberOnly: { string: 20, number: 25 },
    booleanOnly: { string: true, number: true, boolean: true },
    stringsOnly: {
      string: ['a', 'b', 'c', 'x', 'y', 'z'],
      number: ['a', 'b', 'c', '30', '35'],
      boolean: ['a', 'b', 'c', 'true', 'false'],
    },
    stringsMap: {
      force: {
        string: 'new string 2',
      },
    },
  })
})
