import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const DigestContext = createContext(null);

// Explanations and research are expensive to produce and never change for a
// given story+level, so results are held for the life of the tab. `inFlight`
// dedupes concurrent requests; `resolved` lets a revisit render without a flash.
const inFlight = new Map();
const resolved = new Map();

async function getJson(url) {
  const response = await fetch(url);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}

function loadRemote(url) {
  if (resolved.has(url)) return Promise.resolve(resolved.get(url));
  if (!inFlight.has(url)) {
    inFlight.set(url, getJson(url)
      .then(data => { resolved.set(url, data); return data; })
      .finally(() => inFlight.delete(url)));
  }
  return inFlight.get(url);
}

function clearRemoteCache() {
  inFlight.clear();
  resolved.clear();
}

const stateFor = url => (resolved.has(url)
  ? { status: 'ready', data: resolved.get(url), error: null }
  : { status: 'loading', data: null, error: null });

/** Shared fetch-once-per-url hook with loading/error states. */
export function useRemote(url) {
  const [state, setState] = useState(() => (url ? stateFor(url) : { status: 'idle', data: null, error: null }));

  useEffect(() => {
    if (!url) return setState({ status: 'idle', data: null, error: null });
    let active = true;
    // Never carry the previous url's payload into the new url's render.
    setState(stateFor(url));
    loadRemote(url).then(
      data => active && setState({ status: 'ready', data, error: null }),
      error => active && setState({ status: 'error', data: null, error: error.message }),
    );
    return () => { active = false; };
  }, [url]);

  return state;
}

const storyPath = (id, suffix, level) => `/api/stories/${encodeURIComponent(id)}/${suffix}?level=${encodeURIComponent(level)}`;

export const useExplanation = (story, level) => useRemote(story ? storyPath(story.id, 'explain', level) : null);
export const useResearch = (story, level) => useRemote(story ? storyPath(story.id, 'research', level) : null);

export function DigestProvider({ level, children }) {
  const [digest, setDigest] = useState({ status: 'loading', data: null, error: null });
  const [decks, setDecks] = useState({ level: null, map: {}, loading: false });

  const load = useCallback((refresh = false) => {
    setDigest({ status: 'loading', data: null, error: null });
    if (refresh) clearRemoteCache();
    getJson(`/api/digest${refresh ? '?refresh=1' : ''}`).then(
      data => setDigest({ status: 'ready', data, error: null }),
      error => setDigest({ status: 'error', data: null, error: error.message }),
    );
  }, []);

  useEffect(() => { load(); }, [load]);

  // Decks arrive after the timeline has already painted, so cards upgrade from
  // the digest's own summary to a level-adapted one without blocking render.
  useEffect(() => {
    if (digest.status !== 'ready' || !level) return;
    let active = true;
    setDecks(current => ({ ...current, loading: true }));
    loadRemote(`/api/decks?level=${encodeURIComponent(level)}`).then(
      payload => active && setDecks({ level, map: payload.decks || {}, loading: false }),
      () => active && setDecks({ level, map: {}, loading: false }),
    );
    return () => { active = false; };
  }, [digest.status, level]);

  const value = useMemo(() => {
    const raw = digest.data?.stories || [];
    const adapted = decks.level === level ? decks.map : {};
    return {
      status: digest.status,
      error: digest.error,
      reload: load,
      meta: digest.data,
      capabilities: digest.data?.capabilities || { gemini: false, tavily: false },
      decksLoading: decks.loading || decks.level !== level,
      stories: raw.map(story => ({ ...story, deck: adapted[story.id] || story.tldr, deckAdapted: Boolean(adapted[story.id]) })),
    };
  }, [digest, decks, level, load]);

  return <DigestContext.Provider value={value}>{children}</DigestContext.Provider>;
}

export function useDigest() {
  const value = useContext(DigestContext);
  if (!value) throw new Error('useDigest must be used inside <DigestProvider>');
  return value;
}

/** Keeps a story reference fresh as decks load in behind it. */
export function useLiveStory(story) {
  const { stories } = useDigest();
  return useMemo(() => (story ? stories.find(candidate => candidate.id === story.id) || story : null), [stories, story]);
}
