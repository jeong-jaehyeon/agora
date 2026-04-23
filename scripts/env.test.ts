import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// env.ts는 import.meta.url 기반으로 .env.agora를 찾으므로,
// 실제 파일 대신 환경변수 fallback과 에러 케이스를 테스트합니다.

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    readFileSync: vi.fn(actual.readFileSync),
  }
})

import { readFileSync } from 'node:fs'
const mockedReadFileSync = vi.mocked(readFileSync)

describe('loadGitlabToken', () => {
  let loadGitlabToken: typeof import('./env').loadGitlabToken

  beforeEach(async () => {
    vi.resetModules()
    mockedReadFileSync.mockReset()
    mockedReadFileSync.mockImplementation((...args) => {
      const actual = vi.importActual<typeof import('node:fs')>('node:fs')
      return (actual as any).readFileSync(...args)
    })
    const mod = await import('./env')
    loadGitlabToken = mod.loadGitlabToken
  })

  afterEach(() => {
    delete process.env.GITLAB_TOKEN
    mockedReadFileSync.mockReset()
  })

  it('GITLAB_TOKEN 환경변수가 있으면 반환한다', () => {
    process.env.GITLAB_TOKEN = 'glpat-test-token'
    try {
      expect(loadGitlabToken()).toBe('glpat-test-token')
    } finally {
      delete process.env.GITLAB_TOKEN
    }
  })

  it('환경변수 GITLAB_TOKEN이 있으면 그 값 반환', () => {
    process.env.GITLAB_TOKEN = 'glpat-test-token-123'
    expect(loadGitlabToken()).toBe('glpat-test-token-123')
  })

  it('환경변수도 .env.agora도 없으면 에러를 던진다', () => {
    const original = process.env.GITLAB_TOKEN
    delete process.env.GITLAB_TOKEN

    mockedReadFileSync.mockImplementation(() => { throw new Error('ENOENT') })

    try {
      expect(() => loadGitlabToken()).toThrow()
    } finally {
      if (original !== undefined) process.env.GITLAB_TOKEN = original
      mockedReadFileSync.mockReset()
    }
  })
})

describe('loadGeminiModel', () => {
  let loadGeminiModel: typeof import('./env').loadGeminiModel

  beforeEach(async () => {
    vi.resetModules()
    mockedReadFileSync.mockReset()
    const mod = await import('./env')
    loadGeminiModel = mod.loadGeminiModel
  })

  afterEach(() => {
    mockedReadFileSync.mockReset()
  })

  it('GEMINI_MODEL 환경변수가 없으면 기본값 gemini-2.0-flash를 반환', () => {
    mockedReadFileSync.mockImplementation(() => { throw new Error('ENOENT') })
    expect(loadGeminiModel()).toBe('gemini-2.0-flash')
  })

  it('모델명을 반환 (기본값 또는 .env.agora 값)', () => {
    const model = loadGeminiModel()
    expect(typeof model).toBe('string')
    expect(model.length).toBeGreaterThan(0)
  })
})

describe('loadCopilotModel', () => {
  let loadCopilotModel: typeof import('./env').loadCopilotModel

  beforeEach(async () => {
    vi.resetModules()
    mockedReadFileSync.mockReset()
    const mod = await import('./env')
    loadCopilotModel = mod.loadCopilotModel
  })

  afterEach(() => {
    mockedReadFileSync.mockReset()
  })

  it('모델명을 반환 (기본값 또는 .env.agora 값)', () => {
    const model = loadCopilotModel()
    expect(typeof model).toBe('string')
    expect(model.length).toBeGreaterThan(0)
  })
})

describe('loadGitlabUrl', () => {
  let loadGitlabUrl: typeof import('./env').loadGitlabUrl

  beforeEach(async () => {
    vi.resetModules()
    mockedReadFileSync.mockReset()
    const mod = await import('./env')
    loadGitlabUrl = mod.loadGitlabUrl
  })

  afterEach(() => {
    mockedReadFileSync.mockReset()
  })

  it('URL을 반환 (기본값 또는 .env.agora 값)', () => {
    const url = loadGitlabUrl()
    expect(typeof url).toBe('string')
    expect(url).toMatch(/^https?:\/\//)
  })
})
