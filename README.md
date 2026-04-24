# Img2Prompt

> 🖼️ 将图片转化为高质量 Prompt 的 Chrome 扩展

## 📖 项目简介

Img2Prompt 是一款 Chrome 浏览器扩展，能够智能分析图片内容并生成详细的 AI 绘画提示词（Prompt）。支持多种 AI 模型，包括 OpenAI 和 Anthropic Claude，帮助你快速从图片中提取灵感。

## ✨ 核心功能

- **🔍 智能图片分析**：自动识别图片内容、风格、构图等元素
- **🤖 多模型支持**：兼容 OpenAI 和 Anthropic Claude API
- **⌨️ 快捷键操作**：使用 `Alt+S` 快速捕获截图并生成 Prompt
- **📋 提示词优化**：支持高保真重建模式，生成结构化 JSON 格式提示词
- **⚙️ 灵活配置**：可自定义 API 端点、模型参数、提示词模板
- **💾 历史记录**：保存分析历史，方便回顾和复用
- **🌐 多语言支持**：支持中文和英文界面

## 🚀 快速开始

### 安装方式

#### 方式一：从 Chrome Web Store 安装
（待上架）

#### 方式二：开发者模式加载
1. 克隆或下载本项目
2. 打开 Chrome 浏览器，访问 `chrome://extensions/`
3. 启用右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择本项目所在文件夹

### 配置步骤

1. 点击浏览器工具栏中的 Img2Prompt 图标
2. 在侧边栏中打开设置页面
3. 配置你的 API 密钥：
   - **OpenAI**：输入 API Key 和端点（可选）
   - **Anthropic Claude**：输入 API Key 和端点（可选）
4. 选择默认使用的 AI 模型
5. 根据需要调整其他参数（温度、最大 token 等）

## 📱 使用方法

### 方式一：快捷键
1. 在任意网页按 `Alt+S`
2. 等待图片分析和 Prompt 生成
3. 复制生成的提示词

### 方式二：右键菜单
1. 在网页图片上右键点击
2. 选择"分析此图片"
3. 查看生成的 Prompt

### 方式三：手动上传
1. 点击扩展图标打开侧边栏
2. 上传本地图片
3. 等待分析结果

## 🛠️ 技术栈

- **Manifest V3**：最新版 Chrome 扩展架构
- **原生 JavaScript**：无依赖，轻量高效
- **Chrome Extension APIs**：
  - `chrome.storage` - 配置和数据持久化
  - `chrome.sidePanel` - 侧边栏界面
  - `chrome.contextMenus` - 右键菜单集成
  - `chrome.activeTab` - 当前页面访问

## 📂 项目结构

```
Img2Prompt/
├── manifest.json      # 扩展配置文件
├── background.js      # 后台服务（AI 模型调用、图片处理）
├── content.js         # 内容脚本（页面交互、截图捕获）
├── config.js          # 配置管理（设置读写、默认值）
├── options.html       # 设置页面 UI
├── options.js         # 设置页面逻辑
├── _locales/          # 国际化文件
│   ├── en/
│   └── zh_CN/
└── icon/              # 扩展图标
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## ⚙️ 高级配置

### 支持的 AI 模型

#### OpenAI 兼容接口
- GPT-4V
- GPT-4 Turbo with Vision
- 其他兼容 OpenAI API 的模型

#### Anthropic Claude
- Claude 3 Opus
- Claude 3 Sonnet
- Claude 3 Haiku

### 提示词模式

- **标准模式**：简洁描述图片内容
- **高保真重建模式**：详细结构化描述，包含构图、色彩、风格等，适合精确还原

### 可配置参数

- API 端点地址
- 模型选择
- 温度（Temperature）
- 最大 Token 数
- 系统提示词模板
- 输出语言偏好

## 🔐 隐私与安全

- 🔒 API 密钥仅存储在本地浏览器中
- 🛡️ 不收集任何用户数据
- 📡 图片仅发送至用户配置的 API 端点
- 🔍 开源代码，透明可审查

## 🐛 常见问题

### Q: 为什么推送失败？
A: 检查 API Key 是否正确，网络连接是否正常。

### Q: 支持哪些图片格式？
A: 支持 JPG、PNG、WebP、GIF 等常见格式。

### Q: 可以自定义提示词格式吗？
A: 可以在设置页面修改系统提示词模板。

### Q: 如何使用高保真模式？
A: 在设置中启用"高还原度模式"，会生成更详细的结构化提示词。

## 📝 更新日志

### v1.0.0
- ✨ 初始版本发布
- 🤖 支持 OpenAI 和 Claude 模型
- 🎨 高保真重建模式
- ⌨️ 快捷键支持（Alt+S）
- 💾 历史记录功能
- 🌐 中英文双语支持
- ⚙️ 完整的配置管理

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 📮 联系方式

- 项目地址：[https://github.com/binasi/Img2Prompt](https://github.com/binasi/Img2Prompt)
- 问题反馈：[Issues](https://github.com/binasi/Img2Prompt/issues)

---

⭐ 如果这个项目对你有帮助，欢迎 Star！
