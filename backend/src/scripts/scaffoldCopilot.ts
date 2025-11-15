import fs from 'fs'
import path from 'path'

function toKebabCase(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function ensureDir(p: string) {
  await fs.promises.mkdir(p, { recursive: true })
}

async function writeIfMissing(filePath: string, content: string) {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK)
    console.log(`skip: already exists -> ${filePath}`)
  } catch {
    await fs.promises.writeFile(filePath, content, 'utf8')
    console.log(`create: ${filePath}`)
  }
}

async function main() {
  const [, , rawId, ...rest] = process.argv
  if (!rawId) {
    console.error('Usage: ts-node src/scripts/scaffoldCopilot.ts <id> [Display Name...]')
    process.exit(1)
  }
  const id = toKebabCase(rawId)
  const displayName = rest.length > 0 ? rest.join(' ') : rawId

  const baseDir = path.join(process.cwd(), 'src', 'agents', 'copilots', id)
  await ensureDir(baseDir)

  const manifestPath = path.join(baseDir, 'manifest.yaml')
  const promptPath = path.join(baseDir, 'system-prompt.md')
  const toolsPath = path.join(baseDir, 'tools.ts')

  const manifest = `id: ${id}
displayName: ${displayName}
description: ${displayName} co-pilot.
version: 0.1.0
owner: team@your-company.com
permissions:
  - read.metrics
  - read.assets
  - write.budget
defaultTools:
  - strategist.queryMetrics
  - strategist.mediaByAdId
  - strategist.planBudget
policy:
  maxSteps: 12
  maxToolCalls: 20
  cooldownSeconds: 300
  approvalRequiredFor:
    - write.budget
`

  const prompt = `You are the ${displayName} co-pilot.
- Be concise and action-oriented.
- Use tools to query metrics and propose safe changes.
- Respect policies: cooldowns and approvals for sensitive actions.
`

  const tools = `// Local tool bindings for ${displayName} (optional)
// Export a function to register any custom tools for this co-pilot.
export function register${id.replace(/-([a-z])/g, (_, c) => (c ? c.toUpperCase() : '')).replace(/^([a-z])/,(m)=>m.toUpperCase())}Tools() {
  // Example: registerTool({...})
}
`

  await writeIfMissing(manifestPath, manifest)
  await writeIfMissing(promptPath, prompt)
  await writeIfMissing(toolsPath, tools)

  console.log('\nScaffold complete.')
  console.log(`Location: ${baseDir}`)
  console.log('\nNext steps:')
  console.log('- Review manifest.yaml permissions and policy')
  console.log('- Edit system-prompt.md to define role and style')
  console.log('- Implement any custom tools in tools.ts (optional)')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
