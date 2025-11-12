# Mastra Language Service

TypeScript + Hono 服务端，集成 Mastra Agent + OpenAI GPT-4o-mini，为前端提供口语、单词与短文阅读接口。

## 快速开始

```bash
cd backend
cp .env.example .env.local
# 填写 OPENAI_API_KEY
npm install
npm run dev
```

默认在 `8787` 端口提供以下 REST 接口：

- `POST /api/language/practice`：接收 `prompt`（可选文本上下文）以及可选的 `audioBase64` / `transcript`。当传入语音时，服务会自动调用 OpenAI Whisper(`gpt-4o-mini-transcribe`) 转写，再让 Mastra Agent 返回语法/发音/流畅度评分、纠错建议、示例练习与下一轮引导问题。
- `POST /api/language/vocabulary`
- `POST /api/language/reading`

所有接口均返回结构化 JSON，前端可直接消费。若 `ALLOW_MOCK_DATA=true` 或未配置 `OPENAI_API_KEY`，服务会自动返回内置示例，便于离线调试。日志默认使用 [pino](https://github.com/pinojs/pino) 输出结构化记录，可通过 `LOG_LEVEL`（默认 `info`）控制。

## REST 接口

### 通用约定

- 基础地址：`http://localhost:8787/api/language`
- Header：`Content-Type: application/json`
- 出错时统一返回：
  ```json
  {
    "error": "Language service temporarily unavailable."
  }
  ```
  若输入校验失败，会返回 Zod `flatten()` 结构，可直接在前端读取 `error.fieldErrors`。

### POST /api/language/practice

- 请求体字段
  | 字段 | 类型 | 说明 |
  | --- | --- | --- |
  | `language` | string | 练习目标语言，例如 `English` |
  | `nativeLanguage` | string | 用户母语，用于生成解释 |
  | `proficiency` | `'beginner' \| 'intermediate' \| 'advanced'` | 水平档位 |
  | `focus` | `'fluency' \| 'accuracy' \| 'confidence'` | 练习侧重 |
  | `prompt` | string? | 文本输入，允许为空 |
  | `audioBase64` | string? | 语音 `webm` base64（不含 `data:` 前缀） |
  | `transcript` | string? | 若前端已有识别结果可直接传入 |

> 三者需至少提供其一，否则会返回 400。

- 响应体字段

```ts
{
  summary: string
  followUpQuestion: string
  transcript?: string
  scores: {
    grammar: { score: number; explanation: string }
    pronunciation: { score: number; explanation: string }
    fluency: { score: number; explanation: string }
  }
  notes: Array<{ title: string; items: string[] }>
  practice: {
    pronunciationDrill: string
    speakingPrompt: string
    encouragement: string
  }
}
```

- 示例
  ```bash
  curl -X POST http://localhost:8787/api/language/practice \
    -H "Content-Type: application/json" \
    -d '{
      "language": "English",
      "nativeLanguage": "Chinese",
      "proficiency": "intermediate",
      "focus": "fluency",
      "prompt": "I will going to the new gallery with my friend this weekend."
    }'
  ```

### POST /api/language/vocabulary

- 请求体字段
  | 字段 | 类型 | 说明 |
  | --- | --- | --- |
  | `language` | string | 返回释义所使用的语言（如 `Chinese`） |
  | `word` | string | 要查询的单词/短语，至少 1 个字符 |

- 响应体字段
  ```ts
  {
    entry: {
      word: string
      ipa?: string
      phoneticSpelling?: string
      partOfSpeech?: string
      definition: string
      example: string
      synonyms?: string[]
    }
    relatedWords: string[]
  }
  ```

### POST /api/language/reading

- 请求体字段
  | 字段 | 类型 | 说明 |
  | --- | --- | --- |
  | `language` | string | 输出语言 |
  | `proficiency` | `'beginner' \| 'intermediate' \| 'advanced'` | 适用水平 |
  | `topic` | string | 主题关键词，至少 3 个字符 |
  | `tone` | `'narrative' \| 'informative' \| 'conversational'` | 文风 |
  | `length` | `'short' \| 'medium'` | 短文长度（约 120 / 220 词） |

- 响应体字段

  ```ts
  {
    title: string
    summary: string
    body: string
    vocabulary: Array<{
      word: string
      definition: string
      example: string
    }>
    comprehensionQuestions: string[]
  }
  ```

- 示例
  ```bash
  curl -X POST http://localhost:8787/api/language/reading \
    -H "Content-Type: application/json" \
    -d '{
      "language": "English",
      "proficiency": "beginner",
      "topic": "local market",
      "tone": "narrative",
      "length": "short"
    }'
  ```

## 技术栈

- [Mastra](https://mastra.ai) Agent 容器，统一管理模型。
- [@ai-sdk/openai](https://sdk.vercel.ai) 驱动 `gpt-4o-mini`。
- [Hono](https://hono.dev) + `@hono/node-server` 构建轻量 HTTP API。
- TypeScript + Zod 输入校验，`tsx` 热重载。
- Pino 中间件级请求日志（request id、耗时、错误堆栈）。
- Cloudflare Workers 友好：`wrangler.toml` 已配置 `nodejs_compat`，可直接 `wrangler deploy`。

## Cloudflare Workers 部署

```bash
cd backend
# 设置 OpenAI Key 等 secrets
wrangler secret put OPENAI_API_KEY
# 可选：覆盖 LOG_LEVEL / ALLOW_MOCK_DATA
wrangler deploy
```

`src/app.ts` 为共享 Hono 应用，`src/worker.ts` 用于 Cloudflare Workers，`src/server.ts` 仍可在 Node 环境本地运行。

> 注意：Mastra 依赖 Node.js >= 20。当前环境若仍是 Node 16，可先完成开发与类型检查，部署时切换到 LTS 20+。
