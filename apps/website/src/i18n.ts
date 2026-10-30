import { en } from './lang/en';
import { zh } from './lang/zh';

type Lang = 'en' | 'zh';
type Dictionary = typeof en;

const dictionaries: Record<Lang, Dictionary> = { en, zh };

export function useLang(pathname: string): { lang: Lang; t: (key: keyof Dictionary) => string } {
  const lang: Lang = pathname.startsWith('/zh/') || pathname === '/zh' ? 'zh' : 'en';
  const dict = dictionaries[lang];
  const t = (key: keyof Dictionary): string => dict[key] ?? key;
  return { lang, t };
}

export type { Lang, Dictionary };
