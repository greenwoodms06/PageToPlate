// Forgiving CSV parser for cookbook-index imports (spec §CSV Import).
// Real exports are messy — the shipped ATK index has a category with a trailing
// space ("Drinks "), quoted names containing commas, and sometimes-quoted
// keyword cells — so every cell is trimmed and quoting is handled by a
// character state machine rather than a split-on-comma.

export interface ParsedRecipeRow { name: string; page: string; category?: string; tags: string[] }
export interface ParsedCsv { rows: ParsedRecipeRow[]; hadHeader: boolean }

/** Quote-aware record splitter: handles "" escapes, commas inside quotes,
 *  CRLF/LF endings; skips fully-empty lines. Cells come back trimmed. */
function splitRecords(text: string): string[][] {
  const records: string[][] = [];
  let fields: string[] = [];
  let cell = '';
  let inQuotes = false;
  const endField = () => { fields.push(cell.trim()); cell = ''; };
  const endRecord = () => {
    endField();
    if (fields.some(f => f !== '')) records.push(fields);
    fields = [];
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }   // "" escape
        else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"' && cell.trim() === '') {
      inQuotes = true; cell = '';                        // opening quote
    } else if (ch === ',') {
      endField();
    } else if (ch === '\n') {
      endRecord();
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') i++;                     // CRLF
      endRecord();
    } else cell += ch;
  }
  if (cell.trim() !== '' || fields.length > 0) endRecord(); // no trailing newline
  return records;
}

const HEADER_WORDS = ['page', 'recipe', 'name', 'category', 'keywords', 'tags'];

function looksLikeHeader(cells: string[]): boolean {
  const lower = cells.map(c => c.toLowerCase());
  if (lower.some(c => HEADER_WORDS.some(w => c.includes(w)))) return true;
  // Positional assumption is name,page[,...]: a non-numeric page cell in
  // column 2 means the first row is labels, not data.
  const pageCell = cells[1] ?? '';
  return pageCell !== '' && !/^\d+(\s*[-–]\s*\d+)?$/.test(pageCell);
}

interface ColumnMap { name: number; page: number; category: number; tags: number }

// Headerless / positional fallback order: name,page[,category[,tags]]
const POSITIONAL: ColumnMap = { name: 0, page: 1, category: 2, tags: 3 };

/** Fuzzy header mapping: "Page Number"→page, "Recipe Name"→name, etc.
 *  Columns the header does not identify fall back to the positional order. */
function mapColumns(header: string[]): ColumnMap {
  const map: ColumnMap = { name: -1, page: -1, category: -1, tags: -1 };
  header.forEach((cell, i) => {
    const h = cell.toLowerCase();
    if (map.page === -1 && (h.includes('page') || h.includes('pg'))) map.page = i;
    else if (map.name === -1 && (h.includes('recipe') || h.includes('name') || h.includes('title') || h.includes('dish'))) map.name = i;
    else if (map.category === -1 && (h.includes('category') || h.includes('section'))) map.category = i;
    else if (map.tags === -1 && (h.includes('keyword') || h.includes('tag'))) map.tags = i;
  });
  const taken = new Set(Object.values(map).filter(i => i !== -1));
  const nextFree = (from: number) => {
    for (let i = from; ; i++) if (!taken.has(i)) { taken.add(i); return i; }
  };
  if (map.name === -1) map.name = nextFree(POSITIONAL.name);
  if (map.page === -1) map.page = nextFree(POSITIONAL.page);
  if (map.category === -1) map.category = nextFree(POSITIONAL.category);
  if (map.tags === -1) map.tags = nextFree(POSITIONAL.tags);
  return map;
}

const splitTags = (cell: string): string[] =>
  cell.split(/[,;]/).map(t => t.trim()).filter(t => t !== '');

export function parseRecipeCsv(text: string): ParsedCsv {
  const records = splitRecords(text);
  if (records.length === 0) return { rows: [], hadHeader: false };
  const hadHeader = looksLikeHeader(records[0]);
  const cols = hadHeader ? mapColumns(records[0]) : POSITIONAL;
  const rows = records.slice(hadHeader ? 1 : 0).map(cells => {
    const at = (i: number) => cells[i] ?? '';
    const category = at(cols.category);
    return {
      name: at(cols.name),
      page: at(cols.page),
      category: category === '' ? undefined : category,
      tags: splitTags(at(cols.tags)),
    };
  });
  return { rows, hadHeader };
}
