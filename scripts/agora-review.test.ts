import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}))

import { callGemini, callCopilot, callExternalAIs } from './agora-review'
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
      if (cmdStr.includes('gemini -p')) {
        return 'line 42에 null 체크가 필요합니다.'
      }
      return '' // rm cleanup 등
    })

    const result = callGemini(SAMPLE_PROMPT)
    expect(result.ai).toBe('Gemini')
    expect(result.icon).toBe('🐻')
    expect(result.response).toContain('null 체크')
    expect(result.error).toBeUndefined()
  })

  it('CLI 실행 실패 → error 반환', () => {
    mockedExecSync.mockImplementation((cmd: any) => {
      if (typeof cmd === 'string' && cmd.includes('gemini')) {
        throw new Error('gemini: command not found')
      }
      return ''
    })

    const result = callGemini(SAMPLE_PROMPT)
    expect(result.error).toContain('gemini')
    expect(result.response).toBe('')
  })

  it('타임아웃 → error 반환', () => {
    mockedExecSync.mockImplementation((cmd: any) => {
      if (typeof cmd === 'string' && cmd.includes('gemini')) {
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
      if (typeof cmd === 'string' && cmd.includes('gh copilot -p')) {
        return 'null 체크가 빠져있습니다. Optional chaining을 권장합니다.'
      }
      return ''
    })

    const result = callCopilot(SAMPLE_PROMPT)
    expect(result.ai).toBe('Copilot')
    expect(result.icon).toBe('🐱')
    expect(result.response).toContain('null 체크')
    expect(result.error).toBeUndefined()
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
  })

  it('CLI 호출 실패 → error', () => {
    mockedExecSync.mockImplementation((cmd: any) => {
      if (typeof cmd === 'string' && cmd.includes('--version')) {
        return 'GitHub Copilot CLI 1.0.22'
      }
      if (typeof cmd === 'string' && cmd.includes('gh copilot -p')) {
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

  it('2개 모두 성공 → 2개 결과, 경고 없음', () => {
    mockedExecSync.mockImplementation((cmd: any) => {
      if (typeof cmd === 'string' && cmd.includes('gemini')) return 'Gemini 리뷰 결과'
      if (typeof cmd === 'string' && cmd.includes('--version')) return '1.0.22'
      if (typeof cmd === 'string' && cmd.includes('gh copilot -p')) return 'Copilot 리뷰 결과'
      return ''
    })

    const output = callExternalAIs('diff content')
    expect(output.results).toHaveLength(2)
    expect(output.results.filter(r => !r.error)).toHaveLength(2)
    expect(output.warnings).toHaveLength(0)
  })

  it('1개 성공 + 1개 실패 → 경고 포함', () => {
    mockedExecSync.mockImplementation((cmd: any) => {
      if (typeof cmd === 'string' && cmd.includes('gemini')) throw new Error('fail')
      if (typeof cmd === 'string' && cmd.includes('--version')) return '1.0.22'
      if (typeof cmd === 'string' && cmd.includes('gh copilot -p')) return 'Copilot OK'
      return ''
    })

    const output = callExternalAIs('diff content')
    expect(output.results.filter(r => !r.error)).toHaveLength(1)
    expect(output.warnings.some(w => w.includes('Gemini'))).toBe(true)
  })

  it('전체 실패 → 에러 경고', () => {
    mockedExecSync.mockImplementation((cmd: any) => {
      if (typeof cmd === 'string' && cmd.includes('--version')) throw new Error('fail')
      if (typeof cmd === 'string' && cmd.includes('gemini')) throw new Error('fail')
      return ''
    })

    const output = callExternalAIs('diff content')
    expect(output.results.filter(r => !r.error)).toHaveLength(0)
    expect(output.warnings.some(w => w.includes('모든 외부 AI'))).toBe(true)
  })

  it('대형 diff → 경고 포함', () => {
    mockedExecSync.mockImplementation((cmd: any) => {
      if (typeof cmd === 'string' && cmd.includes('gemini')) return 'OK'
      if (typeof cmd === 'string' && cmd.includes('--version')) return '1.0.22'
      if (typeof cmd === 'string' && cmd.includes('gh copilot -p')) return 'OK'
      return ''
    })

    const largeDiff = 'line\n'.repeat(4000)
    const output = callExternalAIs(largeDiff)
    expect(output.warnings.some(w => w.includes('매우 큽니다'))).toBe(true)
    expect(output.diffLineCount).toBeGreaterThan(3000)
  })
})
