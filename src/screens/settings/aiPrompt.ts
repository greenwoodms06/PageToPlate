// The full "Copy full prompt" text for the AI import help page (plan Task 24;
// canvas 5a). The category list is joined from DEFAULT_CATEGORIES at runtime —
// single source of truth: if the 11 defaults ever change, the prompt follows
// without a second edit site (aiPrompt.test.ts fails if this coupling breaks).
import { DEFAULT_CATEGORIES } from '../../data/categories';

/** Exact header line the importer's fuzzy column mapping recognizes best. */
export const CSV_HEADER = 'Recipe Name,Page,Category';

export const AI_IMPORT_PROMPT = `Read the attached photos of a cookbook's table of contents (or index) and transcribe every recipe into CSV.

Rules:
1. Output CSV only — no commentary, no markdown code fences.
2. The first line must be exactly this header: ${CSV_HEADER}
3. One row per recipe: the recipe's name, its page number, and a category.
4. For the category, use EXACTLY one of these names whenever one fits: ${DEFAULT_CATEGORIES.map((c) => c.name).join(', ')}. If none of them fits, use the book's own section heading as written.
5. Transcribe only recipes you can actually read in the photos — never invent, merge, or reword entries. If a page number is unreadable, leave the page cell empty.
6. Put double quotes around any recipe name that contains a comma.`;
