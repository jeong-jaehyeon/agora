import { loadGitlabToken, loadGitlabUrl } from './env'

function printUsage(): void {
  console.log(`Usage: npx tsx scripts/fetch-sibling-file.ts <project-path> <file-path> [ref]

GitLab sibling 프로젝트의 파일을 가져옵니다.

Arguments:
  project-path   GitLab 프로젝트 경로 (예: my-group/my-project/frontend)
  file-path      가져올 파일 경로 (예: src/types/user.ts)
  ref            브랜치/태그/커밋 (기본값: develop)

Examples:
  npx tsx scripts/fetch-sibling-file.ts my-group/my-project/frontend src/types/user.ts develop
  npx tsx scripts/fetch-sibling-file.ts my-group/my-project/backend package.json main`)
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.includes('-h')) {
    printUsage()
    process.exit(0)
  }

  const [projectPath, filePath, ref = 'develop'] = args

  if (!projectPath || !filePath) {
    printUsage()
    process.exit(1)
  }

  const token = loadGitlabToken()
  const encodedProject = encodeURIComponent(projectPath)
  const encodedFile = encodeURIComponent(filePath)
  const baseUrl = loadGitlabUrl()
  const url = `${baseUrl}/api/v4/projects/${encodedProject}/repository/files/${encodedFile}/raw?ref=${encodeURIComponent(ref)}`

  const response = await fetch(url, {
    headers: { 'PRIVATE-TOKEN': token },
  })

  if (!response.ok) {
    const body = await response.text()
    console.error(`에러: ${response.status} ${response.statusText}`)
    console.error(`프로젝트: ${projectPath}, 파일: ${filePath}, ref: ${ref}`)
    if (body) console.error(body)
    process.exit(1)
  }

  const content = await response.text()
  process.stdout.write(content)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
