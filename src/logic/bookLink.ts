// Smart "buy / more info" link for a book (round-2 amendment 7). Per book type:
//   • infoUrl set + points at archive.org → "Read free on archive.org" (our
//     linked packs — the book's own free scan).
//   • infoUrl set otherwise (a user's own link) → "More info".
//   • no infoUrl (index-only pack or a plain user book) → "Find this book", a
//     title+author web search so the owner can buy/borrow the physical book.
// Affiliate tagging (Amazon Associates) is deferred — plain links for now.
import type { Cookbook } from '../data/types';

export function bookInfoLink(
  book: Pick<Cookbook, 'name' | 'author' | 'infoUrl'>,
): { label: string; url: string } | null {
  if (book.infoUrl) {
    return {
      label: book.infoUrl.includes('archive.org') ? 'Read free on archive.org' : 'More info',
      url: book.infoUrl,
    };
  }
  // Query built verbatim per spec — a missing author leaves a harmless double
  // space that the search engine ignores.
  const query = `${book.name} ${book.author ?? ''} cookbook`;
  return { label: 'Find this book', url: `https://www.google.com/search?q=${encodeURIComponent(query)}` };
}
