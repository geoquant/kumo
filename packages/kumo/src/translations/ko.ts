import { createTranslation } from "./create-translation";
import koJson from "./ko.json";

const ko = createTranslation(
  {
    $code: "ko",
    $name: "한국어",
    $dir: "ltr",
  },
  koJson,
);

export default ko;
