import { readFileSync } from 'fs'
import { resolve } from 'path'
import { config } from 'dotenv'

// .env.agora 로드
config({ path: resolve(import.meta.dirname, '..', '.env.agora') })

// ─── Types ───────────────────────────────────────────────

export interface ReviewIssue {
  file: string
  line: number
  severity: 'error' | 'warning' | 'info'
  category: 'bug' | 'security' | 'performance' | 'style' | 'logic' | 'type-safety'
  description: string
  suggestion: string
}

export interface ReviewResult {
  ai: string
  icon: string
  issues: ReviewIssue[]
  summary?: string
  raw?: string // 텍스트 폴백 시 원본
  error?: string
}

interface AgoraOutput {
  results: ReviewResult[]
  warnings: string[]
  diffLineCount: number
}

// ─── Constants ───────────────────────────────────────────

const MAX_DIFF_LINES = 3000
const RETRY_DELAYS = [1000, 2000, 4000]

const REVIEW_PROMPT = (diff: string) => `당신은 코드 리뷰어입니다. 아래 diff를 리뷰하고, 발견한 이슈를 JSON 형식으로 반환하세요.

추가로, 이 diff가 어떤 변경인지 비개발자도 이해할 수 있도록 간단한 요약(summary)을 한국어로 작성하세요. 비유를 포함해주세요.

반드시 아래 JSON 형식으로만 응답하세요:
{
  "summary": "이 MR은 ... (비유 포함 설명)",
  "issues": [
    {
      "file": "파일 경로",
      "line": 줄번호,
      "severity": "error | warning | info",
      "category": "bug | security | performance | style | logic | type-safety",
      "description": "이슈 설명 (한국어)",
      "suggestion": "개선 제안 (한국어)"
    }
  ]
}

이슈가 없으면 issues를 빈 배열로 반환하세요.

\`\`\`diff
${diff}
\`\`\``

// ─── AI Callers ──────────────────────────────────────────

async function callWithRetry<T>(
  fn: () => Promise<T>,
  retries: number[] = RETRY_DELAYS,
): Promise<T> {
  let lastError: unknown
  // 첫 시도
  try {
    return await fn()
  } catch (e) {
    lastError = e
  }
  // 재시도
  for (const delay of retries) {
    const errMsg = lastError instanceof Error ? lastError.message : String(lastError)
    if (!errMsg.includes('429') && !errMsg.includes('rate')) break
    await new Promise(r => setTimeout(r, delay))
    try {
      return await fn()
    } catch (e) {
      lastError = e
    }
  }
  throw lastError
}

export async function callClaude(diff: string): Promise<ReviewResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY가 설정되지 않았습니다. .env.agora 파일을 확인하세요.')

  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey })

  const response = await callWithRetry(async () => {
    return client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: REVIEW_PROMPT(diff) }],
      tools: [{
        name: 'submit_review',
        description: '코드 리뷰 결과를 구조화된 형식으로 제출',
        input_schema: {
          type: 'object' as const,
          properties: {
            summary: { type: 'string', description: 'MR 변경사항 요약 (비유 포함)' },
            issues: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  file: { type: 'string' },
                  line: { type: 'number' },
                  severity: { type: 'string', enum: ['error', 'warning', 'info'] },
                  category: { type: 'string', enum: ['bug', 'security', 'performance', 'style', 'logic', 'type-safety'] },
                  description: { type: 'string' },
                  suggestion: { type: 'string' },
                },
                required: ['file', 'line', 'severity', 'category', 'description', 'suggestion'],
              },
            },
          },
          required: ['summary', 'issues'],
        },
      }],
      tool_choice: { type: 'tool', name: 'submit_review' },
    })
  })

  const toolBlock = response.content.find(b => b.type === 'tool_use')
  if (!toolBlock || toolBlock.type !== 'tool_use') {
    // 텍스트 폴백
    const textBlock = response.content.find(b => b.type === 'text')
    return {
      ai: 'Claude',
      icon: '🐶',
      issues: [],
      raw: textBlock && textBlock.type === 'text' ? textBlock.text : JSON.stringify(response.content),
    }
  }

  const input = toolBlock.input as { summary: string, issues: ReviewIssue[] }
  return {
    ai: 'Claude',
    icon: '🐶',
    issues: input.issues || [],
    summary: input.summary,
  }
}

export async function callGemini(diff: string): Promise<ReviewResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY가 설정되지 않았습니다. .env.agora 파일을 확인하세요.')

  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(apiKey)

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object' as any,
        properties: {
          summary: { type: 'string' as any },
          issues: {
            type: 'array' as any,
            items: {
              type: 'object' as any,
              properties: {
                file: { type: 'string' as any },
                line: { type: 'number' as any },
                severity: { type: 'string' as any, enum: ['error', 'warning', 'info'] },
                category: { type: 'string' as any, enum: ['bug', 'security', 'performance', 'style', 'logic', 'type-safety'] },
                description: { type: 'string' as any },
                suggestion: { type: 'string' as any },
              },
              required: ['file', 'line', 'severity', 'category', 'description', 'suggestion'],
            },
          },
        },
        required: ['summary', 'issues'],
      },
    },
  })

  const response = await callWithRetry(async () => {
    return model.generateContent(REVIEW_PROMPT(diff))
  })

  const text = response.response.text()
  try {
    const parsed = JSON.parse(text)
    return {
      ai: 'Gemini',
      icon: '🐻',
      issues: parsed.issues || [],
      summary: parsed.summary,
    }
  } catch {
    return {
      ai: 'Gemini',
      icon: '🐻',
      issues: [],
      raw: text,
    }
  }
}

export async function callCopilot(diff: string): Promise<ReviewResult> {
  const { execSync } = await import('child_process')

  // gh copilot 사용 가능 확인
  try {
    execSync('gh copilot --version', { stdio: 'pipe' })
  } catch {
    throw new Error('GitHub Copilot CLI를 사용할 수 없습니다. `gh auth login` 후 `gh extension install github/gh-copilot`을 실행하세요.')
  }

  const prompt = REVIEW_PROMPT(diff)

  const result = await callWithRetry(async () => {
    const output = execSync(
      `echo '${prompt.replace(/'/g, "'\\''")}' | gh copilot explain --stdin 2>/dev/null || echo '{"summary":"Copilot 응답 실패","issues":[]}'`,
      {
        encoding: 'utf-8',
        timeout: 30000,
        maxBuffer: 10 * 1024 * 1024,
      },
    )
    return output
  })

  // JSON 파싱 시도
  try {
    // 응답에서 JSON 블록 추출 시도
    const resultStr = String(result)
    const jsonMatch = resultStr.match(/\{[\s\S]*"issues"[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        ai: 'Copilot',
        icon: '🐱',
        issues: parsed.issues || [],
        summary: parsed.summary,
      }
    }
  } catch {
    // JSON 파싱 실패
  }

  // 텍스트 폴백
  return {
    ai: 'Copilot',
    icon: '🐱',
    issues: [],
    raw: String(result).trim(),
  }
}

// ─── Orchestrator ────────────────────────────────────────

export async function callAllAIs(diff: string): Promise<AgoraOutput> {
  const warnings: string[] = []
  const diffLineCount = diff.split('\n').length

  if (diffLineCount > MAX_DIFF_LINES) {
    warnings.push(`⚠️ diff가 ${diffLineCount}줄로 매우 큽니다 (권장: ${MAX_DIFF_LINES}줄 이하). 일부 AI에서 잘림이 발생할 수 있습니다.`)
  }

  const promises = [
    callClaude(diff).catch(e => ({
      ai: 'Claude',
      icon: '🐶',
      issues: [],
      error: e instanceof Error ? e.message : String(e),
    } as ReviewResult)),
    callGemini(diff).catch(e => ({
      ai: 'Gemini',
      icon: '🐻',
      issues: [],
      error: e instanceof Error ? e.message : String(e),
    } as ReviewResult)),
    callCopilot(diff).catch(e => ({
      ai: 'Copilot',
      icon: '🐱',
      issues: [],
      error: e instanceof Error ? e.message : String(e),
    } as ReviewResult)),
  ]

  const results = await Promise.all(promises)

  const succeeded = results.filter(r => !r.error)
  const failed = results.filter(r => r.error)

  if (succeeded.length === 0) {
    warnings.push('❌ 모든 AI 호출이 실패했습니다.')
    failed.forEach(r => warnings.push(`  ${r.icon} ${r.ai}: ${r.error}`))
  } else if (succeeded.length < 3) {
    failed.forEach(r => warnings.push(`⚠️ ${r.icon} ${r.ai} 응답 없음: ${r.error}`))
  }

  results.forEach(r => {
    if (r.raw) {
      warnings.push(`⚠️ ${r.icon} ${r.ai}: JSON 파싱 실패, 텍스트 폴백으로 포함`)
    }
  })

  return { results, warnings, diffLineCount }
}

// ─── Main ────────────────────────────────────────────────

async function main() {
  const diffPath = process.argv[2]

  if (!diffPath) {
    console.error(JSON.stringify({
      results: [],
      warnings: ['❌ diff 파일 경로가 필요합니다. 사용법: tsx agora-review.ts <diff-file-path>'],
      diffLineCount: 0,
    }))
    process.exit(1)
  }

  let diff: string
  try {
    diff = readFileSync(diffPath, 'utf-8')
  } catch {
    console.error(JSON.stringify({
      results: [],
      warnings: [`❌ diff 파일을 읽을 수 없습니다: ${diffPath}`],
      diffLineCount: 0,
    }))
    process.exit(1)
  }

  if (!diff.trim()) {
    console.log(JSON.stringify({
      results: [],
      warnings: ['리뷰할 변경사항이 없습니다.'],
      diffLineCount: 0,
    }))
    process.exit(0)
  }

  const output = await callAllAIs(diff)
  console.log(JSON.stringify(output))
}

// 직접 실행 시에만 main 호출 (테스트에서는 import만)
const isDirectRun = process.argv[1]?.endsWith('agora-review.ts')
if (isDirectRun) {
  main().catch(e => {
    console.error(JSON.stringify({
      results: [],
      warnings: [`❌ 예상치 못한 오류: ${e instanceof Error ? e.message : String(e)}`],
      diffLineCount: 0,
    }))
    process.exit(1)
  })
}
