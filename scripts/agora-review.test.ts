import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock setup ──────────────────────────────────────────

const mockAnthropicCreate = vi.fn()
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockAnthropicCreate },
  })),
}))

const mockGeminiGenerate = vi.fn()
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: () => ({
      generateContent: mockGeminiGenerate,
    }),
  })),
}))

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}))

// ─── Import after mocks ─────────────────────────────────

import { callClaude, callGemini, callCopilot, callAllAIs } from './agora-review'
import type { ReviewIssue } from './agora-review'
import { execSync } from 'child_process'

const SAMPLE_DIFF = `diff --git a/src/app.ts b/src/app.ts
--- a/src/app.ts
+++ b/src/app.ts
@@ -10,6 +10,8 @@
 function getData(id: string) {
-  return db.query(id)
+  const result = db.query(id)
+  if (!result) return null
+  return result.data
 }`

const SAMPLE_ISSUES: ReviewIssue[] = [
  {
    file: 'src/app.ts',
    line: 12,
    severity: 'warning',
    category: 'bug',
    description: 'null 반환 시 호출부에서 처리가 필요합니다',
    suggestion: 'Optional chaining 또는 null 체크를 호출부에 추가하세요',
  },
]

// ─── Claude Tests ────────────────────────────────────────

describe('callClaude', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ANTHROPIC_API_KEY = 'test-key'
  })

  it('정상 tool_use 응답 → ReviewResult 반환', async () => {
    mockAnthropicCreate.mockResolvedValueOnce({
      content: [{
        type: 'tool_use',
        name: 'submit_review',
        input: {
          summary: '데이터 조회 시 null 체크를 추가한 변경',
          issues: SAMPLE_ISSUES,
        },
      }],
    })

    const result = await callClaude(SAMPLE_DIFF)
    expect(result.ai).toBe('Claude')
    expect(result.icon).toBe('🐶')
    expect(result.issues).toHaveLength(1)
    expect(result.summary).toContain('null')
    expect(result.error).toBeUndefined()
  })

  it('tool_use 없는 응답 → 텍스트 폴백', async () => {
    mockAnthropicCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '리뷰 결과입니다...' }],
    })

    const result = await callClaude(SAMPLE_DIFF)
    expect(result.issues).toHaveLength(0)
    expect(result.raw).toContain('리뷰 결과')
  })

  it('API 키 없음 → 에러', async () => {
    delete process.env.ANTHROPIC_API_KEY
    await expect(callClaude(SAMPLE_DIFF)).rejects.toThrow('ANTHROPIC_API_KEY')
  })

  it('401 에러 → 재시도 없이 실패', async () => {
    mockAnthropicCreate.mockRejectedValue(new Error('401 Unauthorized'))
    await expect(callClaude(SAMPLE_DIFF)).rejects.toThrow('401')
    expect(mockAnthropicCreate).toHaveBeenCalledTimes(1)
  })

  it('429 에러 → 재시도 후 성공', async () => {
    mockAnthropicCreate
      .mockRejectedValueOnce(new Error('429 rate limit'))
      .mockResolvedValueOnce({
        content: [{
          type: 'tool_use',
          name: 'submit_review',
          input: { summary: '요약', issues: [] },
        }],
      })

    const result = await callClaude(SAMPLE_DIFF)
    expect(result.issues).toHaveLength(0)
    expect(mockAnthropicCreate).toHaveBeenCalledTimes(2)
  })

  it('429 3회 연속 → 최종 실패', async () => {
    const error = new Error('429 rate limit')
    mockAnthropicCreate.mockRejectedValue(error)

    await expect(callClaude(SAMPLE_DIFF)).rejects.toThrow('429')
    expect(mockAnthropicCreate).toHaveBeenCalledTimes(4) // 1 initial + 3 retries
  }, 15000)
})

// ─── Gemini Tests ────────────────────────────────────────

describe('callGemini', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GEMINI_API_KEY = 'test-key'
  })

  it('정상 JSON 응답 → ReviewResult 반환', async () => {
    mockGeminiGenerate.mockResolvedValueOnce({
      response: {
        text: () => JSON.stringify({
          summary: 'null 체크 추가',
          issues: SAMPLE_ISSUES,
        }),
      },
    })

    const result = await callGemini(SAMPLE_DIFF)
    expect(result.ai).toBe('Gemini')
    expect(result.icon).toBe('🐻')
    expect(result.issues).toHaveLength(1)
  })

  it('비정상 JSON → 텍스트 폴백', async () => {
    mockGeminiGenerate.mockResolvedValueOnce({
      response: { text: () => '이건 JSON이 아닙니다...' },
    })

    const result = await callGemini(SAMPLE_DIFF)
    expect(result.issues).toHaveLength(0)
    expect(result.raw).toContain('JSON이 아닙니다')
  })

  it('API 키 없음 → 에러', async () => {
    delete process.env.GEMINI_API_KEY
    await expect(callGemini(SAMPLE_DIFF)).rejects.toThrow('GEMINI_API_KEY')
  })

  it('빈 issues → 빈 배열', async () => {
    mockGeminiGenerate.mockResolvedValueOnce({
      response: {
        text: () => JSON.stringify({ summary: '이슈 없음', issues: [] }),
      },
    })

    const result = await callGemini(SAMPLE_DIFF)
    expect(result.issues).toHaveLength(0)
    expect(result.summary).toBe('이슈 없음')
  })
})

// ─── Copilot Tests ───────────────────────────────────────

describe('callCopilot', () => {
  const mockedExecSync = vi.mocked(execSync)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('정상 JSON 응답 → ReviewResult 반환', async () => {
    mockedExecSync
      .mockReturnValueOnce('0.1.0') // version check
      .mockReturnValueOnce(JSON.stringify({
        summary: 'null 체크 추가',
        issues: SAMPLE_ISSUES,
      }))

    const result = await callCopilot(SAMPLE_DIFF)
    expect(result.ai).toBe('Copilot')
    expect(result.icon).toBe('🐱')
    expect(result.issues).toHaveLength(1)
  })

  it('gh copilot 미설치 → 에러', async () => {
    mockedExecSync.mockImplementation(() => { throw new Error('command not found') })

    await expect(callCopilot(SAMPLE_DIFF)).rejects.toThrow('GitHub Copilot CLI')
  })

  it('비정상 응답 → 텍스트 폴백', async () => {
    mockedExecSync
      .mockReturnValueOnce('0.1.0')
      .mockReturnValueOnce('이건 JSON이 아닌 일반 텍스트')

    const result = await callCopilot(SAMPLE_DIFF)
    expect(result.issues).toHaveLength(0)
    expect(result.raw).toBeDefined()
  })

  it('JSON이 응답 중간에 포함 → 추출 성공', async () => {
    mockedExecSync
      .mockReturnValueOnce('0.1.0')
      .mockReturnValueOnce(
        '아래는 리뷰 결과입니다:\n' +
        JSON.stringify({ summary: '변경 요약', issues: SAMPLE_ISSUES }) +
        '\n이상입니다.',
      )

    const result = await callCopilot(SAMPLE_DIFF)
    expect(result.issues).toHaveLength(1)
  })
})

// ─── Orchestrator Tests ──────────────────────────────────

describe('callAllAIs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ANTHROPIC_API_KEY = 'test-key'
    process.env.GEMINI_API_KEY = 'test-key'
  })

  it('3개 모두 성공 → 3개 결과', async () => {
    mockAnthropicCreate.mockResolvedValueOnce({
      content: [{
        type: 'tool_use',
        name: 'submit_review',
        input: { summary: '요약', issues: SAMPLE_ISSUES },
      }],
    })
    mockGeminiGenerate.mockResolvedValueOnce({
      response: { text: () => JSON.stringify({ summary: '요약', issues: SAMPLE_ISSUES }) },
    })
    const mockedExecSync = vi.mocked(execSync)
    let callCount = 0
    mockedExecSync.mockImplementation(() => {
      callCount++
      if (callCount === 1) return '0.1.0' as any // version check
      return JSON.stringify({ summary: '요약', issues: SAMPLE_ISSUES }) as any
    })

    const output = await callAllAIs(SAMPLE_DIFF)
    expect(output.results).toHaveLength(3)
    const succeeded = output.results.filter(r => !r.error)
    expect(succeeded).toHaveLength(3)
    expect(output.warnings).toHaveLength(0)
  })

  it('2개 성공 + 1 실패 → 경고 포함', async () => {
    mockAnthropicCreate.mockResolvedValueOnce({
      content: [{
        type: 'tool_use',
        name: 'submit_review',
        input: { summary: '요약', issues: [] },
      }],
    })
    mockGeminiGenerate.mockRejectedValueOnce(new Error('API 에러'))
    const mockedExecSync = vi.mocked(execSync)
    let callCount = 0
    mockedExecSync.mockImplementation(() => {
      callCount++
      if (callCount === 1) return '0.1.0' as any
      return JSON.stringify({ summary: '요약', issues: [] }) as any
    })

    const output = await callAllAIs(SAMPLE_DIFF)
    expect(output.results).toHaveLength(3)
    const succeeded = output.results.filter(r => !r.error)
    expect(succeeded).toHaveLength(2)
    expect(output.warnings.some(w => w.includes('Gemini'))).toBe(true)
  })

  it('전체 실패 → 에러 경고', async () => {
    mockAnthropicCreate.mockRejectedValueOnce(new Error('fail'))
    mockGeminiGenerate.mockRejectedValueOnce(new Error('fail'))
    const mockedExecSync = vi.mocked(execSync)
    mockedExecSync.mockImplementation(() => { throw new Error('fail') })

    const output = await callAllAIs(SAMPLE_DIFF)
    const succeeded = output.results.filter(r => !r.error)
    expect(succeeded).toHaveLength(0)
    expect(output.warnings.some(w => w.includes('모든 AI'))).toBe(true)
  })

  it('대형 diff → 경고 포함', async () => {
    const largeDiff = 'line\n'.repeat(4000)
    mockAnthropicCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', name: 'submit_review', input: { summary: '', issues: [] } }],
    })
    mockGeminiGenerate.mockResolvedValueOnce({
      response: { text: () => JSON.stringify({ summary: '', issues: [] }) },
    })
    const mockedExecSync = vi.mocked(execSync)
    let callCount = 0
    mockedExecSync.mockImplementation(() => {
      callCount++
      if (callCount === 1) return '0.1.0' as any
      return JSON.stringify({ summary: '', issues: [] }) as any
    })

    const output = await callAllAIs(largeDiff)
    expect(output.warnings.some(w => w.includes('매우 큽니다'))).toBe(true)
    expect(output.diffLineCount).toBeGreaterThan(3000)
  })
})
