import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './login.css';
import './digest.css';
import { LEVELS } from './components.jsx';
import { DigestProvider, useDigest } from './store.jsx';
import { Timeline } from './timeline.jsx';
import { Article } from './article.jsx';
import { LearningDashboard, ResearchHub, Settings } from './product-features.jsx';
import { LearningDashboardV2 } from './dashboard.jsx';

const NAV = [
  ['timeline', <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>, 'AI timeline'],
  ['research', <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" /></svg>, 'In-depth research'],
  ['dashboard', <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>, 'My learning'],
  ['settings', <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>, 'Settings'],
];

/** Per-user localStorage list, tolerant of anything an older build left behind. */
function useStoredList(key) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!key) return setItems([]);
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '[]');
      setItems(Array.isArray(parsed) ? parsed.filter(item => typeof item === 'string') : []);
    } catch {
      setItems([]);
    }
  }, [key]);

  const toggle = useCallback(id => setItems(current => {
    const next = current.includes(id) ? current.filter(item => item !== id) : [...current, id];
    if (key) localStorage.setItem(key, JSON.stringify(next));
    return next;
  }), [key]);

  const replace = useCallback(nextItems => {
    const next = Array.isArray(nextItems) ? nextItems.filter(item => typeof item === 'string') : [];
    setItems(next);
    if (key) localStorage.setItem(key, JSON.stringify(next));
  }, [key]);

  return [items, toggle, replace];
}

/** Per-user localStorage object for learning progress and notification choices. */
function useStoredObject(key, initialValue) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (!key) return setValue(initialValue);
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || 'null');
      setValue(parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? { ...initialValue, ...parsed } : initialValue);
    } catch {
      setValue(initialValue);
    }
  }, [key]);

  const update = useCallback(updater => setValue(current => {
    const next = typeof updater === 'function' ? updater(current) : updater;
    if (key) localStorage.setItem(key, JSON.stringify(next));
    return next;
  }), [key]);

  return [value, update];
}

function Workspace({ user, level, setLevel, openLevelPicker, signOut }) {
  const { stories } = useDigest();
  const [page, setPage] = useState(() => new URLSearchParams(window.location.search).get('view') === 'dashboard' ? 'dashboard' : 'timeline');
  const [selectedId, setSelectedId] = useState(null);
  const [focusId, setFocusId] = useState(null);
  const [saved, toggleSave, replaceSaved] = useStoredList(`unboxing-ai-saved-${user.id}`);
  const [playlist, togglePlaylist, replacePlaylist] = useStoredList(`unboxing-ai-playlist-${user.id}`);
  const [learning, setLearning] = useStoredObject(`unboxing-ai-progress-${user.id}`, {
    read: [], completed: [], activityDays: [], notifications: true, emailNudges: false,
  });
  const [learningReady, setLearningReady] = useState(false);
  const toggleSavedStory = useCallback(id => {
    if (saved.includes(id) && playlist.includes(id)) togglePlaylist(id);
    toggleSave(id);
  }, [saved, playlist, toggleSave, togglePlaylist]);

  useEffect(() => {
    let active = true;
    fetch('/api/learning-state').then(response => response.ok ? response.json() : null).then(payload => {
      if (!active) return;
      if (payload?.state) {
        replaceSaved(payload.state.saved);
        replacePlaylist(payload.state.playlist);
        setLearning(current => ({ ...current, ...payload.state }));
      }
    }).catch(() => {}).finally(() => active && setLearningReady(true));
    return () => { active = false; };
  }, [replaceSaved, replacePlaylist, setLearning]);

  useEffect(() => {
    if (!learningReady) return;
    fetch('/api/learning-state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saved, playlist, ...learning }),
    }).catch(() => {});
  }, [saved, playlist, learning, learningReady]);

  const selected = useMemo(() => stories.find(story => story.id === selectedId) || null, [stories, selectedId]);

  // Opening a story from anywhere goes through one place, so the research tab,
  // the timeline, and the learning queue all behave identically.
  const recordActivity = useCallback(updater => setLearning(current => {
    const today = new Date().toISOString().slice(0, 10);
    const next = updater(current);
    return { ...next, activityDays: [...new Set([...(next.activityDays || []), today])] };
  }), [setLearning]);
  const openStory = useCallback(id => {
    setSelectedId(id);
    recordActivity(current => ({ ...current, read: [...new Set([...(current.read || []), id])] }));
  }, [recordActivity]);
  const markCompleted = useCallback(id => recordActivity(current => ({
    ...current,
    read: [...new Set([...(current.read || []), id])],
    completed: [...new Set([...(current.completed || []), id])],
  })), [recordActivity]);
  const explore = useCallback(id => { setFocusId(id); setSelectedId(null); setPage('research'); }, []);

  useEffect(() => {
    if (!selectedId) return undefined;
    const onKey = event => event.key === 'Escape' && setSelectedId(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId]);

  const shared = { level, saved, toggleSave: toggleSavedStory, open: openStory, explore };
  const clearCompletedPlaylist = useCallback(() => {
    if (!playlist.length) return;
    const completedIds = new Set(learning.completed || []);
    const nextPlaylist = playlist.filter(id => !completedIds.has(id));
    replacePlaylist(nextPlaylist);
  }, [learning.completed, playlist, replacePlaylist]);

  return <div className="app">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">U</span><span>unboxing<span>AI</span></span></div>
      <div className="nav-label">EXPLORE</div>
      <nav>
        {NAV.map(([id, icon, label]) => <button key={id} onClick={() => setPage(id)} className={page === id ? 'active' : ''}>
          <i>{icon}</i>{label}{id === 'dashboard' && saved.length > 0 && <b>{saved.length}</b>}
        </button>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="tip">
          <span>✦</span>
          <p><strong>Make it yours</strong>Choose how deeply you want to learn.</p>
          <button onClick={openLevelPicker}>Adjust level →</button>
        </div>
        <button className="profile">
          <span>{user.name?.split(' ').map(part => part[0]).slice(0, 2).join('')}</span>
          <div><strong>{user.name}</strong><small>{level} learner</small></div>
          <em>⌄</em>
        </button>
      </div>
    </aside>

    <main>
      {page === 'timeline' && <Timeline {...shared} openLevelPicker={openLevelPicker} />}
      {page === 'research' && <ResearchHub {...shared} focusId={focusId} setFocusId={setFocusId} />}
      {page === 'dashboard' && <LearningDashboardV2 {...shared} playlist={playlist} togglePlaylist={togglePlaylist} learning={learning} setLearning={setLearning} markCompleted={markCompleted} clearCompletedPlaylist={clearCompletedPlaylist} />}
      {page === 'settings' && <Settings user={user} level={level} changeLevel={openLevelPicker} signOut={signOut} />}
    </main>

    {selected && <Article
      story={selected}
      level={level}
      setLevel={setLevel}
      close={() => setSelectedId(null)}
      saved={saved}
      toggleSave={toggleSavedStory}
      markCompleted={markCompleted}
      completed={learning.completed || []}
      openStory={openStory}
      explore={explore}
    />}
  </div>;
}

function App() {
  const [user, setUser] = useState(undefined);
  const [level, setLevelState] = useState(null);
  const [showLevel, setShowLevel] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(response => response.json())
      .then(({ user: me }) => {
        setUser(me);
        if (me) setLevelState(localStorage.getItem(`unboxing-ai-level-${me.id}`));
      })
      .catch(() => setUser(null));
  }, []);

  const setLevel = useCallback(choice => {
    if (!LEVELS.includes(choice)) return;
    setLevelState(choice);
    if (user) localStorage.setItem(`unboxing-ai-level-${user.id}`, choice);
    setShowLevel(false);
  }, [user]);

  const signOut = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    localStorage.removeItem(`unboxing-ai-level-${user.id}`);
    setUser(null);
    setLevelState(null);
  }, [user]);

  if (user === undefined) return <div className="loading">Loading your learning space…</div>;
  if (!user) return <LoginScreen />;
  if (!level) return <LevelModal level={level} setLevel={setLevel} close={() => {}} forced />;

  return <DigestProvider level={level}>
    <Workspace user={user} level={level} setLevel={setLevel} openLevelPicker={() => setShowLevel(true)} signOut={signOut} />
    {showLevel && <LevelModal level={level} setLevel={setLevel} close={() => setShowLevel(false)} />}
  </DigestProvider>;
}

function LoginScreen() {
  return <div className="login-page"><div className="login-panel">
    <div className="brand"><span className="brand-mark">U</span><span>unboxing<span>AI</span></span></div>
    <div className="login-copy">
      <p className="eyebrow">YOUR AI LEARNING COMPANION</p>
      <h1>The AI world,<br /><i>unboxed.</i></h1>
      <p>One story, multiple trusted sources, explained at your level.</p>
      <a className="google-button" href="/api/auth/google"><span className="google-g">G</span>Continue with Google</a>
      <small>By continuing, you agree to start a personal learning space.</small>
    </div>
    <div className="login-art"><span>✦</span><div className="orbit one"></div><div className="orbit two"></div><div className="orbit three"></div><b>AI<br />made<br />clear</b></div>
  </div></div>;
}

function LevelModal({ level, setLevel, close, forced = false }) {
  const blurbs = ['Clear, jargon-free foundations', 'Helpful context and connections', 'Technical depth and source detail'];
  return <div className="overlay"><div className="level-modal">
    <button className="close" onClick={close} style={{ display: forced ? 'none' : undefined }}>×</button>
    <span className="spark">✦</span>
    <p className="eyebrow">{forced ? 'WELCOME TO UNBOXING AI' : 'YOUR LEARNING LENS'}</p>
    <h2>How would you like<br />AI explained?</h2>
    <p>Every story in the timeline is rewritten for the level you choose. You can change this at any time.</p>
    {LEVELS.map((option, index) => <button key={option} onClick={() => setLevel(option)} className={level === option ? 'chosen' : ''}>
      <span>{['◇', '◈', '✦'][index]}</span>
      <div><strong>{option}</strong><small>{blurbs[index]}</small></div>
      <em>{level === option ? '✓' : '→'}</em>
    </button>)}
  </div></div>;
}

createRoot(document.getElementById('root')).render(<App />);
