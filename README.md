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
