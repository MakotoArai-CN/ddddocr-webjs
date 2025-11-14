# DDDD OCR WEBJS

基于 [ddddocr](https://github.com/sml2h3/ddddocr) 的浏览器版本，使用 ONNX Runtime Web 在浏览器中识别验证码。

## ✨ 特性

- 🚀 浏览器内运行，无需后端
- 💾 自动缓存模型到 IndexedDB
- 🌐 支持多个 GitHub 镜像站
- 📦 支持离线模式
- 📋 自动复制识别结果
- 🎨 美观的拖拽式 UI

## 📦 安装

### 在线版（推荐）

1. 安装 [Tampermonkey](https://www.tampermonkey.net/)、[Violentmonkey](https://violentmonkey.github.io/)或者[ScriptCat](https://www.scriptcat.org/) 等油猴插件
2. 安装脚本: 在[Greasy Fork](https://greasyfork.org/)脚本市场、[ScriptCat](https://www.scriptcat.org/)脚本市场中搜索 "DDDD OCR WEBJS" 安装
3. 等待脚本加载完毕，打开设置页设置白名单（必须）

### 离线版

1. 下载模型文件:
   - [common.onnx](https://github.com/J3n5en/ddddocr-js/raw/main/onnx/common.onnx)
   - [charsets.json](https://github.com/J3n5en/ddddocr-js/raw/main/onnx/charsets.json)
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

## Todolist

* [ ]修正脚本执行顺序，实现模块化
* [ ]支持更多模型

## 📝 许可

MIT License

## 📄 鸣谢

- [ddddocr](https://github.com/sml2h3/ddddocr) - 原项目
- [ddddocr-js](https://github.com/J3n5en/ddddocr-js) - JavaScript移植原版项目
- [onnxruntime-web](https://github.com/microsoft/onnxruntime-web) - 模型推理