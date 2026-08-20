import { Router } from 'express';
import { getDigest } from './digest.js';
import { decksForLevel, explainStory, hasGemini, LEVELS } from './gemini.js';
import { hasTavily, relatedInDigest, researchStory } from './research.js';
import { getResearchPapers, explainResearchPaper, researchForPaper } from './papers.js';

const DECK_BATCH = 10;

const levelFrom = value => (LEVELS.includes(value) ? value : 'Intermediate');

/** These endpoints spend Gemini and Tavily credits, so they stay behind sign-in. */
const requireAuth = (req, res, next) => (req.user ? next() : res.status(401).json({ error: 'Sign in first.' }));

const handle = fn => async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json(await fn(req));
  } catch (error) {
    console.error(`[api] ${req.method} ${req.originalUrl}:`, error.message);
    res.status(error.status || 502).json({ error: error.message });
  }
};

const withStory = fn => handle(async req => {
  const digest = await getDigest();
  let story = digest.stories.find(candidate => candidate.id === req.params.id);
  let isResearch = false;

  if (!story) {
    const papersData = await getResearchPapers().catch(() => ({ stories: [] }));
    story = (papersData.stories || []).find(candidate => candidate.id === req.params.id);
    if (story) isResearch = true;
  }

  if (!story) {
    const notFound = new Error(`No story with id "${req.params.id}" in the current digest or research papers.`);
    notFound.status = 404;
    throw notFound;
  }
  return fn(story, digest, req, isResearch);
});

export function contentRoutes() {
  const router = Router();

  router.get('/capabilities', (_req, res) => res.json({
    gemini: hasGemini(),
    tavily: hasTavily(),
    levels: LEVELS,
  }));

  // Paints the timeline and research pages; includes both digest stories and top AI research papers.
  router.get('/digest', requireAuth, handle(async req => {
    const isForce = req.query.refresh === '1';
    const digest = await getDigest({ force: isForce });
    const papersData = await getResearchPapers({ force: isForce }).catch(() => ({ stories: [], weeks: [] }));

    const newsStories = digest.stories.map(story => ({
      ...story,
      related: relatedInDigest(story, digest.stories),
    }));

    const researchStories = (papersData.stories || []).map(paper => ({
      ...paper,
      related: (papersData.stories || []).filter(p => p.id !== paper.id).slice(0, 2),
    }));

    const combinedStories = [...newsStories, ...researchStories];

    return {
      ...digest,
      stories: combinedStories,
      newsCount: newsStories.length,
      researchCount: researchStories.length,
      researchWeeks: papersData.weeks || [],
      capabilities: { gemini: hasGemini(), tavily: hasTavily() },
    };
  }));

  router.get('/decks', requireAuth, handle(async req => {
    const level = levelFrom(req.query.level);
    const { stories } = await getDigest();
    const papersData = await getResearchPapers().catch(() => ({ stories: [] }));

    const batches = [];
    for (let index = 0; index < stories.length; index += DECK_BATCH) {
      batches.push(stories.slice(index, index + DECK_BATCH));
    }
    const results = await Promise.all(batches.map(batch => decksForLevel(batch, level)));
    const decks = Object.assign({}, ...results);

    // Attach research paper decks (identical for Intermediate and Expert)
    for (const paper of (papersData.stories || [])) {
      decks[paper.id] = paper.deck;
    }

    return { level, decks, generatedBy: hasGemini() ? 'gemini' : 'digest-fallback' };
  }));

  router.get('/stories/:id/explain', requireAuth, withStory((story, _digest, req, isResearch) => {
    const level = levelFrom(req.query.level);
    if (isResearch || story.isResearch) {
      return Promise.resolve({ story, explanation: explainResearchPaper(story, level) });
    }
    return explainStory(story, level).then(explanation => ({ story, explanation }));
  }));

  router.get('/stories/:id/research', requireAuth, withStory(async (story, digest, req, isResearch) => {
    const level = levelFrom(req.query.level);
    if (isResearch || story.isResearch) {
      const papersData = await getResearchPapers().catch(() => ({ stories: [] }));
      return { story, research: researchForPaper(story, level, papersData.stories || []) };
    }
    return researchStory(story, level, digest.stories).then(research => ({ story, research }));
  }));

  return router;
}
