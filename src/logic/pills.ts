import type { Pill } from '../data/types';
export function recipeMatches(r: { name: string; tags: string[] }, pills: Pill[]): boolean {
  const hay = (r.name + ' ' + r.tags.join(' ')).toLowerCase();
  return pills.every(p => { const has = hay.includes(p.text); return p.neg ? !has : has; });
}
export const addPill = (pills: Pill[], text: string): Pill[] => {
  const t = text.trim().toLowerCase();
  return !t || pills.some(p => p.text === t) ? pills : [...pills, { text: t, neg: false }];
};
export const togglePill = (pills: Pill[], i: number): Pill[] => pills.map((p, j) => j === i ? { ...p, neg: !p.neg } : p);
export const removePill = (pills: Pill[], i: number): Pill[] => pills.filter((_, j) => j !== i);
