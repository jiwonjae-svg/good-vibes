import { getPraisesByLanguage, seedPraises } from '../data/seedPraises';
import i18n from '../i18n';

const praiseIndexByLang = new Map<string, number>();

export async function getPraise(): Promise<string> {
  return getOfflinePraise();
}

function getOfflinePraise(): string {
  const lang = i18n.language;
  let praises = getPraisesByLanguage(lang);

  if (praises.length === 0) {
    praises = getPraisesByLanguage('en');
  }
  if (praises.length === 0) {
    praises = seedPraises;
  }

  if (!praiseIndexByLang.has(lang)) {
    praiseIndexByLang.set(lang, 0);
  }

  const index = praiseIndexByLang.get(lang)!;
  const praise = praises[index % praises.length];
  praiseIndexByLang.set(lang, index + 1);

  return praise.text;
}
