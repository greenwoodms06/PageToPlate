// Shared book-metadata display (round-2 amendments 7/8): the author · year ·
// cuisines meta line and the smart "buy / more info" external link, reused by
// the installed-book card (BookDetail), the Library PackCard, and rows. Keeps
// the metadata presentation identical everywhere it appears.
import type { Cookbook } from '../../data/types';
import { bookInfoLink } from '../../logic/bookLink';

const cap = (s: string): string => (s === '' ? s : s[0].toUpperCase() + s.slice(1));

/** "America's Test Kitchen · 2025 · American" — omits whatever is absent. */
export function bookMetaBits(book: Pick<Cookbook, 'author' | 'year' | 'cuisines'>): string {
  return [book.author, book.year, (book.cuisines ?? []).map(cap).join(', ')]
    .filter((x) => x !== undefined && x !== null && x !== '')
    .join(' · ');
}

export function BookMetaLine({
  book,
  soft = false,
}: {
  book: Pick<Cookbook, 'author' | 'year' | 'cuisines'>;
  soft?: boolean;
}) {
  const text = bookMetaBits(book);
  if (!text) return null;
  return (
    <div style={{ fontSize: 12.5, color: soft ? 'var(--ink-disabled)' : 'var(--ink-soft)' }}>{text}</div>
  );
}

/**
 * External info link. Renders as a real anchor (target _blank, rel noopener) so
 * it opens the archive.org scan / book search in a new tab. Label + url come
 * from bookLink.ts and depend on the book type.
 */
export function InfoLink({ book }: { book: Pick<Cookbook, 'name' | 'author' | 'infoUrl'> }) {
  const link = bookInfoLink(book);
  if (!link) return null;
  const archive = link.url.includes('archive.org');
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        border: `1.5px solid ${archive ? 'var(--accent)' : 'var(--line)'}`,
        background: archive ? 'var(--accent-tint)' : 'var(--card)',
        color: archive ? 'var(--accent)' : 'var(--ink-mid)',
        borderRadius: 'var(--r-pill)',
        padding: '8px 14px',
        fontSize: 12.5,
        fontWeight: 700,
        textDecoration: 'none',
      }}
    >
      {link.label} ↗
    </a>
  );
}
