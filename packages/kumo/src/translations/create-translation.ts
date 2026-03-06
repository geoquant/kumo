import en from "./en";

import type { KumoTranslation } from "../localize/types";

type TranslationMetadata = Pick<KumoTranslation, "$code" | "$name" | "$dir">;
type TranslationOverrides = Partial<
  Omit<KumoTranslation, keyof TranslationMetadata>
>;

export function createTranslation(
  metadata: TranslationMetadata,
  overrides: TranslationOverrides = {},
): KumoTranslation {
  return {
    ...en,
    ...overrides,
    ...metadata,
  };
}
