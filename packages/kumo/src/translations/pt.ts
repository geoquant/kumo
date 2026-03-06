import { createTranslation } from "./create-translation";
import ptJson from "./pt.json";

const pt = createTranslation(
  {
    $code: "pt",
    $name: "Português",
    $dir: "ltr",
  },
  ptJson,
);

export default pt;
