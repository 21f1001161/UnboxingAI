import { cached } from './cache.js';

export const DIGEST_URL = process.env.DIGEST_URL || 'https://elbruno.github.io/weekly-ai-news-digest/';
const DIGEST_TTL = 30 * 60 * 1000;

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”' };

function decode(value = '') {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match);
}

const text = (html = '') => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const attr = (block, name) => (block.match(new RegExp(`data-${name}="([^"]*)"`)) || [, ''])[1];
const slug = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 72);

// The digest labels each outlet with an emoji; keep it, but give the app its own
// accent + glyph so timeline orbs stay on-brand instead of importing GitHub's palette.
const SOURCE_STYLE = {
  'GitHub Changelog': { color: 'violet', glyph: '◆', kind: 'Platform changelog' },
  'Microsoft Developer': { color: 'sky', glyph: '◈', kind: 'Vendor release notes' },
  'TechCrunch AI': { color: 'coral', glyph: '▲', kind: 'Industry reporting' },
  'Ars Technica': { color: 'amber', glyph: '⌁', kind: 'Technical reporting' },
  'VentureBeat AI': { color: 'lime', glyph: '✦', kind: 'Industry reporting' },
  'The Verge': { color: 'rose', glyph: '◒', kind: 'Consumer tech reporting' },
  'Hacker News': { color: 'ember', glyph: '⌘', kind: 'Community discussion' },
};
const DEFAULT_STYLE = { color: 'violet', glyph: '✦', kind: 'Reporting' };

// Ordered: the first rule that matches a story's tags wins, so "Policy" beats a
// generic "AI" tag and a security story is never filed under Tools.
const CATEGORY_RULES = [
  ['Policy', ['policy', 'regulation', 'governance']],
  ['Security', ['security', 'privacy', 'moderation']],
  ['Research', ['research', 'science']],
  ['Models', ['llms', 'models', 'model']],
  ['Business', ['startups', 'funding', 'enterprise', 'm&a']],
  ['Tools', ['tools', 'developer experience', 'productivity', 'github', 'web']],
  ['Open source', ['open source', 'opensource']],
  ['Infrastructure', ['cloud', 'databases', 'apis', 'devops']],
];

function categoryFor(tags) {
  const lower = tags.map(tag => tag.toLowerCase());
  for (const [category, needles] of CATEGORY_RULES) {
    if (needles.some(needle => lower.includes(needle))) return category;
  }
  return 'AI';
}

/**
 * What it takes to read the *unboxed* story: the digest TL;DR plus the ~260-word
 * explainer UnboxingAI generates around it, with a small allowance per topic tag
 * since each extra concept adds a key term to unpack. Digest TL;DRs are all
 * 48-69 words, so this lands in a narrow 3-5 min band — that is the honest
 * answer, not a bug to tune variance into.
 */
function readingMinutes(tags, ...parts) {
  const words = parts.join(' ').split(/\s+/).filter(Boolean).length;
  return Math.max(3, Math.min(9, Math.round((words + 260 + tags.length * 18) / 95)));
}

function parseList(html, sectionId) {
  const section = html.match(new RegExp(`id="${sectionId}"([\\s\\S]*?)</section>`));
  if (!section) return [];
  const list = section[1].match(/<ul class="lang-block" data-lang="en">([\s\S]*?)<\/ul>/);
  if (!list) return [];
  return [...list[1].matchAll(/<li>([\s\S]*?)<\/li>/g)].map(match => text(match[1]));
}

function parseCard(block) {
  const tags = attr(block, 'tags').split(',').map(tag => decode(tag).trim()).filter(Boolean);
  const source = decode(attr(block, 'source'));
  const url = (block.match(/<h2 class="card-title">\s*<a href="([^"]+)"/) || [, ''])[1];
  const titleBlock = block.match(/<h2 class="card-title">([\s\S]*?)<\/h2>/)?.[1] || '';
  const title = text(titleBlock.match(/data-lang="en">([\s\S]*?)<\/span>/)?.[1] || '');
  const titleEs = text(titleBlock.match(/data-lang="es">([\s\S]*?)<\/span>/)?.[1] || '');
  const tldr = text(block.match(/<p class="tldr lang-block" data-lang="en">([\s\S]*?)<\/p>/)?.[1] || '');
  const tldrEs = text(block.match(/<p class="tldr lang-block" data-lang="es">([\s\S]*?)<\/p>/)?.[1] || '');
  const whyBlock = block.match(/<div class="why-matters">([\s\S]*?)<\/div>/)?.[1] || '';
  const whyMatters = text(whyBlock.match(/data-lang="en">([\s\S]*?)<\/span>/)?.[1] || '').replace(/^Why it matters:\s*/i, '');
  const sourceLabel = text(block.match(/<span class="source-label">([\s\S]*?)<\/span>/)?.[1] || '');
  const emoji = sourceLabel.match(/^(\P{ASCII})/u)?.[1] || '';
  const style = SOURCE_STYLE[source] || DEFAULT_STYLE;
  const published = attr(block, 'published');

  if (!title || !url) return null;

  return {
    id: slug(title),
    rank: Number(attr(block, 'rank')) || 0,
    published,
    dateLabel: new Date(`${published}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: '2-digit', timeZone: 'UTC' }).toUpperCase(),
    importance: attr(block, 'importance') || 'Medium',
    source,
    sourceEmoji: emoji,
    sourceKind: style.kind,
    color: style.color,
    glyph: style.glyph,
    tags,
    category: categoryFor(tags),
    title,
    titleEs,
    tldr,
    tldrEs,
    whyMatters,
    url,
    mins: readingMinutes(tags, tldr, whyMatters),
  };
}

/**
 * Picks a spread of stories that exercises every part of the UI: different
 * outlets, different categories, and a mix of importance levels.
 */
function markFeatured(stories, count = 7) {
  const byImportance = { High: 0, Medium: 1, Low: 2 };
  const ranked = [...stories].sort((a, b) =>
    (byImportance[a.importance] ?? 3) - (byImportance[b.importance] ?? 3) || a.rank - b.rank);

  const picked = [];
  const seenSource = new Set();
  const seenCategory = new Set();
  for (const pass of [0, 1, 2]) {
    for (const story of ranked) {
      if (picked.length >= count || picked.includes(story)) continue;
      // Pass 0 demands a new outlet *and* a new category, pass 1 relaxes to a
      // new outlet, pass 2 fills any remaining slots by rank.
      if (pass === 0 && (seenSource.has(story.source) || seenCategory.has(story.category))) continue;
      if (pass === 1 && seenSource.has(story.source)) continue;
      picked.push(story);
      seenSource.add(story.source);
      seenCategory.add(story.category);
    }
  }
  const ids = new Set(picked.map(story => story.id));
  stories.forEach(story => { story.featured = ids.has(story.id); });
  return stories;
}

export function parseDigest(html) {
  const stories = [...html.matchAll(/<article class="story-card"([\s\S]*?)<\/article>/g)]
    .map(match => parseCard(match[1]))
    .filter(Boolean)
    .sort((a, b) => a.rank - b.rank);

  // Two cards can point at the same slug if the digest repeats a headline.
  const seen = new Map();
  for (const story of stories) {
    const count = (seen.get(story.id) || 0) + 1;
    seen.set(story.id, count);
    if (count > 1) story.id = `${story.id}-${count}`;
  }

  const sourceCounts = [...html.matchAll(/<div class="stat">\s*(\P{ASCII})\s*(\d+)\s+([^<]+?)\s*<\/div>/gu)]
    .map(([, emoji, count, name]) => ({ emoji, name: decode(name).trim(), count: Number(count) }));

  return {
    title: text(html.match(/<title>([\s\S]*?)<\/title>/)?.[1] || 'Weekly AI & Tech News Digest'),
    range: text(html.match(/<title>[^<]*—([^<]*)<\/title>/)?.[1] || ''),
    takeaways: parseList(html, 'top-takeaways'),
    highlights: parseList(html, 'gh-highlights'),
    sourceCounts,
    stories: markFeatured(stories),
    digestUrl: DIGEST_URL,
    fetchedAt: new Date().toISOString(),
  };
}

export function getDigest({ force = false } = {}) {
  return cached('digest:v1', force ? 0 : DIGEST_TTL, async () => {
    const response = await fetch(DIGEST_URL, { headers: { 'user-agent': 'UnboxingAI/0.2 (learning companion)' } });
    if (!response.ok) throw new Error(`Digest fetch failed with ${response.status}`);
    const parsed = parseDigest(await response.text());
    if (!parsed.stories.length) throw new Error('Digest fetched but no story cards were found');
    return parsed;
  });
}

export async function findStory(id) {
  const digest = await getDigest();
  return digest.stories.find(story => story.id === id) || null;
}
