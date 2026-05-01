#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const SNAPSHOT_INDEX_PATH = path.join(DATA_DIR, "meta_policy_snapshots", "index.json");
const MANIFEST_PATH = path.join(DATA_DIR, "meta_policy_source_manifest.json");
const SEED_CHUNKS_PATH = path.join(DATA_DIR, "meta_policy_chunks.json");
const OUTPUT_PATH = path.join(DATA_DIR, "meta_policy_runtime_chunks.json");

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function splitSentences(text) {
  return normalizeText(text)
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function chunkText(text, { minLen = 180, maxLen = 900 } = {}) {
  const sentences = splitSentences(text);
  const chunks = [];
  let current = "";
  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length <= maxLen) {
      current = candidate;
      continue;
    }
    if (current.length >= minLen) chunks.push(current);
    current = sentence;
  }
  if (current.length >= minLen) chunks.push(current);
  if (!chunks.length && normalizeText(text).length) {
    chunks.push(normalizeText(text).slice(0, maxLen));
  }
  return chunks;
}

function isUsefulChunk(text) {
  const lower = normalizeText(text).toLowerCase();
  if (!lower) return false;
  const boilerplatePatterns = [
    "get the latest updates from meta for business",
    "by submitting this form",
    "campaign_id subscribe",
    "log in with facebook",
    "manage your ad accounts and get personalized support",
    "about developers careers privacy cookies terms",
    "english (us)"
  ];
  return !boilerplatePatterns.some((pattern) => lower.includes(pattern));
}

function buildRuntimeChunks() {
  const manifest = readJson(MANIFEST_PATH, { sources: [] });
  const snapshotIndex = readJson(SNAPSHOT_INDEX_PATH, { refreshedAt: null, sources: [] });
  const seed = readJson(SEED_CHUNKS_PATH, { version: null, chunks: [] });
  const manifestById = new Map((manifest.sources || []).map((source) => [source.id, source]));
  const runtimeChunks = [];

  for (const sourceSnapshot of snapshotIndex.sources || []) {
    const source = manifestById.get(sourceSnapshot.id) || null;
    const latestTextPath = sourceSnapshot.latestTextPath ? path.join(ROOT, sourceSnapshot.latestTextPath) : null;
    if (!latestTextPath || !fs.existsSync(latestTextPath)) continue;
    const text = normalizeText(fs.readFileSync(latestTextPath, "utf8"));
    if (text.length < 120) continue;
    const chunks = chunkText(text);
    chunks.forEach((chunkTextValue, index) => {
      if (!isUsefulChunk(chunkTextValue)) return;
      runtimeChunks.push({
        chunkId: `${sourceSnapshot.id}__snapshot_${String(index + 1).padStart(3, "0")}`,
        sourceId: sourceSnapshot.id,
        title: source?.title || sourceSnapshot.title,
        url: sourceSnapshot.finalUrl || sourceSnapshot.url,
        category: source?.category || sourceSnapshot.category || "unknown",
        subcategories: [],
        official: true,
        groundingMode: "raw_snapshot_excerpt",
        text: chunkTextValue,
        snapshotMeta: {
          refreshedAt: sourceSnapshot.refreshedAt || snapshotIndex.refreshedAt || null,
          captureStatus: sourceSnapshot.captureStatus || null,
          latestTextPath: sourceSnapshot.latestTextPath || null
        }
      });
    });
  }

  const curatedChunks = (seed.chunks || []).map((chunk) => ({
    ...chunk,
    groundingMode: "curated_summary"
  }));

  return {
    version: snapshotIndex.refreshedAt || seed.version || null,
    builtAt: new Date().toISOString(),
    snapshotRefreshedAt: snapshotIndex.refreshedAt || null,
    chunks: [...runtimeChunks, ...curatedChunks]
  };
}

const runtime = buildRuntimeChunks();
writeJson(OUTPUT_PATH, runtime);
process.stdout.write(`wrote ${path.relative(ROOT, OUTPUT_PATH)} with ${runtime.chunks.length} chunks\n`);
