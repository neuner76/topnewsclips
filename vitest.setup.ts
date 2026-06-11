import fs from 'fs'
import path from 'path'

// Load .env.local for tests that hit the real Anthropic API (Node 20.6+)
const envPath = path.join(process.cwd(), '.env.local')
if (!process.env.ANTHROPIC_API_KEY && fs.existsSync(envPath)) {
  process.loadEnvFile(envPath)
}
