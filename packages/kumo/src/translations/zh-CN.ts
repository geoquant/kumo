import { createTranslation } from "./create-translation";
import zhCNJson from "./zh-CN.json";

const zhCN = createTranslation(
  {
    $code: "zh-CN",
    $name: "简体中文",
    $dir: "ltr",
  },
  zhCNJson,
);

export default zhCN;
