// #/dev — component gallery (plan Task 13 Step 5). Every Card Catalog
// component in representative states, with a theme toggle, for eyeballing
// against the handoff screenshots (01/04/06/07) and for quick manual checks
// later. Kept in production deliberately: harmless, and useful whenever a
// component regression is suspected.
import { useState } from 'react';
import type { Pill as PillT } from '../data/types';
import { applyTheme } from '../theme';
import { Chip } from '../components/Chip';
import { Dialog } from '../components/Dialog';
import { OrderBadge } from '../components/OrderBadge';
import { PageTab } from '../components/PageTab';
import { Pill } from '../components/Pill';
import { PillEditor } from '../components/PillEditor';
import { RecipeRow, RowList } from '../components/RecipeRow';
import { SegmentToggle } from '../components/SegmentToggle';
import { Sheet } from '../components/Sheet';
import { SpineChip } from '../components/SpineChip';
import { SpineStripe } from '../components/SpineStripe';
import { StatusTag, type StatusKind } from '../components/StatusTag';
import { Stepper } from '../components/Stepper';
import { WarningNote } from '../components/WarningNote';
import { spineColor } from '../components/spine';

const ALL_TAGS: StatusKind[] = ['made', 'never', 'installed', 'readable', 'index-only'];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 22 }}>
      <div className="section-label" style={{ color: 'var(--ink-soft)', marginBottom: 8 }}>{title}</div>
      {children}
    </section>
  );
}

export function DevGallery() {
  const [dark, setDark] = useState(document.documentElement.dataset.theme === 'dark');
  const [pills, setPills] = useState<PillT[]>([
    { text: 'chicken', neg: false },
    { text: 'fried', neg: true },
    { text: 'garlic', neg: false },
  ]);
  const [count0, setCount0] = useState(0);
  const [count3, setCount3] = useState(3);
  const [segment, setSegment] = useState('List');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [seedMsg, setSeedMsg] = useState('');

  return (
    <main style={{ padding: '18px 16px 40px' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <h1 className="screen-title">Dev gallery</h1>
        <button
          data-testid="theme-toggle"
          onClick={() => {
            const next = !dark;
            setDark(next);
            applyTheme(next ? 'dark' : 'light');
          }}
          style={{
            border: '1.5px solid var(--line)',
            background: 'var(--card)',
            borderRadius: 'var(--r-pill)',
            padding: '8px 14px',
            fontSize: 12.5,
            fontWeight: 600,
            color: 'var(--ink-mid)',
          }}
        >
          {dark ? 'Light' : 'Dark'} theme
        </button>
      </header>

      <Section title="Pill · Chip">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          <Pill label="chicken" neg={false} onCycle={() => {}} onRemove={() => {}} />
          <Pill label="fried" neg onCycle={() => {}} onRemove={() => {}} />
          <Chip label="beef" onAdd={() => {}} />
        </div>
      </Section>

      <Section title="PillEditor">
        <div
          style={{
            border: '1.5px dashed var(--line)',
            background: 'var(--panel)',
            borderRadius: 'var(--r-card)',
            padding: '10px 12px 12px',
          }}
        >
          <PillEditor
            pills={pills}
            chips={['beef', 'pork', 'fish', 'vegetarian']}
            onChange={setPills}
          />
          <div className="hint" style={{ marginTop: 6 }}>
            Tap a pill to flip include ↔ not. Filters match recipe names and tags.
          </div>
        </div>
      </Section>

      <Section title="StatusTag — all kinds">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {ALL_TAGS.map((k) => (
            <StatusTag key={k} kind={k} />
          ))}
          <StatusTag kind="made" label="Made ×2" />
        </div>
      </Section>

      <Section title="Stepper — 0 and 3">
        <div style={{ display: 'flex', gap: 12 }}>
          <Stepper value={count0} onInc={() => setCount0(count0 + 1)} onDec={() => setCount0(count0 - 1)} />
          <Stepper value={count3} onInc={() => setCount3(count3 + 1)} onDec={() => setCount3(count3 - 1)} />
        </div>
      </Section>

      <Section title="WarningNote">
        <WarningNote>
          Only 1 dessert matches <b>chocolate</b> across these books — showing what&rsquo;s available.
        </WarningNote>
      </Section>

      <Section title="SegmentToggle">
        <SegmentToggle options={['List', 'Calendar']} value={segment} onChange={setSegment} />
      </Section>

      <Section title="Spine primitives — 4 palette colors + neutral + striped">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
          {[0, 1, 2, 3].map((i) => (
            <SpineChip key={i} color={spineColor(i)} />
          ))}
          <SpineChip />
          <SpineChip striped />
          {[0, 1, 2, 3].map((i) => (
            <OrderBadge key={i} n={i + 1} color={spineColor(i)} />
          ))}
        </div>
        {/* SpineStripe + PageTab in context: a ruled results-style card. */}
        <div
          className="index-ruling"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--r-card)',
            padding: '14px 14px 12px 20px',
            position: 'relative',
            backgroundPosition: '0 46px',
          }}
        >
          <SpineStripe color={spineColor(0)} />
          <PageTab color={spineColor(0)} page={142} />
          <div style={{ fontWeight: 600, fontSize: 16, paddingRight: 56 }}>Stir-Fried Beef with Oyster Sauce</div>
          <div className="meta" style={{ marginTop: 2 }}>The Woks of Life</div>
        </div>
      </Section>

      <Section title="RecipeRow — made / never / rating">
        <RowList>
          <RecipeRow
            name="White-Cut Chicken with Ginger Sauce"
            page="156"
            meta="The Woks of Life · Mains"
            color={spineColor(0)}
            tag={{ kind: 'made', label: 'Made ×2' }}
            rating={9}
            onClick={() => {}}
          />
          <RecipeRow
            name="Chicken Liver Pâté"
            page="61"
            meta="Moosewood · Sides"
            color={spineColor(1)}
            tag={{ kind: 'never' }}
            dimmed
          />
          <RecipeRow name="Chicken Paprikash" page="203" meta="Moosewood · Mains · tag: hungarian" color={spineColor(1)} rating={8} />
        </RowList>
      </Section>

      <Section title="Sheet · Dialog">
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setSheetOpen(true)}
            style={openerStyle}
          >
            Open sheet
          </button>
          <button
            onClick={() => setDialogOpen(true)}
            style={openerStyle}
          >
            Open dialog
          </button>
        </div>
      </Section>

      {/* Dev-only demo seeding (plan Demo Checkpoint 1). import.meta.env.DEV
          is compile-time false in prod builds, so this block — and with it the
          dynamic import of devSeed.ts and the ATK CSV — is dead-code-eliminated
          from production bundles (verified by grepping dist/ after build). */}
      {import.meta.env.DEV && (
        <Section title="Dev data (DEV builds only)">
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              data-testid="seed-atk"
              onClick={async () => {
                const { seedAtk } = await import('./devSeed');
                setSeedMsg(await seedAtk());
              }}
              style={openerStyle}
            >
              Seed ATK book
            </button>
            <button
              data-testid="seed-demo"
              onClick={async () => {
                const { seedDemoBooks } = await import('./devSeed');
                setSeedMsg(await seedDemoBooks());
              }}
              style={openerStyle}
            >
              Seed 2 demo books
            </button>
          </div>
          {seedMsg && (
            <p className="meta" data-testid="seed-result" style={{ marginTop: 8 }}>
              {seedMsg}
            </p>
          )}
        </Section>
      )}

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} label="Demo sheet">
        <div className="screen-title" style={{ fontSize: 20 }}>Sheet title</div>
        <p className="meta" style={{ margin: '8px 0 16px' }}>
          Radius 22 top, drag handle, dim+blur backdrop. Backdrop tap, Escape and system back all close it.
        </p>
        <RecipeRow name="Soy Sauce Chicken" page="148" meta="The Woks of Life · Mains" color={spineColor(0)} tag={{ kind: 'made' }} rating={7} />
      </Sheet>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} label="Demo dialog">
        <div className="screen-title" style={{ fontSize: 21 }}>Dialog title</div>
        <p className="meta" style={{ margin: '8px 0 14px' }}>
          Centered, radius 18, --shadow-dialog. Backdrop tap, Escape and system back all close it.
        </p>
        <button
          onClick={() => setDialogOpen(false)}
          style={{
            width: '100%',
            minHeight: 44,
            background: 'var(--accent)',
            color: 'var(--on-accent)',
            borderRadius: 'var(--r-cta)',
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          Done
        </button>
      </Dialog>
    </main>
  );
}

const openerStyle = {
  flex: 1,
  minHeight: 44,
  border: '1.5px solid var(--accent)',
  color: 'var(--accent)',
  background: 'var(--accent-tint)',
  borderRadius: 'var(--r-pill)',
  fontSize: 13,
  fontWeight: 700,
} as const;
