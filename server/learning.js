import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { getDigest } from './digest.js';

const dataDir = path.join(process.cwd(), '.data');
const dataFile = path.join(dataDir, 'learning-state.json');
mkdirSync(dataDir, { recursive: true });

const readStore = () => {
  try { return existsSync(dataFile) ? JSON.parse(readFileSync(dataFile, 'utf8')) : {}; } catch { return {}; }
};
const writeStore = store => writeFileSync(dataFile, JSON.stringify(store, null, 2));
const list = value => Array.isArray(value) ? [...new Set(value.filter(item => typeof item === 'string'))].slice(0, 500) : [];
const stateFor = state => ({
  saved: list(state?.saved), playlist: list(state?.playlist), read: list(state?.read), completed: list(state?.completed),
  activityDays: list(state?.activityDays).filter(day => /^\d{4}-\d{2}-\d{2}$/.test(day)).slice(-365),
  notifications: Boolean(state?.notifications), emailNudges: Boolean(state?.emailNudges),
});

export function getLearningState(userId) { return readStore()[userId]?.state || null; }
export function saveLearningState(user, state) {
  const store = readStore();
  const clean = stateFor(state);
  store[user.id] = { email: user.email, state: clean, updatedAt: new Date().toISOString(), lastWeeklyNudge: store[user.id]?.lastWeeklyNudge || null };
  writeStore(store);
  return clean;
}

const escaped = text => String(text).replace(/[<>&]/g, '');
const weekKey = now => {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
};

async function sendResend(email, titles, baseUrl) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return false;
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [email], subject: 'Your UnboxingAI weekly learning recap', html: `<h1>Three stories are waiting for you</h1><ul>${titles.map(title => `<li>${escaped(title)}</li>`).join('')}</ul><p><a href="${baseUrl}/?view=dashboard#learning-playlist">Open your learning playlist</a></p>` }) });
  if (!response.ok) throw new Error(`Resend returned ${response.status}`);
  return true;
}

export async function runWeeklyNudges(now = new Date()) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return { sent: 0, skipped: 'Email is not configured.' };
  const digest = await getDigest();
  const titles = new Map(digest.stories.map(story => [story.id, story.title]));
  const store = readStore(); const key = weekKey(now); let sent = 0;
  for (const entry of Object.values(store)) {
    const state = stateFor(entry.state);
    const unread = state.saved.filter(id => !state.read.includes(id)).slice(0, 3).map(id => titles.get(id)).filter(Boolean);
    if (!state.emailNudges || entry.lastWeeklyNudge === key || !unread.length) continue;
    await sendResend(entry.email, unread, process.env.APP_URL || 'http://localhost:5173');
    entry.lastWeeklyNudge = key; sent += 1;
  }
  writeStore(store);
  return { sent, skipped: null };
}

export function startWeeklyScheduler() {
  const runIfSunday = () => { const now = new Date(); if (now.getUTCDay() === 0 && now.getUTCHours() === Number(process.env.NUDGE_HOUR_UTC || 10)) runWeeklyNudges(now).catch(error => console.error('[nudges]', error.message)); };
  runIfSunday();
  return setInterval(runIfSunday, 60 * 60 * 1000);
}
