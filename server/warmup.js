import { getDigest } from './digest.js';
import { decksForLevel, explainStory, LEVELS } from './gemini.js';
import { researchStory } from './research.js';
import { getResearchPapers } from './papers.js';
import { fileURLToPath } from 'node:url';

async function asyncPool(limit, items, iteratorFn) {
  const ret = [];
  const executing = new Set();
  for (const item of items) {
    const p = Promise.resolve().then(() => iteratorFn(item));
    ret.push(p);
    executing.add(p);
    const clean = () => executing.delete(p);
    p.then(clean, clean);
    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }
  return Promise.all(ret);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function warmUpCache({ onProgress = console.log } = {}) {
  const startTime = Date.now();
  onProgress('Starting comprehensive cache preloading...');

  // 1. Warm up digest and research papers
  const digest = await getDigest();
  const papers = await getResearchPapers().catch(() => ({ stories: [] }));
  onProgress(`Digest loaded with ${digest.stories.length} news stories and ${papers.stories?.length || 0} research papers.`);

  // 2. Warm up Decks for all 3 levels
  const DECK_BATCH = 10;
  for (const level of LEVELS) {
    onProgress(`Warming timeline decks for level: ${level}...`);
    const batches = [];
    for (let i = 0; i < digest.stories.length; i += DECK_BATCH) {
      batches.push(digest.stories.slice(i, i + DECK_BATCH));
    }
    for (const batch of batches) {
      try {
        await decksForLevel(batch, level);
        await sleep(200);
      } catch (err) {
        onProgress(`Warning warming decks for ${level}: ${err.message}`);
      }
    }
    onProgress(`Timeline decks cached for ${level}.`);
  }

  // 3. Warm up Explanations for all stories and levels
  const explainTasks = [];
  for (const story of digest.stories) {
    for (const level of LEVELS) {
      explainTasks.push({ story, level });
    }
  }

  let explainDone = 0;
  onProgress(`Warming ${explainTasks.length} story card explanations across all levels...`);
  await asyncPool(2, explainTasks, async ({ story, level }) => {
    try {
      await explainStory(story, level);
    } catch (err) {
      onProgress(`Explain notice (${story.id}/${level}): ${err.message}`);
    }
    explainDone++;
    if (explainDone % 15 === 0 || explainDone === explainTasks.length) {
      onProgress(`Explanations cached: ${explainDone}/${explainTasks.length}`);
    }
    await sleep(200);
  });

  // 4. Warm up Research for all stories and levels
  const researchTasks = [];
  for (const story of digest.stories) {
    for (const level of LEVELS) {
      researchTasks.push({ story, level });
    }
  }

  let researchDone = 0;
  onProgress(`Warming ${researchTasks.length} multi-source research summaries across all levels...`);
  await asyncPool(2, researchTasks, async ({ story, level }) => {
    try {
      await researchStory(story, level, digest.stories);
    } catch (err) {
      onProgress(`Research notice (${story.id}/${level}): ${err.message}`);
    }
    researchDone++;
    if (researchDone % 15 === 0 || researchDone === researchTasks.length) {
      onProgress(`Research cached: ${researchDone}/${researchTasks.length}`);
    }
    await sleep(200);
  });

  const durationSec = Math.round((Date.now() - startTime) / 1000);
  onProgress(`Cache warm-up completed in ${durationSec}s! All cards & content are loaded in cache.`);
}

if (process.argv[1]?.endsWith('warmup.js') || process.argv[1]?.includes('warmup')) {
  warmUpCache().catch(console.error);
}
