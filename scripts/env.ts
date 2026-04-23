import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ENV_PATH = join(__dirname, '..', '.env.agora')

function readEnvValue(key: string): string | undefined {
  try {
    const content = readFileSync(ENV_PATH, 'utf-8')
    const match = content.match(new RegExp(`^${key}=(.+)$`, 'm'))
    if (match) return match[1].trim()
  } catch {}
  return undefined
}

export function loadGitlabToken(): string {
  if (process.env.GITLAB_TOKEN) return process.env.GITLAB_TOKEN
  const token = readEnvValue('GITLAB_TOKEN')
  if (token) return token
  throw new Error('GITLAB_TOKEN을 찾을 수 없습니다. .env.agora를 확인해주세요.')
}

export function loadGeminiModel(): string {
  return readEnvValue('GEMINI_MODEL') ?? 'gemini-2.0-flash'
}

export function loadCopilotModel(): string {
  return readEnvValue('COPILOT_MODEL') ?? 'claude-sonnet-4.6'
}

export function loadGitlabUrl(): string {
  return readEnvValue('GITLAB_URL') ?? 'https://gitlab.example.com'
}
