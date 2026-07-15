// Library section of the Books tab (plan Task 25 Step 4; canvas 2f/3g,
// screenshot 08): catalog search + filter chips, pack rows with install
// state. Uninstalled packs render grayed (striped neutral spine, soft-ink
// title, muted badges) with a 44px Install outline button; installed packs
// get a colored spine + green Installed tag.
import { useMemo, useState } from 'react';
import { store, useStore } from '../../data/store';
import type { Cookbook, Recipe } from '../../data/types';
import { installPack, type CatalogPack } from '../../data/packs';
import { SpineChip } from '../../components/SpineChip';
import { StatusTag } from '../../components/StatusTag';
import { useToast } from '../../components/Toast';

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

const cap = (s: string): string => (s === '' ? s : s[0].toUpperCase() + s.slice(1));

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
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState<'linked' | 'index-only' | null>(null);
  const [era, setEra] = useState<string | null>(null);
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [installing, setInstalling] = useState<string | null>(null);

  const eras = useMemo(() => [...new Set(packs.map((p) => p.era).filter((e): e is string => !!e))], [packs]);
  const cuisines = useMemo(() => [...new Set(packs.flatMap((p) => p.cuisines))], [packs]);

  const needle = q.trim().toLowerCase();
  const shown = packs.filter(
    (p) =>
      (needle === '' || `${p.title} ${p.author ?? ''}`.toLowerCase().includes(needle)) &&
      (typeFilter === null || p.type === typeFilter) &&
      (era === null || p.era === era) &&
      (cuisine === null || p.cuisines.includes(cuisine)),
  );

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

  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="⌕ Search the catalog…"
        aria-label="Search the catalog"
        style={{
          width: '100%',
          background: 'var(--card)',
          border: '1.5px solid var(--line)',
          borderRadius: 'var(--r-card)',
          padding: '10px 12px',
          fontSize: 14,
          marginBottom: 8,
        }}
      />

      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 14 }}>
        <FilterChip
          label="Readable online"
          on={typeFilter === 'linked'}
          onClick={() => setTypeFilter(typeFilter === 'linked' ? null : 'linked')}
        />
        <FilterChip
          label="Index only"
          on={typeFilter === 'index-only'}
          onClick={() => setTypeFilter(typeFilter === 'index-only' ? null : 'index-only')}
        />
        <ValueChip name="Era" values={eras} value={era} onChange={setEra} />
        <ValueChip name="Cuisine" values={cuisines.map(cap)} value={cuisine ? cap(cuisine) : null} onChange={(v) => setCuisine(v ? v.toLowerCase() : null)} />
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

      {shown.map((pack) => (
        <PackRow key={pack.id} pack={pack} installing={installing === pack.id} onInstall={() => void install(pack)} />
      ))}

      <div className="hint" style={{ marginTop: 10, textAlign: 'center' }}>
        Linked packs open at the exact page on archive.org — free to cook from.
      </div>
    </div>
  );
}

function PackRow({ pack, installing, onInstall }: { pack: CatalogPack; installing: boolean; onInstall: () => void }) {
  const installed = store.books.some((b) => b.packId === pack.id);
  return (
    <div
      style={{
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
        <span style={{ display: 'block', fontSize: 12, color: installed ? 'var(--ink-soft)' : 'var(--ink-disabled)' }}>
          {[pack.author, pack.year, pack.cuisines.map(cap).join(', ')].filter(Boolean).join(' · ')}
        </span>
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
      {!installed && (
        <button
          onClick={onInstall}
          disabled={installing}
          style={{
            flex: 'none',
            border: '1.5px solid var(--accent)',
            background: 'none',
            color: 'var(--accent)',
            borderRadius: 'var(--r-pill)',
            padding: '0 16px',
            minHeight: 44,
            fontSize: 13,
            fontWeight: 700,
            opacity: installing ? 0.6 : 1,
          }}
        >
          {installing ? 'Installing…' : 'Install'}
        </button>
      )}
    </div>
  );
}

function FilterChip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
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

/**
 * Era / Cuisine chip. With >1 distinct value it acts as a cycling dropdown
 * ("Era ▾" → "Era: modern ✓" → next value → … → off) — a full popup menu is
 * more chrome than a one-pack catalog justifies, and the cycle degrades
 * gracefully as the catalog grows. With exactly one value it renders as a
 * plain static toggle chip (per plan: "dropdowns only if >1 value present").
 * Hidden entirely when no pack declares the field.
 */
function ValueChip({
  name,
  values,
  value,
  onChange,
}: {
  name: string;
  values: string[];
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  if (values.length === 0) return null;
  if (values.length === 1) {
    return <FilterChip label={values[0]} on={value === values[0]} onClick={() => onChange(value === null ? values[0] : null)} />;
  }
  const next = () => {
    const i = value === null ? -1 : values.indexOf(value);
    onChange(i + 1 >= values.length ? null : values[i + 1]);
  };
  return <FilterChip label={value === null ? `${name} ▾` : `${name}: ${value} ✓`} on={value !== null} onClick={next} />;
}
