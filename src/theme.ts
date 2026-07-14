export type ThemePref = 'system' | 'light' | 'dark';
export function applyTheme(pref: ThemePref) {
  const dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}
export function watchSystemTheme(getPref: () => ThemePref) {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme(getPref()));
}
