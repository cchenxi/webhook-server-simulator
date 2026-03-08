import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import zh from './zh';
import en from './en';

export type Locale = 'zh' | 'en';

type DeepStringRecord<T> = {
  [K in keyof T]: T[K] extends Record<string, unknown> ? DeepStringRecord<T[K]> : string;
};

type Translations = typeof zh;
export type TranslationMessages = DeepStringRecord<Translations>;

const translations: Record<Locale, TranslationMessages> = { zh, en };

type FlatKeys<T, Prefix extends string = ''> = T extends Record<string, unknown>
  ? {
      [K in keyof T & string]: T[K] extends Record<string, unknown>
        ? FlatKeys<T[K], `${Prefix}${K}.`>
        : `${Prefix}${K}`;
    }[keyof T & string]
  : never;

export type TranslationKey = FlatKeys<Translations>;

function getByPath(obj: unknown, path: string): string {
  let current = obj;
  for (const key of path.split('.')) {
    if (current == null || typeof current !== 'object') return path;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' ? current : path;
}

interface I18nContextValue {
  t: (key: TranslationKey) => string;
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = 'locale';

function getInitialLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'zh' || stored === 'en') return stored;
  } catch {
    // ignore
  }
  return 'zh';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem(STORAGE_KEY, newLocale);
    } catch {
      // ignore
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey): string => getByPath(translations[locale], key),
    [locale]
  );

  return (
    <I18nContext.Provider value={{ t, locale, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useTranslation must be used within I18nProvider');
  return ctx;
}
