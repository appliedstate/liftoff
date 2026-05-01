const samplePayload = {
  transcript: "Still searching for a workable next step? Review current study options and what participation may involve.",
  primaryText: "Current sleep apnea studies are exploring new approaches. Review study details and participation information.",
  headline: "Explore Current Sleep Apnea Studies",
  description: "See eligibility criteria, study details, and what participation may involve.",
  landingArticleTitle: "How to Find Sleep Apnea Clinical Trials in the US",
  landingArticleSummary: "A guide to current sleep apnea clinical trials, how participation works, and how to review eligibility.",
  landingArticleBody: "This article explains how sleep apnea clinical research works, what current studies may examine, and how readers can review eligibility and participation steps.",
  forceRewrite: true
};

const keyInput = document.querySelector("#apiKey");
const payloadInput = document.querySelector("#payload");
const output = document.querySelector("#output");
const statusNode = document.querySelector("#status");
const healthButton = document.querySelector("#healthCheck");
const runButton = document.querySelector("#runHarness");

payloadInput.value = JSON.stringify(samplePayload, null, 2);

function setStatus(message, type = "") {
  statusNode.textContent = message;
  statusNode.className = `status ${type}`.trim();
}

async function request(path, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json");

  const apiKey = keyInput.value.trim();
  if (apiKey) {
    headers.set("authorization", `Bearer ${apiKey}`);
  }

  const response = await fetch(path, { ...init, headers });
  const text = await response.text();

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }

  if (!response.ok) {
    throw new Error(typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2));
  }

  return parsed;
}

healthButton.addEventListener("click", async () => {
  setStatus("Checking upstream health...");
  output.textContent = "";
  try {
    const data = await request("/api/health", { method: "GET" });
    output.textContent = JSON.stringify(data, null, 2);
    setStatus("Health check passed.", "ok");
  } catch (error) {
    output.textContent = String(error.message || error);
    setStatus("Health check failed.", "error");
  }
});

runButton.addEventListener("click", async () => {
  setStatus("Running Meta policy harness...");
  output.textContent = "";

  let body;
  try {
    body = JSON.parse(payloadInput.value);
  } catch (error) {
    setStatus("Payload JSON is invalid.", "error");
    output.textContent = String(error.message || error);
    return;
  }

  try {
    const data = await request("/api/meta-policy/run", {
      method: "POST",
      body: JSON.stringify(body)
    });
    output.textContent = JSON.stringify(data, null, 2);
    setStatus("Harness response received.", "ok");
  } catch (error) {
    output.textContent = String(error.message || error);
    setStatus("Harness request failed.", "error");
  }
});
