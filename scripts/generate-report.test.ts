import { describe, it, expect } from 'vitest'
import { esc, sevClass, sevLabel, sevEmoji, aiChipClass, opNameClass } from './generate-report.js'

describe('esc', () => {
  it('escapes < and >', () => {
    expect(esc('<script>')).toBe('&lt;script&gt;')
    expect(esc('<div>')).toBe('&lt;div&gt;')
  })

  it('escapes &', () => {
    expect(esc('A & B')).toBe('A &amp; B')
    expect(esc('&&')).toBe('&amp;&amp;')
  })

  it('escapes "', () => {
    expect(esc('"hello"')).toBe('&quot;hello&quot;')
  })

  it('leaves plain text unchanged', () => {
    expect(esc('hello world')).toBe('hello world')
    expect(esc('')).toBe('')
  })

  it('handles multiple special chars in one string', () => {
    expect(esc('<a href="x">A & B</a>')).toBe('&lt;a href=&quot;x&quot;&gt;A &amp; B&lt;/a&gt;')
  })
})

describe('sevClass', () => {
  it('returns e for error', () => {
    expect(sevClass('error')).toBe('e')
  })

  it('returns w for warning', () => {
    expect(sevClass('warning')).toBe('w')
  })

  it('returns i for info and unknown values', () => {
    expect(sevClass('info')).toBe('i')
    expect(sevClass('other')).toBe('i')
    expect(sevClass('')).toBe('i')
  })
})

describe('sevLabel', () => {
  it('returns 필수 for error', () => {
    expect(sevLabel('error')).toBe('필수')
  })

  it('returns 권장 for warning', () => {
    expect(sevLabel('warning')).toBe('권장')
  })

  it('returns 참고 for info and unknown values', () => {
    expect(sevLabel('info')).toBe('참고')
    expect(sevLabel('other')).toBe('참고')
    expect(sevLabel('')).toBe('참고')
  })
})

describe('sevEmoji', () => {
  it('returns red circle for error', () => {
    expect(sevEmoji('error')).toBe('🔴')
  })

  it('returns yellow circle for warning', () => {
    expect(sevEmoji('warning')).toBe('🟡')
  })

  it('returns blue circle for info and unknown values', () => {
    expect(sevEmoji('info')).toBe('🔵')
    expect(sevEmoji('other')).toBe('🔵')
    expect(sevEmoji('')).toBe('🔵')
  })
})

describe('aiChipClass', () => {
  it('returns c for claude', () => {
    expect(aiChipClass('claude')).toBe('c')
  })

  it('returns g for gemini', () => {
    expect(aiChipClass('gemini')).toBe('g')
  })

  it('returns p for copilot', () => {
    expect(aiChipClass('copilot')).toBe('p')
  })

  it('returns mc for mc', () => {
    expect(aiChipClass('mc')).toBe('mc')
  })

  it('returns empty string for unknown keys', () => {
    expect(aiChipClass('gpt')).toBe('')
    expect(aiChipClass('')).toBe('')
  })
})

describe('opNameClass', () => {
  it('returns c for claude', () => {
    expect(opNameClass('claude')).toBe('c')
  })

  it('returns g for gemini', () => {
    expect(opNameClass('gemini')).toBe('g')
  })

  it('returns p for copilot', () => {
    expect(opNameClass('copilot')).toBe('p')
  })

  it('returns empty string for unknown keys', () => {
    expect(opNameClass('mc')).toBe('')
    expect(opNameClass('')).toBe('')
  })
})
