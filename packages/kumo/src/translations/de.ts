import { createTranslation } from "./create-translation";
import deJson from "./de.json";

const de = createTranslation(
  {
    $code: "de",
    $name: "Deutsch",
    $dir: "ltr",
  },
  deJson,
);

export default de;
