import React, { useEffect, useMemo, useState } from 'react';
import { Skeleton } from './components.jsx';
import { useDigest } from './store.jsx';
import './dashboard.css';
import './dashboard-overrides.css';

const unique = items => [...new Set(items || [])];

function streakFrom(days) {
  const active = new Set(days || []);
  let count = 0;
  const cursor = new Date();
  while (active.has(cursor.toISOString().slice(0, 10))) {
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

function PlaylistItem({ story, index, completed, open, markCompleted, togglePlaylist }) {
  return <article className={`playlist-item${completed ? ' done' : ''}`}>
    <span className="playlist-number">{String(index + 1).padStart(2, '0')}</span>
    <div className="playlist-item-copy">
      <small>{story.category} · {story.mins} min · {story.dateLabel}</small>
      <h3>{story.title}</h3>
      <p>{story.deck}</p>
      <button onClick={() => open(story.id)}>Read this story →</button>
    </div>
    <div className="playlist-item-actions">
      <button onClick={() => markCompleted(story.id)} className={completed ? 'completed' : ''}>{completed ? 'Completed' : 'Mark complete'}</button>
      <button onClick={() => togglePlaylist(story.id)}>Remove</button>
    </div>
  </article>;
}

function QueueItem({ story, index, inPlaylist, read, completed, open, togglePlaylist, markCompleted }) {
  return <article className={`queue-card${completed ? ' done' : ''}`}>
    <span className="queue-index">{String(index + 1).padStart(2, '0')}</span>
    <div><small>{story.category} · {story.mins} min</small><h3>{story.title}</h3><p>{story.deck}</p></div>
    <footer>
      <button onClick={() => open(story.id)}>{read ? 'Continue reading' : 'Start reading'} →</button>
      <button onClick={() => markCompleted(story.id)}>{completed ? 'Completed' : 'Complete'}</button>
      <button onClick={() => togglePlaylist(story.id)} className={inPlaylist ? 'in-playlist' : ''}>{inPlaylist ? 'In playlist' : '+ Playlist'}</button>
    </footer>
  </article>;
}

export function LearningDashboardV2({ saved, playlist, togglePlaylist, open, learning, setLearning, markCompleted }) {
  const { stories, status } = useDigest();
  const [emailStatus, setEmailStatus] = useState('');
  const entries = useMemo(() => saved.map(id => stories.find(story => story.id === id)).filter(Boolean), [saved, stories]);
  const playlistEntries = useMemo(() => playlist.map(id => stories.find(story => story.id === id)).filter(Boolean), [playlist, stories]);
  const read = unique(learning.read);
  const completed = unique(learning.completed);
  const unread = entries.filter(story => !read.includes(story.id));
  const totalMins = playlistEntries.reduce((sum, story) => sum + story.mins, 0);
  const playlistDone = playlistEntries.filter(story => completed.includes(story.id)).length;
  const notify = Boolean(learning.notifications);
  const emailEnabled = Boolean(learning.emailNudges);
  useEffect(() => {
    if (!notify || !unread.length || !('Notification' in window) || Notification.permission !== 'granted') return;
    const week = `${new Date().getUTCFullYear()}-${Math.ceil((new Date() - new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1))) / 604800000)}`;
    const key = `unboxing-ai-last-nudge-${week}`;
    if (localStorage.getItem(key)) return;
    new Notification('Your UnboxingAI recap is ready', { body: `${unread.length} saved ${unread.length === 1 ? 'story is' : 'stories are'} ready to continue.` });
    localStorage.setItem(key, '1');
  }, [notify, unread.length]);
  const toggleNotice = async () => {
    const next = !notify;
    if (next && 'Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
    setLearning(current => ({ ...current, notifications: next }));
  };
  const sendTestEmail = async () => {
    setEmailStatus('Sending…');
    try {
      const response = await fetch('/api/nudges/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ stories: unread.slice(0, 3).map(story => story.title) }) });
      const body = await response.json();
      setEmailStatus(body.message || 'Test email sent.');
    } catch { setEmailStatus('Email is not configured yet.'); }
  };
  return <>
    <header><div><p className="eyebrow">YOUR SPACE</p><h1>Keep your curiosity<br /><i>in motion.</i></h1></div><span className="streak">✦ {streakFrom(learning.activityDays) || 0}-day learning streak</span></header>
    {unread.length > 0 && <section className="weekly-recap"><div className="recap-icon">✦</div><div><p className="eyebrow">YOUR WEEKLY RECAP</p><h2>{unread.length} saved {unread.length === 1 ? 'story is' : 'stories are'} waiting for you.</h2><p>{unread.slice(0, 3).map(story => story.title).join(' · ')}</p><p className="recap-summary"><b>Quick catch-up:</b> {unread[0].deck}</p></div><button onClick={() => document.getElementById('learning-playlist')?.scrollIntoView({ behavior: 'smooth' })}>Review playlist →</button></section>}
    <section className="learning-stats learning-stats-four"><div><strong>{saved.length}</strong><span>posts saved</span></div><div><strong>{read.length}</strong><span>posts read</span></div><div><strong>{completed.length}</strong><span>completed</span></div><div><strong>{totalMins}</strong><span>playlist mins</span></div></section>
    {playlistEntries.length > 0 && <section id="learning-playlist" className="playlist-section playlist-first"><div className="section-heading"><div><p className="eyebrow">LEARNING PLAYLIST</p><h2>{playlistDone === playlistEntries.length ? 'Playlist complete. Nice work.' : `${totalMins} minutes to complete your playlist`}</h2></div><span>{playlistDone}/{playlistEntries.length} complete</span></div><div className="playlist-progress"><span style={{ width: `${playlistEntries.length ? (playlistDone / playlistEntries.length) * 100 : 0}%` }}></span></div><div className="playlist-list">{playlistEntries.map((story, index) => <PlaylistItem key={story.id} story={story} index={index} completed={completed.includes(story.id)} open={open} markCompleted={markCompleted} togglePlaylist={togglePlaylist} />)}</div></section>}
    <section className="playlist-section queue-section"><div className="section-heading"><div><p className="eyebrow">LEARNING QUEUE</p><h2>{entries.length ? 'Saved for your next session' : 'Your next story starts here.'}</h2></div><span>{entries.length} saved</span></div>{status === 'loading' ? <Skeleton lines={4} /> : entries.length ? <div className="queue-grid">{entries.map((story, index) => <QueueItem key={story.id} story={story} index={index} inPlaylist={playlist.includes(story.id)} read={read.includes(story.id)} completed={completed.includes(story.id)} open={open} togglePlaylist={togglePlaylist} markCompleted={markCompleted} />)}</div> : <div className="empty-state"><span>☆</span><h2>Your learning queue is ready when you are.</h2><p>Save a story from the timeline or research page to revisit it here.</p></div>}</section>
    <section className="nudge-control"><div><span>✦</span><p className="eyebrow">SMART REMINDERS</p><h2>A timely nudge, not another distraction.</h2><p>Get a browser alert and weekly email recap only when you have stories waiting to be read.</p></div><div className="nudge-actions"><button onClick={toggleNotice} className={notify ? 'toggle-button on' : 'toggle-button'}><i></i>{notify ? 'Alerts on' : 'Alerts off'}</button><button onClick={() => setLearning(current => ({ ...current, emailNudges: !emailEnabled }))} className={emailEnabled ? 'email-enabled' : 'email-test'}>{emailEnabled ? 'Weekly email on' : 'Enable weekly email'}</button><button className="email-test" onClick={sendTestEmail}>Send test email</button>{emailStatus && <small>{emailStatus}</small>}</div></section>
  </>;
}
