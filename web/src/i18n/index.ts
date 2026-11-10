import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import sw from './sw.json';

// Swahili first, English available; the choice persists in localStorage.
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { sw: { translation: sw }, en: { translation: en } },
    fallbackLng: 'sw',
    supportedLngs: ['sw', 'en'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'simulizi_lang',
      caches: ['localStorage'],
    },
  });

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
});

export default i18n;
