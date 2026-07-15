// Guards the prompt ↔ categories coupling (see aiPrompt.ts header): the
// chatbot must be told the app's real category names, or every import lands
// in the unrecognized-mapping UI.
import { describe, expect, it } from 'vitest';
import { DEFAULT_CATEGORIES } from '../../data/categories';
import { AI_IMPORT_PROMPT, CSV_HEADER } from './aiPrompt';

describe('AI import prompt', () => {
  it('names all 11 default categories verbatim', () => {
    for (const c of DEFAULT_CATEGORIES) {
      expect(AI_IMPORT_PROMPT).toContain(c.name);
    }
  });

  it('specifies the exact CSV header the parser maps', () => {
    expect(AI_IMPORT_PROMPT).toContain(CSV_HEADER);
  });
});
