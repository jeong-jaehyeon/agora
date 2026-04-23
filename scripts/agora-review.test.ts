import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { existsSync, rmSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { EventEmitter } from 'events'

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}))

import {
  callGemini,
  callCopilot,
  callExternalAIs,
  loadGeminiModel,
  loadCopilotModel,
  runConnectionTest,
  saveReviewHistory,
} from './agora-review'
import { spawn } from 'child_process'

const mockedSpawn = vi.mocked(spawn)

function makeMockProcess(stdout = '', exitCode = 0, errorCode?: string, errorMessage?: string) {
  const proc = new EventEmitter() as any
  proc.stdout = new EventEmitter()
  proc.stderr = new EventEmitter()
  proc.stdin = { write: vi.fn(), end: vi.fn() }
  proc.kill = vi.fn()

  setTimeout(() => {
    if (errorCode) {
      const err = Object.assign(new Error(errorMessage || errorCode), { code: errorCode })
      proc.emit('error', err)
    } else {
      if (stdout) proc.stdout.emit('data', Buffer.from(stdout))
      proc.emit('close', exitCode)
    }
  }, 0)

  return proc
}

function makeMockProcessNonZero(stderr = '', exitCode = 1) {
  const proc = new EventEmitter() as any
  proc.stdout = new EventEmitter()
  proc.stderr = new EventEmitter()
  proc.stdin = { write: vi.fn(), end: vi.fn() }
  proc.kill = vi.fn()

  setTimeout(() => {
    if (stderr) proc.stderr.emit('data', Buffer.from(stderr))
    proc.emit('close', exitCode)
  }, 0)

  return proc
}

const SAMPLE_PROMPT = '코드 리뷰 프롬프트...'

// ─── Gemini Tests ────────────────────────────────────────

describe('callGemini', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('정상 응답 → response 반환', async () => {
    mockedSpawn.mockReturnValueOnce(makeMockProcess('line 42에 null 체크가 필요합니다.') as any)

    const result = await callGemini(SAMPLE_PROMPT)
    expect(result.ai).toBe('Gemini')
    expect(result.icon).toBe('🐻')
    expect(result.response).toContain('null 체크')
    expect(result.error).toBeUndefined()
    expect(result.model).toBeDefined()
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('CLI 실행 실패 → error 반환', async () => {
    mockedSpawn.mockReturnValueOnce(makeMockProcess('', 0, 'ENOENT', 'gemini: command not found') as any)

    const result = await callGemini(SAMPLE_PROMPT)
    expect(result.error).toContain('gemini')
    expect(result.response).toBe('')
    expect(result.model).toBeDefined()
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('타임아웃 → error 반환', async () => {
    mockedSpawn.mockReturnValueOnce(makeMockProcess('', 0, 'ETIMEDOUT', 'CLI timeout after 120000ms') as any)

    const result = await callGemini(SAMPLE_PROMPT)
    expect(result.error).toContain('CLI timeout')
  })
})

// ─── Copilot Tests ───────────────────────────────────────

describe('callCopilot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('정상 응답 → response 반환', async () => {
    // First spawn: gh copilot --version (preflight)
    mockedSpawn.mockReturnValueOnce(makeMockProcess('GitHub Copilot CLI 1.0.22') as any)
    // Second spawn: gh copilot -- --model <model> -s (actual call)
    mockedSpawn.mockReturnValueOnce(makeMockProcess('null 체크가 빠져있습니다. Optional chaining을 권장합니다.') as any)

    const result = await callCopilot(SAMPLE_PROMPT)
    expect(result.ai).toBe('Copilot')
    expect(result.icon).toBe('🐱')
    expect(result.response).toContain('null 체크')
    expect(result.error).toBeUndefined()
    expect(result.model).toBeDefined()
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('gh copilot 미설치 → error', async () => {
    // Preflight fails
    mockedSpawn.mockReturnValueOnce(makeMockProcess('', 0, 'ENOENT', 'command not found') as any)

    const result = await callCopilot(SAMPLE_PROMPT)
    expect(result.error).toContain('GitHub Copilot CLI')
    expect(result.model).toBeDefined()
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('CLI 호출 실패 → error', async () => {
    // Preflight succeeds
    mockedSpawn.mockReturnValueOnce(makeMockProcess('GitHub Copilot CLI 1.0.22') as any)
    // Actual call fails (non-zero exit)
    mockedSpawn.mockReturnValueOnce(makeMockProcessNonZero('API error') as any)

    const result = await callCopilot(SAMPLE_PROMPT)
    expect(result.error).toContain('API error')
  })
})

// ─── Orchestrator Tests ──────────────────────────────────

describe('callExternalAIs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('2개 모두 성공 → 2개 결과, 경고 없음, totalDurationMs 포함', async () => {
    // Gemini call
    mockedSpawn.mockReturnValueOnce(makeMockProcess('Gemini 리뷰 결과') as any)
    // Copilot preflight
    mockedSpawn.mockReturnValueOnce(makeMockProcess('1.0.22') as any)
    // Copilot actual call
    mockedSpawn.mockReturnValueOnce(makeMockProcess('Copilot 리뷰 결과') as any)

    const output = await callExternalAIs('diff content')
    expect(output.results).toHaveLength(2)
    expect(output.results.filter(r => !r.error)).toHaveLength(2)
    expect(output.warnings).toHaveLength(0)
    expect(output.totalDurationMs).toBeGreaterThanOrEqual(0)
    // 각 결과에 model, durationMs 포함 확인
    output.results.forEach(r => {
      expect(r.model).toBeDefined()
      expect(r.durationMs).toBeGreaterThanOrEqual(0)
    })
  })

  it('1개 성공 + 1개 실패 → 경고 포함', async () => {
    // Gemini fails
    mockedSpawn.mockReturnValueOnce(makeMockProcessNonZero('fail') as any)
    // Copilot preflight succeeds
    mockedSpawn.mockReturnValueOnce(makeMockProcess('1.0.22') as any)
    // Copilot actual call succeeds
    mockedSpawn.mockReturnValueOnce(makeMockProcess('Copilot OK') as any)

    const output = await callExternalAIs('diff content')
    expect(output.results.filter(r => !r.error)).toHaveLength(1)
    expect(output.warnings.some(w => w.includes('Gemini'))).toBe(true)
  })

  it('전체 실패 → 에러 경고', async () => {
    // Gemini fails
    mockedSpawn.mockReturnValueOnce(makeMockProcessNonZero('fail') as any)
    // Copilot preflight fails (triggers immediate error return)
    mockedSpawn.mockReturnValueOnce(makeMockProcessNonZero('fail') as any)

    const output = await callExternalAIs('diff content')
    expect(output.results.filter(r => !r.error)).toHaveLength(0)
    expect(output.warnings.some(w => w.includes('모든 외부 AI'))).toBe(true)
  })

  it('대형 diff → 경고 포함', async () => {
    // Gemini call
    mockedSpawn.mockReturnValueOnce(makeMockProcess('OK') as any)
    // Copilot preflight
    mockedSpawn.mockReturnValueOnce(makeMockProcess('1.0.22') as any)
    // Copilot actual call
    mockedSpawn.mockReturnValueOnce(makeMockProcess('OK') as any)

    const largeDiff = 'line\n'.repeat(4000)
    const output = await callExternalAIs(largeDiff)
    expect(output.warnings.some(w => w.includes('매우 큽니다'))).toBe(true)
    expect(output.diffLineCount).toBeGreaterThan(3000)
  })
})

// ─── Model Helpers Tests ────────────────────────────────

describe('loadGeminiModel', () => {
  it('GEMINI_MODEL 환경변수가 없으면 기본값 반환', () => {
    // .env.agora에 GEMINI_MODEL이 없으므로 기본값
    const model = loadGeminiModel()
    expect(model).toBe('gemini-2.0-flash')
  })
})

describe('loadCopilotModel', () => {
  it('모델명을 반환', () => {
    const model = loadCopilotModel()
    expect(typeof model).toBe('string')
    expect(model.length).toBeGreaterThan(0)
  })
})

// ─── Connection Test Tests ──────────────────────────────

describe('runConnectionTest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('두 AI 모두 성공 → ok: true, responseTime 포함', async () => {
    // Gemini call
    mockedSpawn.mockReturnValueOnce(makeMockProcess('Hello!') as any)
    // Copilot preflight
    mockedSpawn.mockReturnValueOnce(makeMockProcess('1.0.22') as any)
    // Copilot actual call
    mockedSpawn.mockReturnValueOnce(makeMockProcess('Hi there!') as any)

    const result = await runConnectionTest()
    expect(result.tests).toHaveLength(2)

    const gemini = result.tests.find(t => t.ai === 'Gemini')!
    expect(gemini.ok).toBe(true)
    expect(gemini.model).toBeDefined()
    expect(gemini.responseTime).toBeGreaterThanOrEqual(0)

    const copilot = result.tests.find(t => t.ai === 'Copilot')!
    expect(copilot.ok).toBe(true)
    expect(copilot.responseTime).toBeGreaterThanOrEqual(0)
  })

  it('Gemini 실패 → ok: false, error 포함', async () => {
    // Gemini fails
    mockedSpawn.mockReturnValueOnce(makeMockProcess('', 0, 'ENOENT', 'gemini: command not found') as any)
    // Copilot preflight
    mockedSpawn.mockReturnValueOnce(makeMockProcess('1.0.22') as any)
    // Copilot actual call
    mockedSpawn.mockReturnValueOnce(makeMockProcess('Hi!') as any)

    const result = await runConnectionTest()
    const gemini = result.tests.find(t => t.ai === 'Gemini')!
    expect(gemini.ok).toBe(false)
    expect(gemini.error).toContain('gemini')
  })

  it('Copilot 실패 → ok: false, error 포함', async () => {
    // Gemini succeeds
    mockedSpawn.mockReturnValueOnce(makeMockProcess('Hello!') as any)
    // Copilot preflight fails (non-zero exit with stderr)
    mockedSpawn.mockReturnValueOnce(makeMockProcessNonZero('gh copilot: command not found') as any)

    const result = await runConnectionTest()
    const copilot = result.tests.find(t => t.ai === 'Copilot')!
    expect(copilot.ok).toBe(false)
    expect(copilot.error).toContain('command not found')
  })
})

// ─── History Tests ──────────────────────────────────────

describe('saveReviewHistory', () => {
  const testDir = join(tmpdir(), '.agora-test-reviews')

  afterEach(() => {
    try { rmSync(testDir, { recursive: true, force: true }) } catch {}
  })

  it('JSON 파일을 저장하고 경로를 반환', () => {
    // homedir을 mock하여 테스트 디렉토리 사용
    const originalHomedir = process.env.HOME
    process.env.HOME = tmpdir()

    const output = {
      results: [{ ai: 'Gemini', icon: '🐻', response: '리뷰 결과', model: 'gemini-2.0-flash', durationMs: 1000 }],
      warnings: [],
      diffLineCount: 10,
      totalDurationMs: 1500,
    }

    const savedPath = saveReviewHistory(output, '/tmp/agora-diff-42.diff')

    expect(savedPath).toContain('.agora/reviews/')
    expect(savedPath).toContain('agora-diff-42.json')
    expect(existsSync(savedPath)).toBe(true)

    const savedContent = JSON.parse(readFileSync(savedPath, 'utf-8'))
    expect(savedContent.results).toHaveLength(1)
    expect(savedContent.diffLineCount).toBe(10)

    // 정리
    process.env.HOME = originalHomedir
  })
})
