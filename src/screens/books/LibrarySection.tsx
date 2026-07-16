// Library section of the Books tab (plan Task 25 Step 4; canvas 2f/3g,
// screenshot 08): the shared Books filter bar (search + dynamic cuisine + year
// range), a pair of type chips (Readable online / Index only), and pack rows
// with install state. Uninstalled packs render grayed (striped neutral spine,
// soft-ink title, muted badges); installed packs get a colored spine + green
// Installed tag. Tapping ANY row — installed or not — opens its book card
// (PackCard, round-2 amendment 8).
import { useMemo, useState } from 'react';
import { store, useStore } from '../../data/store';
import type { Cookbook, Recipe } from '../../data/types';
import { installPack, type CatalogPack } from '../../data/packs';
import { SpineChip } from '../../components/SpineChip';
import { StatusTag } from '../../components/StatusTag';
import { useToast } from '../../components/Toast';
import { BookFilterBar, applyBookFilters, emptyBookFilter, type BookFilterState, type FilterableItem } from './BookFilters';
import { BookMetaLine } from './BookMeta';
import { PackCard } from './PackCard';

// Ref 08 shows each INSTALLED pack keeping a spine color even though shelf
// books stay neutral outside a generate session. A stable hash of the pack id
// picks the palette slot, so the color survives reloads and reinstalls
// without persisting anything — and two catalogs render identically on every
// device. (Collisions across 8 slots are fine; colors are decoration here,
// not identity.)
function packColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return `var(--spine-${(h % 8) + 1})`;
}

const toItem = (p: CatalogPack): FilterableItem => ({
  id: p.id,
  title: p.title,
  author: p.author,
  year: p.year,
  cuisines: p.cuisines,
});

export function LibrarySection({
  packs,
  offline,
  onInstalled,
}: {
  packs: CatalogPack[];
  offline: boolean;
  /** Re-association hook runs at the call site (BooksTab) — see reassociate.tsx. */
  onInstalled: (book: Cookbook, recipes: Recipe[]) => void;
}) {
  useStore((s) => s.version);
  const showToast = useToast();
  const [filter, setFilter] = useState<BookFilterState>(emptyBookFilter);
  const [typeFilter, setTypeFilter] = useState<'linked' | 'index-only' | null>(null);
  const [installing, setInstalling] = useState<string | null>(null);
  const [cardId, setCardId] = useState<string | null>(null);

  const items = useMemo(() => packs.map(toItem), [packs]);
  const byId = useMemo(() => new Map(packs.map((p) => [p.id, p])), [packs]);

  const shownIds = new Set(applyBookFilters(items, filter).map((i) => i.id));
  const shown = packs.filter((p) => shownIds.has(p.id) && (typeFilter === null || p.type === typeFilter));

  const install = async (pack: CatalogPack) => {
    setInstalling(pack.id);
    try {
      const { book, recipes } = await installPack(pack.id);
      showToast(`${pack.title} installed — ${recipes.length.toLocaleString('en-US')} recipes`);
      onInstalled(book, recipes);
    } catch {
      showToast('Install failed — are you offline?');
    } finally {
      setInstalling(null);
    }
  };

  const cardPack = cardId ? byId.get(cardId) : undefined;

  return (
    <div>
      <BookFilterBar items={items} filter={filter} onChange={setFilter} />

      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 14 }}>
        <TypeChip
          label="Readable online"
          on={typeFilter === 'linked'}
          onClick={() => setTypeFilter(typeFilter === 'linked' ? null : 'linked')}
        />
        <TypeChip
          label="Index only"
          on={typeFilter === 'index-only'}
          onClick={() => setTypeFilter(typeFilter === 'index-only' ? null : 'index-only')}
        />
      </div>

      {offline && (
        <p className="meta" style={{ marginBottom: 10 }}>
          Couldn’t load the pack catalog — you may be offline. Installed packs keep working; try again once
          you’re connected.
        </p>
      )}
      {!offline && shown.length === 0 && (
        <p className="meta" style={{ marginBottom: 10 }}>No packs match — clear a filter or two.</p>
      )}

      <div data-testid="library-list">
        {shown.map((pack) => (
          <PackRow key={pack.id} pack={pack} onOpen={() => setCardId(pack.id)} />
        ))}
      </div>

      <div className="hint" style={{ marginTop: 10, textAlign: 'center' }}>
        Linked packs open at the exact page on archive.org — free to cook from.
      </div>

      {cardPack && (
        <PackCard
          pack={cardPack}
          installing={installing === cardPack.id}
          onInstall={() => void install(cardPack)}
          onClose={() => setCardId(null)}
        />
      )}
    </div>
  );
}

function PackRow({ pack, onOpen }: { pack: CatalogPack; onOpen: () => void }) {
  const installed = store.books.some((b) => b.packId === pack.id);
  return (
    <button
      onClick={onOpen}
      style={{
        width: '100%',
        textAlign: 'left',
        background: 'var(--card)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-card)',
        padding: '13px 14px',
        marginBottom: 9,
        display: 'flex',
        gap: 12,
        alignItems: 'center',
      }}
    >
      {installed ? (
        <SpineChip width={16} height={56} color={packColor(pack.id)} />
      ) : (
        <SpineChip width={16} height={56} striped />
      )}
      <span style={{ flex: 1, minWidth: 0 }}>
        <b style={{ fontWeight: 600, color: installed ? 'var(--ink)' : 'var(--ink-soft)' }}>{pack.title}</b>
        <BookMetaLine book={{ author: pack.author, year: pack.year, cuisines: pack.cuisines }} soft={!installed} />
        {/* Uninstalled rows mute their badges (canvas 2f draws them in lighter
            text); an opacity wash approximates that without new tokens. */}
        <span style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap', alignItems: 'center', opacity: installed ? 1 : 0.7 }}>
          {installed && <StatusTag kind="installed" />}
          <StatusTag kind={pack.type === 'linked' ? 'readable' : 'index-only'} />
          <span style={{ fontSize: 11, color: installed ? 'var(--ink-soft)' : 'var(--ink-disabled)' }}>
            {pack.recipeCount.toLocaleString('en-US')} recipes
          </span>
        </span>
      </span>
      <span style={{ color: 'var(--ink-disabled)' }}>›</span>
    </button>
  );
}

function TypeChip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      style={{
        border: `1.5px solid ${on ? 'var(--accent)' : 'var(--line)'}`,
        background: on ? 'var(--accent-tint)' : 'var(--card)',
        borderRadius: 'var(--r-pill)',
        padding: '7px 13px',
        fontSize: 12.5,
        fontWeight: on ? 700 : 600,
        color: on ? 'var(--accent)' : 'var(--ink-soft)',
      }}
    >
      {label}
    </button>
  );
}
