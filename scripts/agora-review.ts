import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { execSync } from 'child_process'
import { homedir } from 'os'
import { join, basename } from 'path'
import { loadGeminiModel, loadCopilotModel } from './env'

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

const REVIEW_PROMPT = (diff: string) => `당신은 코드 리뷰어입니다. 아래 diff를 리뷰하고, 반드시 아래 형식으로만 응답하세요. 형식을 임의로 변경하지 마세요.

**중요 제한사항**: 이 diff는 단일 프로젝트(서버/클라이언트/러너 중 하나)만 포함합니다. 호출처(클라이언트, 다른 서비스)의 실제 사용 패턴은 볼 수 없습니다.

따라서:
- "구버전 클라이언트가 undefined를 보낼 수 있다", "하위 호환 regression" 같은 판정은 **가설**로만 제시하세요.
- 이런 가설에는 반드시 "[가설: 호출자 확인 필요]"를 붙여주세요.
- API 스키마 변경, 기본값 변경, 인터페이스 비대칭 등은 의도적 설계일 수 있으므로 단정하지 마세요.

## 요약
{비개발자도 이해할 수 있는 변경 요약. 비유를 포함하여 2-3문장으로 작성.}

## 이슈
이슈가 없으면 아래 한 줄만 작성:
이슈 없음

이슈가 있으면 아래 형식을 이슈마다 반복:

### [severity] 파일명:줄번호 — 이슈 제목
**설명**: {이슈 설명}
**개선안**: {개선 제안 코드 또는 설명}

severity는 반드시 error, warning, info 중 하나를 사용하세요.

모든 응답은 한국어로 작성하세요.

\`\`\`diff
${diff}
\`\`\``

// ─── Helpers ────────────────────────────────────────────

export { loadGeminiModel, loadCopilotModel }

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

  try {
    const stdout = execSync(
      'gemini -o text',
      { input: prompt, encoding: 'utf-8', timeout: CLI_TIMEOUT, maxBuffer: 10 * 1024 * 1024 },
    )

    return {
      ai: 'Gemini',
      icon: '🐻',
      response: stdout.trim(),
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
  }
}

export function callCopilot(prompt: string): ReviewResult {
  const model = loadCopilotModel()
  const startTime = Date.now()

  try {
    execSync('gh copilot --version', { stdio: 'pipe' })
  } catch {
    return {
      ai: 'Copilot',
      icon: '🐱',
      response: '',
      error: 'GitHub Copilot CLI를 사용할 수 없습니다. `gh auth login` 후 `gh extension install github/gh-copilot`을 실행하세요.',
      model,
      durationMs: Date.now() - startTime,
    }
  }

  try {
    const stdout = execSync(
      `gh copilot -- --model ${model} -s`,
      { input: prompt, encoding: 'utf-8', timeout: CLI_TIMEOUT, maxBuffer: 10 * 1024 * 1024 },
    )

    return {
      ai: 'Copilot',
      icon: '🐱',
      response: stdout.trim(),
      model,
      durationMs: Date.now() - startTime,
    }
  } catch (e) {
    return {
      ai: 'Copilot',
      icon: '🐱',
      response: '',
      error: e instanceof Error ? e.message : String(e),
      model,
      durationMs: Date.now() - startTime,
    }
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

  // Gemini와 Copilot 순차 호출
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
    try {
      execSync(
        'gemini -o text',
        { input: 'Hello', encoding: 'utf-8', timeout: CLI_TIMEOUT, maxBuffer: 10 * 1024 * 1024, env: { ...process.env } },
      )
      tests.push({ ai: 'Gemini', icon: '🐻', ok: true, model: geminiModel, responseTime: Date.now() - geminiStart })
    } catch (e) {
      tests.push({ ai: 'Gemini', icon: '🐻', ok: false, model: geminiModel, error: e instanceof Error ? e.message : String(e) })
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
    try {
      const copilotModel = loadCopilotModel()
      execSync(
        `gh copilot -- --model ${copilotModel} -s`,
        { input: 'Hello', encoding: 'utf-8', timeout: CLI_TIMEOUT, maxBuffer: 10 * 1024 * 1024, env: { ...process.env } },
      )
      tests.push({ ai: 'Copilot', icon: '🐱', ok: true, model: copilotModel, responseTime: Date.now() - copilotStart })
    } catch (e) {
      tests.push({ ai: 'Copilot', icon: '🐱', ok: false, error: e instanceof Error ? e.message : String(e) })
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

  // --gemini-only: Gemini만 호출
  if (process.argv.includes('--gemini-only')) {
    const diffPath = process.argv.find(a => !a.startsWith('-') && a !== process.argv[0] && a !== process.argv[1])
    if (!diffPath) { console.error('diff 파일 경로 필요'); process.exit(1) }
    const diff = readFileSync(diffPath, 'utf-8')
    const result = callGemini(REVIEW_PROMPT(diff))
    console.log(JSON.stringify(result))
    return
  }

  // --copilot-only: Copilot만 호출
  if (process.argv.includes('--copilot-only')) {
    const diffPath = process.argv.find(a => !a.startsWith('-') && a !== process.argv[0] && a !== process.argv[1])
    if (!diffPath) { console.error('diff 파일 경로 필요'); process.exit(1) }
    const diff = readFileSync(diffPath, 'utf-8')
    const result = callCopilot(REVIEW_PROMPT(diff))
    console.log(JSON.stringify(result))
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
