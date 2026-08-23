import React from 'react';

export const LEVELS = ['Beginner', 'Intermediate', 'Expert'];

export function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

const SOURCE_BRANDS = [
  { match: /arxiv/i, label: 'arXiv', tone: 'arxiv' },
  { match: /dair\.ai|dair ai/i, label: 'DAIR', tone: 'dair' },
  { match: /github/i, label: 'GH', tone: 'github' },
  { match: /microsoft/i, label: 'MS', tone: 'microsoft' },
  { match: /anthropic/i, label: 'AI', tone: 'anthropic' },
  { match: /google/i, label: 'G', tone: 'google' },
  { match: /openai/i, label: 'OA', tone: 'openai' },
  { match: /techcrunch/i, label: 'TC', tone: 'techcrunch' },
  { match: /the verge/i, label: 'V', tone: 'verge' },
  { match: /hugging ?face/i, label: 'HF', tone: 'huggingface' },
];

/** Code-native source marks that remain crisp without loading third-party logos. */
export function SourceBadge({ name = '', domain = '', emoji, className = '' }) {
  const brand = SOURCE_BRANDS.find(entry => entry.match.test(`${name} ${domain}`));
  const initials = (name || domain || '?').replace(/[^A-Za-z0-9 ]/g, '').split(' ').filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase();
  return <span className={`source-badge ${brand?.tone || 'generic'} ${className}`} title={name || domain} aria-label={name || domain}>{brand?.label || emoji || initials || '•'}</span>;
}

const IMPORTANCE_DOT = { High: '●', Medium: '◐', Low: '○' };

export const importanceClass = importance => `importance ${String(importance).toLowerCase()}`;

export function ImportanceBadge({ importance }) {
  return <span className={importanceClass(importance)} title={`${importance} importance`}>
    <i>{IMPORTANCE_DOT[importance] || '○'}</i>{importance}
  </span>;
}

export function TagChips({ tags = [], max = 4, onPick }) {
  if (!tags.length) return null;
  return <div className="tag-chips">
    {tags.slice(0, max).map(tag => (
      onPick
        ? <button key={tag} className="tag-chip" onClick={() => onPick(tag)}>{tag}</button>
        : <span key={tag} className="tag-chip">{tag}</span>
    ))}
    {tags.length > max && <span className="tag-chip muted">+{tags.length - max}</span>}
  </div>;
}

/**
 * Every source in this app is shown as a card, whether it came from the digest,
 * from Tavily, or from another story in the same week.
 */
export function SourceCard({ source, kicker, onOpenStory }) {
  const { publisher, source: name, domain, url, snippet, tldr, published, primary, sourceEmoji, angle, title } = source;
  const label = publisher || name || domain;
  const body = snippet || tldr;
  const initials = (label || '?').replace(/[^A-Za-z0-9 ]/g, '').split(' ').filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase();

  return <article className={`source-card${primary ? ' is-primary' : ''}`}>
    <header>
      <SourceBadge name={label} domain={domain} emoji={sourceEmoji} className="visual-source-mark" />
      <span className="source-avatar">{sourceEmoji || initials || '◆'}</span>
      <div>
        <strong>{label}</strong>
        <small>{kicker || angle || (primary ? 'Original report' : domain)}</small>
      </div>
      {published && <time>{published.slice(0, 10)}</time>}
    </header>
    {title && title !== label && <p className="source-headline">{title}</p>}
    {body && <p className="source-snippet">{body}</p>}
    <footer>
      {url && <a href={url} target="_blank" rel="noopener noreferrer">Read at {domain || label} ↗</a>}
      {onOpenStory && <button onClick={onOpenStory}>Unbox in app →</button>}
    </footer>
  </article>;
}

export function Skeleton({ lines = 3, className = '' }) {
  return <div className={`skeleton ${className}`} aria-hidden="true">
    {Array.from({ length: lines }, (_, index) => <span key={index} style={{ width: `${92 - index * 13}%` }} />)}
  </div>;
}

export function LevelSwitch({ level, onChange, compact = false }) {
  return <div className={`level-switch${compact ? ' compact' : ''}`} role="group" aria-label="Explanation level">
    {LEVELS.map(option => (
      <button
        key={option}
        onClick={() => onChange(option)}
        className={option === level ? 'on' : ''}
        aria-pressed={option === level}
      >{compact ? option.slice(0, 3) : option}</button>
    ))}
  </div>;
}

export function Notice({ tone = 'info', children }) {
  return <p className={`notice ${tone}`}>{children}</p>;
}

export function ErrorState({ error, onRetry }) {
  return <div className="error-state">
    <span>⚠</span>
    <div>
      <strong>We could not load the digest.</strong>
      <p>{error}</p>
    </div>
    {onRetry && <button onClick={onRetry}>Try again</button>}
  </div>;
}
