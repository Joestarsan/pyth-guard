import fs from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "public", "courtroom");
const MANIFEST_PATH = path.join(OUTPUT_DIR, "portrait-manifest.json");

const CHARACTER_SPECS = [
  {
    id: "defense",
    label: "Trader Defense",
    prompt:
      "Original courtroom character portrait for a trading trial app. Defense attorney for a trader. Bust portrait, centered, facing slightly right, confident and sharp, mint green suit with subtle market-tech trim, large readable eyes, bold jawline, crisp silhouette, original character, no copyrighted characters, no text, no watermark, dark flat violet background.",
  },
  {
    id: "judge",
    label: "Judge",
    prompt:
      "Original courtroom character portrait for a trading trial app. Judge presiding over a futuristic market trial. Bust portrait, centered, facing forward, imposing and calm, amber and gold judicial robe, ceremonial tech trim, large readable eyes, strong silhouette, original character, no copyrighted characters, no text, no watermark, dark flat violet background.",
  },
  {
    id: "prosecutor",
    label: "Prosecutor",
    prompt:
      "Original courtroom character portrait for a trading trial app. Prosecutor arguing against a risky trade. Bust portrait, centered, facing slightly left, sharp and severe, coral red suit with sleek market-enforcer trim, large readable eyes, crisp silhouette, original character, no copyrighted characters, no text, no watermark, dark flat violet background.",
  },
];

const STYLE_PREAMBLE =
  "Style target: original 2D courtroom illustration, flat cel-shaded, anime-inspired but not copied from any franchise, hard black outlines, posterized shading, limited palette, broad color blocks, no skin pores, no realistic texture, no photographic lighting, no painterly brushwork, no tiny details. Compose for a game dialogue portrait with the face and upper torso filling most of the frame.";

const DEFAULT_CANDIDATES = [
  {
    model: "black-forest-labs/flux.2-flex",
    modalities: ["image"],
  },
  {
    model: "google/gemini-3.1-flash-image-preview",
    modalities: ["image", "text"],
  },
  {
    model: "google/gemini-2.5-flash-image-preview",
    modalities: ["image", "text"],
  },
  {
    model: "sourceful/riverflow-v2-fast",
    modalities: ["image"],
  },
];

function parseEnvFile(text) {
  const result = {};

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

async function loadEnv() {
  const envPath = path.join(ROOT, ".env.local");
  const file = await fs.readFile(envPath, "utf8");
  return parseEnvFile(file);
}

function resolveCandidates(env) {
  const explicit =
    env.OPENROUTER_IMAGE_MODEL ?? env.OPENROUTER_MODEL ?? process.env.OPENROUTER_IMAGE_MODEL;

  if (!explicit) {
    return DEFAULT_CANDIDATES;
  }

  const isGemini = explicit.includes("gemini");
  return [
    {
      model: explicit,
      modalities: isGemini ? ["image", "text"] : ["image"],
    },
    ...DEFAULT_CANDIDATES.filter((candidate) => candidate.model !== explicit),
  ];
}

async function callOpenRouter({ apiKey, candidate, prompt }) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:3001",
      "X-Title": "Pyth Trade Trial",
    },
    body: JSON.stringify({
      model: candidate.model,
      messages: [
        {
          role: "system",
          content:
            "You create original visual assets for a courtroom-themed financial app. Do not imitate copyrighted characters. Favor bold silhouettes, hard outlines, limited palette, cel-shaded facial planes, and app-friendly framing. Never generate photorealistic portraits.",
        },
        {
          role: "user",
          content: `${prompt} ${STYLE_PREAMBLE}`,
        },
      ],
      modalities: candidate.modalities,
      stream: false,
      image_config: {
        aspect_ratio: "3:4",
      },
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    const message =
      payload?.error?.message ??
      payload?.error ??
      `OpenRouter request failed with ${response.status}`;
    throw new Error(message);
  }

  const imageUrl =
    payload?.choices?.[0]?.message?.images?.[0]?.image_url?.url ??
    payload?.choices?.[0]?.message?.images?.[0]?.imageUrl?.url;

  if (!imageUrl || typeof imageUrl !== "string") {
    throw new Error("OpenRouter response did not include an image payload");
  }

  return {
    imageUrl,
    payload,
  };
}

function decodeDataUrl(dataUrl) {
  const separator = dataUrl.indexOf(",");
  if (separator === -1) {
    throw new Error("Invalid image data URL");
  }

  const metadata = dataUrl.slice(0, separator);
  const base64 = dataUrl.slice(separator + 1);

  if (!metadata.includes(";base64")) {
    throw new Error("Only base64 image responses are supported");
  }

  return Buffer.from(base64, "base64");
}

async function writePortrait({ inputBuffer, outputPath, label }) {
  await sharp(inputBuffer)
    .resize(384, 512, {
      fit: "cover",
      position: "center",
    })
    .resize(96, 128, {
      kernel: sharp.kernel.nearest,
      fit: "fill",
    })
    .resize(768, 1024, {
      kernel: sharp.kernel.nearest,
      fit: "fill",
    })
    .normalise()
    .sharpen()
    .png({
      palette: true,
      colors: 40,
      effort: 10,
      dither: 0.85,
    })
    .toFile(outputPath);

  console.log(`saved ${label} -> ${path.relative(ROOT, outputPath)}`);
}

async function main() {
  const env = await loadEnv();
  const apiKey = env.OPENROUTER_API_KEY ?? process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is missing");
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const candidates = resolveCandidates(env);
  let activeCandidate = null;
  const manifest = {
    generatedAt: new Date().toISOString(),
    model: "",
    portraits: [],
  };

  for (const spec of CHARACTER_SPECS) {
    let result = null;

    if (activeCandidate) {
      result = await callOpenRouter({
        apiKey,
        candidate: activeCandidate,
        prompt: spec.prompt,
      });
    } else {
      let lastError = null;

      for (const candidate of candidates) {
        try {
          result = await callOpenRouter({
            apiKey,
            candidate,
            prompt: spec.prompt,
          });
          activeCandidate = candidate;
          break;
        } catch (error) {
          lastError = error;
        }
      }

      if (!result) {
        throw lastError ?? new Error("Unable to generate portraits from OpenRouter");
      }
    }

    const buffer = decodeDataUrl(result.imageUrl);
    const outputPath = path.join(OUTPUT_DIR, `${spec.id}.png`);

    await writePortrait({
      inputBuffer: buffer,
      outputPath,
      label: spec.label,
    });

    manifest.model = activeCandidate.model;
    manifest.portraits.push({
      id: spec.id,
      label: spec.label,
      file: path.relative(ROOT, outputPath),
    });
  }

  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`manifest -> ${path.relative(ROOT, MANIFEST_PATH)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
