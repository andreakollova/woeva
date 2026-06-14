import React, { createContext, useContext, useEffect, useState } from 'react';
import { translations, Lang, Translations } from '@/lib/i18n/translations';
import { LANG_KEY, loadSavedLang, saveLang } from '@/lib/i18n';

interface LanguageContextType {
  lang: Lang;
  t: Translations;
  setLang: (l: Lang) => void;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'sk',
  t: translations.sk as unknown as Translations,
  setLang: () => {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('sk');

  useEffect(() => {
    loadSavedLang().then(saved => {
      if (saved) setLangState(saved);
    });
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    saveLang(l);
  }

  return (
    <LanguageContext.Provider value={{ lang, t: translations[lang] as Translations, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslations() {
  return useContext(LanguageContext);
}
