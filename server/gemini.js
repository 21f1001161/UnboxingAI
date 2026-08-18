import { cached } from './cache.js';

const API = 'https://generativelanguage.googleapis.com/v1beta/models';
// `gemini-flash-latest` is an alias that tracks the current Flash model, so this
// default cannot rot when a specific version is retired; the pinned names after
// it are the fallback if the alias is unavailable on an account.
const MODELS = (process.env.GEMINI_MODEL || 'gemini-flash-latest,gemini-3.7-flash,gemini-2.5-flash')
  .split(',').map(model => model.trim()).filter(Boolean);
const TTL = Infinity; // A story's text never changes, so an explanation never goes stale.

export const LEVELS = ['Beginner', 'Intermediate', 'Expert'];

export const hasGemini = () => Boolean(process.env.GEMINI_API_KEY);

const LEVEL_BRIEF = {
  Beginner: `The reader is new to AI. Assume no technical background.
- Use everyday words and concrete analogies. Never use an acronym without unpacking it first.
- Explain why a non-specialist should care before explaining any mechanism.
- Short sentences. No jargon, no benchmark numbers, no vendor comparisons.`,
  Intermediate: `The reader follows tech news and has used AI tools, but does not build them.
- Connect this story to the wider trend it belongs to and to adjacent stories.
- Name the technology precisely, then explain it in one clause.
- Include the practical consequence for someone who uses or buys these tools.`,
  Expert: `The reader builds with AI and reads primary sources.
- Lead with the technical substance: architecture, mechanism, measurable claims, limits.
- Be explicit about what the reporting establishes vs. what it only implies.
- Note second-order effects, failure modes, migration or threat-model implications.
- Skip introductory framing entirely.`,
};

const EXPLANATION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    deck: { type: 'STRING', description: 'One sentence, max 30 words, pitched at the reader level.' },
    shortVersion: { type: 'ARRAY', items: { type: 'STRING' }, description: '2-3 paragraphs of 2-3 sentences each.' },
    plainLanguage: { type: 'STRING', description: 'A single sentence capturing the whole story.' },
    keyTerms: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { term: { type: 'STRING' }, meaning: { type: 'STRING' } },
        required: ['term', 'meaning'],
      },
      description: '2-4 terms from this story, defined for this reader level.',
    },
    whyItMatters: { type: 'STRING' },
    watchNext: { type: 'ARRAY', items: { type: 'STRING' }, description: '2-3 things to watch, each one sentence.' },
  },
  required: ['deck', 'shortVersion', 'plainLanguage', 'keyTerms', 'whyItMatters', 'watchNext'],
};

const DECKS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    decks: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { id: { type: 'STRING' }, deck: { type: 'STRING' } },
        required: ['id', 'deck'],
      },
    },
  },
  required: ['decks'],
};

const TOPICS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    topics: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          topic: { type: 'STRING', description: 'Short name of the concept, max 6 words.' },
          why: { type: 'STRING', description: 'One sentence on why it unlocks this story.' },
          query: { type: 'STRING', description: 'A web search query that finds explainers on it.' },
        },
        required: ['topic', 'why', 'query'],
      },
    },
  },
  required: ['topics'],
};

async function callGemini(prompt, schema, { temperature = 0.4 } = {}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set');

  const failures = [];
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let response;
      try {
        response = await fetch(`${API}/${model}:generateContent`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature, responseMimeType: 'application/json', responseSchema: schema },
          }),
        });
      } catch (error) {
        failures.push(`${model}: ${error.message}`);
        continue;
      }

      if (response.ok) {
        const body = await response.json();
        const text = body.candidates?.[0]?.content?.parts?.map(part => part.text).join('') || '';
        if (!text) throw new Error(`Gemini returned no text (finish: ${body.candidates?.[0]?.finishReason || 'unknown'})`);
        return JSON.parse(text);
      }

      const body = await response.json().catch(() => null);
      const detail = body?.error?.message?.replace(/\s+/g, ' ').slice(0, 90) || `HTTP ${response.status}`;
      failures.push(`${model} ${response.status}: ${detail}`);
      // 404/400 means this account cannot use the model — move on, don't retry.
      if (response.status === 404 || response.status === 400) break;
      if (response.status !== 429 && response.status < 500) break;
      await new Promise(resolve => setTimeout(resolve, 700 * (attempt + 1)));
    }
  }
  // Report each distinct failure once: a retired name in the chain would
  // otherwise mask the real reason the first-choice model failed, but repeating
  // the same message per retry buries it just as effectively.
  throw new Error(`Gemini request failed — ${[...new Set(failures)].join('; ')}`);
}

const storyBrief = story => `Headline: ${story.title}
Published: ${story.published}
Reported by: ${story.source} (${story.sourceKind})
Topic tags: ${story.tags.join(', ')}
Editor's importance rating: ${story.importance}
Digest summary: ${story.tldr}
Digest note on significance: ${story.whyMatters}
Canonical link: ${story.url}`;

const GROUNDING = `Ground every claim in the digest summary above. Do not invent numbers, dates, quotes, or product names that are not present in it. If something is only reported or rumoured, say so.`;

/** Sentence-aware truncation, so fallback copy never ends mid-word. */
function firstSentences(value = '', count = 1) {
  const sentences = value.match(/[^.!?]+[.!?]+/g);
  if (!sentences) return value;
  return sentences.slice(0, count).join(' ').trim();
}

function fallbackExplanation(story, level) {
  const lead = {
    Beginner: `Here is the simple version: ${firstSentences(story.tldr, 1)}`,
    Intermediate: firstSentences(story.tldr, 2),
    Expert: story.tldr,
  }[level];

  return {
    deck: firstSentences(story.tldr, 1),
    shortVersion: [lead, story.whyMatters].filter(Boolean),
    plainLanguage: firstSentences(story.whyMatters, 1) || firstSentences(story.tldr, 1),
    // Filler definitions would be worse than none — the reader can see the tags.
    keyTerms: [],
    whyItMatters: story.whyMatters,
    watchNext: [`Follow ${story.source} for updates to this story.`],
    level,
    generatedBy: 'digest-fallback',
    note: 'Add GEMINI_API_KEY to .env for explanations written for your level.',
  };
}

export function explainStory(story, level) {
  if (!hasGemini()) return Promise.resolve(fallbackExplanation(story, level));

  return cached(`explain:v2:${story.id}:${level}`, TTL, async () => {
    const result = await callGemini(
      `You write for UnboxingAI, a companion that explains AI news at the reader's chosen level.

READER LEVEL — ${level}
${LEVEL_BRIEF[level]}

STORY
${storyBrief(story)}

${GROUNDING}
Write the explanation for a ${level} reader. Vary the depth, vocabulary, and framing so a ${level} reader would notice this was written for them specifically.`,
      EXPLANATION_SCHEMA,
    );
    return { ...result, level, generatedBy: 'gemini' };
  }).catch(error => {
    console.warn(`[gemini] explanation for ${story.id}/${level} failed:`, error.message);
    return { ...fallbackExplanation(story, level), note: 'Gemini was unavailable, so this is the digest summary.' };
  });
}

/**
 * One call per (level, batch of stories) so the timeline can show level-adapted
 * decks on every card without one request per card.
 */
export function decksForLevel(stories, level) {
  const ids = stories.map(story => story.id).join('|');
  if (!hasGemini()) {
    return Promise.resolve(Object.fromEntries(stories.map(story => [story.id, firstSentences(story.tldr, 1)])));
  }

  return cached(`decks:v2:${level}:${ids}`, TTL, async () => {
    const { decks } = await callGemini(
      `You write one-sentence timeline summaries for UnboxingAI.

READER LEVEL — ${level}
${LEVEL_BRIEF[level]}

Write one summary per story below, max 28 words each, in the voice described above.
Return the exact id you were given for each story. ${GROUNDING}

${stories.map(story => `---\nid: ${story.id}\n${storyBrief(story)}`).join('\n')}`,
      DECKS_SCHEMA,
      { temperature: 0.5 },
    );
    const byId = Object.fromEntries(decks.map(({ id, deck }) => [id, deck]));
    // A model can drop or rename an id; fall back per story rather than per batch.
    return Object.fromEntries(stories.map(story => [story.id, byId[story.id] || firstSentences(story.tldr, 1)]));
  }).catch(error => {
    console.warn(`[gemini] decks for ${level} failed:`, error.message);
    return Object.fromEntries(stories.map(story => [story.id, firstSentences(story.tldr, 1)]));
  });
}

function fallbackTopics(story) {
  return story.tags.slice(0, 4).map(tag => ({
    topic: tag,
    why: `${tag} is one of the themes the digest filed this story under.`,
    query: `${tag} ${story.category} explained 2026`,
  }));
}

/** Names the concepts a reader needs before this story makes sense. */
export function explorationTopics(story, level) {
  if (!hasGemini()) return Promise.resolve(fallbackTopics(story));

  return cached(`topics:v2:${story.id}:${level}`, TTL, async () => {
    const { topics } = await callGemini(
      `A ${level} reader wants to understand this story properly.

${storyBrief(story)}

Name the 4 concepts they most need to know first — the background that makes this story make sense, not a restatement of it.
Pitch the selection at a ${level} reader: ${LEVEL_BRIEF[level].split('\n')[0]}
For each, give a web search query that would surface good explainers (not news coverage of this specific event).`,
      TOPICS_SCHEMA,
      { temperature: 0.6 },
    );
    return topics.slice(0, 4);
  }).catch(error => {
    console.warn(`[gemini] topics for ${story.id} failed:`, error.message);
    return fallbackTopics(story);
  });
}
