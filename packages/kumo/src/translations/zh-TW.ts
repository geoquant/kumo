import { createTranslation } from "./create-translation";
import zhTWJson from "./zh-TW.json";

const zhTW = createTranslation(
  {
    $code: "zh-TW",
    $name: "繁體中文",
    $dir: "ltr",
  },
  zhTWJson,
);

export default zhTW;
