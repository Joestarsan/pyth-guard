import { createHash } from "node:crypto";

type DialogueProof = {
  label: string;
  value: string;
  delta: string;
  source: string;
  note: string;
};

type DialogueBeatInput = {
  id: string;
  speaker: string;
  tone: string;
  headline: string;
  speech: string;
  proofs: DialogueProof[];
};

type DialogueRequest = {
  asset: string;
  action: string;
  caseLine: string;
  beats: DialogueBeatInput[];
  verdict: {
    outcome: string;
    stamp: string;
    summary: string;
    reasons: string[];
    guidance: string;
  };
};

export type DialogueResponse = {
  beats: Array<{
    id: string;
    speech: string;
  }>;
  verdictSpeech?: string;
  verdictSummary?: string;
  verdictReasons?: string[];
  verdictGuidance?: string;
};

const dialogueCache = new Map<string, DialogueResponse>();
const DEFAULT_DIALOGUE_MODEL = "openai/gpt-4o-mini";
const MAX_SPEECH_LENGTH = 240;

function cleanResponseText(value: string) {
  return value
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractMessageText(content: unknown) {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "text" in item && typeof item.text === "string") {
          return item.text;
        }

        return "";
      })
      .join("\n")
      .trim();
  }

  return "";
}

function normalizeSpeech(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.length > MAX_SPEECH_LENGTH
    ? `${trimmed.slice(0, MAX_SPEECH_LENGTH - 1).trimEnd()}...`
    : trimmed;
}

function normalizeReasonList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeSpeech(item))
    .filter((item): item is string => item !== null)
    .slice(0, 2);
}

export async function enhanceTrialDialogue(input: DialogueRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return null;
  }

  const cacheKey = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const cached = dialogueCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3_800);

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://market-witness-pyth-trial.vercel.app",
        "X-Title": "Pyth Trade Trial",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_DIALOGUE_MODEL ?? DEFAULT_DIALOGUE_MODEL,
        temperature: 0.9,
        max_tokens: 900,
        stream: false,
        messages: [
          {
            role: "system",
            content:
              "You rewrite financial courtroom dialogue into energetic game-like lines. Keep every claim anchored to the supplied facts only. Do not imitate or quote copyrighted Ace Attorney lines. Use plain English that a crypto Twitter audience can understand. Keep each speech to one or two short sentences and under 240 characters. Also rewrite the final verdict into a short playful summary, up to two simple reasons, and one friendly note. Return JSON only with the exact shape {\"beats\":[{\"id\":\"...\",\"speech\":\"...\"}],\"verdictSpeech\":\"...\",\"verdictSummary\":\"...\",\"verdictReasons\":[\"...\"],\"verdictGuidance\":\"...\"}.",
          },
          {
            role: "user",
            content: JSON.stringify(input),
          },
        ],
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(
        payload?.error?.message ??
          payload?.error ??
          `OpenRouter request failed with ${response.status}`,
      );
    }

    const rawContent = extractMessageText(payload?.choices?.[0]?.message?.content);
    const parsed = JSON.parse(cleanResponseText(rawContent));

    const byId = new Map<string, string>();
    if (Array.isArray(parsed?.beats)) {
      for (const item of parsed.beats) {
        if (!item || typeof item !== "object" || typeof item.id !== "string") {
          continue;
        }

        const speech = normalizeSpeech(item.speech);
        if (speech) {
          byId.set(item.id, speech);
        }
      }
    }

    const result = {
      beats: input.beats
        .map((beat) => {
          const speech = byId.get(beat.id);
          if (!speech) {
            return null;
          }

          return {
            id: beat.id,
            speech,
          };
        })
        .filter((item): item is { id: string; speech: string } => item !== null),
      verdictSpeech: normalizeSpeech(parsed?.verdictSpeech) ?? undefined,
      verdictSummary: normalizeSpeech(parsed?.verdictSummary) ?? undefined,
      verdictReasons: normalizeReasonList(parsed?.verdictReasons),
      verdictGuidance: normalizeSpeech(parsed?.verdictGuidance) ?? undefined,
    } satisfies DialogueResponse;

    dialogueCache.set(cacheKey, result);
    return result;
  } finally {
    clearTimeout(timeout);
  }
}
