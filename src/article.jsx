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
      {research?.note || (story.isResearch ? 'This research paper is published on arXiv.' : 'No other outlets were found covering this exact story.')}
    </Notice>;
  }

  return <>
    {research.answer && <div className="synthesis"><span>✦</span><div><strong>{story.isResearch ? 'Research Overview' : 'What the coverage agrees on'}</strong><p>{research.answer}</p></div></div>}
    <div className="source-grid">
      {extra.map(source => <SourceCard key={source.url} source={source} onOpenStory={onOpenStory && (() => onOpenStory(source))} />)}
    </div>
  </>;
}

export function Article({ story: incoming, level, setLevel, close, saved, toggleSave, openStory, explore, markCompleted, completed }) {
  const story = useLiveStory(incoming);
  const [coverageOpen, setCoverageOpen] = useState(false);
  const { status, data, error } = useExplanation(story, level);
  const explanation = data?.explanation;
  const related = story.related || [];
  const isSaved = saved.includes(story.id);
  const isCompleted = completed.includes(story.id);
  const sourceCount = 1 + related.length;

  const bullets = explanation?.bulletPoints || story.bulletPoints || [];

  return <div className="overlay" onClick={event => event.target === event.currentTarget && close()}>
    <article className="article-modal">
      <button className="close" onClick={close} aria-label="Close">×</button>

      <div className="article-kicker">
        <span className={`tag${story.isResearch ? ' research-tag' : ''}`}>{story.category}</span>
        {story.isResearch
          ? <span className="research-badge" title="Top AI Paper of the Week">RESEARCH</span>
          : <ImportanceBadge importance={story.importance} />}
      </div>
      <p className="eyebrow">
        {story.isResearch ? `TOP AI PAPER OF THE WEEK · ${story.dateLabel}` : `ONE STORY · ${sourceCount} SOURCE${sourceCount === 1 ? '' : 'S'} · ${story.dateLabel}`}
      </p>
      <h1>{story.title}</h1>

      <div className="article-meta">
        <span>◷ {story.mins} min</span>
        <span className="meta-level">Explained for</span>
        <LevelSwitch level={level} onChange={setLevel} compact />
        <button onClick={() => toggleSave(story.id)} className={isSaved ? 'is-saved' : ''}>
          {isSaved ? '★ Saved' : '☆ Save'}
        </button>
        <button onClick={() => markCompleted(story.id)} className={isCompleted ? 'is-complete' : 'mark-complete'}>
          {isCompleted ? 'Completed' : 'Mark complete'}
        </button>
      </div>

      <div className="article-copy">
        {status === 'loading' && <>
          <p className="loading-line">Loading details for a <b>{level.toLowerCase()}</b> reader…</p>
          <Skeleton lines={5} />
        </>}

        {status === 'error' && <Notice tone="warn">{error}</Notice>}

        {explanation && <>
          <p className="lead">{explanation.deck}</p>

          <h2>{story.isResearch ? 'Paper summary' : 'The short version'}</h2>
          {explanation.shortVersion.map((paragraph, index) => <p key={index}>{paragraph}</p>)}

          {Boolean(bullets.length) && <>
            <h2>Key research findings &amp; mechanism</h2>
            <ul className="paper-bullets">
              {bullets.map((item, index) => <li key={index}>
                <strong>{item.split(':')[0]}:</strong>{item.includes(':') ? item.slice(item.indexOf(':') + 1) : item}
              </li>)}
            </ul>
          </>}

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
            <h2>{story.isResearch ? 'Where to explore next' : 'What to watch next'}</h2>
            <ul className="watch-next">{explanation.watchNext.map(item => <li key={item}>{item}</li>)}</ul>
          </>}

          {explanation.generatedBy !== 'gemini' && explanation.note && <Notice tone="info">{explanation.note}</Notice>}
        </>}

        <h2>Primary publication &amp; discussion</h2>
        <div className="source-grid">
          <SourceCard
            source={{
              publisher: story.isResearch ? 'arXiv Publication' : story.source,
              sourceEmoji: story.sourceEmoji || '📄',
              domain: domainOf(story.url),
              title: story.title,
              snippet: story.tldr,
              url: story.url,
              published: story.published,
              primary: true,
            }}
            kicker={story.isResearch ? 'Primary Research Paper' : `Original report · ${story.sourceKind}`}
          />
          {story.tweetUrl && <SourceCard
            source={{
              publisher: 'DAIR.AI / Author Commentary',
              sourceEmoji: '💬',
              domain: 'x.com',
              title: `Discussion on ${story.paperTitle || story.title}`,
              snippet: story.whyMatters || story.tldr,
              url: story.tweetUrl,
              published: story.published,
              primary: false,
            }}
            kicker="Community & Author Breakdown"
          />}
          {!story.isResearch && related.map(item => <SourceCard
            key={item.id}
            source={item}
            onOpenStory={openStory && (() => openStory(item.id))}
          />)}
        </div>

        {coverageOpen
          ? <MoreCoverage story={story} level={level} />
          : <button className="ghost-button" onClick={() => setCoverageOpen(true)}>
            {story.isResearch ? '⌕ View related research & topics' : '⌕ Find more outlets covering this'}
          </button>}

        <div className="article-footer">
          <TagChips tags={story.tags} max={6} />
          <button className="ghost-button" onClick={() => explore(story.id)}>Explore this in depth →</button>
        </div>
      </div>
    </article>
  </div>;
}
