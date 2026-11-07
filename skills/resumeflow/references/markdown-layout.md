# 排版与图片规则

以下规则对应当前 ResumeFlow 的共享渲染器，网页预览与 PDF 使用同一份 Markdown 和基础样式。实例版本或已有自定义 CSS 可能影响最终效果，修改前先读取当前正文与样式。

## 标准布局

使用显式 `::::row` 包裹一个或多个 `:::cell`；每行边界明确，cell 内可继续使用 Markdown。单元格默认等宽，首列左对齐、末列右对齐，其余居中。一个 cell 时默认左对齐。编辑器“插入语法”提供左右同行、左中右同行和等宽分栏，插入完整的标准布局。

```markdown
::::row{columns="1fr auto"}
:::cell{align="left"}
高级前端工程师
:::

:::cell{align="right"}
2023.01 - 至今
:::
::::
```

`columns` 的项目数必须与 cell 数量相同，支持 `auto` 和正整数 `fr`、`mm`、`px`、`%`，如 `2fr 1fr`、`1fr 24mm`；百分比最大为 100，其余数字最大为 1000。`auto` 按内容宽度排列，`fr` 分配剩余空间。`align` 可为 `left`、`center`、`right`。左中右且中间需要相对整行居中时，使用 `1fr auto 1fr` 和对应的对齐方式。超长内容可在单元格内换行；窄列或多个固定宽度之和过大时应调整列宽。

旧的 `:::left`、`:::center`、`:::right` 及 row 外的 `:::cell` 不再支持，需要改为标准布局。冒号与指令名之间不能有空格。普通单换行遵循 Markdown 规则，需要硬换行时在行尾加两个空格或反斜杠。

## 顶部头像

顶部个人信息区的图片默认作为头像：从顶部第一个 `#`（h1）标题开始，到首个 `##`–`######`（h2–h6）标题之前结束。HTML `<h1>`–`<h6>` 遵循同样规则。进入模块后不会自动恢复头像区域，即使后面再次出现 h1；h1 之前或没有 h1 的图片也不会自动裁剪。

产品经理模板中的照片是可替换的 Markdown 示例图片；AI 工程师模板不含头像。姓名在左、照片在右时，使用标准左右布局：

```markdown
::::row{columns="1fr auto"}
:::cell{align="left"}

# 姓名

前端工程师

电话 · 邮箱
:::
:::cell{align="right"}
![个人照片](https://example.com/photo.jpg)
:::
::::
```

请将示例 URL 换成用户提供的真实图片直链。没有照片时可询问链接或暂时省略照片，不把模板人物照片当作用户头像。

渲染器只为顶部个人信息区的图片生成 `rf-avatar` class。默认头像为 24 mm × 32 mm，以 `object-fit: cover` 裁剪、`object-position: center top` 定位，并靠右显示；产品经理模板还会通过自定义 CSS 调整垂直对齐、边框与阴影。不要求图片必须放在 row 内。

模块中的图片默认仅限制 `max-width: 100%`，高度按原图比例自适应，即使放在 row 最后一格也不采用头像裁剪。手写 `class="rf-avatar"` 不能让模块图片变成默认头像，该 class 由渲染器按标题区域重新计算。

调整头像尺寸或裁剪时使用 `customCss` 中的 `img.rf-avatar` 选择器，并保留原有其他样式。避免用所有 row 的末栏图片选择器设置头像；已有简历的自定义 CSS 若包含这种宽泛规则，仍可能覆盖默认行为，需按用户意图调整。

## 图片写法与导入

支持标准 Markdown 图片及引用式图片：

```markdown
![作品截图](https://example.com/project.png)

![个人照片][photo]

[photo]: https://example.com/photo.jpg
```

- 图片必须是完整的 `http://` 或 `https://` URL，不能包含用户名、密码。不支持相对路径、`/photo.jpg`、本地文件路径、`file:`、`data:` 或 `blob:`。
- 当前这条工作流通过图片 URL 引用资源，不会把聊天附件或本地文件自动上传成图片链接。用户只提供本地文件时，说明需要可访问的图片直链；不要编造上传接口或未经授权上传到第三方图床。
- 也支持 HTML `<img>`，`src` 与 Markdown 图片使用相同校验；可保留 `alt`、`title`、`width`、`height` 等安全属性。普通图片可用 `width` 设置宽度，高度默认自适应；顶部头像尺寸由头像 CSS 控制。
- `![照片](URL){.rf-avatar}` 不会设置 class，花括号会成为正文。头像由顶部标题区域自动识别，样式通过自定义 CSS 调整。

例如，在 `## 项目经历` 后插入普通截图：

```html
<img src="https://example.com/project.png" alt="作品截图" width="320" />
```

## 安全 HTML

Markdown 中可以混用白名单允许的 HTML，例如 `div`、`span`、`p`、`br`、`strong`、`em`、`sup`、`sub`、`h1`–`h6`、`table` 与 `img`。例如：

```html
<p>
  <strong>联系方式：</strong><span>hello@example.com</span><br />工作城市：上海
</p>
```

HTML 先解析，再清洗；脚本、iframe 等非白名单标签及 `onerror`、`onclick` 等事件属性、危险链接会被移除。内联 `style` 不保留，样式放在 `customCss`；class 仅保留允许的 `rf-*` 类。不要依赖 JavaScript、任意 HTML 属性或任意 class。

HTML 块内需要继续解析 Markdown 时，在 HTML 标签与 Markdown 内容之间留空行。代码块或行内代码中的 HTML 仅展示源码，不作为标签执行。

## PDF 图片限制

网页预览能显示图片，不代表 PDF 服务也能读取它。导出时由服务端获取图片：

- 使用服务端可直接访问的公网图片 URL；内网、回环等受限制地址会被拒绝，不应通过放开限制解决导入问题。
- 图片请求必须直接返回 HTTP `200`，当前不跟随重定向。登录页、分享页面或返回 `301/302` 的地址不能替代图片直链。
- 响应 `Content-Type` 必须为 `image/png`、`image/jpeg`、`image/webp`、`image/gif`、`image/avif` 或 `image/svg+xml`，单张图片最多 5,000,000 字节。
- 服务端不会沿用用户浏览器的登录态。图片超限、请求失败或超时会导致 PDF 导出失败，应更换或修正图片链接后再导出。
