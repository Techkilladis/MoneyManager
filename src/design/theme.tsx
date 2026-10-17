/**
 * Light/dark theming. Components read the palette with `useTheme()` and
 * build styles with `makeStyles`, which caches one StyleSheet per scheme, so
 * switching themes re-renders in place without losing navigation state.
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import * as SystemUI from 'expo-system-ui';
import { darkColors, lightColors, Palette } from './tokens';
import { setActiveScheme } from './scheme';
import { getSetting, setSetting, subscribeSettings, ThemePreference } from '../services/settings';

export type Scheme = 'light' | 'dark';

interface ThemeValue {
  scheme: Scheme;
  colors: Palette;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeValue>({
  scheme: 'light',
  colors: lightColors,
  preference: 'system',
  setPreference: () => undefined,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [preference, setPref] = useState<ThemePreference>('system');

  useEffect(() => {
    let alive = true;
    // The settings table may not exist until the database is initialised;
    // fall back to "system" until then.
    const load = () =>
      getSetting('theme')
        .then((p) => alive && setPref(p))
        .catch(() => undefined);
    load();
    const unsubscribe = subscribeSettings((key) => {
      if (key === 'theme') load();
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  const scheme: Scheme = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
  // Module-level helpers (tint) read this during render.
  setActiveScheme(scheme);

  // The native root view shows through during screen transitions.
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync((scheme === 'dark' ? darkColors : lightColors).background).catch(() => undefined);
  }, [scheme]);

  const value = useMemo<ThemeValue>(
    () => ({
      scheme,
      colors: scheme === 'dark' ? darkColors : lightColors,
      preference,
      setPreference: (p) => {
        setPref(p);
        void setSetting('theme', p).catch(() => undefined);
      },
    }),
    [scheme, preference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}

type NamedStyles<T> = { [P in keyof T]: StyleSheet.NamedStyles<T>[P] };

/** Declares themed styles: `const useStyles = makeStyles((colors) => ({ ... }))`. */
export function makeStyles<T extends NamedStyles<T>>(factory: (colors: Palette, scheme: Scheme) => T): () => T {
  const cache: Partial<Record<Scheme, T>> = {};
  return function useStyles(): T {
    const { scheme, colors } = useTheme();
    let styles = cache[scheme];
    if (!styles) {
      styles = StyleSheet.create(factory(colors, scheme)) as T;
      cache[scheme] = styles;
    }
    return styles;
  };
}
