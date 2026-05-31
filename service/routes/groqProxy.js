const express = require("express");
const router = express.Router();

router.post("/", async (req, res) => {
  const apiKey = process.env.GROQ_API_KEY;
  const { prompt, model, max_tokens = 200, temperature = 0.5 } = req.body || {};

  if (!apiKey) return res.status(503).json({ error: "GROQ_API_KEY not configured" });
  if (!prompt) return res.status(400).json({ error: "prompt is required" });

  try {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: model || process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        max_tokens,
        temperature,
      }),
    });

    if (!groqRes.ok) {
      const err = await groqRes.text();
      return res.status(502).json({ error: "groq error", detail: err });
    }

    const json = await groqRes.json();
    const text = (json?.choices?.[0]?.message?.content ?? "").trim();
    return res.json({ text });
  } catch (e) {
    console.error("[groq-proxy] error:", e.message);
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
