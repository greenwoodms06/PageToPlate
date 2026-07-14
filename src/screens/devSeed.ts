// Dev-only demo seeding (plan Milestone D demo checkpoint): imports the real
// ATK index CSV through the same parse→plan pipeline the CSV import flow
// (Task 24) will use, plus two tiny fake books so multi-book tap-order colors
// are demoable. Loaded ONLY via dynamic import from a DEV-guarded button in
// DevGallery — the CSV must never reach production bundles (verified by
// grepping dist/ after build).
//
// Idempotent by design: planImport dedupes ATK rows by normalized name
// (re-seed ⇒ all skips); the fake books are guarded by book name.
import { store } from '../data/store';
import { newId } from '../data/types';
import type { MadeEntry, Recipe } from '../data/types';
import { parseRecipeCsv } from '../logic/csv';
import { planImport } from '../logic/importer';
import { UNCATEGORIZED } from '../data/categories';

// Placeholder title until the owner confirms the exact ATK edition (plan
// Demo Checkpoint 1 reviews this).
export const ATK_BOOK_NAME = "America's Test Kitchen";

export async function seedAtk(): Promise<string> {
  const { default: csv } = await import('../../background/atk_index.csv?raw');
  const parsed = parseRecipeCsv(csv);

  let book = store.books.find((b) => b.name === ATK_BOOK_NAME);
  if (!book) {
    book = { id: newId(), name: ATK_BOOK_NAME, tags: [], archived: false, createdAt: new Date().toISOString() };
    await store.addBook(book);
  }

  const existing = store.recipes.filter((r) => r.bookId === book.id);
  const plan = planImport(parsed.rows, existing, store.categories.map((c) => c.name));
  const adds: Recipe[] = plan.rows
    .filter((r) => r.action === 'add')
    .map((r) => ({
      id: newId(),
      bookId: book.id,
      name: r.name,
      page: r.page,
      category: r.category ?? UNCATEGORIZED, // ATK maps clean; belt-and-braces
      tags: r.tags,
      status: 'active',
      isCustom: false,
      attachmentIds: [],
      createdAt: new Date().toISOString(),
    }));
  if (adds.length > 0) await store.addRecipes(adds);
  return `${ATK_BOOK_NAME}: +${adds.length} recipes, ${plan.skips} skipped`;
}

// name, page, category, tags, madeDates (each date ⇒ one MadeEntry)
type FakeRow = [string, string, string, string[], string[]?];
const FAKE_BOOKS: { name: string; rows: FakeRow[] }[] = [
  {
    name: 'Weeknight Standbys',
    rows: [
      ['Skillet Chicken Thighs', '12', 'Mains', ['chicken'], ['2026-06-02', '2026-07-01']],
      ['Garlic Butter Salmon', '18', 'Mains', ['fish']],
      ['Sheet-Pan Sausage and Peppers', '24', 'Mains', ['pork']],
      ['Crispy Fried Chicken Cutlets', '15', 'Mains', ['chicken', 'fried']],
      ['Smashed Potatoes', '41', 'Sides', ['potato'], ['2026-05-20']],
      ['Charred Broccoli', '44', 'Sides', ['vegetable']],
      ['Tomato Soup with Grilled Cheese', '52', 'Soups & Stews', ['creamy']],
      ['Chopped Kale Salad', '60', 'Salads', ['green']],
      ['One-Bowl Brownies', '71', 'Desserts', ['chocolate']],
      ['Lemon Yogurt Cake', '75', 'Desserts', ['cake'], ['2026-06-15']],
    ],
  },
  {
    name: 'Sunday Baking',
    rows: [
      ['Overnight Sourdough Loaf', '8', 'Breads', ['yeasted']],
      ['Buttermilk Biscuits', '14', 'Breads', ['quick'], ['2026-06-08']],
      ['Cinnamon Swirl Rolls', '21', 'Breads', ['yeasted']],
      ['Chocolate Chip Cookies', '33', 'Desserts', ['cookie', 'chocolate'], ['2026-04-12', '2026-06-28']],
      ['Peach Galette', '39', 'Desserts', ['fruit', 'pie']],
      ['Vanilla Bean Pound Cake', '45', 'Desserts', ['cake']],
      ['Dutch Baby Pancake', '55', 'Breakfast & Brunch', ['pancake']],
      ['Blueberry Muffins', '58', 'Breakfast & Brunch', ['muffin']],
    ],
  },
];

export async function seedDemoBooks(): Promise<string> {
  const results: string[] = [];
  for (const fake of FAKE_BOOKS) {
    if (store.books.some((b) => b.name === fake.name)) {
      results.push(`${fake.name}: already seeded`);
      continue;
    }
    const bookId = newId();
    await store.addBook({ id: bookId, name: fake.name, tags: [], archived: false, createdAt: new Date().toISOString() });
    const recipes: Recipe[] = fake.rows.map(([name, page, category, tags]) => ({
      id: newId(),
      bookId,
      name,
      page,
      category,
      tags,
      status: 'active',
      isCustom: false,
      attachmentIds: [],
      createdAt: new Date().toISOString(),
    }));
    await store.addRecipes(recipes);
    const entries: MadeEntry[] = fake.rows.flatMap(([name, , , , dates], i) =>
      (dates ?? []).map((date) => ({
        id: newId(),
        recipeId: recipes[i].id,
        date,
        rating: 8,
        notes: `Seed entry for ${name}`,
        photoIds: [],
      })),
    );
    for (const e of entries) await store.addMadeEntry(e);
    results.push(`${fake.name}: +${recipes.length} recipes, ${entries.length} made entries`);
  }
  return results.join(' · ');
}
