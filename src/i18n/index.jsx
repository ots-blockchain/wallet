import React, { createContext, useContext, useState } from 'react';
import ru from './ru';
import en from './en';

const dictionaries = { ru, en };
const STORAGE_LANG_KEY = 'ots_lang';

const I18nContext = createContext({
  lang: 'ru',
  setLang: () => {},
  t: () => ''
});

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    const saved = localStorage.getItem(STORAGE_LANG_KEY);
    if (saved && dictionaries[saved]) return saved;
    const nav = navigator.language?.slice(0, 2);
    return nav === 'en' ? 'en' : 'ru';
  });

  const setLang = (newLang) => {
    if (dictionaries[newLang]) {
      setLangState(newLang);
      localStorage.setItem(STORAGE_LANG_KEY, newLang);
    }
  };

  const t = (key, ...args) => {
    const dict = dictionaries[lang] || dictionaries.ru;
    let val = dict[key] || dictionaries.en[key] || key;
    args.forEach((arg, i) => {
      val = val.replace(`{${i}}`, String(arg));
    });
    return val;
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
