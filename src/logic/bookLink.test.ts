import { describe, expect, it } from 'vitest';
import { bookInfoLink } from './bookLink';

describe('bookInfoLink', () => {
  it('labels an archive.org infoUrl as a free read', () => {
    const link = bookInfoLink({
      name: 'The Chinese Cook Book',
      author: 'Chan, Shiu Wong',
      infoUrl: 'https://archive.org/details/chinesecookbook00chan',
    });
    expect(link).toEqual({
      label: 'Read free on archive.org',
      url: 'https://archive.org/details/chinesecookbook00chan',
    });
  });

  it('labels a non-archive infoUrl as generic "More info"', () => {
    const link = bookInfoLink({
      name: 'My Own Cookbook',
      author: 'Me',
      infoUrl: 'https://example.com/my-book',
    });
    expect(link).toEqual({ label: 'More info', url: 'https://example.com/my-book' });
  });

  it('falls back to a title+author web search when there is no infoUrl', () => {
    const link = bookInfoLink({ name: 'The Joy of Cooking', author: 'Rombauer' });
    expect(link?.label).toBe('Find this book');
    expect(link?.url).toBe(
      'https://www.google.com/search?q=' + encodeURIComponent('The Joy of Cooking Rombauer cookbook'),
    );
  });

  it('tolerates a missing author in the search query (spec-verbatim query)', () => {
    const link = bookInfoLink({ name: 'Anonymous Recipes' });
    // Built exactly as the spec template `${name} ${author ?? ''} cookbook` —
    // the absent author leaves a double space, which encodes and searches fine.
    expect(link?.url).toBe(
      'https://www.google.com/search?q=' + encodeURIComponent('Anonymous Recipes  cookbook'),
    );
  });
});
