import { createTranslation } from "./create-translation";
import heJson from "./he.json";

const he = createTranslation(
  {
    $code: "he",
    $name: "עברית",
    $dir: "rtl",
  },
  heJson,
);

export default he;
