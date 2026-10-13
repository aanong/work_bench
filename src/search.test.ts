import { describe, it, expect } from "vitest";
import { searchApps } from "./search";
import { demoApps } from "./demo";
describe("应用搜索", () => {
  it("中文、全拼和首字母均能找到微信，并优先于企业微信", () => {
    for (const query of ["微信", "weixin", "wx"])
      expect(searchApps(demoApps, query, true)[0].name).toBe("微信");
  });
  it("匹配英文大小写与非连续字符", () => {
    expect(searchApps(demoApps, "VSC", true)[0].name).toBe(
      "Visual Studio Code",
    );
    expect(searchApps(demoApps, "FIGMA", true)[0].name).toBe("Figma");
  });
  it("未匹配时返回空列表", () => {
    expect(searchApps(demoApps, "notfound", true)).toEqual([]);
  });
  it("精确匹配不会被高使用频率的弱匹配覆盖", () => {
    const apps = structuredClone(demoApps);
    apps.find((a) => a.name === "企业微信")!.usage = 10000;
    expect(searchApps(apps, "微信", true)[0].name).toBe("微信");
  });
  it("只有智能排序打开时才应用使用加成", () => {
    const apps = structuredClone(demoApps);
    apps.find((a) => a.name === "Figma")!.usage = 2;
    expect(searchApps(apps, "", true)[0].name).toBe("Figma");
    expect(searchApps(apps, "", false)[0].name).not.toBe("Figma");
  });
});
