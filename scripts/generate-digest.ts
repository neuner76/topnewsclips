import { generateAndStoreDigest } from '../lib/digest'

generateAndStoreDigest()
  .then(digest => {
    const ntk = Array.isArray(digest.content.needToKnow) ? digest.content.needToKnow.length : 0
    const itk = Object.values(digest.content.inTheKnow ?? {})
      .reduce((n, arr) => n + (Array.isArray(arr) ? arr.length : 0), 0)
    const etc = Array.isArray(digest.content.etcetera) ? digest.content.etcetera.length : 0
    const gbs = Array.isArray(digest.content.globalBlindspots) ? digest.content.globalBlindspots.length : 0
    console.log(`✓ Digest generated for ${digest.date}`)
    console.log(`  NeedToKnow: ${ntk} | InTheKnow: ${itk} | Etcetera: ${etc} | GlobalBlindspot: ${gbs}`)
    process.exit(0)
  })
  .catch(err => {
    console.error('✗ Digest generation failed:', err instanceof Error ? err.message : String(err))
    if (err instanceof Error && err.stack) console.error(err.stack)
    process.exit(1)
  })
