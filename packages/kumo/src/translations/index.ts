/**
 * Built-in Kumo translation locales.
 *
 * English is first so it remains the fallback locale.
 */
import { registerTranslation } from "../localize/registry";

import en from "./en";
import ar from "./ar";
import de from "./de";
import es from "./es";
import fr from "./fr";
import he from "./he";
import it from "./it";
import ja from "./ja";
import ko from "./ko";
import pt from "./pt";
import zhCN from "./zh-CN";
import zhTW from "./zh-TW";

const BUILTIN_TRANSLATIONS = [
  en,
  ar,
  de,
  es,
  fr,
  he,
  it,
  ja,
  ko,
  pt,
  zhCN,
  zhTW,
] as const;

let registered = false;

export function registerBuiltInTranslations(): void {
  if (registered) return;
  registerTranslation(...BUILTIN_TRANSLATIONS);
  registered = true;
}
