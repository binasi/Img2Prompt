// Shared configuration for ImgPrompt extension.
// Loaded as a classic script so it can be reused by options pages and service workers.

globalThis.ImgPromptConfig = {
  // 基础提示词 - 始终使用
  BASE_USER_PROMPT: "以json格式描述这幅图,描述准确复刻原始图像所需的所有方面,包括主体、视角构图、风格、光线、图片比例、有关物品、服装、发型、复杂细节、配饰、摄影器材、环境、身体姿势以及任何其他相关元素的具体信息,确保能够精确地重现原始图像的每一个细节。要求输出json格式提示词,字数750字以内。",

  ENGLISH_PROMPT_REQUIREMENT:
    "Also include a top-level `en` field. The `en` value must be a single fluent English image-generation prompt that faithfully recreates the image. Write the `en` value in English only.",

  GENERIC_USER_CONSTRAINTS:
    "Additional reconstruction constraints: 1. Prioritize hard constraints before atmosphere or style wording. 2. Treat typography, logos, labels, prices, QR codes, packaging graphics, background material, prop material, subject material, transparency, and layout positions as hard constraints. 3. For easy-to-drift elements, explicitly describe what the element is, where it is, its color/material, its orientation/scale, and when helpful what it is not. 4. For graphic design, posters, ads, packaging, and UI, make composition and text_content more detailed than usual. 5. Do not mistake a flat design backdrop for a natural scene, a transparent container for an opaque generic container, or a specific font style for a generic font category. 6. In the en field, write the hardest-to-drift constraints first, then lighting and style.",

  GENERIC_SYSTEM_CONSTRAINTS:
    "ADDITIONAL RECONSTRUCTION CONSTRAINTS:\n- Prioritize exact reconstruction constraints over general style similarity.\n- Treat typography, text color, font category, line breaks, logos, icons, badges, prices, QR codes, packaging graphics, printed patterns, object material, transparency, silhouette, prop material, background substrate/material, and relative layout positions as hard constraints whenever visible.\n- Do not replace a flat graphic backdrop with a natural scene, a printed texture with clouds or fog, a transparent container with an opaque generic container, or a specific prop material with a generic substitute unless the image clearly shows that.\n- Describe fixed facts before mood words: color, material, shape, scale, count, position, direction, overlap, spacing, and hierarchy.\n- In composition, explicitly describe subject-to-canvas scale, margin relationships, alignment, overlap relationships, vertical or horizontal orientation, and the visual center.\n- In text_content, include exact visible wording, language, line breaks, reading direction, font category, weight, color, approximate size hierarchy, and placement.\n- In background, explicitly identify the substrate/material and whether it is a flat design background, paper texture, fabric, wood, gradient, bokeh, wall, sky, cloud, or studio backdrop.\n- If a detail is ambiguous, stay conservative and do not substitute it with a common generic alternative.\n- The en field must begin with the hardest-to-drift constraints first: subject identity, material, background material, typography style/color, layout, then lighting and style.\n- When an element is easy to drift, state both what it is and what it is not.",

  RECREATE_MODE_USER_OVERLAY:
    "High fidelity reconstruction mode is enabled. Keep all existing instructions valid and add an outer layer of ultra-detailed reconstruction analysis. Ignore any earlier brevity or 750-character limit and be exhaustive. Capture tiny but reconstruction-critical details, including micro-texture, paper/fabric grain, brushstroke character, font size hierarchy, approximate coordinates or relative regions, subject occupancy ratio, spacing, margins, overlap, edge softness, reflections, opacity, printed patterns, seams, wrinkles, embossing, noise, highlight roll-off, and shadow falloff. Also include a top-level negative field and a top-level parameters field. The negative field must be an English negative prompt focused on preventing drift. The parameters field must summarize the most important reconstruction controls such as subject scale, layout lock, typography lock, material lock, background lock, camera/lens clues, lighting setup, and render quality.",

  RECREATE_MODE_SYSTEM_OVERLAY:
    "HIGH FIDELITY RECONSTRUCTION MODE:\n- This mode wraps around all existing instructions and adds extra detail requirements without replacing the base rules.\n- Ignore any earlier brevity or character-limit instruction. Produce exhaustive, reconstruction-oriented output.\n- Preserve all existing fields and additionally include:\n  \"negative\": \"an English negative prompt that suppresses likely drift errors\",\n  \"parameters\": {\n    \"subject_scale\": \"...\",\n    \"layout_lock\": \"...\",\n    \"typography_lock\": \"...\",\n    \"material_lock\": \"...\",\n    \"background_lock\": \"...\",\n    \"camera_lens\": \"...\",\n    \"lighting_setup\": \"...\",\n    \"render_quality\": \"...\"\n  }\n- Every visible element should be described as precisely as possible, from micro texture and edge quality to relative position, size proportion, spacing, overlap, and margin relationships.\n- When possible, express placement using approximate canvas regions or percentages.\n- Typography must include approximate size hierarchy, weight, style category, stroke behavior, line spacing, and positional relationships.\n- Materials must include translucency/opacity, gloss or matte character, grain, wear, embossing, reflection behavior, and printed or engraved details when visible.\n- The negative field must focus on preventing common substitutions, layout drift, wrong material, wrong typography, wrong background type, wrong prop type, and genericization.\n- The parameters field must be a structured reconstruction-control summary. Use Chinese for values by default, but camera/lens terms may remain in English when more natural.",

  DEFAULT_SETTINGS: {
    apiEndpoint: "https://api.openai.com/v1/chat/completions",
    apiKey: "",
    model: "gpt-5-mini",
    requestFormat: "auto",
    anthropicVersion: "2023-06-01",
    hoverButtonEnabled: true,
    snippingShortcutEnabled: true,
    uiLanguage: "zh",
    maxImageEdge: 1024,
    recreateMode: false,
    _legacySystemPrompt:
      "You are an expert reverse prompt engineer specializing in ultra-accurate image recreation. You must analyze every visual element of the image with extreme precision and output a structured JSON that enables exact reproduction.\n\nANALYSIS METHODOLOGY:\nDeconstruct the image layer by layer like a forensic analyst:\n1. First identify the OVERALL type, format, and aspect ratio\n2. Then analyze BACKGROUND from top to bottom\n3. Then MAIN SUBJECT(S) - appearance, clothing, posture, expression in detail\n4. Then SURROUNDING ELEMENTS - objects, decorations, flora/fauna\n5. Then TEXT CONTENT - every visible text, its position, font style, color\n6. Then VISUAL STYLE, LIGHTING, and COLOR PALETTE\n\nOUTPUT FORMAT (STRICT JSON STRUCTURE):\n{\n  \"image_type\": \"图片类型描述（如：竖版手机端商业宣传海报/横版风景摄影/正方形社交媒体图片等）\",\n  \"aspect_ratio\": \"宽高比（如：9:16, 16:9, 1:1, 4:3等）\",\n  \"background\": \"背景的完整描述，包括颜色渐变、纹理、层次等\",\n  \"subject\": {\n    \"identity\": \"主体身份描述\",\n    \"appearance\": \"外貌细节：脸型、表情、发型发色、妆容等\",\n    \"clothing\": \"服装细节：款式、颜色、材质、纹样、配饰等\",\n    \"posture\": \"身体姿势、动作、手势、朝向等\",\n    \"position\": \"主体在画面中的位置\"\n  },\n  \"surrounding_elements\": \"环绕主体的元素：物品、装饰、花草等，描述其位置和细节\",\n  \"composition\": \"构图方式：视角（平视/仰视/俯视）、透视、前后景关系、视觉引导线等\",\n  \"text_content\": \"画面中所有可见文字内容，包括位置、颜色、字体风格\",\n  \"style\": \"艺术风格：手绘/摄影/3D渲染/插画等，具体流派和技法\",\n  \"lighting\": \"光线描述：光源方向、强度、色温、阴影、高光等\",\n  \"color_palette\": \"色彩方案：主色调、辅助色、整体色调氛围\"\n}\n\nCRITICAL RULES:\n- Output ONLY the JSON object, no markdown code blocks, no extra text before or after\n- Each structured field must contain SPECIFIC details from THIS image, not generic descriptions\n- subject sub-fields must describe WHAT YOU ACTUALLY SEE, not categories\n- Every detail matters for exact recreation - position, color, size, texture, style\n- If the image contains text, describe each text element's content, position, color, and font style\n- DO NOT include zh, en, negative_zh, negative_en, negative, parameters fields - only visual analysis fields above",
    userPrompt:
      "分析这幅图的每一个视觉细节，以结构化JSON格式输出，确保能精确复刻原图。\n\n必须包含以下字段：\n- image_type: 图片类型（如竖版海报/横版风景照等）\n- aspect_ratio: 宽高比\n- background: 背景完整描述\n- subject: 主体对象（含identity/appearance/clothing/posture/position子字段）\n- surrounding_elements: 环绕元素及位置\n- composition: 构图与视角\n- text_content: 所有可见文字内容、位置、颜色、字体风格\n- style: 艺术风格与技法\n- lighting: 光线方向、色温、阴影\n- color_palette: 主色调与配色方案\n\n关键要求：\n- 每个结构化字段必须写THIS图的具体内容，不要泛泛而谈\n- subject子字段要描述你实际看到的细节（什么发型、什么颜色、什么材质）\n- 画面中的文字必须逐个描述：内容、位置、颜色、字体风格\n- 只输出纯JSON，不加markdown代码块\n- 不要包含zh、en、negative_zh、negative_en、negative、parameters字段",
    systemPrompt:
      "You are an expert reverse prompt engineer specializing in ultra-accurate image recreation. Analyze the image with forensic precision and output strict JSON only.\n\nReturn this exact top-level schema:\n{\n  \"image_type\": \"...\",\n  \"aspect_ratio\": \"...\",\n  \"background\": \"...\",\n  \"subject\": {\n    \"identity\": \"...\",\n    \"appearance\": \"...\",\n    \"clothing\": \"...\",\n    \"posture\": \"...\",\n    \"position\": \"...\"\n  },\n  \"surrounding_elements\": \"...\",\n  \"composition\": \"...\",\n  \"text_content\": \"...\",\n  \"style\": \"...\",\n  \"lighting\": \"...\",\n  \"color_palette\": \"...\",\n  \"en\": \"...\"\n}\n\nRules:\n- Output JSON only. No markdown, no prose outside the JSON object.\n- Fill every structured field with image-specific details from this exact image.\n- Describe visible text with its content, position, color, and font style when present.\n- The top-level `en` field must be a single fluent English image-generation prompt that can be used directly for recreation.\n- Write the `en` field in English only.\n- Do not include zh, negative_zh, negative_en, negative, or parameters fields.",
    temperature: 1
  },

  USER_PROMPT_PRESETS: {
    general: "Perform a comprehensive structural breakdown of this image for exact recreation. Output a structured JSON with these fields:\n\n- image_type: 图片类型\n- aspect_ratio: 宽高比\n- background: 背景完整描述\n- subject: {identity, appearance, clothing, posture, position}\n- surrounding_elements: 环绕元素\n- composition: 构图与视角\n- text_content: 所有可见文字\n- style: 艺术风格\n- lighting: 光线\n- color_palette: 色彩方案\n\nFocus on: subject details, composition, lighting, color palette, materials/textures, background, artistic style, quality aspects, emotion/atmosphere, technical specs. Output ONLY the JSON, no markdown. DO NOT include zh/en/negative_zh/negative_en/negative/parameters fields.",
    photo: "Analyze this photograph for exact recreation. Output a structured JSON with these fields:\n\n- image_type: 摄影类型\n- aspect_ratio: 宽高比\n- background: 背景与环境\n- subject: {identity, appearance, clothing, posture, position}\n- surrounding_elements: 环绕元素\n- composition: 构图(三分法/引导线/对称)与视角\n- text_content: 画面文字(如有)\n- style: 摄影/纪实风格\n- lighting: 光线(主光/补光/轮廊光/自然光/人造光)\n- color_palette: 色彩(色温/调色/LUT/胶片模拟)\n\nFocus on: camera settings (focal length, aperture), lens characteristics, lighting rig, color grading, sensor grain, composition techniques, depth of field. Output ONLY the JSON, no markdown. DO NOT include zh/en/negative_zh/negative_en/negative/parameters fields.",
    cg: "Deconstruct this digital artwork for exact recreation. Output a structured JSON with these fields:\n\n- image_type: 数字艺术类型\n- aspect_ratio: 宽高比\n- background: 背景描述\n- subject: {identity, appearance, clothing, posture, position}\n- surrounding_elements: 装饰与环绕元素\n- composition: 构图与视觉流动\n- text_content: 画面文字(如有)\n- style: 艺术风格(印象派/新艺术/赛博朋克等)与技法\n- lighting: 光线(全局光照/次表面散射/体积光)\n- color_palette: 色彩方案(互补/类比/三色调和)\n\nFocus on: artistic medium, brushwork, rendering pipeline, stylistic influences, texture quality, atmospheric effects. Output ONLY the JSON, no markdown. DO NOT include zh/en/negative_zh/negative_en/negative/parameters fields.",
    design: "Analyze this graphic design for exact recreation. Output a structured JSON with these fields:\n\n- image_type: 设计类型\n- aspect_ratio: 宽高比\n- background: 背景与留白\n- subject: {identity: 主视觉元素, appearance: 形态, clothing: N/A, posture: N/A, position: 位置}\n- surrounding_elements: 辅助图形元素\n- composition: 网格/排版/视觉层级\n- text_content: 所有文字内容、字体、大小、颜色、位置\n- style: 设计风格(包豪斯/瑞士风格/极简/粗野主义等)\n- lighting: N/A或特殊光影效果\n- color_palette: 色彩系统(主色/辅色/强调色/对比度)\n\nFocus on: typographic system, grid structure, color system, layout composition, graphic elements, white space, design movement, branding. Output ONLY the JSON, no markdown. DO NOT include zh/en/negative_zh/negative_en/negative/parameters fields.",
    assets3d: "Examine this 3D asset for exact recreation. Output a structured JSON with these fields:\n\n- image_type: 3D资产类型\n- aspect_ratio: 宽高比\n- background: 背景环境\n- subject: {identity: 资产类型, appearance: 外观/拓扑, clothing: 材质/PBR, posture: 姿态/变形, position: 场景位置}\n- surrounding_elements: 场景辅助元素\n- composition: 视角与构图\n- text_content: N/A\n- style: 渲染风格\n- lighting: 灯光设置(三点布光/HDRI/IBL)\n- color_palette: 材质色彩\n\nFocus on: topology, PBR materials, surface imperfections, silhouette, UV mapping, render settings. Output ONLY the JSON, no markdown. DO NOT include zh/en/negative_zh/negative_en/negative/parameters fields.",
    product: "Evaluate this product photography for exact recreation. Output a structured JSON with these fields:\n\n- image_type: 产品摄影类型\n- aspect_ratio: 宽高比\n- background: 背景(影室白/生活场景/纯色)\n- subject: {identity: 产品类型, appearance: 外观细节, clothing: 包装/标签, posture: 展示角度, position: 画面位置}\n- surrounding_elements: 道具与装饰\n- composition: 构图(英雄照/平铺/等轴)\n- text_content: 品牌/标签文字\n- style: 商业摄影风格\n- lighting: 灯光(主光/补光/轮廊光/柔光箱)\n- color_palette: 色彩(产品色/背景色/整体色调)\n\nFocus on: material premiumness, macro details, branding, commercial staging. Output ONLY the JSON, no markdown. DO NOT include zh/en/negative_zh/negative_en/negative/parameters fields.",
    ui: "Deconstruct this UI/UX design for exact recreation. Output a structured JSON with these fields:\n\n- image_type: UI设计类型\n- aspect_ratio: 宽高比\n- background: 背景色/表面色\n- subject: {identity: 主功能模块, appearance: 组件外观, clothing: N/A, posture: 交互状态, position: 布局位置}\n- surrounding_elements: 辅助组件/导航/操作项\n- composition: 布局架构(网格/响应式/容器)\n- text_content: 所有UI文字内容、字体、层级\n- style: 设计风格(毛玻璃/新拟态/扁平/拟物/Bento Grid/SaaS极简)\n- lighting: 阴影/投影/模态层级\n- color_palette: 设计令牌(主色/辅色/语义色/表面色/文字色)\n\nFocus on: component library, design tokens, layout architecture, interface style, state variations, platform context. Output ONLY the JSON, no markdown. DO NOT include zh/en/negative_zh/negative_en/negative/parameters fields.",
    anime: "Analyze this anime/manga illustration for exact recreation. Output a structured JSON with these fields:\n\n- image_type: 动漫插画类型\n- aspect_ratio: 宽高比\n- background: 背景场景\n- subject: {identity: 角色类型, appearance: 发型/发色/眼型/瞳色/脸型/腮红/表情, clothing: 服装/配饰/鞋, posture: 姿势/手势/体态, position: 画面位置}\n- surrounding_elements: 特效/装饰(闪光/气场/速度线)\n- composition: 构图与视角\n- text_content: 画面文字(如有)\n- style: 动漫风格(赛璐珞/渐变/手绘)与工作室风格暗示\n- lighting: 光线(柔光/逆光/特效光)\n- color_palette: 色彩(鲜艳/柔和/单色/季节主题)\n\nFocus on: character design details, anime tropes, art style, quality tags. Output ONLY the JSON, no markdown. DO NOT include zh/en/negative_zh/negative_en/negative/parameters fields.",
    architecture: "Analyze this architectural/interior design for exact recreation. Output a structured JSON with these fields:\n\n- image_type: 建筑/室内设计类型\n- aspect_ratio: 宽高比\n- background: 环境与景观\n- subject: {identity: 建筑类型, appearance: 建筑外观/立面/材质, clothing: N/A, posture: 空间形态/结构, position: 视角位置}\n- surrounding_elements: 家具/装饰/绿化/景观\n- composition: 视角(平视/鸟瞰/虫视/一点透视/两点透视)\n- text_content: N/A\n- style: 建筑风格(现代/古典/哥特/装饰艺术/粗野主义/极简)\n- lighting: 光线(自然光/人工照明/氛围光)\n- color_palette: 色彩方案(墙面/强调/材质色调)\n\nFocus on: architectural style, structural elements, materials, spatial layout, lighting design. Output ONLY the JSON, no markdown. DO NOT include zh/en/negative_zh/negative_en/negative/parameters fields.",
    food: "Analyze this food photography for exact recreation. Output a structured JSON with these fields:\n\n- image_type: 美食摄影类型\n- aspect_ratio: 宽高比\n- background: 背景/餐桌/场景\n- subject: {identity: 菜品类型, appearance: 摆盘/配料/酱汁/质感, clothing: 餐具/器皿, posture: 拍摄角度/展示方式, position: 画面位置}\n- surrounding_elements: 装饰道具/配料散布/餐具/花卉/织物\n- composition: 构图(俯拍/45度/平视/微距)\n- text_content: N/A\n- style: 美食摄影风格(杂志/社交媒体/餐厅/家居)\n- lighting: 光线(柔光箱/自然光/窗光/反射)\n- color_palette: 色彩(食物色/餐具色/背景色/互补色)\n\nFocus on: plating, textures, steam, drips, glaze, depth of field, styling props. Output ONLY the JSON, no markdown. DO NOT include zh/en/negative_zh/negative_en/negative/parameters fields.",
    portrait: "Analyze this portrait photograph for exact recreation. Output a structured JSON with these fields:\n\n- image_type: 人像摄影类型\n- aspect_ratio: 宽高比\n- background: 背景(影室/外景/建筑/室内)\n- subject: {identity: 人物特征, appearance: 脸型/五官/发色/发型/表情/妆容, clothing: 服装风格/配饰/珠宝/眼镜, posture: 头部角度/身体朝向/手部姿势/站坐姿态, position: 画面位置}\n- surrounding_elements: 道具/环境元素\n- composition: 构图(伦勃朗光/蝴蝶光/分割光/环形光)\n- text_content: N/A\n- style: 人像风格(商业/纪实/时尚/艺术)\n- lighting: 灯光(影室/自然/混合, 柔光/硬光/漫射, 光比/高调/低调)\n- color_palette: 色彩(暖调/冷调/胶片/电影/现代)\n\nFocus on: facial features, expression, pose, lighting setup, camera & lens, color grading, retouching level, mood. Output ONLY the JSON, no markdown. DO NOT include zh/en/negative_zh/negative_en/negative/parameters fields."
  },

  UI_STRINGS: {
    zh: {
      preparing: "准备中",
      locatingImage: "正在定位图片",
      generating: "生成中",
      completed: "已完成",
      generationComplete: "生成完成",
      subtitle: "图片转提示词",
      stopped: "已停止",
      stopGeneration: "已停止生成",
      failed: "失败",
      generationFailed: "生成失败",
      waitingToStart: "等待开始",
      stopButton: "停止生成",
      placeholder: "生成后的提示词会显示在这里，可直接修改。",
      zhBtn: "中文",
      enBtn: "English",
      copyBtn: "复制",
      copied: "已复制",
      copyFailed: "复制失败，请检查剪贴板权限。",
      dragCard: "拖动卡片",
      closeHover: "关闭悬浮按钮",
      unknownError: "发生未知错误",
      imageLoading: "图片加载中...",
      fetchingImage: "正在获取图片",
      callingModel: "正在调用模型",
      organizingPrompts: "正在整理提示词",
      fetchFailed: "未能获取图片内容，请尝试在图片加载完成后重试。",
      modelFailed: "模型请求失败",
      emptyContent: "模型返回内容为空，无法生成提示词。",
      noJson: "模型返回的不是有效 JSON，请调整 system prompt 后重试。",
      missingFields: "模型返回缺少 zh/en 字段。",
      base64Failed: "图片处理失败：无法获取图片的二进制数据进行 AI 分析。请尝试换一张图或检查网络连接。",
      historyTitle: "历史记录",
      historyEmpty: "暂无历史记录",
      historyClear: "清空全部",
      historyCopy: "复制",
      historyDelete: "删除",
      historyCopied: "已复制",
      historyLoaded: "已复制到剪贴板 ✓",
      // Prompt field labels
      labelAspectRatio: "宽高比",
      labelBackground: "背景",
      labelSubject: "主体",
      labelSurroundingElements: "环绕元素",
      labelComposition: "构图",
      labelTextContent: "文字",
      labelStyle: "风格",
      labelLighting: "光线",
      labelColorPalette: "色彩"
    },
    en: {
      preparing: "Preparing",
      locatingImage: "Locating image",
      generating: "Generating",
      completed: "Completed",
      generationComplete: "Generation complete",
      subtitle: "Image to Prompt",
      stopped: "Stopped",
      stopGeneration: "Generation stopped",
      failed: "Failed",
      generationFailed: "Generation failed",
      waitingToStart: "Waiting to start",
      stopButton: "Stop generation",
      placeholder: "Generated prompts will appear here. You can edit them directly.",
      zhBtn: "ZH",
      enBtn: "EN",
      copyBtn: "Copy",
      copied: "Copied",
      copyFailed: "Copy failed. Please check clipboard permissions.",
      dragCard: "Drag to move",
      closeHover: "Close hover button",
      unknownError: "Unknown error occurred",
      imageLoading: "Loading image...",
      fetchingImage: "Fetching image",
      callingModel: "Calling model",
      organizingPrompts: "Organizing prompts",
      fetchFailed: "Failed to fetch image. Please try again after the image has fully loaded.",
      modelFailed: "Model request failed",
      emptyContent: "Model returned empty content. Failed to generate prompts.",
      noJson: "Model returned invalid JSON. Please adjust your system prompt and try again.",
      missingFields: "Model response missing zh/en fields.",
      base64Failed: "Image processing failed: Could not encode image to base64 for AI analysis. Please try another image or check your connection.",
      historyTitle: "History",
      historyEmpty: "No history yet",
      historyClear: "Clear all",
      historyCopy: "Copy",
      historyDelete: "Delete",
      historyCopied: "Copied",
      historyLoaded: "Copied to clipboard ✓",
      // Prompt field labels
      labelAspectRatio: "Aspect Ratio",
      labelBackground: "Background",
      labelSubject: "Subject",
      labelSurroundingElements: "Surrounding Elements",
      labelComposition: "Composition",
      labelTextContent: "Text",
      labelStyle: "Style",
      labelLighting: "Lighting",
      labelColorPalette: "Color Palette"
    }
  },

  SETTINGS_I18N: {
    zh: {
      "imgprompt-title": "ImgPrompt",
      "imgprompt-subtitle": "图片转提示词",
      "connection-section-title": "连接设置",
      "connection-section-note": "填入接口地址、模型和密钥。",
      "endpoint-label": "API 接口地址",
      "endpoint-hint": "常见兼容接口为 /v1/chat/completions",
      "model-label": "模型名称",
      "model-hint": "例如 gpt-5-mini 或 gemini-2.5-pro",
      "key-label": "API 密钥",
      "key-hint": "仅保存在本地浏览器中",
      "prompt-section-title": "提示词设置",
      "prompt-section-note": "选择预设场景，或自定义具体的提取任务。",
      "system-prompt-label": "System Prompt",
      "user-prompt-label": "User Prompt",
      "experience-section-title": "使用体验",
      "experience-section-note": "控制插件在网页中的交互方式。",
      "toggle-hover-title": "悬浮 PicPrompt 按钮",
      "toggle-hover-note": "鼠标移到图片上时显示快捷入口。",
      "toggle-snipping-title": "截屏提取提示词",
      "toggle-snipping-note": "使用快捷键对网页进行框选截图分析。",
      "toggle-recreate-title": "高还原度模式",
      "toggle-recreate-note": "启用后将使用更详细的分析提示词,生成更精确的还原提示词(包含负面提示词和技术参数)。",
      "shortcut-hint": "默认快捷键：Alt / Option + S 。如需修改，请前往 chrome://extensions/shortcuts",
      "language-label": "面板语言",
      "language-note": "切换设置面板的显示语言。",
      "compatibility-section-title": "兼容性设置",
      "compatibility-section-note": "如果遇到 400 报错，请尝试调整以下设置。",
      "resolution-label": "图片分辨率限制",
      "resolution-note": "降低分辨率可减小请求体积，防止接口超时或拒绝。",
      "reset-button": "恢复默认",
      "preset-general": "通用",
      "preset-photo": "📸 摄影",
      "preset-cg": "🎨 插画CG",
      "preset-design": "📐 平面设计",
      "preset-ui": "📱 界面 UI",
      "preset-3d": "🧊 游戏资产",
      "preset-product": "👕 电商产品",
      "preset-anime": "🎭 动漫插画",
      "preset-architecture": "🏛️ 建筑室内",
      "preset-food": "🍜 美食摄影",
      "preset-portrait": "👤 人像摄影",
      "preset-add-custom": "➕ 添加自定义",
      "custom-title-label": "模板名称",
      "custom-title-placeholder": "分享您的提示词名称",
      "custom-save-btn": "保存",
      "custom-cancel-btn": "取消",
      "custom-delete-btn": "🗑️ 删除",
      "footer-contact": "感谢大帅锅："
    },
    en: {
      "imgprompt-title": "ImgPrompt",
      "imgprompt-subtitle": "Image to Prompt",
      "connection-section-title": "Connection",
      "connection-section-note": "Enter API endpoint, model, and key.",
      "endpoint-label": "API Endpoint",
      "endpoint-hint": "Common compatible interface: /v1/chat/completions",
      "model-label": "Model",
      "model-hint": "e.g., gpt-5-mini or gemini-2.5-pro",
      "key-label": "API Key",
      "key-hint": "Saved locally in browser only",
      "prompt-section-title": "Prompt",
      "prompt-section-note": "Choose a preset or customize the specific task.",
      "system-prompt-label": "System Prompt",
      "user-prompt-label": "User Prompt",
      "experience-section-title": "Experience",
      "experience-section-note": "Control how the hover entry appears.",
      "toggle-hover-title": "Hover PicPrompt Button",
      "toggle-hover-note": "Show shortcut entry when hovering over images.",
      "toggle-snipping-title": "Shortcut Snipping",
      "toggle-snipping-note": "Use shortcut to select and analyze any area on the page.",
      "toggle-recreate-title": "High-Fidelity Recreation Mode",
      "toggle-recreate-note": "Enable to use detailed analysis prompts for more precise recreation (includes negative prompts and technical parameters).",
      "shortcut-hint": "Default: Alt / Option + S. To modify, go to chrome://extensions/shortcuts",
      "language-label": "Panel Language",
      "language-note": "Switch the language of this settings panel.",
      "compatibility-section-title": "Compatibility",
      "compatibility-section-note": "If you encounter 400 errors, try adjusting these settings.",
      "resolution-label": "Max Image Resolution",
      "resolution-note": "Lowering resolution reduces payload size and avoids timeouts.",
      "reset-button": "Reset to Defaults",
      "preset-general": "General",
      "preset-photo": "📸 Photo",
      "preset-cg": "🎨 Illust",
      "preset-design": "📐 Design",
      "preset-ui": "📱 UI Design",
      "preset-3d": "🧊 3D Asset",
      "preset-product": "👕 Product",
      "preset-anime": "🎭 Anime",
      "preset-architecture": "🏛️ Architecture",
      "preset-food": "🍜 Food",
      "preset-portrait": "👤 Portrait",
      "preset-add-custom": "➕ Add Custom",
      "custom-title-label": "Template Name",
      "custom-title-placeholder": "Name your prompt template",
      "custom-save-btn": "Save",
      "custom-cancel-btn": "Cancel",
      "custom-delete-btn": "🗑️ Delete",
      "footer-contact": "XIhaha: "
    }
  },

  ERROR_CODES: {
    NETWORK_ERROR: "NETWORK_ERROR",
    IMAGE_FETCH_FAILED: "IMAGE_FETCH_FAILED",
    IMAGE_PROCESSING_FAILED: "IMAGE_PROCESSING_FAILED",
    API_AUTH_FAILED: "API_AUTH_FAILED",
    API_RATE_LIMITED: "API_RATE_LIMITED",
    API_TIMEOUT: "API_TIMEOUT",
    API_INVALID_RESPONSE: "API_INVALID_RESPONSE",
    JSON_PARSE_FAILED: "JSON_PARSE_FAILED",
    MISSING_FIELDS: "MISSING_FIELDS",
    CANCELED: "CANCELED",
    UNKNOWN: "UNKNOWN"
  },

  ERROR_MESSAGES: {
    zh: {
      "NETWORK_ERROR": "网络连接失败，请检查网络后重试。",
      "IMAGE_FETCH_FAILED": "无法获取图片，请确认图片链接有效且可访问。",
      "IMAGE_PROCESSING_FAILED": "图片处理失败，请尝试换一张图片或调整分辨率设置。",
      "API_AUTH_FAILED": "API 密钥无效或已过期，请检查设置中的 API Key。",
      "API_RATE_LIMITED": "API 调用次数已达上限，请稍后再试或升级配额。",
      "API_TIMEOUT": "API 请求超时，请检查网络连接或降低图片分辨率。",
      "API_INVALID_RESPONSE": "API 返回了意外结果，请检查模型配置或更换模型。",
      "JSON_PARSE_FAILED": "模型返回的内容无法解析，请调整 System Prompt 确保输出纯 JSON。",
      "MISSING_FIELDS": "模型返回缺少必需的 zh/en 字段，请检查 System Prompt。",
      "CANCELED": "已停止生成。",
      "UNKNOWN": "发生未知错误，请重试。"
    },
    en: {
      "NETWORK_ERROR": "Network connection failed. Please check your connection and try again.",
      "IMAGE_FETCH_FAILED": "Unable to fetch image. Please verify the image URL is valid and accessible.",
      "IMAGE_PROCESSING_FAILED": "Image processing failed. Please try another image or lower the resolution.",
      "API_AUTH_FAILED": "Invalid or expired API key. Please check your API Key in settings.",
      "API_RATE_LIMITED": "API rate limit reached. Please try again later or upgrade your quota.",
      "API_TIMEOUT": "API request timed out. Check your connection or lower image resolution.",
      "API_INVALID_RESPONSE": "API returned unexpected results. Check model configuration or try another model.",
      "JSON_PARSE_FAILED": "Could not parse model output. Adjust System Prompt to ensure pure JSON output.",
      "MISSING_FIELDS": "Model response missing required zh/en fields. Check your System Prompt.",
      "CANCELED": "Generation stopped.",
      "UNKNOWN": "An unknown error occurred. Please try again."
    }
  },

  POSTHOG_PROJECT_KEY: atob("cGhjX3dUYnlxb2FMbnNrUEZFc0t5U0xzdWRiSGFucFR6amJWOGNxWXdEM0ZWeno2"),
  POSTHOG_HOST: "https://us.i.posthog.com",
  ANALYTICS_CONFIG_KEY: "analyticsConfig"
};

globalThis.ImgPromptConfig.DEFAULT_SETTINGS.systemPrompt =
  `${globalThis.ImgPromptConfig.DEFAULT_SETTINGS._legacySystemPrompt}

ADDITIONAL RULES:
- Also include a top-level "en" field in the JSON object.
- Keep image_type, aspect_ratio, background, subject, surrounding_elements, composition, text_content, style, lighting, and color_palette in Chinese.
- The top-level "en" field must be a single fluent English image-generation prompt for recreating the image.
- Only the "en" field should be in English.

${globalThis.ImgPromptConfig.GENERIC_SYSTEM_CONSTRAINTS}`;
