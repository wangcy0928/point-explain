// Point & Explain — describes the object a blind user is pointing at.
// The browser sends a JPEG with a red ring drawn around the pointed spot.
// Env: DEEPSEEK_API_KEY (required), DEEPSEEK_MODEL (optional, default deepseek-flash)

const PROMPT =
  "You help a blind person walking around. They are pointing at the object inside the RED RING. " +
  "Say what that object is plus the one detail that matters most to them " +
  "(text written on it, whether it is open or closed, on or off, a step or edge, how far in arm lengths). " +
  "Maximum 12 words, plain spoken English, no 'I see', no mention of the ring. " +
  "If you cannot tell, answer exactly: Not sure, move closer and point again.";

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ ok: true, hasKey: !!process.env.DEEPSEEK_API_KEY });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return res.status(500).json({ error: "DEEPSEEK_API_KEY is not set" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const image = body && body.image;
  if (!image || !String(image).startsWith("data:image/")) {
    return res.status(400).json({ error: "image (data URL) is required" });
  }

  try {
    const r = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || "deepseek-flash",
        thinking: { type: "disabled" },
        max_tokens: 60,
        temperature: 0.2,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            { type: "image_url", image_url: { url: image } }
          ]
        }]
      })
    });
    const data = await r.json();
    if (!r.ok) {
      return res.status(502).json({ error: (data.error && data.error.message) || "DeepSeek error " + r.status });
    }
    let text = (data.choices && data.choices[0] && data.choices[0].message.content || "").trim();
    text = text.replace(/^["']|["']$/g, "").replace(/\s+/g, " ");
    return res.status(200).json({ text: text || "Not sure, move closer and point again." });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
};
