import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { store } from './store';
import { clearAll } from './db';
import { backfillPatches, catalogMetadata, installPack, type CatalogPack } from './packs';
import type { Cookbook } from './types';

const LINKED: CatalogPack = {
  id: 'chinesecookbook00chan',
  title: 'The Chinese Cook Book',
  author: 'Chan, Shiu Wong',
  year: 1917,
  country: 'US',
  cuisines: ['chinese'],
  era: 'historical',
  type: 'linked',
  recipeCount: 1,
  file: 'packs/chinesecookbook00chan.json',
  version: 1,
};
const INDEX_ONLY: CatalogPack = {
  id: 'atk-complete',
  title: "America's Test Kitchen",
  author: 'America’s Test Kitchen',
  year: 2025,
  country: 'US',
  cuisines: ['american'],
  era: 'modern',
  type: 'index-only',
  recipeCount: 1,
  file: 'packs/atk-complete.json',
  version: 1,
};
const NO_CUISINE: CatalogPack = { ...LINKED, id: 'plain', cuisines: [], file: 'packs/plain.json' };

const book = (over: Partial<Cookbook>): Cookbook => ({
  id: 'b',
  name: 'A book',
  tags: [],
  archived: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

// ── catalogMetadata (pure) ────────────────────────────────────────────────

describe('catalogMetadata', () => {
  it('sets the archive.org infoUrl for linked packs', () => {
    expect(catalogMetadata(LINKED)).toEqual({
      author: 'Chan, Shiu Wong',
      year: 1917,
      cuisines: ['chinese'],
      infoUrl: 'https://archive.org/details/chinesecookbook00chan',
    });
  });

  it('leaves infoUrl undefined for index-only packs', () => {
    const meta = catalogMetadata(INDEX_ONLY);
    expect(meta.infoUrl).toBeUndefined();
    expect(meta.cuisines).toEqual(['american']);
  });
});

// ── backfillPatches (pure) ────────────────────────────────────────────────

describe('backfillPatches', () => {
  it('fills missing fields on an already-installed pack book from the catalog', () => {
    // Simulates the user's ATK installed before this metadata existed.
    const installed = book({ id: 'atk', name: 'ATK', packId: 'atk-complete', packVersion: 1 });
    const patches = backfillPatches([installed], [INDEX_ONLY]);
    expect(patches).toEqual([
      { id: 'atk', patch: { author: 'America’s Test Kitchen', year: 2025, cuisines: ['american'] } },
    ]);
    // index-only ⇒ no infoUrl backfilled
    expect(patches[0].patch.infoUrl).toBeUndefined();
  });

  it('backfills the archive.org infoUrl for a linked pack book', () => {
    const installed = book({ id: 'chin', packId: 'chinesecookbook00chan' });
    const [{ patch }] = backfillPatches([installed], [LINKED]);
    expect(patch.infoUrl).toBe('https://archive.org/details/chinesecookbook00chan');
  });

  it('leaves a user (non-pack) book untouched', () => {
    expect(backfillPatches([book({ id: 'u' })], [LINKED, INDEX_ONLY])).toEqual([]);
  });

  it('does not overwrite fields the book already has', () => {
    const installed = book({
      id: 'atk',
      packId: 'atk-complete',
      author: 'Custom Author',
      year: 2025,
      cuisines: ['american'],
    });
    expect(backfillPatches([installed], [INDEX_ONLY])).toEqual([]);
  });

  it('stores an empty cuisines array (present) for a pack with no cuisines', () => {
    const installed = book({ id: 'p', packId: 'plain' });
    const [{ patch }] = backfillPatches([installed], [NO_CUISINE]);
    expect(patch.cuisines).toEqual([]);
  });

  it('tolerates an absent/offline catalog (no packs ⇒ no patches, no crash)', () => {
    expect(backfillPatches([book({ id: 'atk', packId: 'atk-complete' })], [])).toEqual([]);
  });

  it('ignores a pack book whose pack is no longer in the catalog', () => {
    expect(backfillPatches([book({ id: 'gone', packId: 'removed-pack' })], [LINKED])).toEqual([]);
  });
});

// ── installPack populates metadata (fetch-mocked integration) ──────────────

describe('installPack metadata', () => {
  beforeEach(async () => {
    await clearAll();
    await store.init();
    const catalog = { packs: [LINKED, INDEX_ONLY] };
    const packFiles: Record<string, unknown> = {
      'chinesecookbook00chan': {
        id: 'chinesecookbook00chan',
        version: 1,
        book: { name: 'The Chinese Cook Book', tags: ['chinese'] },
        recipes: [
          {
            name: 'Primary Soup',
            page: '8',
            category: 'Soups & Stews',
            tags: [],
            link: { url: 'https://archive.org/details/chinesecookbook00chan/page/n33', pageStatus: 'verified' },
          },
        ],
      },
      'atk-complete': {
        id: 'atk-complete',
        version: 1,
        book: { name: "America's Test Kitchen", tags: [] },
        recipes: [{ name: 'Roast Chicken', page: '10', category: 'Mains', tags: [] }],
      },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: unknown) => {
        const u = String(url);
        if (u.includes('catalog.json')) return new Response(JSON.stringify(catalog));
        const id = Object.keys(packFiles).find((k) => u.includes(k));
        if (id) return new Response(JSON.stringify(packFiles[id]));
        return new Response('not found', { status: 404 });
      }),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('populates author/year/cuisines and the archive.org infoUrl for a linked pack', async () => {
    const { book: created } = await installPack('chinesecookbook00chan');
    expect(created.author).toBe('Chan, Shiu Wong');
    expect(created.year).toBe(1917);
    expect(created.cuisines).toEqual(['chinese']);
    expect(created.infoUrl).toBe('https://archive.org/details/chinesecookbook00chan');
  });

  it('populates metadata but no infoUrl for an index-only pack', async () => {
    const { book: created } = await installPack('atk-complete');
    expect(created.author).toBe('America’s Test Kitchen');
    expect(created.year).toBe(2025);
    expect(created.cuisines).toEqual(['american']);
    expect(created.infoUrl).toBeUndefined();
  });
});
