#!/usr/bin/env node

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const MANIFEST_PATH = path.join(DATA_DIR, "meta_policy_source_manifest.json");
const SNAPSHOT_ROOT = path.join(DATA_DIR, "meta_policy_snapshots");
const SNAPSHOT_INDEX_PATH = path.join(SNAPSHOT_ROOT, "index.json");

const USER_AGENT = process.env.META_POLICY_REFRESH_USER_AGENT || "liftoff-meta-policy-refresh/1.0";
const TIMEOUT_MS = Number(process.env.META_POLICY_REFRESH_TIMEOUT_MS || 20000);
const LIMIT = Number(process.env.META_POLICY_REFRESH_LIMIT || 0);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sanitizeText(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function hashString(value) {
  return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers: { "user-agent": USER_AGENT },
      redirect: "follow",
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

function classifySnapshot({ status, finalUrl, bodyText }) {
  const lowerFinal = String(finalUrl || "").toLowerCase();
  const lowerBody = String(bodyText || "").toLowerCase();
  if (lowerFinal.includes("/login") || lowerBody.includes("email or phone password")) {
    return {
      accessible: false,
      captureStatus: "login_redirect",
      notes: "Fetch resolved to a login page; manual capture may be required."
    };
  }
  if (status >= 400) {
    return {
      accessible: false,
      captureStatus: "http_error",
      notes: `HTTP ${status}`
    };
  }
  if (lowerBody.includes("you’re temporarily blocked") || lowerBody.includes("you're temporarily blocked")) {
    return {
      accessible: false,
      captureStatus: "temporary_block",
      notes: "Meta temporarily blocked automated access."
    };
  }
  return {
    accessible: true,
    captureStatus: "captured",
    notes: "Snapshot captured successfully."
  };
}

async function captureSource(source) {
  const requestedAt = new Date().toISOString();
  const response = await fetchWithTimeout(source.url);
  const body = await response.text();
  const bodyText = sanitizeText(body);
  const finalUrl = response.url || source.url;
  const status = response.status;
  const contentType = response.headers.get("content-type") || "";
  const bodyHash = hashString(body);
  const textHash = hashString(bodyText);
  const classification = classifySnapshot({ status, finalUrl, bodyText });

  return {
    sourceId: source.id,
    sourceTitle: source.title,
    requestedUrl: source.url,
    finalUrl,
    requestedAt,
    status,
    ok: response.ok,
    contentType,
    bodyHash,
    textHash,
    accessible: classification.accessible,
    captureStatus: classification.captureStatus,
    notes: classification.notes,
    bodyLength: body.length,
    textLength: bodyText.length,
    bodyHtml: body,
    bodyText,
    sourceMeta: source
  };
}

async function main() {
  const manifest = readJson(MANIFEST_PATH, { version: null, sources: [] });
  const sources = Array.isArray(manifest.sources) ? manifest.sources : [];
  const selectedSources = LIMIT > 0 ? sources.slice(0, LIMIT) : sources;
  const runAt = new Date().toISOString();
  const index = {
    manifestVersion: manifest.version || null,
    refreshedAt: runAt,
    userAgent: USER_AGENT,
    timeoutMs: TIMEOUT_MS,
    sources: []
  };

  ensureDir(SNAPSHOT_ROOT);

  for (const source of selectedSources) {
    const sourceDir = path.join(SNAPSHOT_ROOT, "sources", source.id);
    ensureDir(sourceDir);
    try {
      const snapshot = await captureSource(source);
      const stamp = runAt.replace(/[:.]/g, "-");
      const baseName = `${stamp}`;
      const htmlPath = path.join(sourceDir, `${baseName}.html`);
      const txtPath = path.join(sourceDir, `${baseName}.txt`);
      const jsonPath = path.join(sourceDir, `${baseName}.json`);
      fs.writeFileSync(htmlPath, snapshot.bodyHtml, "utf8");
      fs.writeFileSync(txtPath, snapshot.bodyText, "utf8");
      writeJson(jsonPath, {
        ...snapshot,
        bodyHtmlPath: path.relative(ROOT, htmlPath),
        bodyTextPath: path.relative(ROOT, txtPath)
      });
      writeJson(path.join(sourceDir, "latest.json"), {
        ...snapshot,
        bodyHtmlPath: path.relative(ROOT, htmlPath),
        bodyTextPath: path.relative(ROOT, txtPath)
      });
      index.sources.push({
        id: source.id,
        title: source.title,
        url: source.url,
        category: source.category,
        priority: source.priority,
        refreshedAt: runAt,
        finalUrl: snapshot.finalUrl,
        status: snapshot.status,
        accessible: snapshot.accessible,
        captureStatus: snapshot.captureStatus,
        bodyHash: snapshot.bodyHash,
        textHash: snapshot.textHash,
        latestJsonPath: path.relative(ROOT, path.join(sourceDir, "latest.json")),
        latestTextPath: path.relative(ROOT, txtPath),
        notes: snapshot.notes
      });
      process.stdout.write(`captured ${source.id} -> ${snapshot.captureStatus}\n`);
    } catch (error) {
      const errorRecord = {
        id: source.id,
        title: source.title,
        url: source.url,
        category: source.category,
        priority: source.priority,
        refreshedAt: runAt,
        accessible: false,
        captureStatus: "fetch_error",
        notes: error?.message || String(error)
      };
      writeJson(path.join(sourceDir, "latest.json"), errorRecord);
      index.sources.push(errorRecord);
      process.stdout.write(`failed ${source.id} -> ${errorRecord.notes}\n`);
    }
  }

  writeJson(SNAPSHOT_INDEX_PATH, index);
  process.stdout.write(`wrote ${path.relative(ROOT, SNAPSHOT_INDEX_PATH)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
