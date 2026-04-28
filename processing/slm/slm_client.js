const SLM_ENDPOINT = process.env.SLM_ENDPOINT || "http://localhost:11434";
const SLM_MODEL    = process.env.SLM_MODEL    || "gemma4:e4b";
const SLM_TIMEOUT  = Number(process.env.SLM_TIMEOUT_MS) || 30000;

async function callSlm(prompt) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SLM_TIMEOUT);
  try {
    const res = await fetch(`${SLM_ENDPOINT}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: SLM_MODEL, prompt, stream: false }),
      signal: controller.signal
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "<unable to read body>");
      console.error(`[slm_client] ERROR HTTP ${res.status} ${res.statusText} - ${body}`);
      return null;
    }
    const json = await res.json();
    const text = (json?.response ?? "").trim();
    if (text.length === 0) {
      console.error(`[slm_client] ERROR empty response JSON: ${JSON.stringify(json)}`);
      return null;
    }
    return text;
  } catch (err) {
    console.error("[slm_client] ERROR]", err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { callSlm };
