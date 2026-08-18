import React, { useState } from 'react';
import { domainOf, ImportanceBadge, LevelSwitch, Notice, Skeleton, SourceCard, TagChips } from './components.jsx';
import { useExplanation, useLiveStory, useResearch } from './store.jsx';

function MoreCoverage({ story, level, onOpenStory }) {
  const { status, data, error } = useResearch(story, level);

  if (status === 'loading') return <Skeleton lines={4} className="source-skeleton" />;
  if (status === 'error') return <Notice tone="warn">Could not reach the research service: {error}</Notice>;

  const research = data?.research;
  const extra = (research?.sources || []).filter(source => !source.primary);
  if (!extra.length) {
    return <Notice tone="info">
      {research?.note || 'No other outlets were found covering this exact story.'}
    </Notice>;
  }

  return <>
    {research.answer && <div className="synthesis"><span>✦</span><div><strong>What the coverage agrees on</strong><p>{research.answer}</p></div></div>}
    <div className="source-grid">
      {extra.map(source => <SourceCard key={source.url} source={source} onOpenStory={onOpenStory && (() => onOpenStory(source))} />)}
    </div>
  </>;
}

export function Article({ story: incoming, level, setLevel, close, saved, toggleSave, openStory, explore }) {
  const story = useLiveStory(incoming);
  const [coverageOpen, setCoverageOpen] = useState(false);
  const { status, data, error } = useExplanation(story, level);
  const explanation = data?.explanation;
  const related = story.related || [];
  const isSaved = saved.includes(story.id);
  const sourceCount = 1 + related.length;

  return <div className="overlay" onClick={event => event.target === event.currentTarget && close()}>
    <article className="article-modal">
      <button className="close" onClick={close} aria-label="Close">×</button>

      <div className="article-kicker">
        <span className="tag">{story.category}</span>
        <ImportanceBadge importance={story.importance} />
      </div>
      <p className="eyebrow">ONE STORY · {sourceCount} SOURCE{sourceCount === 1 ? '' : 'S'} · {story.dateLabel}</p>
      <h1>{story.title}</h1>

      <div className="article-meta">
        <span>◷ {story.mins} min</span>
        <span className="meta-level">Explained for</span>
        <LevelSwitch level={level} onChange={setLevel} compact />
        <button onClick={() => toggleSave(story.id)} className={isSaved ? 'is-saved' : ''}>
          {isSaved ? '★ Saved' : '☆ Save'}
        </button>
      </div>

      <div className="article-copy">
        {status === 'loading' && <>
          <p className="loading-line">Writing this for a <b>{level.toLowerCase()}</b> reader…</p>
          <Skeleton lines={5} />
        </>}

        {status === 'error' && <Notice tone="warn">{error}</Notice>}

        {explanation && <>
          <p className="lead">{explanation.deck}</p>

          <h2>The short version</h2>
          {explanation.shortVersion.map((paragraph, index) => <p key={index}>{paragraph}</p>)}

          <div className="plain">
            <span>✦</span>
            <div>
              <strong>In plain language</strong>
              <p>{explanation.plainLanguage}</p>
            </div>
          </div>

          {Boolean(explanation.keyTerms?.length) && <>
            <h2>Key terms at your level</h2>
            <dl className="key-terms">
              {explanation.keyTerms.map(({ term, meaning }) => <div key={term}>
                <dt>{term}</dt>
                <dd>{meaning}</dd>
              </div>)}
            </dl>
          </>}

          <h2>Why it matters</h2>
          <p>{explanation.whyItMatters}</p>

          {Boolean(explanation.watchNext?.length) && <>
            <h2>What to watch next</h2>
            <ul className="watch-next">{explanation.watchNext.map(item => <li key={item}>{item}</li>)}</ul>
          </>}

          {explanation.generatedBy !== 'gemini' && <Notice tone="info">{explanation.note}</Notice>}
        </>}

        <h2>Follow the thread</h2>
        <div className="source-grid">
          <SourceCard source={{ publisher: story.source, sourceEmoji: story.sourceEmoji, domain: domainOf(story.url), title: story.title, snippet: story.tldr, url: story.url, published: story.published, primary: true }} kicker={`Original report · ${story.sourceKind}`} />
          {related.map(item => <SourceCard
            key={item.id}
            source={item}
            onOpenStory={openStory && (() => openStory(item.id))}
          />)}
        </div>

        {coverageOpen
          ? <MoreCoverage story={story} level={level} />
          : <button className="ghost-button" onClick={() => setCoverageOpen(true)}>⌕ Find more outlets covering this</button>}

        <div className="article-footer">
          <TagChips tags={story.tags} max={6} />
          <button className="ghost-button" onClick={() => explore(story.id)}>Explore this in depth →</button>
        </div>
      </div>
    </article>
  </div>;
}
