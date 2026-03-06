import { createTranslation } from "./create-translation";
import arJson from "./ar.json";

const ar = createTranslation(
  {
    $code: "ar",
    $name: "العربية",
    $dir: "rtl",
  },
  arJson,
);

export default ar;
