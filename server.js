import express from "express";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
app.set("trust proxy", 1); // Render जस्ता होस्टिङमा सही IP पाउन
app.use(express.json({ limit: "15mb" }));
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
const MODELS = {
  chat: process.env.GEMINI_MODEL || "gemini-3.8-flash",
  image: process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image",
  tts: process.env.GEMINI_TTS_MODEL || "gemini-3.1-flash-tts-preview",
};
const ACCESS_CODE = process.env.ACCESS_CODE || ""; // खाली भए जसले पनि चलाउन पाउँछ

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

const CHAT_SYSTEM =
  "तिमी GPT नामको सहयोगी AI हौ। प्रयोगकर्ताले नेपालीमा सोधे नेपालीमै, अंग्रेजीमा सोधे अंग्रेजीमै स्पष्ट, उपयोगी र इमानदार उत्तर देऊ। " +
  "उत्तर सजिलो र व्यवस्थित राख। थाहा नभएको कुरा थाहा छैन भन। आफूले गर्न नसक्ने काम गरेको दाबी नगर।";

const SITE_SYSTEM =
  "तिमी web developer हौ। प्रयोगकर्ताले भनेअनुसार एउटै पूरा HTML फाइल बनाऊ: CSS <style> भित्र र JavaScript <script> भित्र। " +
  "मोबाइलमा पनि राम्रो देखिने, आधुनिक र सफा डिजाइन बनाऊ। बाहिरी फोटोको सट्टा CSS gradient वा emoji प्रयोग गर। " +
  "पहिलेको HTML दिइएको छ भने त्यसैमा माग गरिएको परिवर्तन गरेर पूरा फाइल फेरि देऊ। " +
  "उत्तरमा <!DOCTYPE html> देखि </html> सम्मको code मात्र देऊ, अरू व्याख्या वा ``` नलेख।";

// ---------- सुरक्षा ----------
const limiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "धेरै छिटो अनुरोध पठाउनुभयो। एक मिनेटपछि फेरि प्रयास गर्नुहोस्।" },
});
// फोटो र आवाज महँगो हुन्छ, त्यसैले कडा सीमा
const heavyLimiter = rateLimit({
  windowMs: 60_000,
  max: 6,
  message: { error: "फोटो/आवाज एक मिनेटमा ६ पटकभन्दा बढी बनाउन मिल्दैन।" },
});

function guard(req, res, next) {
  if (!ai) {
    return res.status(503).json({ error: "सर्भरमा GEMINI_API_KEY सेट गरिएको छैन।" });
  }
  if (ACCESS_CODE && req.get("x-access-code") !== ACCESS_CODE) {
    return res.status(401).json({ error: "पहुँच कोड मिलेन।", needCode: true });
  }
  next();
}
app.use("/api", limiter);

function fail(res, err, label) {
  console.error(label, err?.message || err);
  const msg = String(err?.message || "");
  let text = "AI सर्भरबाट उत्तर आउन सकेन। फेरि प्रयास गर्नुहोस्।";
  if (/not found|404/i.test(msg)) text = "AI model भेटिएन। .env मा model को नाम जाँच्नुहोस्।";
  else if (/quota|429|exhausted/i.test(msg)) text = "API को सीमा सकियो। केही बेरपछि प्रयास गर्नुहोस् वा billing जाँच्नुहोस्।";
  else if (/safety|blocked/i.test(msg)) text = "यो अनुरोध AI ले सुरक्षाका कारण अस्वीकार गर्‍यो।";
  res.status(500).json({ error: text });
}

function buildHistory(history) {
  const contents = [];
  const recent = Array.isArray(history) ? history.slice(-12) : [];
  for (const item of recent) {
    if (item?.role === "user" || item?.role === "model") {
      contents.push({ role: item.role, parts: [{ text: String(item.text || "").slice(0, 5000) }] });
    }
  }
  while (contents.length && contents[0].role !== "user") contents.shift();
  return contents;
}

function imagePart(image) {
  if (image?.data && typeof image.mimeType === "string" && image.mimeType.startsWith("image/")) {
    return { inlineData: { mimeType: image.mimeType, data: image.data } };
  }
  return null;
}

// Gemini TTS ले कच्चा PCM (24kHz, 16-bit, mono) दिन्छ, त्यसलाई WAV बनाउने
function pcmToWav(pcm, sampleRate = 24000, channels = 1, bits = 16) {
  const header = Buffer.alloc(44);
  const byteRate = (sampleRate * channels * bits) / 8;
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE((channels * bits) / 8, 32);
  header.writeUInt16LE(bits, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

// ---------- API ----------
app.get("/api/status", (_req, res) => {
  res.json({ ready: Boolean(ai), needCode: Boolean(ACCESS_CODE), models: MODELS });
});

// १. कुराकानी (फोटो पनि पठाउन मिल्छ)
app.post("/api/chat", guard, async (req, res) => {
  try {
    const { message, history, image } = req.body || {};
    if ((!message || !String(message).trim()) && !image) {
      return res.status(400).json({ error: "कृपया सन्देश वा फोटो पठाउनुहोस्।" });
    }
    const contents = buildHistory(history);
    const parts = [{ text: String(message || "यो फोटोमा के छ?").slice(0, 10000) }];
    const img = imagePart(image);
    if (img) parts.push(img);
    contents.push({ role: "user", parts });

    const result = await ai.models.generateContent({
      model: MODELS.chat,
      contents,
      config: { systemInstruction: CHAT_SYSTEM },
    });
    res.json({ reply: result.text || "यसपटक उत्तर प्राप्त भएन। फेरि प्रयास गर्नुहोस्।" });
  } catch (err) {
    fail(res, err, "chat:");
  }
});

// २. फोटो बनाउने (फोटो दिएर सम्पादन गर्न पनि मिल्छ)
app.post("/api/image", guard, heavyLimiter, async (req, res) => {
  try {
    const { prompt, image } = req.body || {};
    if (!prompt || !String(prompt).trim()) {
      return res.status(400).json({ error: "कस्तो फोटो बनाउने हो, लेख्नुहोस्।" });
    }
    const parts = [{ text: String(prompt).slice(0, 4000) }];
    const img = imagePart(image);
    if (img) parts.push(img);

    const result = await ai.models.generateContent({
      model: MODELS.image,
      contents: [{ role: "user", parts }],
      config: { responseModalities: ["TEXT", "IMAGE"] },
    });

    const outParts = result.candidates?.[0]?.content?.parts || [];
    const images = [];
    let text = "";
    for (const p of outParts) {
      if (p.inlineData?.data) images.push({ mimeType: p.inlineData.mimeType || "image/png", data: p.inlineData.data });
      else if (p.text) text += p.text;
    }
    if (!images.length) {
      return res.status(422).json({ error: text || "फोटो बन्न सकेन। अर्को तरिकाले लेखेर हेर्नुहोस्।" });
    }
    res.json({ images, text });
  } catch (err) {
    fail(res, err, "image:");
  }
});

// ३. लेखलाई आवाजमा बदल्ने
const VOICES = ["Kore", "Puck", "Charon", "Fenrir", "Aoede", "Leda", "Orus", "Zephyr"];
app.post("/api/tts", guard, heavyLimiter, async (req, res) => {
  try {
    const { text, voice, style } = req.body || {};
    if (!text || !String(text).trim()) {
      return res.status(400).json({ error: "आवाजमा बदल्ने लेख चाहिन्छ।" });
    }
    const voiceName = VOICES.includes(voice) ? voice : "Kore";
    const clean = String(text).replace(/[*#_`>]/g, "").slice(0, 3000);
    const prompt = style ? `${String(style).slice(0, 200)}: ${clean}` : clean;

    const result = await ai.models.generateContent({
      model: MODELS.tts,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
      },
    });

    const part = result.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    if (!part) return res.status(422).json({ error: "आवाज बन्न सकेन। फेरि प्रयास गर्नुहोस्।" });

    const raw = Buffer.from(part.inlineData.data, "base64");
    const mime = part.inlineData.mimeType || "";
    const rate = Number(/rate=(\d+)/.exec(mime)?.[1]) || 24000;
    const wav = mime.includes("wav") ? raw : pcmToWav(raw, rate);
    res.json({ audio: wav.toString("base64"), mimeType: "audio/wav" });
  } catch (err) {
    fail(res, err, "tts:");
  }
});

// ४. वेबसाइट बनाउने
app.post("/api/website", guard, async (req, res) => {
  try {
    const { prompt, currentHtml } = req.body || {};
    if (!prompt || !String(prompt).trim()) {
      return res.status(400).json({ error: "कस्तो वेबसाइट बनाउने हो, लेख्नुहोस्।" });
    }
    let text = "अनुरोध: " + String(prompt).slice(0, 4000);
    if (currentHtml) text = "पहिलेको HTML:\n" + String(currentHtml).slice(0, 60000) + "\n\n" + text;

    const result = await ai.models.generateContent({
      model: MODELS.chat,
      contents: [{ role: "user", parts: [{ text }] }],
      config: { systemInstruction: SITE_SYSTEM },
    });

    let html = (result.text || "").trim();
    html = html.replace(/^```(?:html)?\s*/i, "").replace(/```\s*$/, "").trim();
    const start = html.search(/<!DOCTYPE html>|<html/i);
    if (start > 0) html = html.slice(start);
    if (!/<html/i.test(html)) {
      return res.status(422).json({ error: "वेबसाइट बन्न सकेन। अलि स्पष्ट गरी फेरि लेख्नुहोस्।" });
    }
    res.json({ html });
  } catch (err) {
    fail(res, err, "website:");
  }
});

app.listen(PORT, () => console.log(`GPT is running on http://localhost:${PORT}`));
