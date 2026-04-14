import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'fs'
import { execSync } from 'child_process'
import { tmpdir, homedir } from 'os'
import { join, basename } from 'path'

// ─── Types ───────────────────────────────────────────────

export interface ReviewResult {
  ai: string
  icon: string
  response: string
  error?: string
  model?: string
  durationMs?: number
}

export interface TestResult {
  ai: string
  icon: string
  ok: boolean
  model?: string
  responseTime?: number
  error?: string
}

interface AgoraOutput {
  results: ReviewResult[]
  warnings: string[]
  diffLineCount: number
  totalDurationMs?: number
  savedTo?: string
}

interface AgoraTestOutput {
  tests: TestResult[]
}

// ─── Constants ───────────────────────────────────────────

const MAX_DIFF_LINES = 3000
const CLI_TIMEOUT = 120000 // 2분

const REVIEW_PROMPT = (diff: string) => `당신은 코드 리뷰어입니다. 아래 diff를 리뷰해주세요.

1. 먼저 이 diff가 어떤 변경인지 비개발자도 이해할 수 있도록 간단하게 요약해주세요. 비유를 포함해주세요.
2. 발견한 이슈를 severity(error/warning/info), 파일명, 줄번호와 함께 나열해주세요.
3. 각 이슈에 대한 개선 제안도 함께 작성해주세요.
4. 이슈가 없으면 "이슈 없음"이라고 작성하세요.

모든 응답은 한국어로 작성하세요.

\`\`\`diff
${diff}
\`\`\``

// ─── Helpers ────────────────────────────────────────────

export function loadGeminiModel(): string {
  try {
    const envPath = join(import.meta.dirname, '..', '.env.agora')
    const content = readFileSync(envPath, 'utf-8')
    const match = content.match(/^GEMINI_MODEL=(.+)$/m)
    if (match) return match[1].trim()
  } catch {}
  return 'gemini-2.0-flash'
}

export function parseCopilotModel(response: string): string {
  // 응답 텍스트에서 모델명 패턴 탐색 (예: claude-sonnet-4.6, gpt-4o, etc.)
  const modelPattern = /\b(claude[-\w.]+|gpt[-\w.]+|o[1-9][-\w.]*)\b/i
  const match = response.match(modelPattern)
  return match ? match[1] : '모델 자동 선택'
}

function formatTimestamp(date: Date): string {
  const y = date.getFullYear()
  const mo = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const mi = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  return `${y}${mo}${d}-${h}${mi}${s}`
}

// ─── AI Callers ──────────────────────────────────────────

export function callGemini(prompt: string): ReviewResult {
  const model = loadGeminiModel()
  const startTime = Date.now()

  // 프롬프트를 임시 파일로 저장 (쉘 이스케이프 문제 방지)
  const promptFile = join(tmpdir(), `agora-gemini-${Date.now()}.txt`)
  writeFileSync(promptFile, prompt, 'utf-8')

  try {
    const output = execSync(
      `gemini -p "$(cat '${promptFile}')" -o text`,
      {
        encoding: 'utf-8',
        timeout: CLI_TIMEOUT,
        maxBuffer: 10 * 1024 * 1024,
        env: { ...process.env },
      },
    )

    return {
      ai: 'Gemini',
      icon: '🐻',
      response: output.trim(),
      model,
      durationMs: Date.now() - startTime,
    }
  } catch (e) {
    return {
      ai: 'Gemini',
      icon: '🐻',
      response: '',
      error: e instanceof Error ? e.message : String(e),
      model,
      durationMs: Date.now() - startTime,
    }
  } finally {
    try { unlinkSync(promptFile) } catch {}
  }
}

export function callCopilot(prompt: string): ReviewResult {
  const startTime = Date.now()

  try {
    // gh copilot 사용 가능 확인
    execSync('gh copilot --version', { stdio: 'pipe' })
  } catch {
    return {
      ai: 'Copilot',
      icon: '🐱',
      response: '',
      error: 'GitHub Copilot CLI를 사용할 수 없습니다. `gh auth login` 후 `gh extension install github/gh-copilot`을 실행하세요.',
      model: '모델 자동 선택',
      durationMs: Date.now() - startTime,
    }
  }

  const promptFile = join(tmpdir(), `agora-copilot-${Date.now()}.txt`)
  writeFileSync(promptFile, prompt, 'utf-8')

  try {
    const output = execSync(
      `gh copilot -p "$(cat '${promptFile}')"`,
      {
        encoding: 'utf-8',
        timeout: CLI_TIMEOUT,
        maxBuffer: 10 * 1024 * 1024,
        env: { ...process.env },
      },
    )

    const trimmed = output.trim()
    return {
      ai: 'Copilot',
      icon: '🐱',
      response: trimmed,
      model: parseCopilotModel(trimmed),
      durationMs: Date.now() - startTime,
    }
  } catch (e) {
    return {
      ai: 'Copilot',
      icon: '🐱',
      response: '',
      error: e instanceof Error ? e.message : String(e),
      model: '모델 자동 선택',
      durationMs: Date.now() - startTime,
    }
  } finally {
    try { unlinkSync(promptFile) } catch {}
  }
}

// ─── Orchestrator ────────────────────────────────────────

export function callExternalAIs(diff: string): AgoraOutput {
  const totalStart = Date.now()
  const warnings: string[] = []
  const diffLineCount = diff.split('\n').length

  if (diffLineCount > MAX_DIFF_LINES) {
    warnings.push(`⚠️ diff가 ${diffLineCount}줄로 매우 큽니다 (권장: ${MAX_DIFF_LINES}줄 이하). 일부 AI에서 잘림이 발생할 수 있습니다.`)
  }

  const prompt = REVIEW_PROMPT(diff)

  // Gemini와 Copilot을 순차 호출 (CLI는 동기 실행)
  const geminiResult = callGemini(prompt)
  const copilotResult = callCopilot(prompt)

  const results = [geminiResult, copilotResult]

  const failed = results.filter(r => r.error)
  if (failed.length === results.length) {
    warnings.push('❌ 모든 외부 AI 호출이 실패했습니다.')
    failed.forEach(r => warnings.push(`  ${r.icon} ${r.ai}: ${r.error}`))
  } else if (failed.length > 0) {
    failed.forEach(r => warnings.push(`⚠️ ${r.icon} ${r.ai} 응답 없음: ${r.error}`))
  }

  return { results, warnings, diffLineCount, totalDurationMs: Date.now() - totalStart }
}

// ─── Connection Test ─────────────────────────────────────

export function runConnectionTest(): AgoraTestOutput {
  const tests: TestResult[] = []

  // Gemini 테스트
  const geminiModel = loadGeminiModel()
  const geminiStart = Date.now()
  {
    const promptFile = join(tmpdir(), `agora-gemini-test-${Date.now()}.txt`)
    writeFileSync(promptFile, 'Hello', 'utf-8')
    try {
      execSync(
        `gemini -p "$(cat '${promptFile}')" -o text`,
        { encoding: 'utf-8', timeout: CLI_TIMEOUT, maxBuffer: 10 * 1024 * 1024, env: { ...process.env } },
      )
      tests.push({ ai: 'Gemini', icon: '🐻', ok: true, model: geminiModel, responseTime: Date.now() - geminiStart })
    } catch (e) {
      tests.push({ ai: 'Gemini', icon: '🐻', ok: false, model: geminiModel, error: e instanceof Error ? e.message : String(e) })
    } finally {
      try { unlinkSync(promptFile) } catch {}
    }
  }

  // Copilot 테스트
  const copilotStart = Date.now()
  try {
    execSync('gh copilot --version', { stdio: 'pipe' })
  } catch (e) {
    tests.push({ ai: 'Copilot', icon: '🐱', ok: false, error: e instanceof Error ? e.message : String(e) })
    return { tests }
  }
  {
    const promptFile = join(tmpdir(), `agora-copilot-test-${Date.now()}.txt`)
    writeFileSync(promptFile, 'Hello', 'utf-8')
    try {
      const output = execSync(
        `gh copilot -p "$(cat '${promptFile}')"`,
        { encoding: 'utf-8', timeout: CLI_TIMEOUT, maxBuffer: 10 * 1024 * 1024, env: { ...process.env } },
      )
      tests.push({ ai: 'Copilot', icon: '🐱', ok: true, model: parseCopilotModel(output.trim()), responseTime: Date.now() - copilotStart })
    } catch (e) {
      tests.push({ ai: 'Copilot', icon: '🐱', ok: false, error: e instanceof Error ? e.message : String(e) })
    } finally {
      try { unlinkSync(promptFile) } catch {}
    }
  }

  return { tests }
}

// ─── History ─────────────────────────────────────────────

export function saveReviewHistory(output: AgoraOutput, diffPath: string): string {
  const reviewDir = join(homedir(), '.agora', 'reviews')
  mkdirSync(reviewDir, { recursive: true })

  const timestamp = formatTimestamp(new Date())
  const diffName = basename(diffPath, '.diff').replace(/[^a-zA-Z0-9_-]/g, '-')
  const fileName = `${timestamp}-${diffName}.json`
  const filePath = join(reviewDir, fileName)

  writeFileSync(filePath, JSON.stringify(output, null, 2), 'utf-8')
  return filePath
}

// ─── Main ────────────────────────────────────────────────

function main() {
  // --test 플래그 처리
  if (process.argv.includes('--test')) {
    const testOutput = runConnectionTest()
    console.log(JSON.stringify(testOutput))
    return
  }

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

  const output = callExternalAIs(diff)

  // 히스토리 저장
  const savedTo = saveReviewHistory(output, diffPath)
  output.savedTo = savedTo

  console.log(JSON.stringify(output))
}

// 직접 실행 시에만 main 호출 (테스트에서는 import만)
const isDirectRun = process.argv[1]?.endsWith('agora-review.ts')
if (isDirectRun) {
  main()
}
