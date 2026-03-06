import { createTranslation } from "./create-translation";
import itJson from "./it.json";

const it = createTranslation(
  {
    $code: "it",
    $name: "Italiano",
    $dir: "ltr",
  },
  itJson,
);

export default it;
