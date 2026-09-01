# Pantopus AI Architecture and Security Evidence Map

Last reviewed: 2026-05-14

This file maps the AI interview answers to concrete repository evidence. It is intentionally terse so it can be used while answering follow-up interview questions.

## Core AI Runtime

| Area | Evidence |
| --- | --- |
| OpenAI client and fallback | `backend/config/openai.js` returns `null` when `OPENAI_API_KEY` is absent and logs that AI features will use fallback mode. |
| Main agent service | `backend/services/ai/agentService.js` orchestrates streaming chat, tool calls, structured drafts, mail summaries, place briefs, request logging, and conversation state. |
| Default models | `backend/services/ai/agentService.js` defaults `OPENAI_CHAT_MODEL` to `gpt-4o` and `OPENAI_DRAFT_MODEL` to `gpt-4o-mini`. |
| Responses API usage | `backend/services/ai/agentService.js` uses `openai.responses.create` for chat streaming, multimodal input, function tools, structured outputs, and `previous_response_id`. |
| Legacy Chat Completions usage | `backend/services/magicTaskService.js`, `backend/services/context/briefingComposer.js`, `backend/services/context/localUpdateProvider.js`, and `backend/services/ai/propertySuggestionsService.js` still use chat completions. |
| Audio transcription | `backend/routes/ai.js` sends uploaded audio to `openai.audio.transcriptions.create` with model `whisper-1`. |
| Seeder humanizer | `pantopus-seeder/src/pipeline/humanizer.py` calls OpenAI for public/local content rewriting, not user account data. |

## User Data Sent to OpenAI

| Feature | Data sent |
| --- | --- |
| AI chat | User message, optional images, optional coarse city/state, tool definitions, system prompt, and `previous_response_id`. |
| Gig/listing/post drafts | User-provided draft text, optional coarse city/state, structured output schema. |
| Listing vision draft | Image URLs/data URLs/public object URLs plus optional user text. |
| Mail opening suggestion | Intent, ink, recipient display name, and optional body preview capped at 2,000 characters. |
| Mail summary | Authorized mail subject, sender display, category, type, urgency, due date, content or preview, and key facts. |
| Place brief | Saved-place label/city/state plus external weather alert facts. Place coordinates are used server-side for NOAA lookup, not included as exact address text. |
| Support Train draft | User story, requested support modes, optional recipient/home reference labels or ids. |
| Magic Task | Raw user task text plus deterministic parser hints. |
| Context briefing polish | Derived signal facts, not raw full database records. |
| Local update summary | Curated post titles/content and area label. |
| Property suggestions LLM | Full postal address and requested missing property keys, only when `PROPERTY_SUGGESTIONS_LLM=1`. |
| Transcription | Raw uploaded audio file. |

## Data Intentionally Not Sent

| Data class | Control |
| --- | --- |
| Exact saved-place addresses in normal AI chat | `get_user_context` selects only `id`, `label`, `place_type`, `city`, and `state`. |
| Unauthorized mail | `getAuthorizedMail` checks direct recipient or home mailbox permission before returning mail content to AI code. |
| Home address/phone/private Support Train recipient notes | `get_support_train_summary` fetches household size, dietary styles, allergies, and contactless preference only. |
| Prompt/completion bodies in Pantopus AI logs | `AIRequestLog` stores metadata and token counts, not prompt text, output text, tool output, or mail bodies. |
| Full server-side chat transcript | `AIConversation` stores `response_id`, title, counts, and timestamps, not message bodies. |

Important caveat: free-form user text and authorized mail content may contain PII. The current implementation minimizes what it selects and sends, but it does not apply a universal PII scrubber before every OpenAI call.

## Prompt Injection and Tool Safety

| Control | Evidence |
| --- | --- |
| Tool allowlist | `backend/services/ai/tools.js` dispatches through a fixed `switch`; unknown tool names return an error. |
| Strict tool schemas | Tool definitions use `strict: true` and `additionalProperties: false`. |
| Server-bound identity | Tool calls receive `userId` from the authenticated server request, not from model arguments. |
| Authorization inside tools | Mail and support train tools re-check database permissions before returning sensitive rows. |
| Bounded tool loop | `MAX_TOOL_ROUNDS = 5` in `agentService.js`. |
| Tool timeout | `TOOL_TIMEOUT_MS = 5000` in `tools.js`. |
| Structured output validation | OpenAI JSON schema output is validated again with AJV in `schemas.js`. |
| Rate limits | `backend/routes/ai.js` applies `aiChatLimiter` and `aiDraftLimiter` behind `verifyToken`. |

Current gap: the repo does not yet include a dedicated prompt-injection classifier, taint tracking, or a full adversarial eval corpus for tool calls.

## Mail Authorization

| Layer | Evidence |
| --- | --- |
| Route auth | `backend/routes/ai.js` protects AI mail endpoints with `verifyToken`. |
| Service guard | `backend/services/ai/mailAccess.js` implements `canUserViewMail` and `getAuthorizedMail`. |
| DB function | `backend/database/schema.sql` defines `public.can_view_mail`, allowing direct recipients or users with `mailbox.view` on the home. |
| RLS | `backend/database/schema.sql` includes `mail_select_visible` and update policies using `can_view_mail`. |
| Tests | `backend/tests/unit/aiMailAccess.test.js` covers direct access, home access, denied access, and missing rows. |

## Precise Home Address Protection

| Control | Evidence |
| --- | --- |
| Prompt rule | `backend/services/ai/prompts.js` says never reference precise addresses and use city/neighborhood-level location. |
| Context minimization | `backend/services/ai/tools.js` omits exact addresses from `get_user_context`. |
| Draft defaults | `create_gig_draft` defaults location preferences to approximate area and reveal-after-assignment. |
| Product privacy matrix | `docs/location-privacy-matrix.md` defines exact, approximate, neighborhood-only, and none precision behavior. |
| Privacy gates | `CONTRIBUTING.md` documents privacy test gates and forbidden identity/location keys. |

Current gap: model outputs are not passed through a deterministic home-address redaction filter before response delivery. The strongest implemented control is that hidden exact home addresses are normally not provided to the model.

## Evaluation Coverage

| Eval/test | Coverage |
| --- | --- |
| `backend/tests/aiAgent.test.js` | JSON schemas, draft shapes, mail summary shape, place brief shape, and tool definitions. |
| `backend/tests/unit/aiMailAccess.test.js` | AI mail authorization guard behavior. |
| `backend/tests/ai/supportTrainDraft.eval.test.js` | Live OpenAI Support Train draft quality evals when `OPENAI_API_KEY` is set. |
| `backend/tests/hubContext.test.js` | Context briefing fallback behavior, validation, and token-use paths. |
| `pantopus-seeder/tests/test_humanizer.py` | Humanizer validation, error, retry, and prompt behavior with mocked OpenAI. |
| `pnpm --filter pantopus-backend run test:privacy` | Privacy gates for identity serializers, notification context, and forbidden-key regressions. |

Recommended next evals:

- Prompt-injection tool-call suite.
- Address leak regression suite.
- Mail summary semantic golden set.
- Chat-answer factuality and refusal boundary set.
- Model-upgrade A/B eval set tied to `prompt_version`.
- Cost and latency SLO regression checks.

## Cost and Observability

| Field | Evidence |
| --- | --- |
| User | `AIRequestLog.user_id` |
| Feature | `AIRequestLog.endpoint` |
| Model | `AIRequestLog.model` |
| Prompt version | `AIRequestLog.prompt_version` |
| Tokens | `AIRequestLog.input_tokens` and `AIRequestLog.output_tokens` |
| Latency | `AIRequestLog.latency_ms` |
| Tool use | `AIRequestLog.tool_calls_count` |
| Schema validity | `AIRequestLog.schema_valid` |
| Status | `AIRequestLog.status` |

Current gap: dollar cost is computed outside the table by joining token counts to a pricing table. Some legacy AI paths are not consistently written to `AIRequestLog`.

## Timeout Behavior

| Scenario | Behavior |
| --- | --- |
| Chat stream exceeds 20s | SSE `error` event is sent, stream is closed, request logs status `timeout`, and `AIConversation.response_id` is not updated. |
| Tool execution exceeds 5s | Tool returns a JSON error object; the agent can continue if the overall request has time left. |
| Draft request timeout | `AbortSignal.timeout` aborts the OpenAI request and returns `AI_TIMEOUT` with fallback metadata. |
| Client behavior | Web/mobile hooks clear streaming state and keep the UI usable; partial text already streamed may remain visible. |

Current gap: streaming chat timeout is cooperative in the event loop rather than a guaranteed hard network abort of the remote generation.

## AI Logs and Retention

| Store | Content | Retention/notes |
| --- | --- | --- |
| `AIRequestLog` | Metadata, status, latency, token counts, model, prompt version, schema validity, error message | No repository-level TTL found. |
| `AIConversation` | `response_id`, title, message count, timestamps | User can delete local conversation metadata. |
| Winston `combined.log` | Application logs | Rotates 50MB x 5 files. No global redaction layer. |
| OpenAI API | Governed by OpenAI API data controls | Official docs state API data is not used for training by default, with retention controls depending on endpoint/account settings. |

Recommended next hardening:

- Add a centralized logger redaction transform.
- Add a database retention job for `AIRequestLog`.
- Avoid storing raw provider error messages if they can contain content.
- Evaluate `store:false` or Zero Data Retention compatibility where product requirements allow it.

## Graceful Degradation

| Feature | Degradation when OpenAI is unavailable |
| --- | --- |
| Magic Task | Falls back to deterministic parser and basic draft generation. |
| Context briefing | Falls back to deterministic template. |
| Local updates | Falls back to deterministic summary. |
| Mail opening | Returns `suggestion: null` so UI can continue. |
| Support Train draft | Returns fallback error so user can create manually. |
| Gig/listing/post drafts | Return AI fallback errors; manual creation remains available. |
| Place brief | No-alert/all-clear paths can avoid AI; active alert summarization may fail. |
| Property suggestions | Optional LLM path is skipped if disabled/unavailable. |
| Transcription | Returns 503; no non-AI transcription fallback. |

