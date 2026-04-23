import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { existsSync, rmSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

vi.mock('child_process', () => ({
  execSync: vi.fn(),
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
import { execSync } from 'child_process'

const mockedExecSync = vi.mocked(execSync)

const SAMPLE_PROMPT = '코드 리뷰 프롬프트...'

// ─── Gemini Tests ────────────────────────────────────────

describe('callGemini', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('정상 응답 → response 반환', () => {
    mockedExecSync.mockImplementation((cmd: any) => {
      const cmdStr = typeof cmd === 'string' ? cmd : ''
      if (cmdStr.includes('gemini -o text')) {
        return 'line 42에 null 체크가 필요합니다.'
      }
      return ''
    })

    const result = callGemini(SAMPLE_PROMPT)
    expect(result.ai).toBe('Gemini')
    expect(result.icon).toBe('🐻')
    expect(result.response).toContain('null 체크')
    expect(result.error).toBeUndefined()
    expect(result.model).toBeDefined()
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('CLI 실행 실패 → error 반환', () => {
    mockedExecSync.mockImplementation((cmd: any) => {
      if (typeof cmd === 'string' && cmd.includes('gemini -o text')) {
        throw new Error('gemini: command not found')
      }
      return ''
    })

    const result = callGemini(SAMPLE_PROMPT)
    expect(result.error).toContain('gemini')
    expect(result.response).toBe('')
    expect(result.model).toBeDefined()
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('타임아웃 → error 반환', () => {
    mockedExecSync.mockImplementation((cmd: any) => {
      if (typeof cmd === 'string' && cmd.includes('gemini -o text')) {
        throw new Error('ETIMEDOUT')
      }
      return ''
    })

    const result = callGemini(SAMPLE_PROMPT)
    expect(result.error).toContain('ETIMEDOUT')
  })
})

// ─── Copilot Tests ───────────────────────────────────────

describe('callCopilot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('정상 응답 → response 반환', () => {
    mockedExecSync.mockImplementation((cmd: any) => {
      if (typeof cmd === 'string' && cmd.includes('--version')) {
        return 'GitHub Copilot CLI 1.0.22'
      }
      if (typeof cmd === 'string' && cmd.includes('gh copilot -- --model')) {
        return 'null 체크가 빠져있습니다. Optional chaining을 권장합니다.'
      }
      return ''
    })

    const result = callCopilot(SAMPLE_PROMPT)
    expect(result.ai).toBe('Copilot')
    expect(result.icon).toBe('🐱')
    expect(result.response).toContain('null 체크')
    expect(result.error).toBeUndefined()
    expect(result.model).toBeDefined()
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('gh copilot 미설치 → error', () => {
    mockedExecSync.mockImplementation((cmd: any) => {
      if (typeof cmd === 'string' && cmd.includes('--version')) {
        throw new Error('command not found')
      }
      return ''
    })

    const result = callCopilot(SAMPLE_PROMPT)
    expect(result.error).toContain('GitHub Copilot CLI')
    expect(result.model).toBeDefined()
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('CLI 호출 실패 → error', () => {
    mockedExecSync.mockImplementation((cmd: any) => {
      if (typeof cmd === 'string' && cmd.includes('--version')) {
        return 'GitHub Copilot CLI 1.0.22'
      }
      if (typeof cmd === 'string' && cmd.includes('gh copilot -- --model')) {
        throw new Error('API error')
      }
      return ''
    })

    const result = callCopilot(SAMPLE_PROMPT)
    expect(result.error).toContain('API error')
  })
})

// ─── Orchestrator Tests ──────────────────────────────────

describe('callExternalAIs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('2개 모두 성공 → 2개 결과, 경고 없음, totalDurationMs 포함', () => {
    mockedExecSync.mockImplementation((cmd: any) => {
      if (typeof cmd === 'string' && cmd.includes('gemini -o text')) return 'Gemini 리뷰 결과'
      if (typeof cmd === 'string' && cmd.includes('--version')) return '1.0.22'
      if (typeof cmd === 'string' && cmd.includes('gh copilot -- --model')) return 'Copilot 리뷰 결과'
      return ''
    })

    const output = callExternalAIs('diff content')
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

  it('1개 성공 + 1개 실패 → 경고 포함', () => {
    mockedExecSync.mockImplementation((cmd: any) => {
      if (typeof cmd === 'string' && cmd.includes('gemini -o text')) throw new Error('fail')
      if (typeof cmd === 'string' && cmd.includes('--version')) return '1.0.22'
      if (typeof cmd === 'string' && cmd.includes('gh copilot -- --model')) return 'Copilot OK'
      return ''
    })

    const output = callExternalAIs('diff content')
    expect(output.results.filter(r => !r.error)).toHaveLength(1)
    expect(output.warnings.some(w => w.includes('Gemini'))).toBe(true)
  })

  it('전체 실패 → 에러 경고', () => {
    mockedExecSync.mockImplementation((cmd: any) => {
      if (typeof cmd === 'string' && cmd.includes('--version')) throw new Error('fail')
      if (typeof cmd === 'string' && cmd.includes('gemini -o text')) throw new Error('fail')
      return ''
    })

    const output = callExternalAIs('diff content')
    expect(output.results.filter(r => !r.error)).toHaveLength(0)
    expect(output.warnings.some(w => w.includes('모든 외부 AI'))).toBe(true)
  })

  it('대형 diff → 경고 포함', () => {
    mockedExecSync.mockImplementation((cmd: any) => {
      if (typeof cmd === 'string' && cmd.includes('gemini -o text')) return 'OK'
      if (typeof cmd === 'string' && cmd.includes('--version')) return '1.0.22'
      if (typeof cmd === 'string' && cmd.includes('gh copilot -- --model')) return 'OK'
      return ''
    })

    const largeDiff = 'line\n'.repeat(4000)
    const output = callExternalAIs(largeDiff)
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

  it('두 AI 모두 성공 → ok: true, responseTime 포함', () => {
    mockedExecSync.mockImplementation((cmd: any) => {
      if (typeof cmd === 'string' && cmd.includes('gemini -o text')) return 'Hello!'
      if (typeof cmd === 'string' && cmd.includes('--version')) return '1.0.22'
      if (typeof cmd === 'string' && cmd.includes('gh copilot -- --model')) return 'Hi there!'
      return ''
    })

    const result = runConnectionTest()
    expect(result.tests).toHaveLength(2)

    const gemini = result.tests.find(t => t.ai === 'Gemini')!
    expect(gemini.ok).toBe(true)
    expect(gemini.model).toBeDefined()
    expect(gemini.responseTime).toBeGreaterThanOrEqual(0)

    const copilot = result.tests.find(t => t.ai === 'Copilot')!
    expect(copilot.ok).toBe(true)
    expect(copilot.responseTime).toBeGreaterThanOrEqual(0)
  })

  it('Gemini 실패 → ok: false, error 포함', () => {
    mockedExecSync.mockImplementation((cmd: any) => {
      if (typeof cmd === 'string' && cmd.includes('gemini -o text')) throw new Error('gemini: command not found')
      if (typeof cmd === 'string' && cmd.includes('--version')) return '1.0.22'
      if (typeof cmd === 'string' && cmd.includes('gh copilot -- --model')) return 'Hi!'
      return ''
    })

    const result = runConnectionTest()
    const gemini = result.tests.find(t => t.ai === 'Gemini')!
    expect(gemini.ok).toBe(false)
    expect(gemini.error).toContain('gemini')
  })

  it('Copilot 실패 → ok: false, error 포함', () => {
    mockedExecSync.mockImplementation((cmd: any) => {
      if (typeof cmd === 'string' && cmd.includes('gemini -o text')) return 'Hello!'
      if (typeof cmd === 'string' && cmd.includes('--version')) throw new Error('gh copilot: command not found')
      return ''
    })

    const result = runConnectionTest()
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
