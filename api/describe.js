// Point & Explain — vision answers for a blind user.
// POST { image: dataURL, mode: "point" | "scene" | "read" | "ask", question?: string }
// Env: DEEPSEEK_API_KEY (required), DEEPSEEK_MODEL (optional, default deepseek-flash)

const BASE = "You help a blind person walking around. Plain spoken English, no 'I see', no 'the image shows'. ";

const PROMPTS = {
  point:
    BASE + "They are pointing at the object inside the RED RING. " +
    "Say what that object is plus the one detail that matters most to them " +
    "(text written on it, open or closed, on or off, a step or edge, distance in arm lengths). " +
    "Maximum 12 words, no mention of the ring. " +
    "If you cannot tell, answer exactly: Not sure, move closer and point again.",
  scene:
    BASE + "Describe what is in front of them. Start with anything they could walk into or trip on, " +
    "with direction (left, ahead, right) and rough distance in steps. Then the 1-2 most useful landmarks " +
    "(doors, stairs, counters, signs, people). Maximum 30 words.",
  read:
    BASE + "Read out all the text that is legible, word for word, in normal reading order " +
    "(top to bottom, left to right). Do not summarize or add commentary. Skip tiny unreadable print. " +
    "If the text is long, read the most important part first (headings, prices, names), up to 80 words. " +
    "If there is no readable text, answer exactly: I don't see any text. Try moving closer.",
  ask:
    BASE + "Answer their question about what the camera sees, directly and honestly, maximum 30 words. " +
    "If the picture does not show enough to answer, say so and suggest how to aim the phone. Question: "
};

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ ok: true, hasKey: !!process.env.DEEPSEEK_API_KEY });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return res.status(500).json({ error: "DEEPSEEK_API_KEY is not set" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};
  const image = body.image;
  if (!image || !String(image).startsWith("data:image/")) {
    return res.status(400).json({ error: "image (data URL) is required" });
  }
  const mode = PROMPTS[body.mode] ? body.mode : "point";
  const question = String(body.question || "").slice(0, 300);
  const prompt = mode === "ask" ? PROMPTS.ask + (question || "What is in front of me?") : PROMPTS[mode];

  try {
    const r = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || "deepseek-flash",
        thinking: { type: "disabled" },
        max_tokens: mode === "read" ? 250 : 120,
        temperature: 0.2,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
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
    return res.status(200).json({ mode, text: text || "Not sure, try again." });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
};
