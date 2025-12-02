# DDDD OCR WEBJS

基于 [ddddocr](https://github.com/sml2h3/ddddocr) 的浏览器版本，使用 ONNX Runtime Web 在浏览器中识别验证码。

> 由于浏览器的限制以及扩展的限制，模型文件和字符集全部存储与浏览器IndexedDB中，考虑到会浪费大量内存，因此不建议关闭站点白名单使用。
>
> 建议使用场景：单个站点频繁输入验证码/单个站点频繁测试

## ✨ 特性

- 🚀 浏览器内运行，无需后端
- 💾 自动缓存模型到 IndexedDB
- 🌐 支持多个 GitHub 镜像站
- 📦 支持离线模式

## 📦 安装

### 在线安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/)、[Violentmonkey](https://violentmonkey.github.io/)或者[ScriptCat](https://www.scriptcat.org/) 等油猴插件
2. 安装脚本: 在[Greasy Fork](https://greasyfork.org/)脚本市场、[ScriptCat](https://www.scriptcat.org/)脚本市场中搜索 "DDDD OCR WEBJS" 安装
3. 等待脚本加载完毕，打开设置页设置白名单（必须）

### 本地编译安装

1. 下载模型文件:
   - [common.onnx](https://github.com/MakotoArai-CN/ddddocr-webjs/blob/main/public/common.onnx)
   - [charsets.json](https://github.com/MakotoArai-CN/ddddocr-webjs/blob/main/public/charsets.json)
2. 放到你能找到的目录，后续导入到脚本中（需要开启扩展的 **允许访问文件URL** ）
3. 构建: `bun run build`
4. 安装 `dist\ddddocr-web.user.js`
5. 等待脚本加载完毕，打开设置页设置白名单（必须）

## 🛠️ 开发

```bash
# 安装依赖
bun install

# 开发模式
bun run dev

# 构建脚本
bun run build
```

## 📖 使用

1. 访问任意网页
2. 右上角出现 "🔤 DDDD OCR" 面板
3. 点击扩展，找到 "DDDD OCR" 面板的**打开设置**，配置脚本白名单
4. 等待模型加载完毕（首次加载需要下载模型，可能需要几分钟）

## 注意事项

- 默认使用白名单模式，在线下载模型，模型下载可能比较慢，请耐心等待
- 目前1.0.2-beta版本不支持模型/字符集管理，如需清理，请手动删除IndexedDB中的数据
- 项目可能不支持vue/react等前端框架，请等待后续新版本更新支持
- 考虑到编译含有三方库，因此编译后的脚本默认清理了注释，并开启优化，压缩等，如需调试，请注释terser后编译

## Todolist

- [ ]新增浏览器扩展（目前有两个方案：扩展作为Helper,或者扩展完全独立）
- [ ]添加更多设置选项
- [ ]适配vue/react等前端框架
- [x]修正脚本执行顺序，实现模块化
- [ ]支持更多模型

## 📝 许可

MIT License

## 更新日志

- V1.0.2-beta
  - 修复首次加载没有等待验证码加载完毕就开始识别的bug
  - 修改wasm CDN为[cdnjs.cloudflare.com](https://cdnjs.cloudflare.com/ajax/libs/onnxruntime-web/1.17.0/ort.min.js)，提高兼容性
  - 优化代码逻辑，提高可读性

- V1.0.1
  - 修复在任何站点都加载模型的bug
  - 修复程序逻辑，优先加载操作菜单
  - 新增离线上传模型功能
  - 新增更多类别验证码识别支持

- V1.0.0
  - 初版发布
  - 支持ONNX Runtime Web在浏览器中识别验证码

## 📄 鸣谢

- [ddddocr](https://github.com/sml2h3/ddddocr) - 原项目
- [ddddocr-js](https://github.com/J3n5en/ddddocr-js) - JavaScript移植原版项目
- [onnxruntime-web](https://github.com/microsoft/onnxruntime-web) - 模型推理