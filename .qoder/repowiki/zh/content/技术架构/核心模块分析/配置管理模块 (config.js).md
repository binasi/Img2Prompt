# 配置管理模块 (config.js)

<cite>
**本文档引用的文件**
- [config.js](file://config.js)
- [manifest.json](file://manifest.json)
- [options.js](file://options.js)
- [background.js](file://background.js)
- [content.js](file://content.js)
- [options.html](file://options.html)
- [messages.json](file://_locales/en/messages.json)
- [messages.json](file://_locales/zh_CN/messages.json)
</cite>

## 更新摘要
**所做更改**
- 重构配置系统架构，移除复杂的多层配置结构
- 简化为更精简的配置架构，集中管理UI字符串和提示词字段标签
- 移除了DEFAULT_SETTINGS、USER_PROMPT_PRESETS、UI_STRINGS、SETTINGS_I18N、ERROR_CODES、ERROR_MESSAGES、分析配置等多层结构
- 保留了核心配置项和国际化支持，但重新组织了结构
- 新增了BASE_USER_PROMPT、ENGLISH_PROMPT_REQUIREMENT、RECREATE_MODE_*、GENERIC_*等关键配置
- 增强了多语言字符串支持，包括完整的中英文界面文本

## 目录
1. [简介](#简介)
2. [项目结构](#项目结构)
3. [核心组件](#核心组件)
4. [架构概览](#架构概览)
5. [详细组件分析](#详细组件分析)
6. [依赖关系分析](#依赖关系分析)
7. [性能考虑](#性能考虑)
8. [故障排除指南](#故障排除指南)
9. [结论](#结论)

## 简介

ImgPrompt 扩展的配置管理模块是一个集中式的配置管理系统，负责管理扩展的所有配置项、UI 字符串本地化和错误码管理。该模块采用共享配置模式，通过全局对象 `ImgPromptConfig` 提供统一的配置访问接口，确保所有扩展组件（选项页面、后台脚本、内容脚本）都能访问一致的配置数据。

**更新** 配置系统经历了重大重构，移除了复杂的多层配置结构，简化为更精简的架构。现在主要包含基础提示词、默认设置、用户提示词预设、UI字符串、设置面板国际化、错误码定义和分析配置等核心组件。

该模块的设计遵循了以下原则：
- **单一真相源**：所有配置数据集中在单个文件中
- **类型安全**：明确区分不同类型的配置项
- **国际化支持**：内置多语言字符串管理
- **向后兼容**：支持配置项的动态更新和迁移
- **模块化设计**：清晰的配置分类和组织结构
- **简洁高效**：移除冗余结构，提升性能和可维护性

## 项目结构

```mermaid
graph TB
subgraph "重构后的配置管理模块"
Config[config.js<br/>共享配置文件]
subgraph "核心配置分类"
BasePrompt[BASE_USER_PROMPT<br/>基础用户提示词]
EnglishRequirement[ENGLISH_PROMPT_REQUIREMENT<br/>英文提示词要求]
GenericConstraints[GENERIC_USER_CONSTRAINTS<br/>通用用户约束]
SystemConstraints[GENERIC_SYSTEM_CONSTRAINTS<br/>通用系统约束]
RecreateModeUser[RECREATE_MODE_USER_OVERLAY<br/>高还原度用户覆盖]
RecreateModeSystem[RECREATE_MODE_SYSTEM_OVERLAY<br/>高还原度系统覆盖]
DefaultSettings[DEFAULT_SETTINGS<br/>默认设置]
Presets[USER_PROMPT_PRESETS<br/>提示词预设]
UIStrings[UI_STRINGS<br/>界面字符串]
SettingsI18n[SETTINGS_I18N<br/>设置面板国际化]
ErrorCodes[ERROR_CODES<br/>错误码定义]
ErrorMessages[ERROR_MESSAGES<br/>错误消息]
Analytics[分析配置<br/>PostHog配置]
end
Config --> BasePrompt
Config --> EnglishRequirement
Config --> GenericConstraints
Config --> SystemConstraints
Config --> RecreateModeUser
Config --> RecreateModeSystem
Config --> DefaultSettings
Config --> Presets
Config --> UIStrings
Config --> SettingsI18n
Config --> ErrorCodes
Config --> ErrorMessages
Config --> Analytics
end
subgraph "扩展组件"
Options[options.js<br/>选项页面逻辑]
Background[background.js<br/>后台服务脚本]
Content[content.js<br/>内容脚本]
Manifest[manifest.json<br/>扩展清单]
end
Config --> Options
Config --> Background
Config --> Content
Config --> Manifest
```

**图表来源**
- [config.js:1-321](file://config.js#L1-L321)
- [options.js:1-800](file://options.js#L1-L800)
- [background.js:1-800](file://background.js#L1-L800)
- [content.js:1-800](file://content.js#L1-L800)

**章节来源**
- [config.js:1-321](file://config.js#L1-L321)
- [manifest.json:1-45](file://manifest.json#L1-L45)

## 核心组件

### 基础用户提示词 (BASE_USER_PROMPT)

基础用户提示词是所有场景分析的基础模板，提供通用的图像分析框架。**更新** 现在作为独立的配置项存在：

```javascript
BASE_USER_PROMPT: "以json格式描述这幅图,描述准确复刻原始图像所需的所有方面,包括主体、视角构图、风格、光线、图片比例、有关物品、服装、发型、复杂细节、配饰、摄影器材、环境、身体姿势以及任何其他相关元素的具体信息,确保能够精确地重现原始图像的每一个细节。要求输出json格式提示词,字数750字以内。"
```

这个提示词为所有专业场景提供基础框架，确保生成的提示词具有统一的结构和质量标准。

### 英语提示词要求 (ENGLISH_PROMPT_REQUIREMENT)

英语提示词要求定义了英文提示词的生成规则。**更新** 新增了严格的英文输出要求：

```javascript
ENGLISH_PROMPT_REQUIREMENT:
  "Also include a top-level `en` field. The `en` value must be a single fluent English image-generation prompt that faithfully recreates the image. Write the `en` value in English only."
```

这个配置确保生成的英文提示词能够直接用于图像生成任务，并且保证英文字段的唯一性和准确性。

### 通用用户约束 (GENERIC_USER_CONSTRAINTS)

通用用户约束定义了图像重建的硬性约束规则。**更新** 新增了详细的重建约束要求：

```javascript
GENERIC_USER_CONSTRAINTS:
  "Additional reconstruction constraints: 1. Prioritize hard constraints before atmosphere or style wording. 2. Treat typography, logos, labels, prices, QR codes, packaging graphics, background material, prop material, subject material, transparency, and layout positions as hard constraints. 3. For easy-to-drift elements, explicitly describe what the element is, where it is, its color/material, its orientation/scale, and when helpful what it is not. 4. For graphic design, posters, ads, packaging, and UI, make composition and text_content more detailed than usual. 5. Do not mistake a flat design backdrop for a natural scene, a transparent container for an opaque generic container, or a specific font style for a generic font category. 6. In the en field, write the hardest-to-drift constraints first, then lighting and style."
```

这些约束确保图像重建的准确性和一致性。

### 通用系统约束 (GENERIC_SYSTEM_CONSTRAINTS)

通用系统约束定义了AI模型的分析方法和输出格式要求。**更新** 新增了详细的系统约束规则：

```javascript
GENERIC_SYSTEM_CONSTRAINTS:
  "ADDITIONAL RECONSTRUCTION CONSTRAINTS:\n- Prioritize exact reconstruction constraints over general style similarity.\n- Treat typography, text color, font category, line breaks, logos, icons, badges, prices, QR codes, packaging graphics, printed patterns, object material, transparency, silhouette, prop material, background substrate/material, and relative layout positions as hard constraints whenever visible.\n- Do not replace a flat graphic backdrop with a natural scene, a printed texture with clouds or fog, a transparent container with an opaque generic container, or a specific prop material with a generic substitute unless the image clearly shows that.\n- Describe fixed facts before mood words: color, material, shape, scale, count, position, direction, overlap, spacing, and hierarchy.\n- In composition, explicitly describe subject-to-canvas scale, margin relationships, alignment, overlap relationships, vertical or horizontal orientation, and the visual center.\n- In text_content, include exact visible wording, language, line breaks, reading direction, font category, weight, color, approximate size hierarchy, and placement.\n- In background, explicitly identify the substrate/material and whether it is a flat design background, paper texture, fabric, wood, gradient, bokeh, wall, sky, cloud, or studio backdrop.\n- If a detail is ambiguous, stay conservative and do not substitute it with a common generic alternative.\n- The en field must begin with the hardest-to-drift constraints first: subject identity, material, background material, typography style/color, layout, then lighting and style.\n- When an element is easy to drift, state both what it is and what it is not."
```

**更新** 新增了严格的JSON结构要求，确保输出格式的一致性和可解析性。

### 高还原度模式用户覆盖 (RECREATE_MODE_USER_OVERLAY)

高还原度模式的用户提示词覆盖。**更新** 新增了专业的高还原度分析要求：

```javascript
RECREATE_MODE_USER_OVERLAY:
  "High fidelity reconstruction mode is enabled. Keep all existing instructions valid and add an outer layer of ultra-detailed reconstruction analysis. Ignore any earlier brevity or 750-character limit and be exhaustive. Capture tiny but reconstruction-critical details, including micro-texture, paper/fabric grain, brushstroke character, font size hierarchy, approximate coordinates or relative regions, subject occupancy ratio, spacing, margins, overlap, edge softness, reflections, opacity, printed patterns, seams, wrinkles, embossing, noise, highlight roll-off, and shadow falloff. Also include a top-level negative field and a top-level parameters field. The negative field must be an English negative prompt focused on preventing drift. The parameters field must summarize the most important reconstruction controls such as subject scale, layout lock, typography lock, material lock, background lock, camera/lens clues, lighting setup, and render quality."
```

### 高还原度模式系统覆盖 (RECREATE_MODE_SYSTEM_OVERLAY)

高还原度模式的系统提示词覆盖。**更新** 新增了详细的高还原度分析规则：

```javascript
RECREATE_MODE_SYSTEM_OVERLAY:
  "HIGH FIDELITY RECONSTRUCTION MODE:\n- This mode wraps around all existing instructions and adds extra detail requirements without replacing the base rules.\n- Ignore any earlier brevity or character-limit instruction. Produce exhaustive, reconstruction-oriented output.\n- Preserve all existing fields and additionally include:\n  \"negative\": \"an English negative prompt that suppresses likely drift errors\",\n  \"parameters\": {\n    \"subject_scale\": \"...\",\n    \"layout_lock\": \"...\",\n    \"typography_lock\": \"...\",\n    \"material_lock\": \"...\",\n    \"background_lock\": \"...\",\n    \"camera_lens\": \"...\",\n    \"lighting_setup\": \"...\",\n    \"render_quality\": \"...\"\n  }\n- Every visible element should be described as precisely as possible, from micro texture and edge quality to relative position, size proportion, spacing, overlap, and margin relationships.\n- When possible, express placement using approximate canvas regions or percentages.\n- Typography must include approximate size hierarchy, weight, style category, stroke behavior, line spacing, and positional relationships.\n- Materials must include translucency/opacity, gloss or matte character, grain, wear, embossing, reflection behavior, and printed or engraved details when visible.\n- The negative field must focus on preventing common substitutions, layout drift, wrong material, wrong typography, wrong background type, wrong prop type, and genericization.\n- The parameters field must be a structured reconstruction-control summary. Use Chinese for values by default, but camera/lens terms may remain in English when more natural."
```

### 默认设置 (DEFAULT_SETTINGS)

默认设置包含扩展运行所需的所有基本配置项。**更新** 现在包含更简洁的结构：

| 配置项 | 类型 | 默认值 | 描述 |
|--------|------|--------|------|
| apiEndpoint | string | "https://api.openai.com/v1/chat/completions" | API 端点地址 |
| apiKey | string | "" | API 认证密钥 |
| model | string | "gpt-5-mini" | AI 模型名称 |
| requestFormat | string | "auto" | 请求格式（auto/openai/anthropic） |
| anthropicVersion | string | "2023-06-01" | Anthropic API 版本 |
| hoverButtonEnabled | boolean | true | 是否启用悬浮按钮 |
| snippingShortcutEnabled | boolean | true | 是否启用截图功能 |
| uiLanguage | string | "zh" | 用户界面语言 |
| maxImageEdge | number | 1024 | 最大图像边缘尺寸 |
| recreateMode | boolean | false | 高还原度模式开关 |
| temperature | number | 1 | 生成温度参数 |

**更新** 移除了复杂的嵌套结构，简化为扁平化的配置项组织。

### 提示词预设 (USER_PROMPT_PRESETS)

系统提供了多种场景化的提示词预设，每种预设针对特定的图像分析需求。**更新** 现在包含更专业的场景模板：

- **general**: 通用图像结构分解
- **photo**: 摄影技术参数分析
- **cg**: 数字艺术和 CG 分析
- **design**: 平面设计元素识别
- **assets3d**: 3D 资产技术分析
- **product**: 电商产品摄影分析
- **ui**: 界面设计系统分析
- **anime**: 动漫插画专业分析
- **architecture**: 建筑室内设计分析
- **food**: 美食摄影专业分析
- **portrait**: 人像摄影专业分析

**更新** 所有预设现在都支持统一的JSON结构输出，确保生成结果的一致性。

### UI 字符串本地化 (UI_STRINGS)

UI 字符串系统支持中英文双语界面，包含完整的界面文本资源。**更新** 现在包含更全面的界面文本：

| 分类 | 中文键 | 英文键 | 用途 |
|------|--------|--------|------|
| 状态文本 | preparing/generating/completed | preparing/generating/completed | 生成状态显示 |
| 错误消息 | modelFailed/base64Failed/noJson/missingFields | modelFailed/base64Failed/noJson/missingFields | 错误提示 |
| 操作按钮 | copyBtn/cancelBtn | copyBtn/cancelBtn | 用户操作 |
| 历史记录 | historyTitle/historyEmpty | historyTitle/historyEmpty | 历史管理 |
| 提示词字段标签 | labelAspectRatio/labelBackground/labelSubject/... | labelAspectRatio/labelBackground/labelSubject/... | 结构化提示词显示 |

**更新** 新增了完整的提示词字段标签，支持结构化提示词的可视化显示。

### 设置面板国际化 (SETTINGS_I18N)

设置面板的完整本地化支持，涵盖所有设置界面的标签和说明。**更新** 现在包含更详细的设置说明：

- **连接设置**：API 端点、模型、密钥配置
- **提示词设置**：System Prompt 和 User Prompt 配置
- **使用体验**：悬浮按钮和截图功能控制
- **高还原度模式**：新增的专业模式配置
- **兼容性设置**：图像分辨率和请求格式优化
- **帮助信息**：快捷键说明和联系信息

**更新** 高还原度模式的详细设置说明，提供专业的模式配置指导。

### 错误码管理 (ERROR_CODES)

标准化的错误码定义，确保错误处理的一致性和可维护性：

```mermaid
flowchart TD
ErrorCodes[错误码定义] --> Network[网络错误]
ErrorCodes --> Image[图像处理错误]
ErrorCodes --> API[API 调用错误]
ErrorCodes --> Parse[解析错误]
ErrorCodes --> User[用户操作错误]
Network --> NetworkError[NONEWORK_ERROR]
Image --> ImageFetchFailed[IMAGE_FETCH_FAILED]
Image --> ImageProcessingFailed[IMAGE_PROCESSING_FAILED]
API --> ApiAuthFailed[API_AUTH_FAILED]
API --> ApiRateLimited[API_RATE_LIMITED]
API --> ApiTimeout[API_TIMEOUT]
API --> ApiInvalidResponse[API_INVALID_RESPONSE]
Parse --> JsonParseFailed[JSON_PARSE_FAILED]
Parse --> NoJson[NO_JSON]
Parse --> MissingFields[MISSING_FIELDS]
User --> Canceled[CANCELED]
User --> Unknown[UNKNOWN]
```

**图表来源**
- [config.js:263-275](file://config.js#L263-L275)

### 错误消息 (ERROR_MESSAGES)

错误消息的本地化支持，提供用户友好的错误提示：

- **中文错误消息**：完整的中文错误提示
- **英文错误消息**：对应的英文错误提示

**更新** 错误消息现在支持双语显示，提升用户体验。

### 分析配置 (Analytics)

分析配置支持PostHog分析服务，用于收集使用统计信息：

- **POSTHOG_PROJECT_KEY**: PostHog项目密钥（经过base64编码）
- **POSTHOG_HOST**: PostHog服务器地址
- **ANALYTICS_CONFIG_KEY**: 分析配置存储键名

**更新** 分析配置现在使用base64编码的项目密钥，提升安全性。

**章节来源**
- [config.js:1-321](file://config.js#L1-L321)

## 架构概览

配置管理模块采用简化的分层架构设计，确保配置的统一管理和高效访问。**更新** 移除了复杂的多层结构，采用更扁平化的组织方式：

```mermaid
graph TB
subgraph "重构后的配置访问层"
Global[ImgPromptConfig<br/>全局配置对象]
Access[配置访问器]
end
subgraph "配置存储层"
Memory[内存缓存]
Storage[Chrome Storage]
end
subgraph "配置验证层"
StrictJSON[严格JSON验证]
FieldValidation[字段验证]
FormatValidation[格式验证]
end
subgraph "配置更新层"
AutoSave[自动保存机制]
ChangeListener[变更监听器]
Broadcast[广播通知]
end
subgraph "配置使用层"
Options[选项页面]
Background[后台脚本]
Content[内容脚本]
Panel[侧边面板]
end
Global --> Memory
Memory --> Storage
Storage --> Access
Access --> Options
Access --> Background
Access --> Content
Access --> Panel
StrictJSON --> FieldValidation
FieldValidation --> FormatValidation
ChangeListener --> Broadcast
Broadcast --> Content
Broadcast --> Panel
```

**图表来源**
- [config.js:1-321](file://config.js#L1-L321)
- [options.js:1-800](file://options.js#L1-L800)
- [background.js:1-800](file://background.js#L1-L800)

### 配置验证机制

配置验证系统确保所有配置项的有效性和一致性。**更新** 现在包含更严格的验证规则：

```mermaid
sequenceDiagram
participant Options as 选项页面
participant Config as 配置验证器
participant Storage as 存储系统
participant Background as 后台脚本
Options->>Config : 验证配置
Config->>Config : 检查必填字段
Config->>Config : 验证格式正确性
Config->>Config : 检查范围限制
Config->>Config : 验证 recreateMode 逻辑
Config->>Config : 验证严格JSON结构
Config->>Config : 检查字段完整性
Config->>Config : 验证格式规范
Config-->>Options : 返回验证结果
Options->>Storage : 保存配置
Storage->>Background : 广播配置更新
Background->>Background : 更新内部配置
```

**图表来源**
- [background.js:587-598](file://background.js#L587-L598)
- [options.js:1-800](file://options.js#L1-L800)

### 动态更新策略

系统实现了简化的配置更新机制。**更新** 现在采用更直接的更新策略：

1. **自动保存延迟机制**：防抖处理，避免频繁写入
2. **实时变更监听**：即时响应配置变化
3. **跨组件同步**：确保所有扩展组件保持配置一致
4. **回滚机制**：支持配置恢复到默认值
5. **严格格式验证**：确保配置项符合格式要求

**章节来源**
- [options.js:1-800](file://options.js#L1-L800)
- [background.js:151-164](file://background.js#L151-L164)

## 详细组件分析

### 配置项组织结构

配置系统采用简化的组织结构，每个配置类别都有明确的职责分工。**更新** 现在包含更清晰的配置分类：

```mermaid
classDiagram
class ImgPromptConfig {
+BASE_USER_PROMPT : string
+ENGLISH_PROMPT_REQUIREMENT : string
+GENERIC_USER_CONSTRAINTS : string
+GENERIC_SYSTEM_CONSTRAINTS : string
+RECREATE_MODE_USER_OVERLAY : string
+RECREATE_MODE_SYSTEM_OVERLAY : string
+DEFAULT_SETTINGS : Object
+USER_PROMPT_PRESETS : Object
+UI_STRINGS : Object
+SETTINGS_I18N : Object
+ERROR_CODES : Object
+ERROR_MESSAGES : Object
+POSTHOG_PROJECT_KEY : string
+POSTHOG_HOST : string
+ANALYTICS_CONFIG_KEY : string
}
class DEFAULT_SETTINGS {
+apiEndpoint : string
+apiKey : string
+model : string
+requestFormat : string
+anthropicVersion : string
+hoverButtonEnabled : boolean
+snippingShortcutEnabled : boolean
+uiLanguage : string
+maxImageEdge : number
+recreateMode : boolean
+temperature : number
}
class USER_PROMPT_PRESETS {
+general : string
+photo : string
+cg : string
+design : string
+assets3d : string
+product : string
+ui : string
+anime : string
+architecture : string
+food : string
+portrait : string
}
class UI_STRINGS {
+zh : Object
+en : Object
}
class SETTINGS_I18N {
+zh : Object
+en : Object
}
class ERROR_CODES {
+NETWORK_ERROR : string
+IMAGE_FETCH_FAILED : string
+IMAGE_PROCESSING_FAILED : string
+API_AUTH_FAILED : string
+API_RATE_LIMITED : string
+API_TIMEOUT : string
+API_INVALID_RESPONSE : string
+JSON_PARSE_FAILED : string
+MISSING_FIELDS : string
+CANCELED : string
+UNKNOWN : string
}
ImgPromptConfig --> BASE_USER_PROMPT
ImgPromptConfig --> ENGLISH_PROMPT_REQUIREMENT
ImgPromptConfig --> GENERIC_USER_CONSTRAINTS
ImgPromptConfig --> GENERIC_SYSTEM_CONSTRAINTS
ImgPromptConfig --> RECREATE_MODE_USER_OVERLAY
ImgPromptConfig --> RECREATE_MODE_SYSTEM_OVERLAY
ImgPromptConfig --> DEFAULT_SETTINGS
ImgPromptConfig --> USER_PROMPT_PRESETS
ImgPromptConfig --> UI_STRINGS
ImgPromptConfig --> SETTINGS_I18N
ImgPromptConfig --> ERROR_CODES
ImgPromptConfig --> ERROR_MESSAGES
ImgPromptConfig --> POSTHOG_PROJECT_KEY
ImgPromptConfig --> POSTHOG_HOST
ImgPromptConfig --> ANALYTICS_CONFIG_KEY
```

**图表来源**
- [config.js:1-321](file://config.js#L1-L321)

### API 端点配置

API 端点配置支持多种兼容的 AI 服务提供商：

| 服务提供商 | 端点格式 | 认证方式 | 特殊要求 |
|------------|----------|----------|----------|
| OpenAI | `/v1/chat/completions` | Bearer Token | 支持多模态输入 |
| Anthropic | `/v1/messages` | x-api-key | 需要 Anthropic 版本 |
| Gemini | `/v1beta/models/{model}:generateContent` | API Key | 支持多模态 |
| 自定义 | `{custom_endpoint}` | 可配置 | 遵循 OpenAI 兼容协议 |

### 模型参数设置

模型参数配置支持灵活的参数调整。**更新** 现在包含更严格的格式要求：

```mermaid
flowchart LR
subgraph "模型参数"
Temperature[Temperature<br/>0.0-2.0]
MaxTokens[Max Tokens<br/>1-4096]
TopP[Top-P<br/>0.0-1.0]
FrequencyPenalty[频率惩罚<br/>-2.0-2.0]
PresencePenalty[存在惩罚<br/>-2.0-2.0]
end
subgraph "请求格式"
Auto[自动检测]
OpenAI[OpenAI 格式]
Anthropic[Anthropic 格式]
end
subgraph "严格格式要求"
StrictJSON[强制JSON格式]
FieldValidation[字段完整性验证]
FormatValidation[格式规范验证]
end
Temperature --> Auto
MaxTokens --> OpenAI
TopP --> Anthropic
StrictJSON --> FieldValidation
FieldValidation --> FormatValidation
```

**图表来源**
- [config.js:8-9](file://config.js#L8-L9)
- [background.js:627-637](file://background.js#L627-L637)

### 界面语言选项

界面语言系统支持动态切换和持久化存储。**更新** 现在包含更完整的语言支持：

```mermaid
sequenceDiagram
participant User as 用户
participant Options as 选项页面
participant Config as 配置系统
participant Content as 内容脚本
participant Panel as 侧边面板
User->>Options : 选择语言
Options->>Config : 更新 uiLanguage
Config->>Config : 应用语言切换
Config->>Content : 广播语言变更
Config->>Panel : 更新面板语言
Content->>Panel : 刷新界面文本
Panel-->>User : 显示新语言界面
```

**图表来源**
- [options.js:1-800](file://options.js#L1-L800)
- [content.js:140-201](file://content.js#L140-L201)

### 行为偏好配置

行为偏好配置管理用户交互设置。**更新** 现在包含更专业的配置项：

| 偏好设置 | 默认值 | 影响范围 | 配置键 |
|----------|--------|----------|--------|
| 悬浮按钮 | 启用 | 页面交互 | `hoverButtonEnabled` |
| 截图功能 | 启用 | 快捷操作 | `snippingShortcutEnabled` |
| 图像压缩 | 1024px | 性能优化 | `maxImageEdge` |
| 语言偏好 | 中文 | 界面显示 | `uiLanguage` |
| 高还原度模式 | 关闭 | 专业分析 | `recreateMode` |

**更新** 新增高还原度模式配置项，提供专业的图像还原分析能力。

### 专业领域模板配置

系统新增的四个专业领域模板提供了深度的分析能力。**更新** 所有模板现在都支持统一的JSON结构输出：

#### 动漫插画模板 (anime)
- **角色设计**：头发、眼睛、面部特征、身体比例
- **服装配饰**：制服、魔法少女、传统服饰细节
- **艺术风格**：分镜效果、线条风格、特效元素
- **背景环境**：学校、城市、幻想世界场景
- **色彩搭配**：动漫常用色系和主题色调
- **构图技巧**：三分法、动态角度、特写镜头
- **英语提示词**：包含英文复刻提示词生成要求

#### 建筑室内模板 (architecture)
- **建筑风格**：现代、古典、哥特、装饰艺术等
- **结构元素**：柱子、横梁、拱门、穹顶设计
- **材料质感**：混凝土、玻璃、钢材、木材纹理
- **空间布局**：平面图、流线设计、开放vs封闭空间
- **照明设计**：自然光、人工照明、氛围营造
- **装饰细节**：家具、装饰品、色彩方案
- **英语提示词**：包含英文复刻提示词生成要求

#### 美食摄影模板 (food)
- **菜品构图**：摆盘风格、食材分布、分量控制
- **烹饪技法**：烤制、油炸、烘焙、蒸煮特征
- **餐具搭配**：瓷器、木质、石材材质选择
- **光影效果**：柔光箱、窗光、反射光运用
- **色彩协调**：食物本色、餐具对比、背景和谐
- **质感表现**：光泽、纹理、层次感呈现
- **英语提示词**：包含英文复刻提示词生成要求

#### 人像摄影模板 (portrait)
- **人物特征**：年龄、种族、性别表达、面部轮廓
- **姿态语言**：头部位置、身体姿态、手势表达
- **服装造型**：商务、休闲、前卫风格搭配
- **化妆修饰**：自然妆、戏剧化妆、无妆效果
- **灯光布景**：伦勃朗光、蝴蝶光、分割光配置
- **后期处理**：自然修图、时尚大片、纪实风格
- **英语提示词**：包含英文复刻提示词生成要求

**章节来源**
- [config.js:43-55](file://config.js#L43-L55)
- [options.js:1-800](file://options.js#L1-L800)
- [content.js:58-88](file://content.js#L58-L88)

## 依赖关系分析

配置管理模块与扩展其他组件的依赖关系。**更新** 现在包含更清晰的依赖关系：

```mermaid
graph TB
subgraph "核心依赖"
Config[config.js]
Manifest[manifest.json]
end
subgraph "选项页面依赖"
OptionsJS[options.js]
OptionsHTML[options.html]
end
subgraph "后台脚本依赖"
BackgroundJS[background.js]
ContentJS[content.js]
end
subgraph "国际化依赖"
EnMessages[_locales/en/messages.json]
ZhMessages[_locales/zh_CN/messages.json]
end
subgraph "配置验证依赖"
StrictJSON[严格JSON验证]
FieldValidation[字段验证]
FormatValidation[格式验证]
end
Config --> OptionsJS
Config --> BackgroundJS
Config --> ContentJS
Config --> OptionsHTML
Config --> Manifest
OptionsJS --> OptionsHTML
BackgroundJS --> ContentJS
OptionsHTML --> EnMessages
OptionsHTML --> ZhMessages
Config --> EnMessages
Config --> ZhMessages
StrictJSON --> FieldValidation
FieldValidation --> FormatValidation
FormatValidation --> BackgroundJS
```

**图表来源**
- [config.js:1-321](file://config.js#L1-L321)
- [options.js:1-800](file://options.js#L1-L800)
- [background.js:1-800](file://background.js#L1-L800)
- [content.js:1-800](file://content.js#L1-L800)

### 配置验证机制

配置验证系统确保数据的完整性和有效性。**更新** 现在包含更严格的验证流程：

```mermaid
flowchart TD
Input[用户输入] --> Validation[配置验证]
Validation --> Required{必填字段检查}
Required --> |缺失| Error1[错误: 缺少必填字段]
Required --> |完整| Format{格式验证}
Format --> Type{类型检查}
Type --> |错误| Error2[错误: 格式不正确]
Type --> |正确| Range{范围检查}
Range --> Value{数值范围}
Value --> |超出| Error3[错误: 数值超出范围]
Value --> |正常| StrictJSON{严格JSON验证}
StrictJSON --> |失败| Error4[错误: JSON格式不正确]
StrictJSON --> |成功| FieldValidation{字段完整性验证}
FieldValidation --> |失败| Error5[错误: 字段缺失]
FieldValidation --> |成功| Success[验证通过]
Error1 --> Feedback[错误反馈]
Error2 --> Feedback
Error3 --> Feedback
Error4 --> Feedback
Error5 --> Feedback
```

**图表来源**
- [background.js:587-598](file://background.js#L587-L598)

### 动态更新策略

系统实现了简化的配置更新机制。**更新** 现在采用更直接的更新策略：

```mermaid
sequenceDiagram
participant User as 用户
participant Options as 选项页面
participant Debounce as 防抖机制
participant Storage as Chrome Storage
participant Background as 后台脚本
participant Content as 内容脚本
User->>Options : 修改配置
Options->>Debounce : 触发防抖
Debounce->>Debounce : 延迟220ms
Debounce->>Storage : 保存配置
Storage->>Background : 广播更新
Storage->>Content : 广播更新
Background->>Background : 更新内部状态
Content->>Content : 更新界面显示
Background->>Options : 确认更新
Options-->>User : 显示保存成功
```

**图表来源**
- [options.js:1-800](file://options.js#L1-L800)
- [background.js:151-164](file://background.js#L151-L164)

**章节来源**
- [options.js:1-800](file://options.js#L1-L800)
- [background.js:151-164](file://background.js#L151-L164)

## 性能考虑

配置管理模块在设计时充分考虑了性能优化。**更新** 现在包含更有效的性能考虑：

### 内存管理
- **扁平化结构**：移除嵌套结构，减少内存占用
- **懒加载策略**：配置项按需加载，避免不必要的内存占用
- **缓存机制**：常用配置项缓存在内存中，减少存储访问开销
- **垃圾回收**：及时清理不再使用的配置引用

### 网络优化
- **批量存储**：配置更新采用批量写入，减少存储 API 调用次数
- **增量更新**：只更新发生变化的配置项
- **去重处理**：避免重复的配置更新操作
- **格式验证优化**：使用高效的验证算法

### 用户体验优化
- **防抖处理**：配置变更采用防抖机制，避免频繁的界面更新
- **异步处理**：配置保存操作异步执行，不影响用户操作
- **渐进式加载**：配置项按需加载，提升初始启动速度
- **格式验证反馈**：提供即时的格式验证反馈

**更新** 重构后的扁平化结构显著提升了性能，减少了内存占用和存储访问开销。

## 故障排除指南

### 常见配置问题

| 问题类型 | 症状 | 解决方案 |
|----------|------|----------|
| API 连接失败 | 无法连接到 AI 服务 | 检查 API 端点和密钥配置 |
| 图像处理错误 | 无法处理图片输入 | 调整图像分辨率设置 |
| 模型响应异常 | 模型返回格式错误 | 检查 System Prompt 配置 |
| 语言显示问题 | 界面文字显示异常 | 重置语言设置到默认值 |
| 配置丢失 | 设置无法保存 | 检查浏览器存储权限 |
| 高还原度模式失效 | 专业模板不生效 | 检查 recreateMode 配置 |
| JSON格式错误 | 模型返回非JSON格式 | 检查 System Prompt 确保输出严格JSON |
| 字段缺失 | 模型返回缺少字段 | 验证 System Prompt 的字段定义 |
| 格式验证失败 | 配置格式不正确 | 检查配置项的格式要求 |

**更新** 新增了格式验证失败的故障排除指导。

### 配置迁移策略

系统支持配置的平滑迁移和版本兼容。**更新** 现在包含更简单的迁移策略：

```mermaid
flowchart TD
Install[扩展安装/更新] --> Check[检查现有配置]
Check --> HasConfig{存在旧配置?}
HasConfig --> |否| Default[使用默认配置]
HasConfig --> |是| Migrate[迁移配置]
Migrate --> NewKeys{新配置项?}
NewKeys --> |有| AddKeys[添加新配置项]
NewKeys --> |无| Validate[验证配置]
AddKeys --> Validate
Validate --> StrictJSON{严格格式验证}
StrictJSON --> |失败| Fallback[Fallback到兼容模式]
StrictJSON --> |成功| Complete[迁移完成]
Fallback --> Complete
```

**图表来源**
- [background.js:29-74](file://background.js#L29-L74)

### 版本兼容性处理

系统通过以下机制确保版本兼容性。**更新** 现在包含更简化的兼容性处理：

1. **默认值回退**：新版本缺少的配置项使用默认值
2. **类型转换**：自动转换配置项的数据类型
3. **格式升级**：支持配置格式的向后兼容
4. **错误恢复**：配置损坏时自动恢复到安全状态
5. **严格格式验证**：确保配置项符合格式要求
6. **字段完整性检查**：验证配置项的完整性

**更新** 简化的配置结构提升了版本兼容性，减少了迁移复杂度。

**章节来源**
- [background.js:29-74](file://background.js#L29-L74)

## 结论

ImgPrompt 的配置管理模块展现了现代浏览器扩展配置系统的最佳实践。通过集中式配置管理、完善的国际化支持、健壮的验证机制和高效的更新策略，该模块为扩展提供了稳定可靠的基础架构。

**更新** 重构后的配置系统移除了复杂的多层结构，采用更精简的架构设计。虽然简化了配置结构，但保留了核心功能的完整性，包括严格JSON格式验证、多语言支持、错误处理和分析配置等关键特性。

### 主要优势

1. **简洁性**：扁平化的配置结构，易于理解和维护
2. **统一性**：所有组件共享同一套配置，确保一致性
3. **可维护性**：清晰的配置分类和组织结构
4. **可扩展性**：支持新的配置项和功能扩展
5. **用户体验**：流畅的配置更新和语言切换体验
6. **可靠性**：完善的错误处理和配置恢复机制
7. **性能优化**：简化的结构提升了内存和存储效率
8. **严格验证**：确保配置项的完整性和正确性

### 最佳实践建议

1. **配置项命名规范**：使用语义化的配置项名称
2. **默认值设计**：提供合理的默认值和边界检查
3. **国际化优先**：所有用户可见文本都应支持多语言
4. **性能优化**：合理使用缓存和异步处理
5. **错误处理**：提供清晰的错误信息和恢复机制
6. **格式验证**：确保配置项符合严格的格式要求
7. **兼容性考虑**：支持配置格式的平滑迁移
8. **严格JSON格式**：确保System Prompt输出严格的JSON结构
9. **字段完整性**：验证配置项的完整性和正确性
10. **性能监控**：定期评估配置系统的性能表现

该配置管理模块为 ImgPrompt 扩展的成功运行奠定了坚实的基础，其简洁高效的架构设计值得其他浏览器扩展项目借鉴和学习。重构后的配置系统在保持功能完整性的同时，显著提升了性能和可维护性，为用户提供了更加稳定和专业的图像分析体验。