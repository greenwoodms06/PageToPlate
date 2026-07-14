// DECISION (owner, 2026-07-14): 11 default categories, not the spec's 12 —
// "Appetizers & Small Plates" merged into Sides (appetizer-vocab sections auto-tag
// "appetizer" so the distinction stays filterable); "Desserts & Sweets"→"Desserts";
// "Basics & Staples"→"Basics". Supersedes cookbook-app-spec.md §Category.
// The test in categories.test.ts fails if this list drifts.
export const DEFAULT_CATEGORIES: ReadonlyArray<{ name: string; chips: string[] }> = [
  { name: 'Mains',               chips: ['beef','chicken','pork','fish','seafood','vegetarian','pasta'] },
  { name: 'Sides',               chips: ['vegetable','potato','grain','appetizer','dip'] },
  { name: 'Soups & Stews',       chips: ['creamy','brothy','chili','stew'] },
  { name: 'Salads',              chips: ['green','grain','fruit'] },
  { name: 'Breakfast & Brunch',  chips: ['egg','pancake','muffin','oat'] },
  { name: 'Breads',              chips: ['yeasted','quick','flatbread','biscuit'] },
  { name: 'Desserts',            chips: ['chocolate','fruit','cake','cookie','pie'] },
  { name: 'Drinks',              chips: ['cocktail','coffee','tea','punch'] },
  { name: 'Sauces & Condiments', chips: ['sauce','dressing','salsa','chutney'] },
  { name: 'Preserves & Pickles', chips: ['jam','pickle','ferment','jelly'] },
  { name: 'Basics',              chips: ['stock','dough','spice blend'] },
];

const SYN: Record<string, string> = {
  'entrées':'Mains','entrees':'Mains','main dishes':'Mains','main courses':'Mains','primi':'Mains','secondi':'Mains',
  'side dishes':'Sides','vegetables':'Sides',
  'appetizers & small plates':'Sides','appetizers':'Sides','starters':'Sides','small plates':'Sides',
  "hors d'oeuvres":'Sides','hors d’oeuvres':'Sides','meze':'Sides','tapas':'Sides','antipasti':'Sides',
  'dim sum':'Sides','snacks':'Sides','canapés':'Sides','canapes':'Sides',
  'soups':'Soups & Stews','stews':'Soups & Stews','soups and stews':'Soups & Stews','chowders':'Soups & Stews',
  'breakfast':'Breakfast & Brunch','brunch':'Breakfast & Brunch',
  'rolls':'Breads','biscuits':'Breads',
  'desserts & sweets':'Desserts','sweets':'Desserts','puddings':'Desserts','cakes':'Desserts','pies':'Desserts',
  'cookies':'Desserts','confections':'Desserts','dolci':'Desserts',
  'beverages':'Drinks','cocktails':'Drinks',
  'sauces':'Sauces & Condiments','condiments':'Sauces & Condiments','dressings':'Sauces & Condiments','salsas':'Sauces & Condiments',
  'preserves':'Preserves & Pickles','pickles':'Preserves & Pickles','canning':'Preserves & Pickles',
  'jams':'Preserves & Pickles','jellies':'Preserves & Pickles',
  'basics & staples':'Basics','staples':'Basics','stocks':'Basics','fundamentals':'Basics',
};
const APPETIZER_SECTIONS = new Set(['appetizers & small plates','appetizers','starters','small plates',
  "hors d'oeuvres",'hors d’oeuvres','meze','tapas','antipasti','dim sum','snacks','canapés','canapes']);

export function mapRawCategory(raw: string, extraNames: string[] = []): { category: string | null; addTags: string[] } {
  const norm = raw.trim().replace(/\s+/g, ' ').toLowerCase();
  const addTags = APPETIZER_SECTIONS.has(norm) ? ['appetizer'] : [];
  const direct = [...DEFAULT_CATEGORIES.map(c => c.name), ...extraNames].find(n => n.toLowerCase() === norm);
  if (direct) return { category: direct, addTags };
  if (SYN[norm]) return { category: SYN[norm], addTags };
  return { category: null, addTags };
}
export const UNCATEGORIZED = 'Uncategorized';
