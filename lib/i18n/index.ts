import { createContext, useContext } from 'react';
import { translations, Lang, Translations } from './translations';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type { Lang };

export const LANG_KEY = '@woeva_lang';

export async function loadSavedLang(): Promise<Lang | null> {
  try {
    const val = await AsyncStorage.getItem(LANG_KEY);
    if (val === 'sk' || val === 'en') return val;
  } catch {}
  return null;
}

export async function saveLang(lang: Lang) {
  try {
    await AsyncStorage.setItem(LANG_KEY, lang);
  } catch {}
}

export const LanguageContext = createContext<{
  lang: Lang;
  t: Translations;
  setLang: (l: Lang) => void;
}>({
  lang: 'en',
  t: translations.en,
  setLang: () => {},
});

export function useTranslations() {
  return useContext(LanguageContext);
}

export { translations };
