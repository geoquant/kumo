/**
 * Eagerly registers all 12 Kumo translation locales.
 *
 * **English is registered first** so it becomes the fallback when no
 * match is found during locale resolution.
 *
 * Import this module for its side-effect:
 * ```ts
 * import "../translations/index.js";
 * ```
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

// English first — it becomes the fallback for unmatched locales.
registerTranslation(en, ar, de, es, fr, he, it, ja, ko, pt, zhCN, zhTW);
