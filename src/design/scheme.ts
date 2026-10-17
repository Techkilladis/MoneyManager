// The active colour scheme, set by ThemeProvider during render so plain
// helpers like `tint()` can pick the right base colour.
let active: 'light' | 'dark' = 'light';

export function setActiveScheme(scheme: 'light' | 'dark'): void {
  active = scheme;
}

export function getActiveScheme(): 'light' | 'dark' {
  return active;
}
