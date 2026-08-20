# UnboxingAI

UnboxingAI is a learning companion for making AI news and research easier to understand. It groups related coverage into one story, presents trusted sources together, and adapts the explanation to each learner’s chosen level.

Story content is ingested live from [El Bruno’s Weekly AI & Tech News Digest](https://elbruno.github.io/weekly-ai-news-digest/) and top AI research papers from [DAIR.AI’s AI Papers of the Week](https://github.com/dair-ai/AI-Papers-of-the-Week), rewritten for the reader’s level by **Gemini**, and cross-referenced against other outlets by **Tavily**.

## What the prototype includes

- **Google sign-in:** OAuth 2.0 authentication keeps the app behind a simple, familiar sign-in flow.
- **Personalized onboarding:** every newly signed-in learner chooses **Beginner**, **Intermediate**, or **Expert** before entering the product. The choice is remembered locally and can be changed later.
- **Live AI timeline:** every story card is parsed from the weekly digest — headline, outlet, publication date, topic tags, editorial importance, and canonical link. The week’s TL;DR takeaways and per-outlet counts appear above the feed.
- **Top AI research papers:** research papers from the top 2 weeks of DAIR.AI’s weekly index are integrated directly into the timeline and in-depth research views, tagged as `Research`. Card content remains rich and identical for Intermediate and Expert learners, while Beginner learners are not shown research papers.
- **Featured vs. all vs. research:** the timeline opens on a diverse **featured** set, can expand to all stories, or filter specifically by research papers or category chips.
- **Level-adapted cards:** each card’s summary is written by Gemini for the reader’s current level, so the same story reads differently for a beginner and an expert. Cards paint immediately with the digest summary and upgrade in place.
- **Sources as cards:** every source is presented as a card — on the timeline, in the reader, and in research — showing the outlet, domain, date, and a direct link to the original report.
- **Story reader:** **Unbox this story** opens a level-adapted explanation with a short version, a plain-language line, key terms defined for that level, why it matters, and what to watch next. The level can be switched inside the reader.
- **Multi-source grouping:** stories are linked to other coverage of the same event, both from within the digest and — on demand — from other outlets found via Tavily.
- **In-depth research:** search and filter the week by keyword, topic, or outlet, then open any story to see every outlet covering it plus **need-to-know exploration topics**: the background concepts to learn first, each with real explainer links, chosen for the reader’s level.
- **Save for later:** stories can be saved from the timeline, the reader, or research results, and persist per Google account.
- **Learning queue:** saved stories appear in **My learning** with working links — continue reading, jump to sources and topics, or open the original report. Stories that roll off the digest are shown as such rather than becoming dead links.
- **Learning playlist:** saved stories can be independently added to or removed from a personal deep-dive playlist.
- **Learning summary:** the dashboard shows saved stories, playlist size, queued minutes, and recap status at a glance.
- **Learning progress:** opening a story records it as read; learners can mark it complete from the reader or dashboard. These actions update completed-post counts and the daily learning streak.
- **Weekly recap:** the dashboard surfaces up to three saved-but-unread stories with a quick catch-up summary and a direct path to the playlist.
- **Persistent learner state:** saved posts, playlist items, read/completed status, streak activity, and nudge preferences are stored in a server-side durable data store per Google account.
- **Smart nudges:** learners can opt into browser alerts and weekly email recaps. A test email can be sent from My learning once Resend is configured.
- **Weekly reminder controls:** users can enable or disable the weekly Sunday learning-recap concept.
- **Account settings:** learners can review their Google account, change their learning level, see whether Gemini and Tavily are connected, and sign out securely.
- **Responsive design:** the interface adjusts for desktop, tablet, and mobile screens.

### How content flows

1. `GET /api/digest` fetches and parses the news digest and top AI research papers from DAIR.AI into structured stories (cached).
2. `GET /api/decks?level=` asks Gemini for a one-sentence, level-adapted summary for news cards, in batches.
3. `GET /api/stories/:id/explain?level=` produces the full reader explanation for one story or research paper at one level.
4. `GET /api/stories/:id/research?level=` runs Tavily/arXiv for other outlets and papers covering the story, and pairs exploration topics with real explainer links.

Results are cached to `.cache/` and keyed by story and level, so re-reading a story costs nothing. API keys stay server-side; these endpoints require a signed-in session.

### Graceful degradation

Without `GEMINI_API_KEY` the app falls back to the digest’s own summaries; without `TAVILY_API_KEY` it still groups related stories found inside the digest. Both cases are labelled in the UI rather than hidden.

### Current prototype data

Story content and sources are real and live. Learning statistics, the streak, and reminder content remain local demo data, and saved stories, playlists, and learning level are stored in `localStorage`. A production version should move those to a persistent database.

## Tech stack

- React + Vite for the user interface.
- Express for the local authentication server, the content API, and production static hosting.
- Passport with Google OAuth 2.0 for authentication.
- Express sessions for signed-in user sessions.
- Google Gemini for level-adapted explanations; Tavily for multi-source coverage and exploration topics.

## Run locally

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the example file:

```bash
Copy-Item .env.example .env
```

Fill in the values in `.env`:

```env
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
SESSION_SECRET=use-a-long-random-value

# Level-adapted explanations — https://aistudio.google.com/apikey
GEMINI_API_KEY=your-gemini-key
GEMINI_MODEL=gemini-flash-latest,gemini-3.7-flash,gemini-2.5-flash

# Multi-source coverage and exploration topics — https://app.tavily.com
TAVILY_API_KEY=your-tavily-key

# Optional: point the timeline at a different weekly digest
DIGEST_URL=https://elbruno.github.io/weekly-ai-news-digest/
APP_URL=http://localhost:5173

# Optional weekly email nudge via Resend
RESEND_API_KEY=your-resend-key
EMAIL_FROM=UnboxingAI <hello@your-verified-domain.com>
NUDGE_CRON_SECRET=use-a-long-random-value
NUDGE_HOUR_UTC=10
```

`GEMINI_MODEL` is a fallback chain — the first model your account can reach is used.

`.env` is excluded from Git and must never be committed.

### 3. Configure Google Cloud OAuth

In the OAuth client settings in Google Cloud Console, add this **Authorized redirect URI**:

```text
http://localhost:3000/api/auth/google/callback
```

For local development, ensure `http://localhost:5173` is allowed as an Authorized JavaScript Origin if your Google Cloud setup requires it.

### 4. Start the app

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The command starts both services:

- Vite frontend: `http://localhost:5173`
- Express authentication and content server: `http://localhost:3000`

## How to use the app

1. Select **Continue with Google** and complete Google sign-in.
2. Select your learning level on the welcome screen.
3. Explore the weekly AI timeline. Cards start on a diverse **featured** set — switch to **All** or filter by topic to see the full digest.
4. Open **Unbox this story** for a level-adapted explanation, key terms, and its source cards. Switch level inside the reader to see the same story re-explained.
5. Select **Go deeper** on any card to open **In-depth research**, which shows every outlet covering that story plus the concepts worth learning first.
6. Save stories to add them to **My learning**, where each entry links back to the reader, the research view, and the original report.
7. Change the learning level at any time from the level control or sidebar prompt.

The first load of a level fetches summaries for the whole digest, so give it a few seconds; everything after that is cached.

## Weekly email delivery

The app persists learning state in `.data/learning-state.json`. On a single long-running Express deployment, the built-in scheduler checks every hour and delivers Sunday recaps at `NUDGE_HOUR_UTC` to opted-in users who have unread saved posts. Each learner receives at most one recap per week.

For serverless or multi-instance deployment, configure your platform scheduler to send a `POST` request to:

```text
/api/nudges/weekly/run
```

Include this header:

```text
Authorization: Bearer <NUDGE_CRON_SECRET>
```

Use a shared persistent volume or replace the included local store with a managed database before running multiple application instances.

## Available commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start frontend and authentication server for development. |
| `npm run build` | Create an optimized frontend build in `dist/`. |
| `npm start` | Serve the built app and authentication server on port 3000. |

## Notes for deployment

- Replace the local callback URL with your deployed callback URL in both `.env` and Google Cloud Console.
- Set a secure, unique `SESSION_SECRET`.
- Use a persistent session store and database before deploying to multiple instances.
- Never expose or commit OAuth client secrets or the Gemini and Tavily keys. All three are read server-side only and are never sent to the browser.
- `.cache/` is a local disk cache of digest, Gemini, and Tavily responses. It is gitignored and safe to delete; deleting it means the next request pays for regeneration.
- Content endpoints require a signed-in session so a deployed instance cannot be used as an open proxy to your Gemini and Tavily quota.
# UnboxingAI

UnboxingAI is a learning companion for making AI news and research easier to understand. It groups related coverage into one story, presents trusted sources together, and adapts the explanation to each learner’s chosen level.

## What the prototype includes

- **Google sign-in:** OAuth 2.0 authentication keeps the app behind a simple, familiar sign-in flow.
- **Personalized onboarding:** every newly signed-in learner chooses **Beginner**, **Intermediate**, or **Expert** before entering the product. The choice is remembered locally and can be changed later.
- **AI timeline:** a weekly timeline groups important AI developments into concise story cards with categories, reading time, and multiple source labels.
- **Story reader:** selecting **Unbox this story** opens an in-depth reading experience with a short version, a plain-language explanation, and a source trail.
- **Adaptive explanations:** the reader changes its explanation depth based on the learner’s selected level.
- **Save for later:** users can save or unsave stories directly from the timeline and research results.
- **In-depth research library:** a dedicated research page supports live keyword search and topic filters for Models, Research, and Policy.
- **Learning queue:** saved stories appear in **My learning**, with an empty state that guides first-time users.
- **Learning playlist:** saved stories can be independently added to or removed from a personal deep-dive playlist.
- **Learning summary:** the dashboard shows saved-story, playlist, and recap status at a glance, plus a sample learning streak.
- **Weekly reminder controls:** users can enable or disable the weekly Sunday learning-recap concept.
- **Account settings:** learners can review their signed-in Google account, change their learning level, and sign out securely.
- **Responsive design:** the interface adjusts for desktop, tablet, and mobile screens.

### Current prototype data

Stories, source labels, learning statistics, and reminder content are intentionally local demo data. Authentication is real. A production version should connect the content, saved posts, learning level, playlists, and notification preferences to a persistent database and a verified source-ingestion service.

## Tech stack

- React + Vite for the user interface.
- Express for the local authentication server and production static hosting.
- Passport with Google OAuth 2.0 for authentication.
- Express sessions for signed-in user sessions.

## Run locally

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the example file:

```bash
Copy-Item .env.example .env
```

Fill in the values in `.env`:

```env
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
SESSION_SECRET=use-a-long-random-value
```

`.env` is excluded from Git and must never be committed.

### 3. Configure Google Cloud OAuth

In the OAuth client settings in Google Cloud Console, add this **Authorized redirect URI**:

```text
http://localhost:3000/api/auth/google/callback
```

For local development, ensure `http://localhost:5173` is allowed as an Authorized JavaScript Origin if your Google Cloud setup requires it.

### 4. Start the app

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The command starts both services:

- Vite frontend: `http://localhost:5173`
- Express authentication server: `http://localhost:3000`

## How to use the app

1. Select **Continue with Google** and complete Google sign-in.
2. Select your learning level on the welcome screen.
3. Explore the weekly AI timeline and open **Unbox this story** for an explanation and its sources.
4. Save stories to add them to **My learning**.
5. Change the learning level at any time from the level control or sidebar prompt.

## Available commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start frontend and authentication server for development. |
| `npm run build` | Create an optimized frontend build in `dist/`. |
| `npm start` | Serve the built app and authentication server on port 3000. |

## Notes for deployment

- Replace the local callback URL with your deployed callback URL in both `.env` and Google Cloud Console.
- Set a secure, unique `SESSION_SECRET`.
- Use a persistent session store and database before deploying to multiple instances.
- Never expose or commit OAuth client secrets.
