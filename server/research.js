import { cached } from './cache.js';
import { explorationTopics } from './gemini.js';

const TAVILY_URL = 'https://api.tavily.com/search';
const TTL = 12 * 60 * 60 * 1000;

export const hasTavily = () => Boolean(process.env.TAVILY_API_KEY);

const domainOf = url => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

const publisherOf = url => {
  const domain = domainOf(url);
  const name = domain.split('.').slice(0, -1).pop() || domain;
  return name.replace(/-/g, ' ').replace(/\b\w/g, character => character.toUpperCase());
};

// Tavily relevance for a genuinely on-topic result sits at 0.6-0.95 and the
// off-topic tail collapses below 0.2, so a mid floor cuts the junk without
// discarding outlets that worded the same headline differently.
const MIN_RELEVANCE_NEWS = 0.5;
const MIN_RELEVANCE_TOPIC = 0.3;

const trim = (value = '', max = 220) => {
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max).replace(/\s+\S*$/, '')}…` : clean;
};

/** Truncates on a sentence boundary so a summary never stops mid-clause. */
const trimToSentence = (value = '', max = 420) => {
  const clean = value.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return lastStop > max * 0.5 ? cut.slice(0, lastStop + 1) : `${cut.replace(/\s+\S*$/, '')}…`;
};

async function tavily(body) {
  const response = await fetch(TAVILY_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
    },
    body: JSON.stringify({ search_depth: 'basic', max_results: 6, ...body }),
  });
  if (!response.ok) throw new Error(`Tavily responded ${response.status}: ${(await response.text()).slice(0, 200)}`);
  return response.json();
}

const STOP_WORDS = new Set(['the', 'and', 'for', 'with', 'that', 'from', 'its', 'now', 'new', 'has', 'have', 'are', 'was', 'their', 'them', 'into', 'over', 'after', 'more', 'this', 'your', 'you', 'available', 'launches', 'launch', 'released', 'releases', 'release', 'announces', 'introduces', 'says', 'than', 'but', 'not', 'all', 'can', 'will', 'reportedly', 'officially', 'across', 'giving', 'gains', 'targets', 'first', 'about']);

const singular = word => (word.length > 4 ? word.replace(/ies$/, 'y').replace(/s$/, '') : word);

const anchorsOf = title => new Set(
  title.toLowerCase().split(/[^a-z0-9]+/).filter(word => word.length > 3 && !STOP_WORDS.has(word)).map(singular),
);

/**
 * Other outlets covering the same event. Deduped by domain so a publisher that
 * ran three follow-ups does not crowd out the rest of the coverage.
 *
 * Relevance score alone is not enough: news-roundup pages score highly because
 * their *body* covers the story while their headline is about something else
 * entirely. Requiring a headline anchor keeps the card's title honest.
 */
async function coverageFor(story) {
  const primaryDomain = domainOf(story.url);
  const anchors = anchorsOf(story.title);
  const { results = [], answer } = await tavily({
    query: story.title,
    topic: 'news',
    days: 30,
    max_results: 10,
    include_answer: true,
  });

  const seen = new Set([primaryDomain]);
  const coverage = [];
  for (const result of results) {
    const domain = domainOf(result.url);
    if (!domain || seen.has(domain) || (result.score ?? 1) < MIN_RELEVANCE_NEWS) continue;
    const hits = [...anchorsOf(result.title || '')].filter(token => anchors.has(token)).length;
    if (!hits) continue;
    seen.add(domain);
    coverage.push({
      publisher: publisherOf(result.url),
      domain,
      title: trim(result.title, 120),
      snippet: trim(result.content),
      url: result.url,
      published: result.published_date || null,
      // Only claim "same event" when the headline agrees on more than one term.
      angle: hits >= 2 ? 'Also covering this' : 'Related coverage',
    });
    if (coverage.length === 5) break;
  }
  return { coverage, answer: answer ? trimToSentence(answer) : null };
}

/** One Tavily lookup per Gemini-named concept, attaching real explainers to each. */
async function explorationsFor(story, level) {
  const topics = await explorationTopics(story, level);
  const searched = await Promise.all(topics.map(async topic => {
    if (!hasTavily()) return { ...topic, links: [] };
    try {
      const { results = [] } = await tavily({ query: topic.query, topic: 'general', max_results: 4 });
      return {
        ...topic,
        links: results.filter(result => (result.score ?? 1) >= MIN_RELEVANCE_TOPIC).slice(0, 2).map(result => ({
          title: trim(result.title, 110),
          snippet: trim(result.content, 160),
          url: result.url,
          domain: domainOf(result.url),
        })),
      };
    } catch (error) {
      console.warn(`[tavily] exploration "${topic.topic}" failed:`, error.message);
      return { ...topic, links: [] };
    }
  }));
  return searched;
}

const titleTokens = title => new Set(
  title.toLowerCase().split(/[^a-z0-9.]+/).filter(word => word.length > 2 && !STOP_WORDS.has(word)),
);

// A term that appears in half the headlines ("github", "copilot") says almost
// nothing about two stories being the same event; a rare one ("openrouter")
// says a great deal. Weighting by inverse document frequency encodes that.
const idfCache = new WeakMap();

function inverseFrequency(stories) {
  if (idfCache.has(stories)) return idfCache.get(stories);
  const documentCount = new Map();
  for (const story of stories) {
    for (const token of titleTokens(story.title)) {
      documentCount.set(token, (documentCount.get(token) || 0) + 1);
    }
  }
  const idf = token => Math.log(stories.length / ((documentCount.get(token) || 0) + 1)) + 1;
  idfCache.set(stories, idf);
  return idf;
}

const SAME_STORY_WEIGHT = 5;
// idf() of a token appearing in at most 2 of the ~29 headlines. One such token
// ("openrouter", "reticulum") is enough to link two stories; a token spread
// across more headlines ("code", "users") is not, however many tags they share.
const DISTINCTIVE = 3.1;

function isRelated({ shared, titleWeight, maxIdf, tagOverlap }) {
  if (shared.length >= 2 && titleWeight >= 3.5) return true;
  if (shared.length >= 1 && maxIdf >= DISTINCTIVE && titleWeight >= 3) return true;
  return shared.length >= 1 && tagOverlap >= 4 && titleWeight >= 2;
}

/**
 * Stories already in the digest that cover the same thread. This runs with no
 * API key at all, so the "one story, many sources" idea holds up offline too.
 */
export function relatedInDigest(story, stories) {
  const idf = inverseFrequency(stories);
  const mine = titleTokens(story.title);
  const myTags = new Set(story.tags.map(tag => tag.toLowerCase()));

  return stories
    .filter(other => other.id !== story.id)
    .map(other => {
      const shared = [...titleTokens(other.title)].filter(token => mine.has(token));
      const titleWeight = shared.reduce((total, token) => total + idf(token), 0);
      const maxIdf = shared.reduce((best, token) => Math.max(best, idf(token)), 0);
      const tagOverlap = other.tags.filter(tag => myTags.has(tag.toLowerCase())).length;
      return { other, titleWeight, shared, maxIdf, tagOverlap, score: titleWeight + tagOverlap * 0.35 };
    })
    .filter(isRelated)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ other, titleWeight }) => ({
      id: other.id,
      title: other.title,
      source: other.source,
      sourceEmoji: other.sourceEmoji,
      url: other.url,
      published: other.published,
      tldr: trim(other.tldr, 180),
      // "Same story" is only claimed when the headlines genuinely overlap AND a
      // different outlet reported it — a wrong claim here is worse than none.
      angle: other.source !== story.source
        ? (titleWeight >= SAME_STORY_WEIGHT ? 'Same story, different outlet' : 'Related thread this week')
        : `More from ${other.source}`,
    }));
}

export function researchStory(story, level, allStories = []) {
  const related = relatedInDigest(story, allStories);
  const primary = {
    publisher: story.source,
    domain: domainOf(story.url),
    title: story.title,
    snippet: trim(story.tldr),
    url: story.url,
    published: story.published,
    primary: true,
  };

  if (!hasTavily()) {
    return explorationsFor(story, level).then(explorations => ({
      sources: [primary],
      related,
      explorations,
      answer: null,
      generatedBy: 'digest-only',
      note: 'Add TAVILY_API_KEY to .env to pull in coverage from other outlets.',
    }));
  }

  return cached(`research:v4:${story.id}:${level}`, TTL, async () => {
    const [coverageResult, explorations] = await Promise.all([
      coverageFor(story).catch(error => {
        console.warn(`[tavily] coverage for ${story.id} failed:`, error.message);
        return { coverage: [], answer: null };
      }),
      explorationsFor(story, level),
    ]);
    return {
      sources: [primary, ...coverageResult.coverage],
      explorations,
      answer: coverageResult.answer,
      generatedBy: 'tavily',
    };
  })
    .then(result => ({ ...result, related }))
    .catch(error => {
      console.warn(`[research] ${story.id} failed:`, error.message);
      return { sources: [primary], related, explorations: [], answer: null, generatedBy: 'digest-only' };
    });
}
