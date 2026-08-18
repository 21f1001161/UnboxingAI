import { Router } from 'express';
import { getDigest } from './digest.js';
import { decksForLevel, explainStory, hasGemini, LEVELS } from './gemini.js';
import { hasTavily, relatedInDigest, researchStory } from './research.js';

const DECK_BATCH = 10;

const levelFrom = value => (LEVELS.includes(value) ? value : 'Intermediate');

/** These endpoints spend Gemini and Tavily credits, so they stay behind sign-in. */
const requireAuth = (req, res, next) => (req.user ? next() : res.status(401).json({ error: 'Sign in first.' }));

const handle = fn => async (req, res) => {
  try {
    res.json(await fn(req));
  } catch (error) {
    console.error(`[api] ${req.method} ${req.originalUrl}:`, error.message);
    res.status(error.status || 502).json({ error: error.message });
  }
};

const withStory = fn => handle(async req => {
  const digest = await getDigest();
  const story = digest.stories.find(candidate => candidate.id === req.params.id);
  if (!story) {
    const notFound = new Error(`No story with id "${req.params.id}" in the current digest.`);
    notFound.status = 404;
    throw notFound;
  }
  return fn(story, digest, req);
});

export function contentRoutes() {
  const router = Router();

  router.get('/capabilities', (_req, res) => res.json({
    gemini: hasGemini(),
    tavily: hasTavily(),
    levels: LEVELS,
  }));

  // Paints the timeline immediately; level-adapted decks arrive from /decks.
  router.get('/digest', requireAuth, handle(async req => {
    const digest = await getDigest({ force: req.query.refresh === '1' });
    return {
      ...digest,
      // Cards can honestly say "one story, N sources" before any API is called.
      stories: digest.stories.map(story => ({ ...story, related: relatedInDigest(story, digest.stories) })),
      capabilities: { gemini: hasGemini(), tavily: hasTavily() },
    };
  }));

  router.get('/decks', requireAuth, handle(async req => {
    const level = levelFrom(req.query.level);
    const { stories } = await getDigest();
    const batches = [];
    for (let index = 0; index < stories.length; index += DECK_BATCH) {
      batches.push(stories.slice(index, index + DECK_BATCH));
    }
    const results = await Promise.all(batches.map(batch => decksForLevel(batch, level)));
    return { level, decks: Object.assign({}, ...results), generatedBy: hasGemini() ? 'gemini' : 'digest-fallback' };
  }));

  router.get('/stories/:id/explain', requireAuth, withStory((story, _digest, req) =>
    explainStory(story, levelFrom(req.query.level)).then(explanation => ({ story, explanation }))));

  router.get('/stories/:id/research', requireAuth, withStory((story, digest, req) =>
    researchStory(story, levelFrom(req.query.level), digest.stories).then(research => ({ story, research }))));

  return router;
}
