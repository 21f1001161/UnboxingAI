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

const NAV = [
  ['timeline', '◌', 'AI timeline'],
  ['research', '⌘', 'In-depth research'],
  ['dashboard', '□', 'My learning'],
  ['settings', '⚙', 'Settings'],
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

  return [items, toggle];
}

function Workspace({ user, level, setLevel, openLevelPicker, signOut }) {
  const { stories } = useDigest();
  const [page, setPage] = useState('timeline');
  const [selectedId, setSelectedId] = useState(null);
  const [focusId, setFocusId] = useState(null);
  const [saved, toggleSave] = useStoredList(`unboxing-ai-saved-${user.id}`);
  const [playlist, togglePlaylist] = useStoredList(`unboxing-ai-playlist-${user.id}`);

  const selected = useMemo(() => stories.find(story => story.id === selectedId) || null, [stories, selectedId]);

  // Opening a story from anywhere goes through one place, so the research tab,
  // the timeline, and the learning queue all behave identically.
  const openStory = useCallback(id => setSelectedId(id), []);
  const explore = useCallback(id => { setFocusId(id); setSelectedId(null); setPage('research'); }, []);

  useEffect(() => {
    if (!selectedId) return undefined;
    const onKey = event => event.key === 'Escape' && setSelectedId(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId]);

  const shared = { level, saved, toggleSave, open: openStory, explore };

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
      {page === 'dashboard' && <LearningDashboard {...shared} playlist={playlist} togglePlaylist={togglePlaylist} />}
      {page === 'settings' && <Settings user={user} level={level} changeLevel={openLevelPicker} signOut={signOut} />}
    </main>

    {selected && <Article
      story={selected}
      level={level}
      setLevel={setLevel}
      close={() => setSelectedId(null)}
      saved={saved}
      toggleSave={toggleSave}
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
