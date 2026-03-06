import { createTranslation } from "./create-translation";
import frJson from "./fr.json";

const fr = createTranslation(
  {
    $code: "fr",
    $name: "Français",
    $dir: "ltr",
  },
  frJson,
);

export default fr;
