#!/usr/bin/env npx tsx
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ── Types ──

interface ReportData {
  title: string
  summary: {
    text: string
    fileGroups: { dir: string; tags: string[] }[]
  }
  stats: {
    total: number
    error: number
    warning: number
    info: number
    consensus: number
    solo: number
    conflict: number
    fileCount: number
    diffLines: number
  }
  participants: { key: string; icon: string; name: string; model: string }[]
  duration: {
    total: string
    perAi: Record<string, string>
  }
  fileGroups: {
    file: string
    issues: Issue[]
  }[]
  conflicts: {
    title: string
    opinions: { key: string; icon: string; name: string; text: string }[]
    verdict: string
  }[]
  infos: { file: string; text: string; badge: string }[]
  actions: { severity: string; file: string; text: string }[]
  date: string
  verificationAudit?: {
    crossProjectChecks: {
      project: string
      file: string
      ref: string
      method: string
      finding: string
    }[]
    localOnly: boolean
  }
}

interface Issue {
  severity: 'error' | 'warning' | 'info'
  loc: string
  name: string
  consensus: boolean
  consensusLabel: string
  desc: string
  fix: string
  codeSnippet?: string
  comparison?: { before: string; after: string }
  prompt?: string
  needsVerification?: boolean
  mcVerdict?: {
    result: '강등' | '유지' | '미검증'
    reason: string
    evidence?: string
    originalSeverity?: string
  }
}

// ── Helpers ──

export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function sevClass(s: string): string {
  if (s === 'error') return 'e'
  if (s === 'warning') return 'w'
  return 'i'
}

export function sevLabel(s: string): string {
  if (s === 'error') return '필수'
  if (s === 'warning') return '권장'
  return '참고'
}

export function sevEmoji(s: string): string {
  if (s === 'error') return '🔴'
  if (s === 'warning') return '🟡'
  return '🔵'
}

export function aiChipClass(key: string): string {
  if (key === 'claude') return 'c'
  if (key === 'gemini') return 'g'
  if (key === 'copilot') return 'p'
  if (key === 'mc') return 'mc'
  return ''
}

export function opNameClass(key: string): string {
  if (key === 'claude') return 'c'
  if (key === 'gemini') return 'g'
  if (key === 'copilot') return 'p'
  return ''
}

function renderCodeSnippet(snippet: string): string {
  return snippet
    .split('\n')
    .map((line) => {
      if (line.startsWith('+')) return `<span class="diff-add">${esc(line)}</span>`
      if (line.startsWith('-')) return `<span class="diff-del">${esc(line)}</span>`
      return esc(line)
    })
    .join('\n')
}

// ── Render functions ──

function renderHeader(data: ReportData): string {
  return `<div class="header">
  <div class="header-left">
    <span class="logo">🏛️</span>
    <div>
      <h1>Agora Review</h1>
      <div class="subtitle">${esc(data.title)}</div>
    </div>
  </div>
  <div class="header-right">
    <nav class="nav-pills">
      <a class="nav-pill active" href="#summary">요약</a>
      <a class="nav-pill" href="#issues">이슈</a>
      <a class="nav-pill" href="#conflicts">충돌</a>
      <a class="nav-pill" href="#actions">액션</a>
    </nav>
    <div class="theme-toggle" onclick="toggleTheme()" title="다크/라이트 모드 전환">
      <div class="knob" id="themeKnob">☀️</div>
    </div>
  </div>
</div>`
}

function renderDashboard(data: ReportData): string {
  const { stats, participants, duration } = data

  const aiChips = participants
    .map((p, i) => {
      const sep = p.key === 'mc' && i > 0
        ? `<span style="color:var(--text-muted); font-size:10px; margin:0 2px;">+</span>`
        : ''
      const title = p.key === 'mc'
        ? ` title="MC(중재자): 3개 AI의 리뷰를 비교 분류하고, 의견 충돌 시 편향 없이 균형 잡힌 판정을 내립니다"`
        : ''
      return `${sep}<span class="ai-chip ${aiChipClass(p.key)}"${title}>${esc(p.icon)} ${esc(p.name)} <span class="model-name">${esc(p.model)}</span></span>`
    })
    .join('\n        ')

  return `<div class="dashboard anim">
    <div class="metric-card">
      <div class="metric-label">발견된 이슈</div>
      <div class="metric-value">${stats.total}</div>
      <div class="severity-inline metric-sub">
        <span class="sev-item"><span class="sev-dot e"></span>${stats.error} 필수</span>
        <span class="sev-item"><span class="sev-dot w"></span>${stats.warning} 권장</span>
        <span class="sev-item"><span class="sev-dot i"></span>${stats.info} 참고</span>
      </div>
    </div>
    <div class="metric-card">
      <div class="metric-label">AI 합의</div>
      <div class="metric-value" style="color: var(--success)">${stats.consensus}</div>
      <div class="metric-sub">고유 ${stats.solo}건 · 충돌 ${stats.conflict}건</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">참여 AI</div>
      <div class="ai-chips">
        ${aiChips}
      </div>
      <div class="metric-sub">${stats.fileCount} files · ${stats.diffLines} lines · 소요 ${esc(duration.total)}</div>
    </div>
  </div>`
}

function renderSummary(data: ReportData): string {
  const fileGroupsHtml = data.summary.fileGroups
    .map((fg) => {
      const tags = fg.tags.map((t) => `<span class="ftag">${esc(t)}</span>`).join(' ')
      return `      <div>📁 <span style="color:var(--accent); font-family:'SF Mono',monospace; font-size:11px;">${esc(fg.dir)}</span> ${tags}</div>`
    })
    .join('\n')

  return `<div class="summary-card anim anim-1" id="summary">
    <h2>📋 이 MR은 뭘 바꾸나요?</h2>
    <p>${data.summary.text}</p>
    <div style="font-size:12px; color:var(--text-muted); margin-top:14px; margin-bottom:6px;">변경된 파일:</div>
    <div style="font-size:12px; line-height:1.8; color:var(--text-muted);">
${fileGroupsHtml}
    </div>
  </div>`
}

function renderIssueCard(issue: Issue): string {
  const sc = sevClass(issue.severity)
  const consensusAttr = issue.consensus ? 'true' : 'false'
  const badgeClass = issue.consensus ? 'consensus' : 'solo'

  let bodyHtml = `<div class="issue-desc">${issue.desc}</div>
          <div class="issue-fix">${issue.fix}</div>`

  if (issue.mcVerdict) {
    const v = issue.mcVerdict
    const resultColor = v.result === '강등' ? 'var(--warning)' : v.result === '유지' ? 'var(--success)' : 'var(--accent)'
    const resultIcon = v.result === '강등' ? '⬇️' : v.result === '유지' ? '✅' : '⚠️'
    bodyHtml += `
          <div style="margin-top:10px; padding:10px 14px; border-radius:6px; background:rgba(168,85,247,0.06); border:1px solid rgba(168,85,247,0.12); font-size:13px; line-height:1.7;">
            <div style="font-size:12px; font-weight:700; color:#a855f7; margin-bottom:4px;">🎙️ MC 재검증: ${resultIcon} ${esc(v.result)}${v.originalSeverity ? ` (원래: ${esc(v.originalSeverity)})` : ''}</div>
            <div style="color:var(--text-muted);">${esc(v.reason)}</div>
            ${v.evidence ? `<div style="margin-top:4px; font-family:'SF Mono',monospace; font-size:11px; color:var(--accent);">근거: ${esc(v.evidence)}</div>` : ''}
          </div>`
  }

  if (issue.codeSnippet) {
    bodyHtml += `
          <div class="issue-code">
            <div class="code-header">관련 코드</div>
            <pre><code>${renderCodeSnippet(issue.codeSnippet)}</code></pre>
          </div>`
  }

  if (issue.comparison) {
    bodyHtml += `
          <div class="code-comparison">
            <div class="code-before">
              <div class="code-label">현재 코드</div>
              <pre><code>${esc(issue.comparison.before)}</code></pre>
            </div>
            <div class="code-after">
              <div class="code-label">💡 개선안</div>
              <pre><code>${esc(issue.comparison.after)}</code></pre>
            </div>
          </div>`
  }

  if (issue.prompt) {
    bodyHtml += `
          <button class="copy-lg" onclick="copyPrompt(this)" data-prompt="${esc(issue.prompt)}">📋 이 수정사항을 Claude Code에 요청하기</button>`
  }

  return `      <div class="issue ${sc}" data-sev="${sc}" data-consensus="${consensusAttr}">
        <div class="issue-top" onclick="toggleIssue(this)">
          <span class="issue-chevron">▶</span>
          <span class="sev-tag ${sc}">${sevLabel(issue.severity)}</span>
          <span class="issue-loc">${esc(issue.loc)}</span>
          <span class="issue-name">${esc(issue.name)}</span>
          <span class="badge ${badgeClass}">${esc(issue.consensusLabel)}</span>${issue.needsVerification ? '\n          <span class="badge needs-verify">⚠️ 검증 필요</span>' : ''}
        </div>
        <div class="issue-body">
          ${bodyHtml}
        </div>
      </div>`
}

function renderIssues(data: ReportData): string {
  const errorAndWarning = data.fileGroups.reduce(
    (sum, fg) => sum + fg.issues.filter((i) => i.severity !== 'info').length,
    0,
  )

  const fgroupsHtml = data.fileGroups
    .map((fg) => {
      const issuesHtml = fg.issues.map((issue) => renderIssueCard(issue)).join('\n')
      return `    <div class="fgroup">
      <div class="fgroup-name">${esc(fg.file)}</div>
${issuesHtml}
    </div>`
    })
    .join('\n\n')

  return `<div class="section anim anim-2" id="issues">
    <div class="section-title">
      수정이 필요한 것들 <span class="count">${errorAndWarning}</span>
      <button class="toggle-all" onclick="toggleAll()">전체 펼치기</button>
    </div>

    <div class="filter-bar">
      <button class="filter-btn active" data-filter="all">전체</button>
      <button class="filter-btn" data-filter="e">🔴 꼭 고쳐야 함</button>
      <button class="filter-btn" data-filter="w">🟡 고치면 좋음</button>
      <button class="filter-btn" data-filter="consensus">👥 AI 합의만</button>
    </div>

${fgroupsHtml}
  </div>`
}

function renderConflicts(data: ReportData): string {
  if (!data.conflicts || data.conflicts.length === 0) return ''

  const cardsHtml = data.conflicts
    .map((c) => {
      const opinionsHtml = c.opinions
        .map(
          (op) =>
            `          <div class="op"><span class="op-name ${opNameClass(op.key)}">${esc(op.icon)} ${esc(op.name)}</span> ${esc(op.text)}</div>`,
        )
        .join('\n')

      return `    <div class="conflict-card">
      <div class="conflict-top">
        <span class="icon">⚡</span>
        <div>
          <div class="conflict-title">${esc(c.title)}</div>
        </div>
      </div>
      <div class="conflict-body">
        <div class="opinions">
${opinionsHtml}
        </div>
        <div class="verdict">
          <div class="verdict-label">🎙️ MC 판정</div>
          ${esc(c.verdict)}
        </div>
      </div>
    </div>`
    })
    .join('\n\n')

  return `<div class="section anim anim-3" id="conflicts">
    <div class="section-title">의견이 갈린 것들 <span class="count">${data.conflicts.length}</span></div>

${cardsHtml}
  </div>`
}

function renderInfos(data: ReportData): string {
  if (!data.infos || data.infos.length === 0) return ''

  const itemsHtml = data.infos
    .map(
      (info) =>
        `    <div class="info-item">🔵 <code>${esc(info.file)}</code> ${esc(info.text)} <span class="badge solo">${esc(info.badge)}</span></div>`,
    )
    .join('\n')

  return `<div class="section anim anim-4">
    <div class="section-title">참고만 하세요 <span class="count">${data.infos.length}</span></div>
${itemsHtml}
  </div>`
}

function renderActions(data: ReportData): string {
  if (!data.actions || data.actions.length === 0) return ''

  const actionsHtml = data.actions
    .map((a) => {
      const sc = sevClass(a.severity)
      const dotColor = sc === 'e' ? 'var(--error)' : sc === 'w' ? 'var(--warning)' : 'var(--accent)'
      return `      <label class="act"><input type="checkbox" onchange="updateProgress()"><span class="act-sev">${sevEmoji(a.severity)}</span><span class="act-text"><span class="file-dot" style="background: ${dotColor};"></span><strong>${esc(a.file)}</strong> — ${esc(a.text)}</span></label>`
    })
    .join('\n')

  return `<div class="section anim anim-5" id="actions">
    <div class="section-title">액션 아이템</div>
    <div class="actions-card">
      <div class="actions-header">
        <span class="actions-title">할 일 목록</span>
        <div style="display:flex;align-items:center;">
          <div class="progress-bar"><div class="progress-fill" id="progressFill" style="width:0%"></div></div>
          <span class="progress-text" id="progressText">0/${data.actions.length}</span>
        </div>
      </div>
${actionsHtml}
    </div>
  </div>`
}

function renderFooter(data: ReportData): string {
  const durationParts = Object.entries(data.duration.perAi)
    .map(([name, time]) => `${name} (${time})`)
    .join(' + ')

  return `<div class="footer">
    Generated by Agora · ${esc(data.date)} · 총 소요 ${esc(data.duration.total)} · ${esc(durationParts)}
  </div>`
}

// ── Main ──

function extractSection(html: string, tag: string): string {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i')
  const m = html.match(re)
  return m ? m[1] : ''
}

function generateReport(data: ReportData, templatePath: string): string {
  const template = readFileSync(templatePath, 'utf-8')
  const css = extractSection(template, 'style')
  const js = extractSection(template, 'script')

  return `<!DOCTYPE html>
<html lang="ko" data-theme="light">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Agora Review — ${esc(data.title)}</title>
<style>${css}</style>
</head>
<body>

${renderHeader(data)}

<div class="container">

  ${renderDashboard(data)}

  ${data.verificationAudit?.localOnly ? `<div style="margin:16px 0;padding:12px 16px;border-radius:8px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);font-size:13px;color:var(--text-muted);line-height:1.6;">
    <strong style="color:#f59e0b;">⚠️ Cross-project 검증 제한</strong><br>
    이번 리뷰의 형제 프로젝트 검증이 로컬 파일(main 브랜치)로만 수행되었습니다. MR source branch의 최신 코드와 다를 수 있으므로, 형제 프로젝트 관련 이슈는 직접 확인을 권장합니다.
  </div>` : ''}

  ${renderSummary(data)}

  ${renderIssues(data)}

  ${renderConflicts(data)}

  ${renderInfos(data)}

  ${renderActions(data)}

  ${renderFooter(data)}
</div>

<script>${js}</script>
</body>
</html>`
}

function printHelp(): void {
  console.log(`사용법: npx tsx scripts/generate-report.ts <json-file> [-o <output-file>]

Agora Review JSON 데이터를 HTML 리포트로 변환합니다.

인자:
  <json-file>      입력 JSON 파일 경로
  -o <output-file>  출력 HTML 파일 경로 (생략 시 stdout)

예시:
  npx tsx scripts/generate-report.ts /tmp/agora-report-data.json -o ~/.agora/reviews/2026-04-21-MR131.html
  npx tsx scripts/generate-report.ts /tmp/agora-report-data.json > report.html`)
}

function main(): void {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    printHelp()
    process.exit(0)
  }

  const jsonPath = args[0]
  let outputPath: string | null = null

  const oIdx = args.indexOf('-o')
  if (oIdx !== -1 && args[oIdx + 1]) {
    outputPath = args[oIdx + 1]
  }

  const templatePath = resolve(__dirname, 'report-template.html')

  let jsonContent: string
  try {
    jsonContent = readFileSync(jsonPath, 'utf-8')
  } catch {
    console.error(`오류: JSON 파일을 읽을 수 없습니다: ${jsonPath}`)
    process.exit(1)
  }

  let data: ReportData
  try {
    data = JSON.parse(jsonContent)
  } catch {
    console.error(`오류: JSON 파싱 실패: ${jsonPath}`)
    process.exit(1)
  }

  const html = generateReport(data, templatePath)

  if (outputPath) {
    const resolvedOutput = resolve(outputPath)
    mkdirSync(dirname(resolvedOutput), { recursive: true })
    writeFileSync(resolvedOutput, html, 'utf-8')
    console.log(`리포트 생성 완료: ${resolvedOutput}`)
  } else {
    process.stdout.write(html)
  }
}

// 직접 실행 시에만 main 호출 (테스트에서는 import만)
const isDirectRun = process.argv[1]?.endsWith('generate-report.ts')
if (isDirectRun) {
  main()
}
