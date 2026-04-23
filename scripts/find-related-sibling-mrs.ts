import { loadGitlabToken, loadGitlabUrl } from './env'

interface MrInfo {
  iid: number
  title: string
  source_branch: string
  sha: string
  changed_files?: string[]
}

function printUsage(): void {
  console.log(`Usage: npx tsx scripts/find-related-sibling-mrs.ts <sibling-project-path> [search-keyword]

sibling 프로젝트에서 열린 MR을 검색합니다.

Arguments:
  sibling-project-path   GitLab 프로젝트 경로 (예: my-group/my-project/frontend)
  search-keyword         검색 키워드 (선택, 예: "PROJ-123", "UserProfile")

Examples:
  npx tsx scripts/find-related-sibling-mrs.ts my-group/my-project/frontend
  npx tsx scripts/find-related-sibling-mrs.ts my-group/my-project/frontend "UserProfile"
  npx tsx scripts/find-related-sibling-mrs.ts my-group/my-project/frontend "PROJ-123"`)
}

async function fetchJson<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, {
    headers: { 'PRIVATE-TOKEN': token },
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`API 요청 실패: ${response.status} ${response.statusText}\n${body}`)
  }
  return response.json() as Promise<T>
}

async function getMrChanges(encodedProject: string, mrIid: number, token: string): Promise<string[]> {
  try {
    const apiBase = `${loadGitlabUrl()}/api/v4`
    const url = `${apiBase}/projects/${encodedProject}/merge_requests/${mrIid}/changes`
    const data = await fetchJson<{ changes: { old_path: string; new_path: string }[] }>(url, token)
    return data.changes.map((c) => c.new_path)
  } catch {
    return []
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.includes('-h')) {
    printUsage()
    process.exit(0)
  }

  const [projectPath, searchKeyword] = args

  if (!projectPath) {
    printUsage()
    process.exit(1)
  }

  const token = loadGitlabToken()
  const encodedProject = encodeURIComponent(projectPath)
  const apiBase = `${loadGitlabUrl()}/api/v4`

  let url = `${apiBase}/projects/${encodedProject}/merge_requests?state=opened&per_page=20`
  if (searchKeyword) {
    url += `&search=${encodeURIComponent(searchKeyword)}`
  }

  const mrs = await fetchJson<{ iid: number; title: string; source_branch: string; sha: string }[]>(url, token)

  if (mrs.length === 0) {
    console.log('[]')
    return
  }

  const results: MrInfo[] = await Promise.all(
    mrs.map(async (mr) => {
      const changedFiles = await getMrChanges(encodedProject, mr.iid, token)
      return {
        iid: mr.iid,
        title: mr.title,
        source_branch: mr.source_branch,
        sha: mr.sha,
        ...(changedFiles.length > 0 ? { changed_files: changedFiles } : {}),
      }
    }),
  )

  console.log(JSON.stringify(results, null, 2))
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
