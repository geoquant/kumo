declare module "@cloudflare/kumo/ai/theme-metadata.json" {
  type ThemeModeValues = {
    light: string;
    dark: string;
  };

  type ThemeMetadataToken = {
    name: string;
    cssVariable: string;
    tailwindUtilityFamily: "text" | "bg-border-ring" | "typography";
    kind: "text" | "color" | "typography";
    defaultTheme: "kumo";
    newName: string;
    description?: string;
    themes: Record<string, ThemeModeValues | string>;
  };

  type ThemeMetadata = {
    themes: readonly string[];
    tokens: readonly ThemeMetadataToken[];
  };

  const themeMetadata: ThemeMetadata;

  export default themeMetadata;
}
