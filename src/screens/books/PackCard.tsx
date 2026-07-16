// Library book card (round-2 amendment 8): tapping ANY pack row — installed or
// not — opens this read-only card built from catalog metadata. Visually the
// same index-card face as the installed-book detail: neutral spine, title,
// author/year/cuisines, type badge, recipe count, the smart info link, and an
// Install (uninstalled) or "Open on shelf" (installed) action. A lightweight
// Sheet rather than a BookDetail reuse, because uninstalled packs have no
// Cookbook row in the store yet.
import { store, useStore } from '../../data/store';
import type { CatalogPack } from '../../data/packs';
import { Sheet } from '../../components/Sheet';
import { SpineStripe } from '../../components/SpineStripe';
import { StatusTag } from '../../components/StatusTag';
import { BookMetaLine, InfoLink } from './BookMeta';

// A CatalogPack shares author/year/cuisines/name with Cookbook, but its info
// link is derived the same way installPack would (linked → archive.org scan;
// index-only → undefined → "Find this book" search). Build a Cookbook-shaped
// view so BookMeta/InfoLink treat it identically to an installed book.
const infoUrlFor = (pack: CatalogPack): string | undefined =>
  pack.type === 'linked' ? `https://archive.org/details/${pack.id}` : undefined;

export function PackCard({
  pack,
  installing,
  onInstall,
  onClose,
}: {
  pack: CatalogPack;
  installing: boolean;
  onInstall: () => void;
  onClose: () => void;
}) {
  useStore((s) => s.version);
  const installedBook = store.books.find((b) => b.packId === pack.id);
  const linkView = { name: pack.title, author: pack.author, infoUrl: infoUrlFor(pack) };

  return (
    <Sheet open onClose={onClose} label={pack.title}>
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--r-card)',
          padding: '16px 16px 16px 22px',
          position: 'relative',
        }}
      >
        <SpineStripe color="var(--neutral-spine)" />

        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, letterSpacing: '-.01em' }}>
          {pack.title}
        </div>
        <div style={{ marginTop: 4 }}>
          <BookMetaLine book={{ author: pack.author, year: pack.year, cuisines: pack.cuisines }} />
        </div>

        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {installedBook && <StatusTag kind="installed" />}
          <StatusTag kind={pack.type === 'linked' ? 'readable' : 'index-only'} />
          <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
            {pack.recipeCount.toLocaleString('en-US')} recipes
          </span>
        </div>

        <div style={{ marginTop: 14 }}>
          <InfoLink book={linkView} />
        </div>
      </div>

      {/* Footer action: open the installed book, or install it. */}
      <div style={{ marginTop: 12 }}>
        {installedBook ? (
          <button
            onClick={() => {
              onClose();
              window.location.hash = `#/books/${installedBook.id}`;
            }}
            style={{
              width: '100%',
              minHeight: 50,
              border: '1.5px solid var(--accent)',
              background: 'none',
              color: 'var(--accent)',
              borderRadius: 'var(--r-cta)',
              fontSize: 15,
              fontWeight: 700,
            }}
          >
            Open on shelf →
          </button>
        ) : (
          <button
            onClick={onInstall}
            disabled={installing}
            style={{
              width: '100%',
              minHeight: 50,
              background: 'var(--accent)',
              color: 'var(--on-accent)',
              borderRadius: 'var(--r-cta)',
              fontSize: 15,
              fontWeight: 700,
              opacity: installing ? 0.6 : 1,
            }}
          >
            {installing ? 'Installing…' : `Install · ${pack.recipeCount.toLocaleString('en-US')} recipes`}
          </button>
        )}
      </div>
      <div style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 10 }}>
        {pack.type === 'linked'
          ? 'Linked pack — opens at the exact page on archive.org, free to cook from.'
          : 'Index only — names and pages; you cook from the physical book.'}
      </div>
    </Sheet>
  );
}
