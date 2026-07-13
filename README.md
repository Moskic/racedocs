# RaceDocs

RaceDocs 是面向中文模拟赛车玩家的双语数字手册资料库，提供经过校验的 YAML 内容、安全 Markdown 渲染、双语阅读，以及手册搜索和筛选。

在线访问：[racedocs.moskic.com](https://racedocs.moskic.com)

## 开发

需要 Node.js 24.14.0 和 pnpm 11.7.0。

```sh
pnpm install --frozen-lockfile
pnpm dev
```

运行自动验证和生产构建：

```sh
pnpm test
pnpm build
```

构建结果位于 `dist/`，可部署到任意静态网站托管服务。

## 内容维护

每本手册对应 `src/data/manuals/` 中的一个 YAML 文件，也可以通过根目录的 `.pages.yml` 使用 Pages CMS 编辑。

- `slug` 只使用小写英文、数字和连字符，并与文件名一致。
- `published: true` 的手册才会进入生产构建。
- 已发布手册的封面和正文图片应位于 `src/data/manuals/assets/{slug}/`，并在内容中使用 `./assets/{slug}/...` 引用。
- 章节 ID 必须唯一；标题层级只能为 H2 或 H3，且 H3 必须位于 H2 之后。
- 中文标题和正文必填；英文标题和正文必须同时填写或同时留空。
- 来源信息通过 `source` 记录，Markdown 会在构建时清理后再输出。

## 声明与许可

RaceDocs 是独立项目，与手册中提及的赛车品牌、汽车制造商、模拟平台及其他权利人没有隶属、认可或合作关系。相关名称、标识和商标归各自权利人所有。

项目源代码使用 [MIT License](LICENSE)。手册文字、图片和其他媒体内容不因源代码采用 MIT License 而自动获得相同授权；其权利与使用条件以各自来源和权利人的规定为准。
