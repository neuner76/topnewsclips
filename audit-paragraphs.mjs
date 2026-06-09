import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local
const envPath = path.join(__dirname, '.env.local');
let env = {};
try {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const [key, ...valueParts] = trimmed.split('=');
    env[key.trim()] = valueParts.join('=').trim();
  });
} catch (e) {
  console.error('Error reading .env.local:', e.message);
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('ERROR: Missing Supabase credentials in .env.local');
  console.error('  NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? 'present' : 'MISSING');
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', SERVICE_ROLE_KEY ? 'present' : 'MISSING');
  process.exit(1);
}

console.log('Connecting to Supabase...');
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  try {
    // Fetch 15 most recent digests ordered by date descending
    console.log('Fetching 15 most recent digests...\n');
    const { data: digests, error } = await supabase
      .from('digests')
      .select('id, date, content')
      .order('date', { ascending: false })
      .limit(15);

    if (error) {
      console.error('Error fetching digests:', error);
      process.exit(1);
    }

    if (!digests || digests.length === 0) {
      console.log('No digests found in database');
      process.exit(0);
    }

    console.log(`Found ${digests.length} digests. Auditing paragraph structure...\n`);
    console.log('='.repeat(130));

    digests.forEach((digest, digestIdx) => {
      console.log(`\nDIGEST ${digestIdx + 1} | Date: ${digest.date}`);
      console.log('-'.repeat(130));

      const content = digest.content;
      if (!content || !content.needToKnow || content.needToKnow.length === 0) {
        console.log('  (No NeedToKnow stories)');
        return;
      }

      // Show first 2 stories
      const storiesToShow = content.needToKnow.slice(0, 2);
      storiesToShow.forEach((story, idx) => {
        console.log(`\n  Story ${idx + 1}: "${story.sectionTitle}"`);
        console.log(`  Slug: ${story.slug}`);

        if (!story.paragraphs || story.paragraphs.length < 2) {
          console.log(`  ⚠️  WARNING: Only ${story.paragraphs?.length || 0} paragraph(s) found (expected 2+)`);
          return;
        }

        // Paragraph 0: "what happened"
        const p0 = story.paragraphs[0];
        const p0excerpt = p0.length > 120 ? p0.substring(0, 120) + '...' : p0;
        console.log(`\n  [p0] "What Happened" (plain facts):`);
        console.log(`    ${p0excerpt}`);

        // Paragraph 1: "why it matters"
        const p1 = story.paragraphs[1];
        const p1excerpt = p1.length > 120 ? p1.substring(0, 120) + '...' : p1;
        console.log(`\n  [p1] "Why It Matters" (context/significance):`);
        console.log(`    ${p1excerpt}`);

        // Show how many paragraphs total
        console.log(`\n  Total paragraphs in story: ${story.paragraphs.length}`);
        
        // Quick audit: check if p0 looks like facts vs interpretation
        const p0_interpretive_words = ['argues', 'suggests', 'characterizes', 'describes', 'according to', 'reports', 'per', 'claims'];
        const p1_interpretive_words = ['matters', 'significance', 'context', 'why', 'implication'];
        
        const p0_has_attribution = p0_interpretive_words.some(w => p0.toLowerCase().includes(w));
        const p1_has_context = p1_interpretive_words.some(w => p1.toLowerCase().includes(w)) || 
                               p1_interpretive_words.some(w => p1.includes(w));
        
        console.log(`\n  AUDIT NOTES:`);
        if (p0_has_attribution) {
          console.log(`    ✓ p0 includes attribution language (good)`);
        } else {
          console.log(`    ? p0 might be stating facts plainly without attribution`);
        }
        if (p1_has_context) {
          console.log(`    ✓ p1 appears to include context/significance language (good)`);
        } else {
          console.log(`    ? p1 might lack clear significance framing`);
        }
      });
    });

    console.log('\n' + '='.repeat(130));
    console.log('\nAudit complete! Review the excerpts above to check:');
    console.log('  ✓ [p0] reads as factual account (what happened), with attribution where needed');
    console.log('  ✓ [p1] reads as significance/analysis (why it matters / context), clearly attributed');
    console.log('  ✓ Consistency across stories in this pattern\n');
  } catch (err) {
    console.error('Script error:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main();
