import React, { useEffect, useMemo, useState } from 'react';
import './product-features.css';
import { domainOf, ErrorState, ImportanceBadge, Notice, Skeleton, SourceCard, TagChips } from './components.jsx';
import { useDigest, useResearch } from './store.jsx';

/* ------------------------------------------------------------------ *
 * Tab 2 — In-depth research
 * ------------------------------------------------------------------ */

function Explorations({ explorations, capabilities }) {
  if (!explorations?.length) return <Notice tone="info">No exploration topics were generated for this story.</Notice>;

  return <div className="explore-list">
    {explorations.map((entry, index) => <article key={entry.topic} className="explore-card">
      <header>
        <span className="explore-number">{String(index + 1).padStart(2, '0')}</span>
        <div>
          <strong>{entry.topic}</strong>
          <small>{entry.why}</small>
        </div>
      </header>
      {entry.links?.length
        ? <ul className="explore-links">
          {entry.links.map(link => <li key={link.url}>
            <a href={link.url} target="_blank" rel="noopener noreferrer">{link.title}<em>{link.domain} ↗</em></a>
            {link.snippet && <p>{link.snippet}</p>}
          </li>)}
        </ul>
        : <p className="explore-empty">
          {capabilities.tavily
            ? 'No explainer links came back for this topic.'
            : <>Add <code>TAVILY_API_KEY</code> to pull explainers for this topic.</>}
        </p>}
    </article>)}
  </div>;
}

function ResearchPanel({ story, level, saved, toggleSave, open }) {
  const { capabilities } = useDigest();
  const { status, data, error } = useResearch(story, level);
  const research = data?.research;
  const isSaved = saved.includes(story.id);

  return <aside className="research-detail">
    <div className="detail-head">
      <div className="story-top">
        <span className="tag">{story.category}</span>
        <ImportanceBadge importance={story.importance} />
        <span className="read">{story.mins} min</span>
      </div>
      <h2>{story.title}</h2>
      <p>{story.deck}</p>
      <div className="detail-actions">
        <button onClick={() => open(story.id)}>Unbox this story →</button>
        <button onClick={() => toggleSave(story.id)} className={isSaved ? 'is-saved' : ''}>{isSaved ? '★ Saved' : '☆ Save'}</button>
      </div>
      <TagChips tags={story.tags} max={6} />
    </div>

    {status === 'loading' && <div className="detail-loading">
      <p className="loading-line">Gathering sources and exploration topics…</p>
      <Skeleton lines={4} />
      <Skeleton lines={4} />
    </div>}

    {status === 'error' && <Notice tone="warn">{error}</Notice>}

    {research && <>
      {research.answer && <div className="synthesis"><span>✦</span><div><strong>What the coverage agrees on</strong><p>{research.answer}</p></div></div>}

      <section className="detail-section">
        <p className="eyebrow">SOURCES ON THIS STORY · {research.sources.length + (research.related?.length || 0)}</p>
        <div className="source-grid">
          {research.sources.map(source => <SourceCard
            key={source.url}
            source={source}
            kicker={source.primary ? `Original report · ${story.sourceKind}` : undefined}
          />)}
          {(research.related || []).map(item => <SourceCard
            key={item.id}
            source={item}
            onOpenStory={() => open(item.id)}
          />)}
        </div>
        {research.note && <Notice tone="info">{research.note}</Notice>}
      </section>

      <section className="detail-section">
        <p className="eyebrow">NEED TO KNOW BEFORE YOU READ · {level.toUpperCase()}</p>
        <Explorations explorations={research.explorations} capabilities={capabilities} />
      </section>
    </>}
  </aside>;
}

export function ResearchHub({ level, saved, toggleSave, open, focusId, setFocusId }) {
  const { status, error, reload, stories } = useDigest();
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState('All topics');
  const [source, setSource] = useState('All sources');

  const topics = useMemo(() => ['All topics', ...[...new Set(stories.map(story => story.category))].sort()], [stories]);
  const sources = useMemo(() => ['All sources', ...[...new Set(stories.map(story => story.source))].sort()], [stories]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return stories.filter(story => {
      const haystack = `${story.title} ${story.tldr} ${story.whyMatters} ${story.category} ${story.source} ${story.tags.join(' ')}`.toLowerCase();
      return (topic === 'All topics' || story.category === topic)
        && (source === 'All sources' || story.source === source)
        && (!needle || haystack.includes(needle));
    });
  }, [stories, query, topic, source]);

  const selected = useMemo(() => stories.find(story => story.id === focusId) || null, [stories, focusId]);

  // If a filter hides the open story, drop the panel rather than stranding it.
  useEffect(() => {
    if (focusId && results.length && !results.some(story => story.id === focusId)) setFocusId(null);
  }, [focusId, results, setFocusId]);

  return <>
    <header>
      <div><p className="eyebrow">GO DEEPER</p><h1>Find the signal,<br /><i>skip the noise.</i></h1></div>
    </header>

    <section className="research-hero">
      <p>Search this week&rsquo;s digest, then open a story to see every outlet covering it and the concepts worth learning first.</p>
      <div className="search-live">
        <span>⌕</span>
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search agents, models, security, regulation…" />
        {query && <button onClick={() => setQuery('')}>Clear</button>}
      </div>
      <div className="filter-row">{topics.map(name => <button key={name} onClick={() => setTopic(name)} className={topic === name ? 'selected' : ''}>{name}</button>)}</div>
      <div className="filter-row subtle">{sources.map(name => <button key={name} onClick={() => setSource(name)} className={source === name ? 'selected' : ''}>{name}</button>)}</div>
    </section>

    {status === 'loading' && <Skeleton lines={6} />}
    {status === 'error' && <ErrorState error={error} onRetry={() => reload(true)} />}

    {status === 'ready' && <>
      <section className="result-head">
        <p className="eyebrow">{results.length} STOR{results.length === 1 ? 'Y' : 'IES'} FOUND</p>
        <span>Searches titles, summaries, topics, and outlets</span>
      </section>

      <div className={`research-split${selected ? ' has-detail' : ''}`}>
        <section className="result-grid">
          {results.map(story => <article
            className={`result-card${story.id === focusId ? ' is-open' : ''}`}
            key={story.id}
          >
            <div>
              <span className="tag">{story.category}</span>
              <span className="read">{story.mins} min</span>
            </div>
            <h2>{story.title}</h2>
            <p>{story.deck}</p>
            <div className="result-source">
              <span className="mini-avatar">{story.sourceEmoji || '◆'}</span>
              {story.source}
              <em>{domainOf(story.url)}</em>
              {Boolean(story.related?.length) && <b>+{story.related.length} related</b>}
            </div>
            <footer>
              <button onClick={() => setFocusId(story.id)}>{story.id === focusId ? 'Showing sources' : 'Sources & topics →'}</button>
              <button onClick={() => open(story.id)}>Read story</button>
              <button onClick={() => toggleSave(story.id)} className={saved.includes(story.id) ? 'is-saved' : ''}>{saved.includes(story.id) ? '★' : '☆'}</button>
            </footer>
          </article>)}
          {!results.length && <div className="no-results"><span>⌕</span><h2>No stories yet</h2><p>Try a broader search or another topic.</p></div>}
        </section>

        {selected
          ? <ResearchPanel story={selected} level={level} saved={saved} toggleSave={toggleSave} open={open} />
          : <aside className="research-detail placeholder">
            <span>◎</span>
            <h2>Pick a story to research it.</h2>
            <p>You&rsquo;ll get every outlet covering the same event, plus the background concepts worth learning first — chosen for a {level.toLowerCase()} reader.</p>
          </aside>}
      </div>
    </>}
  </>;
}

/* ------------------------------------------------------------------ *
 * My learning
 * ------------------------------------------------------------------ */

function SavedRow({ entry, index, inPlaylist, togglePlaylist, toggleSave, open, explore }) {
  const { id, story } = entry;

  if (!story) {
    return <article className="saved-row is-stale">
      <span className="playlist-number">{String(index + 1).padStart(2, '0')}</span>
      <div>
        <small>NOT IN THIS WEEK&rsquo;S DIGEST</small>
        <h3>{id.replace(/-/g, ' ')}</h3>
        <p>This story has rolled off the current digest, so there is nothing left to open.</p>
      </div>
      <aside><button onClick={() => toggleSave(id)}>Remove</button></aside>
    </article>;
  }

  return <article className="saved-row">
    <span className="playlist-number">{String(index + 1).padStart(2, '0')}</span>
    <div>
      <small>{story.category} · {story.mins} min · {story.dateLabel}</small>
      <h3>{story.title}</h3>
      <p>{story.deck}</p>
      <div className="saved-links">
        <button onClick={() => open(story.id)}>Continue reading →</button>
        <button onClick={() => explore(story.id)}>Sources &amp; topics</button>
        <a href={story.url} target="_blank" rel="noopener noreferrer">{story.sourceEmoji} {story.source} ↗</a>
      </div>
    </div>
    <aside>
      <button onClick={() => togglePlaylist(story.id)} className={inPlaylist ? 'in-playlist' : ''}>{inPlaylist ? '✓ In playlist' : '+ Add to playlist'}</button>
      <button onClick={() => toggleSave(story.id)}>Remove</button>
    </aside>
  </article>;
}

export function LearningDashboard({ saved, toggleSave, open, explore, playlist, togglePlaylist }) {
  const { stories, status } = useDigest();
  const [notify, setNotify] = useState(true);

  // Preserve the order the learner saved things in, and keep entries whose
  // story has aged out of the digest so nothing silently disappears.
  const entries = useMemo(
    () => saved.map(id => ({ id, story: stories.find(story => story.id === id) || null })),
    [saved, stories],
  );
  const live = entries.filter(entry => entry.story);
  const minutes = live.reduce((total, entry) => total + entry.story.mins, 0);

  return <>
    <header>
      <div><p className="eyebrow">YOUR SPACE</p><h1>Keep your curiosity<br /><i>in motion.</i></h1></div>
      <span className="streak">✦ 3-day learning streak</span>
    </header>

    <section className="learning-stats">
      <div><strong>{saved.length}</strong><span>saved stories</span></div>
      <div><strong>{playlist.length}</strong><span>in your playlist</span></div>
      <div><strong>{minutes}</strong><span>minutes queued</span></div>
      <div><strong>{notify ? 'Sun' : 'Off'}</strong><span>weekly recap</span></div>
    </section>

    <section className="playlist-section">
      <div className="section-heading">
        <div><p className="eyebrow">LEARNING QUEUE</p><h2>Your next deep dive</h2></div>
        <span>{live.length} ready</span>
      </div>

      {status === 'loading' && <Skeleton lines={4} />}

      {status !== 'loading' && (entries.length
        ? <div className="playlist-list">
          {entries.map((entry, index) => <SavedRow
            key={entry.id}
            entry={entry}
            index={index}
            inPlaylist={playlist.includes(entry.id)}
            togglePlaylist={togglePlaylist}
            toggleSave={toggleSave}
            open={open}
            explore={explore}
          />)}
        </div>
        : <div className="empty-state">
          <span>☆</span>
          <h2>Your learning queue is ready when you are.</h2>
          <p>Save a story from the timeline or research page to revisit it here.</p>
        </div>)}
    </section>

    <section className="reminder-card">
      <div>
        <span>✦</span>
        <p className="eyebrow">WEEKLY LEARNING NUDGE</p>
        <h2>Get a thoughtful recap every Sunday.</h2>
        <p>We&rsquo;ll remind you of saved stories and share a quick summary of what you have not opened yet.</p>
      </div>
      <button onClick={() => setNotify(!notify)} className={notify ? 'toggle-button on' : 'toggle-button'}><i></i>{notify ? 'Enabled' : 'Disabled'}</button>
    </section>
  </>;
}

/* ------------------------------------------------------------------ *
 * Settings
 * ------------------------------------------------------------------ */

export function Settings({ user, level, changeLevel, signOut }) {
  const { capabilities, meta } = useDigest();

  return <>
    <header><div><p className="eyebrow">ACCOUNT</p><h1>Your learning,<br /><i>your way.</i></h1></div></header>
    <section className="settings-panel">
      <div className="account-row">
        <span>{user.name?.split(' ').map(part => part[0]).slice(0, 2).join('')}</span>
        <div><h2>{user.name}</h2><p>{user.email}</p></div>
        <small>Signed in with Google</small>
      </div>

      <div className="settings-row">
        <div><h3>Learning level</h3><p>Stories are currently explained for a <b>{level}</b> learner.</p></div>
        <button onClick={changeLevel}>Change level →</button>
      </div>

      <div className="settings-row">
        <div>
          <h3>Story source</h3>
          <p>{meta ? <>{meta.stories.length} stories from <a href={meta.digestUrl} target="_blank" rel="noopener noreferrer">{meta.title}</a>.</> : 'Loading the weekly digest…'}</p>
        </div>
        <small className="status ok">Connected</small>
      </div>

      <div className="settings-row">
        <div><h3>Level-adapted explanations</h3><p>Gemini rewrites every story for your chosen level.</p></div>
        <small className={`status ${capabilities.gemini ? 'ok' : 'off'}`}>{capabilities.gemini ? 'Gemini connected' : 'GEMINI_API_KEY not set'}</small>
      </div>

      <div className="settings-row">
        <div><h3>Multi-source research</h3><p>Tavily finds other outlets and background explainers.</p></div>
        <small className={`status ${capabilities.tavily ? 'ok' : 'off'}`}>{capabilities.tavily ? 'Tavily connected' : 'TAVILY_API_KEY not set'}</small>
      </div>

      <div className="settings-row">
        <div><h3>Email nudges</h3><p>A weekly recap helps you return to saved stories.</p></div>
        <button disabled>Managed in My learning</button>
      </div>

      <div className="settings-row danger">
        <div><h3>Sign out</h3><p>You can sign in again at any time.</p></div>
        <button onClick={signOut}>Sign out</button>
      </div>
    </section>
  </>;
}
