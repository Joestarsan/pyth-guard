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
      "Original courtroom defense portrait for a trading trial app in Pyth NFT cartoon style. Planck the dinosaur defense counsel, bust portrait with upper torso visible, centered, facing slightly right, skull-like dinosaur head with large expressive eyes, purple glossy Pyth helmet with the Pyth mark, gray-white marble body with pink graffiti-style Pyth markings, classical robe silhouette, holding a glowing purple orb in one hand, calm but clever courtroom energy, strong black outlines, simple shapes, dark violet background, original character, no text, no watermark, no copyrighted characters.",
  },
  {
    id: "judge",
    label: "Judge",
    prompt:
      "Original courtroom judge portrait for a trading trial app in Pyth NFT cartoon style. PIRB the pigeon judge, bust portrait with upper torso visible, centered, facing slightly left, stern bright orange eye, gray pigeon feathers, purple glossy Pyth helmet with the Pyth mark, chest-mounted vintage camera with visible strap, ceremonial authority, readable silhouette, playful but serious courtroom energy, strong black outlines, simple shapes, dark violet background, original mascot character, no text, no watermark, no copyrighted characters.",
  },
  {
    id: "prosecutor",
    label: "Prosecutor",
    prompt:
      "Original courtroom prosecutor portrait for a trading trial app in Pyth NFT cartoon style. Chop The Shark, bust portrait with upper torso visible, centered, facing slightly left, shark head with huge jagged grin, glowing purple laser eyes, purple glossy Pyth helmet with the Pyth mark, white marble-like body with graffiti-style markings, gold Pyth medallion, draped classical robe or toga, aggressive and theatrical courtroom energy, strong black outlines, simple shapes, dark violet background, original character, no text, no watermark, no copyrighted characters.",
  },
];

const STYLE_PREAMBLE =
  "Style target: original Pyth NFT-inspired cartoon illustration prepared for pixel-art conversion. Use hard black outlines, posterized shading, simple facial planes, large readable eyes, broad color blocks, limited palette, playful meme energy, no realistic texture, no photographic lighting, no painterly brushwork, no tiny details. Compose for a game dialogue portrait with the face and upper torso filling most of the frame.";

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
    .resize(112, 150, {
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
      colors: 28,
      effort: 10,
      dither: 0.72,
    })
    .toFile(outputPath);

  console.log(`saved ${label} -> ${path.relative(ROOT, outputPath)}`);
}

async function main() {
  const env = await loadEnv();
  const apiKey = env.OPENROUTER_API_KEY ?? process.env.OPENROUTER_API_KEY;
  const requestedIds = process.argv.slice(2).map((value) => value.toLowerCase());

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
  const specs =
    requestedIds.length === 0
      ? CHARACTER_SPECS
      : CHARACTER_SPECS.filter((spec) => requestedIds.includes(spec.id));

  if (specs.length === 0) {
    throw new Error(`No portrait specs matched: ${requestedIds.join(", ")}`);
  }

  for (const spec of specs) {
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
