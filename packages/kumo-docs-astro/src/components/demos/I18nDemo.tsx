import { useState } from "react";
import { Switch } from "@cloudflare/kumo";

type Direction = "ltr" | "rtl";

type LanguageSwitch = {
  id: string;
  label: string;
};

type Quadrant = {
  id: string;
  title: string;
  description: string;
  direction: Direction;
  controlFirst: boolean;
};

const languageSwitches: LanguageSwitch[] = [
  { id: "en", label: "Enable notifications" },
  { id: "es", label: "Activar notificaciones" },
  { id: "he", label: "הפעל התראות" },
  { id: "ar", label: "تفعيل الإشعارات" },
];

const quadrants: Quadrant[] = [
  {
    id: "ltr-control-first",
    title: "LTR / Control Before Label",
    description: "Left-to-right flow with switch before label",
    direction: "ltr",
    controlFirst: true,
  },
  {
    id: "ltr-label-first",
    title: "LTR / Label Before Control",
    description: "Left-to-right flow with label before switch",
    direction: "ltr",
    controlFirst: false,
  },
  {
    id: "rtl-control-first",
    title: "RTL / Control Before Label",
    description: "Right-to-left flow with switch before label",
    direction: "rtl",
    controlFirst: true,
  },
  {
    id: "rtl-label-first",
    title: "RTL / Label Before Control",
    description: "Right-to-left flow with label before switch",
    direction: "rtl",
    controlFirst: false,
  },
];

export function I18nSwitchGridDemo() {
  const [switchState, setSwitchState] = useState<Record<string, boolean>>(
    () => {
      const initialState: Record<string, boolean> = {};

      for (const quadrant of quadrants) {
        for (const languageSwitch of languageSwitches) {
          initialState[`${quadrant.id}-${languageSwitch.id}`] =
            quadrant.direction === "rtl";
        }
      }

      return initialState;
    },
  );

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {quadrants.map((quadrant) => (
        <section
          key={quadrant.id}
          dir={quadrant.direction}
          className="rounded-lg border border-kumo-line bg-kumo-elevated p-4"
        >
          <h3 className="text-sm font-semibold text-kumo-default">
            {quadrant.title}
          </h3>
          <p className="mt-1 mb-4 text-sm text-kumo-strong">
            {quadrant.description}
          </p>
          <div className="space-y-3">
            {languageSwitches.map((languageSwitch) => {
              const stateKey = `${quadrant.id}-${languageSwitch.id}`;

              return (
                <Switch
                  key={stateKey}
                  label={languageSwitch.label}
                  controlFirst={quadrant.controlFirst}
                  checked={switchState[stateKey] ?? false}
                  onCheckedChange={(nextChecked) => {
                    setSwitchState((prevState) => ({
                      ...prevState,
                      [stateKey]: nextChecked,
                    }));
                  }}
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
