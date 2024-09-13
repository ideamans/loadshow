import { getProperty, setProperty } from 'dot-prop'

// Functions to manipulate spec objects flexible and type safely by users

// Spec value is a string, number, boolean, or string array
export type SpecValue = string | number | boolean | string[]
// Spec is a value or a structured object
export type SpecLike = SpecValue | SpecObject
export interface SpecObject {
  [key: string]: SpecLike
}

export function boolish(value: SpecValue): boolean {
  if (typeof value === 'boolean') {
    return value
  } else if (typeof value === 'number') {
    return value !== 0
  } else if (Array.isArray(value)) {
    return true
  }
  return ['true', 'yes', '1'].includes(`${value}`.toLowerCase())
}

export function splitQuotedStrings(value: string): string[] {
  let state: 'bare' | 'single' | 'double' = 'bare'
  let escaped = false
  let chunk = ''
  const result: string[] = []

  for (let i = 0; i < value.length; i++) {
    const c = value[i]
    if (escaped) {
      chunk += c
      escaped = false
      continue
    }

    if (c === '\\') {
      escaped = true
      continue
    }

    if (state === 'single') {
      if (c === "'") {
        state = 'bare'
      } else {
        chunk += c
      }
    } else if (state === 'double') {
      if (c === '"') {
        state = 'bare'
      } else {
        chunk += c
      }
    } else {
      // state === 'bare'
      if (c === ',') {
        result.push(chunk)
        chunk = ''
      } else if (c === '"') {
        state = 'double'
      } else if (c === "'") {
        state = 'single'
      } else {
        chunk += c
      }
    }
  }

  result.push(chunk)
  return result
}

export function updateDeepProperty(
  obj: SpecObject,
  keyPath: string,
  value: SpecValue,
  reference: SpecObject,
  forcePrefixes: string[] = []
) {
  const defaultValue = getProperty(reference, keyPath)

  if (!forcePrefixes.some((prefix) => keyPath.startsWith(prefix))) {
    if (defaultValue === undefined || defaultValue === null) {
      throw new Error(`No such key ${keyPath} in spec`)
    }
  }

  if (typeof defaultValue === 'string') {
    // Stringify value
    setProperty(obj, keyPath, `${value}`)
  } else if (typeof defaultValue === 'number') {
    // Try to parse as number
    if (isNaN(Number(value))) {
      throw new Error(`Invalid number value for ${keyPath}: ${value}`)
    } else {
      setProperty(obj, keyPath, Number(value))
    }
  } else if (typeof defaultValue === 'boolean') {
    // Try to parse as boolean
    setProperty(obj, keyPath, boolish(value))
  } else if (Array.isArray(defaultValue)) {
    // Split quoted strings but keep the original array
    const values = Array.isArray(value) ? value.map((v) => `${v}`) : splitQuotedStrings(`${value}`)
    // Append to the original array
    const newValues = [...defaultValue, ...values.map((v) => v.trim())]
    setProperty(obj, keyPath, newValues)
  } else {
    // If defaultValue is undefined, reaching here means the key has forcePrefix
    setProperty(obj, keyPath, value)
  }
}

export function parseSpecPhrase(phrase: string): [string, string] {
  // Split by the first '='
  const equalIndex = phrase.indexOf('=')
  if (equalIndex === -1) {
    throw new Error(`Invalid spec phrase: ${phrase}`)
  }
  return [phrase.slice(0, equalIndex), phrase.slice(equalIndex + 1)]
}

export function mergeDeepProperties(
  obj: SpecObject,
  merge: SpecObject,
  reference: SpecObject,
  forcePrefixes: string[] = []
) {
  // Update values in the object recursively
  function walk(paths: string[], value: SpecLike) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || Array.isArray(value)) {
      updateDeepProperty(obj, paths.join('.'), value, reference, forcePrefixes)
    } else if (typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        walk([...paths, k], v)
      }
    }
  }

  walk([], merge)
}
