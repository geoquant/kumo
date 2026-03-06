import { createTranslation } from "./create-translation";
import esJson from "./es.json";

const es = createTranslation(
  {
    $code: "es",
    $name: "Español",
    $dir: "ltr",
  },
  esJson,
);

export default es;
