import { createTranslation } from "./create-translation";
import jaJson from "./ja.json";

const ja = createTranslation(
  {
    $code: "ja",
    $name: "日本語",
    $dir: "ltr",
  },
  jaJson,
);

export default ja;
