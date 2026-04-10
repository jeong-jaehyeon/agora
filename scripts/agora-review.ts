import { readFileSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'
import { tmpdir } from 'os'
import { join } from 'path'

// ─── Types ───────────────────────────────────────────────

export interface ReviewResult {
  ai: string
  icon: string
  response: string
  error?: string
}

interface AgoraOutput {
  results: ReviewResult[]
  warnings: string[]
  diffLineCount: number
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

// ─── AI Callers ──────────────────────────────────────────

export function callGemini(prompt: string): ReviewResult {
  try {
    // 프롬프트를 임시 파일로 저장 (쉘 이스케이프 문제 방지)
    const promptFile = join(tmpdir(), `agora-gemini-${Date.now()}.txt`)
    writeFileSync(promptFile, prompt, 'utf-8')

    const output = execSync(
      `gemini -p "$(cat '${promptFile}')" -o text`,
      {
        encoding: 'utf-8',
        timeout: CLI_TIMEOUT,
        maxBuffer: 10 * 1024 * 1024,
        env: { ...process.env },
      },
    )

    // 임시 파일 정리
    try { execSync(`rm -f '${promptFile}'`, { stdio: 'pipe' }) } catch {}

    return {
      ai: 'Gemini',
      icon: '🐻',
      response: output.trim(),
    }
  } catch (e) {
    return {
      ai: 'Gemini',
      icon: '🐻',
      response: '',
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

export function callCopilot(prompt: string): ReviewResult {
  try {
    // gh copilot 사용 가능 확인
    execSync('gh copilot --version', { stdio: 'pipe' })
  } catch {
    return {
      ai: 'Copilot',
      icon: '🐱',
      response: '',
      error: 'GitHub Copilot CLI를 사용할 수 없습니다. `gh auth login` 후 `gh extension install github/gh-copilot`을 실행하세요.',
    }
  }

  try {
    const promptFile = join(tmpdir(), `agora-copilot-${Date.now()}.txt`)
    writeFileSync(promptFile, prompt, 'utf-8')

    const output = execSync(
      `gh copilot -p "$(cat '${promptFile}')"`,
      {
        encoding: 'utf-8',
        timeout: CLI_TIMEOUT,
        maxBuffer: 10 * 1024 * 1024,
        env: { ...process.env },
      },
    )

    try { execSync(`rm -f '${promptFile}'`, { stdio: 'pipe' }) } catch {}

    return {
      ai: 'Copilot',
      icon: '🐱',
      response: output.trim(),
    }
  } catch (e) {
    return {
      ai: 'Copilot',
      icon: '🐱',
      response: '',
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

// ─── Orchestrator ────────────────────────────────────────

export function callExternalAIs(diff: string): AgoraOutput {
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

  return { results, warnings, diffLineCount }
}

// ─── Main ────────────────────────────────────────────────

function main() {
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
  console.log(JSON.stringify(output))
}

// 직접 실행 시에만 main 호출 (테스트에서는 import만)
const isDirectRun = process.argv[1]?.endsWith('agora-review.ts')
if (isDirectRun) {
  main()
}
