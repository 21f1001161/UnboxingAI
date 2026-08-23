import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentRoutes } from './server/api.js';
import { getLearningState, runWeeklyNudges, saveLearningState, startWeeklyScheduler } from './server/learning.js';
import { warmUpCache } from './server/warmup.js';

// Content API includes live digest stories and top AI research papers from DAIR.AI
const app = express();
const root = path.dirname(fileURLToPath(import.meta.url));
const port = process.env.PORT || 3000;

// Render (and most hosts) terminate HTTPS before forwarding requests to this
// Node process. Trust that proxy so express-session can issue its secure cookie.
app.set('trust proxy', 1);

app.use(express.json());

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_CALLBACK_URL) {
  console.warn('Google OAuth is not configured. Add the required values to .env.');
}

app.use(session({
  secret: process.env.SESSION_SECRET || 'replace-this-development-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { sameSite: 'lax', httpOnly: true, secure: process.env.NODE_ENV === 'production' },
}));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL,
}, (_accessToken, _refreshToken, profile, done) => done(null, {
  id: profile.id,
  name: profile.displayName,
  email: profile.emails?.[0]?.value,
  photo: profile.photos?.[0]?.value,
})));

app.get('/api/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
const appUrl = () => (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');
app.get('/api/auth/google/callback', passport.authenticate('google', { failureRedirect: '/?auth=failed' }), (_req, res) => res.redirect(appUrl()));
app.get('/api/auth/me', (req, res) => res.json({ user: req.user || null }));
app.post('/api/auth/logout', (req, res, next) => req.logout(err => err ? next(err) : req.session.destroy(() => res.status(204).end())));

const requireAuth = (req, res, next) => req.user ? next() : res.status(401).json({ error: 'Sign in first.' });
app.get('/api/learning-state', requireAuth, (req, res) => res.json({ state: getLearningState(req.user.id) }));
app.put('/api/learning-state', requireAuth, (req, res) => res.json({ state: saveLearningState(req.user, req.body) }));

// Sends a real test nudge when a Resend key is configured. Keeping this route
// separate from scheduling lets the UI be used locally without an email account.
app.post('/api/nudges/test', async (req, res) => {
  if (!req.user?.email) return res.status(401).json({ message: 'Please sign in before sending a nudge.' });
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    return res.status(501).json({ message: 'Add RESEND_API_KEY and EMAIL_FROM to enable email nudges.' });
  }

  const titles = Array.isArray(req.body?.stories) ? req.body.stories.slice(0, 3).map(String) : [];
  const summary = titles.length ? `<ul>${titles.map(title => `<li>${title.replace(/[<>&]/g, '')}</li>`).join('')}</ul>` : '<p>Your learning queue is ready for a new story.</p>';
  const playlistUrl = `${appUrl()}/?view=dashboard#learning-playlist`;
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [req.user.email],
        subject: 'Your UnboxingAI learning recap',
        html: `<h1>Three stories are waiting for you</h1><p>Pick up where your curiosity left off.</p>${summary}<p><a href="${playlistUrl}">Open your learning playlist</a></p>`,
      }),
    });
    if (!response.ok) throw new Error('Email provider rejected the request.');
    res.json({ message: `Test recap sent to ${req.user.email}.` });
  } catch (error) {
    res.status(502).json({ message: error.message || 'Could not send the email nudge.' });
  }
});

// Call this from a platform cron job every Sunday. It is intentionally protected
// so a public visitor cannot trigger email delivery for every learner.
app.post('/api/nudges/weekly/run', async (req, res) => {
  if (!process.env.NUDGE_CRON_SECRET || req.get('authorization') !== `Bearer ${process.env.NUDGE_CRON_SECRET}`) return res.status(401).json({ error: 'Unauthorized.' });
  try { res.json(await runWeeklyNudges()); } catch (error) { res.status(502).json({ error: error.message }); }
});

app.use('/api', contentRoutes());

if (!process.env.GEMINI_API_KEY) console.warn('GEMINI_API_KEY is not set. Stories will fall back to the digest summaries.');
if (!process.env.TAVILY_API_KEY) console.warn('TAVILY_API_KEY is not set. Research will show digest sources only.');

app.use(express.static(path.join(root, 'dist')));
app.use((_req, res) => res.sendFile(path.join(root, 'dist', 'index.html')));
app.listen(port, () => {
  console.log(`UnboxingAI auth server listening at http://localhost:${port}`);
  // Preload and cache all story decks, explanations, and research across all reader levels
  setTimeout(() => {
    warmUpCache({ onProgress: msg => console.log(`[cache-warmup] ${msg}`) }).catch(err => {
      console.warn('[cache-warmup] Warmup encountered an issue:', err.message);
    });
  }, 1000);
});
startWeeklyScheduler();
