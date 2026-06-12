import { generateAndStoreDigest } from '../lib/digest'

generateAndStoreDigest()
  .then(digest => {
    const ntk = digest.content.needToKnow.length
    const itk = Object.values(digest.content.inTheKnow).reduce((n, arr) => n + arr.length, 0)
    const etc = digest.content.etcetera.length
    const gbs = digest.content.globalBlindspots?.length ?? 0
    console.log(`✓ Digest generated for ${digest.date}`)
    console.log(`  NeedToKnow: ${ntk} | InTheKnow: ${itk} | Etcetera: ${etc} | GlobalBlindspot: ${gbs}`)
    process.exit(0)
  })
  .catch(err => {
    console.error('✗ Digest generation failed:', err instanceof Error ? err.message : String(err))
    if (err instanceof Error && err.stack) console.error(err.stack)
    process.exit(1)
  })
