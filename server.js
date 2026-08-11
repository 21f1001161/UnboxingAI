import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const root = path.dirname(fileURLToPath(import.meta.url));
const port = process.env.PORT || 3000;

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
app.get('/api/auth/google/callback', passport.authenticate('google', { failureRedirect: '/?auth=failed' }), (_req, res) => res.redirect('http://localhost:5173'));
app.get('/api/auth/me', (req, res) => res.json({ user: req.user || null }));
app.post('/api/auth/logout', (req, res, next) => req.logout(err => err ? next(err) : req.session.destroy(() => res.status(204).end())));

app.use(express.static(path.join(root, 'dist')));
app.use((_req, res) => res.sendFile(path.join(root, 'dist', 'index.html')));
app.listen(port, () => console.log(`UnboxingAI auth server listening at http://localhost:${port}`));
