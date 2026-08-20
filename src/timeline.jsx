import React, { useMemo, useState } from 'react';
import { domainOf, ErrorState, ImportanceBadge, Skeleton, TagChips } from './components.jsx';
import { useDigest } from './store.jsx';

/** Compact source chip-card used on timeline cards, in "card form" per source. */
function SourceMini({ emoji, name, detail, url, onClick }) {
  const inner = <>
    <span className="mini-avatar">{emoji || '◆'}</span>
    <div><strong>{name}</strong><small>{detail}</small></div>
  </>;
  return onClick
    ? <button type="button" className="source-mini" onClick={onClick}>{inner}</button>
    : <a className="source-mini" href={url} target="_blank" rel="noopener noreferrer" onClick={event => event.stopPropagation()}>{inner}<em>↗</em></a>;
}

function StoryCard({ story, decksLoading, saved, toggleSave, open, explore, isNew }) {
  const isSaved = saved.includes(story.id);
  const related = story.related || [];
  const sourceCount = 1 + related.length;

  return <article className={`story${story.isResearch ? ' is-research-card' : ''}`}>
    <div className="date">
      <span>{story.dateLabel}</span>
      {isNew && <b>NEW</b>}
      {story.isResearch
        ? <span className="research-badge" title="Top AI Paper of the Week">RESEARCH</span>
        : <ImportanceBadge importance={story.importance} />}
    </div>
    <div className={`story-orb ${story.color || 'violet'}`}><span>{story.glyph || '◆'}</span></div>
    <div className="story-body">
      <div className="story-top">
        <span className={`tag${story.isResearch ? ' research-tag' : ''}`}>{story.category}</span>
        <span className="read">{story.mins} min read</span>
        <span className="rank">#{story.rank} {story.isResearch ? 'paper' : 'this week'}</span>
      </div>
      <h2>{story.title}</h2>
      {decksLoading && !story.deckAdapted
        ? <Skeleton lines={2} className="deck-skeleton" />
        : <p>{story.deck}</p>}

      <div className="sources">
        <span>{story.isResearch ? 'RESEARCH PAPER · 2 SOURCES' : `ONE STORY · ${sourceCount} SOURCE${sourceCount === 1 ? '' : 'S'}`}</span>
        <div className="source-strip">
          <SourceMini emoji={story.sourceEmoji || '📄'} name={story.source} detail={domainOf(story.url)} url={story.url} />
          {story.tweetUrl && <SourceMini emoji="💬" name="DAIR.AI Breakdown" detail="x.com" url={story.tweetUrl} />}
          {!story.isResearch && related.slice(0, 2).map(item => <SourceMini
            key={item.id}
            emoji={item.sourceEmoji}
            name={item.source}
            detail={item.angle}
            onClick={() => open(item.id)}
          />)}
          {!story.isResearch && related.length > 2 && <button type="button" className="source-mini more" onClick={() => explore(story.id)}>+{related.length - 2} more</button>}
        </div>
      </div>

      <TagChips tags={story.tags} max={4} />

      <div className="story-actions">
        <button onClick={() => open(story.id)}>{story.isResearch ? 'Unbox this paper' : 'Unbox this story'} <span>→</span></button>
        <button onClick={() => toggleSave(story.id)} className={isSaved ? 'saved' : ''}>{isSaved ? '★ Saved' : '☆ Save'}</button>
        <button onClick={() => explore(story.id)}>Go deeper</button>
      </div>
    </div>
  </article>;
}

export function Timeline({ level, saved, toggleSave, open, explore, openLevelPicker }) {
  const { status, error, reload, stories, meta, decksLoading, capabilities, researchCount } = useDigest();
  const [view, setView] = useState('featured');
  const [category, setCategory] = useState('All');
  const [takeawaysOpen, setTakeawaysOpen] = useState(true);

  const categories = useMemo(
    () => ['All', ...[...new Set(stories.map(story => story.category))].sort()],
    [stories],
  );

  const visible = useMemo(() => stories
    .filter(story => {
      if (view === 'featured') return story.featured;
      if (view === 'research') return story.isResearch;
      return true;
    })
    .filter(story => category === 'All' || story.category === category),
  [stories, view, category]);

  // Anything from the digest's two most recent days or top week reads as fresh.
  const newestDays = useMemo(() => {
    const dates = [...new Set(stories.map(story => story.published))].sort().reverse();
    return new Set(dates.slice(0, 2));
  }, [stories]);

  const featuredCount = stories.filter(story => story.featured).length;

  return <>
    <header>
      <div>
        <p className="eyebrow">{meta?.range ? `WEEK OF ${meta.range.toUpperCase()}` : 'THIS WEEK IN AI'}</p>
        <h1>The AI world,<br /><i>unboxed.</i></h1>
      </div>
      <div className="header-actions">
        <button className="round" onClick={() => reload(true)} title="Refresh from the digest">↻</button>
        <button className="level-chip" onClick={openLevelPicker}>{level}<span>⌄</span></button>
      </div>
    </header>

    {status === 'loading' && <section className="feed-loading"><Skeleton lines={3} /><Skeleton lines={3} /><Skeleton lines={3} /></section>}
    {status === 'error' && <ErrorState error={error} onRetry={() => reload(true)} />}

    {status === 'ready' && <>
      <section className="intro">
        <span className="spark">✦</span>
        <p>
          {stories.length} stories {researchCount > 0 ? `including ${researchCount} top AI research papers ` : ''}from <a href={meta?.digestUrl || 'https://elbruno.github.io/weekly-ai-news-digest/'} target="_blank" rel="noopener noreferrer">El Bruno&rsquo;s Digest</a> &amp; <a href="https://github.com/dair-ai/AI-Papers-of-the-Week" target="_blank" rel="noopener noreferrer">DAIR.AI</a>,
          re-explained for a <b>{level.toLowerCase()}</b> reader{capabilities.gemini ? ' by Gemini' : ''}.
        </p>
        <button onClick={() => setTakeawaysOpen(open => !open)}>
          {takeawaysOpen ? 'Hide' : 'Show'} takeaways <span>→</span>
        </button>
      </section>

      {takeawaysOpen && Boolean(meta?.takeaways?.length) && <section className="takeaways">
        <p className="eyebrow">TL;DR — THE WEEK IN {meta.takeaways.length} LINES</p>
        <ol>{meta.takeaways.map((takeaway, index) => <li key={index}>{takeaway}</li>)}</ol>
        <div className="source-counts">
          {(meta.sourceCounts || []).map(({ emoji, name, count }) => <span key={name}>{emoji} {count} {name}</span>)}
          {researchCount > 0 && <span>📄 {researchCount} DAIR.AI / arXiv Research Papers</span>}
        </div>
      </section>}

      <section className="timeline-controls">
        <div className="segmented">
          <button className={view === 'featured' ? 'on' : ''} onClick={() => setView('featured')}>Featured {featuredCount}</button>
          <button className={view === 'all' ? 'on' : ''} onClick={() => setView('all')}>All {stories.length}</button>
          {researchCount > 0 && <button className={view === 'research' ? 'on' : ''} onClick={() => { setView('research'); setCategory('All'); }}>Research {researchCount}</button>}
        </div>
        <div className="chip-row">
          {categories.map(name => <button
            key={name}
            className={category === name ? 'chip on' : 'chip'}
            onClick={() => setCategory(name)}
          >{name}</button>)}
        </div>
      </section>

      <section className="feed">
        <div className="line" />
        {visible.map(story => <StoryCard
          key={story.id}
          story={story}
          decksLoading={decksLoading}
          saved={saved}
          toggleSave={toggleSave}
          open={open}
          explore={explore}
          isNew={newestDays.has(story.published)}
        />)}
        {!visible.length && <div className="empty">No stories in {category}. Try another topic.</div>}
      </section>
    </>}
  </>;
}
