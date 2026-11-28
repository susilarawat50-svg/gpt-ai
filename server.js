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

// ElevenLabs (Bunty जस्तो आवाज)
const ELEVEN = {
  key: process.env.ELEVENLABS_API_KEY || "",
  voice: process.env.ELEVEN_VOICE_ID || "",
  model: process.env.ELEVEN_MODEL || "eleven_v3",
};
const elevenReady = Boolean(ELEVEN.key && ELEVEN.voice);

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

const CHAT_SYSTEM = `तिमी GPT हौ: न्यानो, जिज्ञासु, इमानदार र साँच्चै काम लाग्ने सहयोगी AI।

यो वेबसाइटमा भएका सुविधा (प्रयोगकर्ताले सोधे यिनैतिर डोर्‍याऊ, "सक्दिनँ" नभन):
- 🔊 आवाज मोड: लेखलाई Bunty (ElevenLabs) वा Gemini आवाजमा बदल्छ। हरेक जवाफमुनिको "🔊 सुन्नुहोस्" ले पनि Bunty को आवाजमा पढ्छ।
- 🎬 भिडियो मोड: फोटोहरू थपेर, "✍️ AI स्क्रिप्ट" ले स्क्रिप्ट लेखेर, आवाज "AI (Bunty)" छानेर, ढोल संगीत र subtitle सहित ठाडो (9:16) भिडियो बनाउँछ र download गर्न दिन्छ। भिडियोमा आवाज यहीँबाट आफैं हालिन्छ।
- 🖼️ फोटो बनाउने मोड: लेखेर नयाँ फोटो बनाउँछ, वा फोटो थपेर edit गर्छ।
- 🌐 वेबसाइट मोड: एउटै HTML पेज बनाउँछ।
कुराकानी (यो मोड) मा तिमी आफैं आवाज वा भिडियो फाइल दिन सक्दैनौ, त्यसैले भिडियो/आवाज मागे छोटो स्क्रिप्ट दिएर माथिको मोड कसरी चलाउने भनेर २–३ चरणमा बताऊ।

बोल्ने तरिका:
- प्रयोगकर्ता जुन भाषामा लेख्छ (नेपाली, Romanized नेपाली वा अंग्रेजी), त्यही भाषामा उत्तर देऊ। Romanized नेपालीमा सोधे देवनागरीमा जवाफ देऊ।
- सीधै मुख्य उत्तरबाट सुरु गर। "राम्रो प्रश्न!" जस्ता भूमिका नबाँध, प्रश्न नदोहोर्‍याऊ।
- साथीसँग कुरा गरेझैँ सहज भाषा प्रयोग गर, तर काम परेको बेला व्यवस्थित र स्पष्ट होऊ।
- सानो प्रश्नको छोटो उत्तर, ठूलो कामको पूरा र चरणबद्ध उत्तर देऊ। सूची तब मात्र बनाऊ जब त्यसले बुझ्न सजिलो बनाउँछ।
- प्रश्न अस्पष्ट छ भने एउटा छोटो प्रश्न सोध, नत्र सबैभन्दा उचित अर्थ लगाएर काम गर।

इमानदारी:
- थाहा नभएको वा पक्का नभएको कुरा स्पष्ट भन। तथ्य, तथ्याङ्क वा समाचार आफैँ नबनाऊ।
- तिम्रो जानकारी पुरानो हुन सक्छ; ताजा खबर, स्कोर वा मूल्य सोधे यो कुरा भन।
- प्रयोगकर्ताको विचारमा कमजोरी देखे विनम्र भएर भन; खाली प्रशंसा नगर।
- आफूले गर्न नसक्ने काम (इन्टरनेट खोज्ने, फाइल बचत गर्ने आदि) गरेको दाबी नगर।

विशेष सीप: नेपाली क्रिकेट/खेल कन्टेन्ट, YouTube/TikTok स्क्रिप्ट, भिडियो आइडिया, समाचार लेखन, पढाइ, कोडिङ।
भिडियो स्क्रिप्ट माग्दा: पहिलो ३ सेकेन्डमा ध्यान तान्ने hook, छोटा र जोसिला वाक्य, अन्त्यमा subscribe/follow गर्न आग्रह।`;

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

function errCode(err) {
  const m = String(err?.message || "");
  const c = err?.status || err?.code || (m.match(/\b(4\d\d|5\d\d)\b/) || [])[1];
  return c ? String(c) : "";
}

// Gemini व्यस्त (503/500) भए आफैं फेरि प्रयास गर्ने, अनि अर्को model मा सर्ने
const FALLBACKS = (process.env.GEMINI_FALLBACK_MODELS || "gemini-flash-latest,gemini-flash-lite-latest")
  .split(",").map((m) => m.trim()).filter(Boolean);

function isBusy(err) {
  const m = String(err?.message || "") + " " + (err?.status || "");
  return /\b(500|502|503|504)\b|overload|unavailable|high demand|internal|deadline|fetch failed|ECONNRESET|timeout/i.test(m);
}

// दैनिक सीमा (429) सकिएको model लाई केही समय नछुने
const exhausted = new Map(); // model -> कहिलेसम्म

function isQuota(err) {
  return /\b429\b|quota|exhausted|rate.?limit/i.test(String(err?.message || "") + " " + (err?.status || ""));
}

function retrySeconds(err) {
  const m = String(err?.message || "").match(/retryDelay"?\s*:\s*"?(\d+)s/);
  return m ? Number(m[1]) : 60;
}

async function gen(params) {
  // फोटो/आवाजको model मा fallback नगर्ने, कुराकानी र वेबसाइटमा मात्र
  const canFallback = params.model === MODELS.chat;
  let models = canFallback ? [params.model, ...FALLBACKS.filter((m) => m !== params.model)] : [params.model];
  const now = Date.now();
  const fresh = models.filter((m) => !(exhausted.get(m) > now));
  if (fresh.length) models = fresh;
  let last;
  for (let mi = 0; mi < models.length; mi++) {
    const tries = mi === 0 ? 2 : 1;
    for (let i = 0; i < tries; i++) {
      try {
        return await ai.models.generateContent({ ...params, model: models[mi] });
      } catch (err) {
        last = err;
        const m = String(err?.message || "");
        if (/not found|404/i.test(m) && mi > 0) break; // fallback model छैन भने अर्कोमा
        if (isQuota(err)) {
          exhausted.set(models[mi], Date.now() + retrySeconds(err) * 1000);
          console.error("quota over for", models[mi], "- switching");
          break; // यही model मा फेरि प्रयास नगर्ने, अर्कोमा सर्ने
        }
        if (!isBusy(err)) throw err;
        if (i < tries - 1) await new Promise((r) => setTimeout(r, 1200));
      }
    }
    if (!canFallback) break;
  }
  throw last;
}

function fail(res, err, label) {
  console.error(label, err?.message || err);
  const msg = String(err?.message || "");
  const code = errCode(err);
  let text = "AI सर्भरबाट उत्तर आउन सकेन। फेरि प्रयास गर्नुहोस्।";
  if (/not found|404/i.test(msg)) text = "AI model भेटिएन। model को नाम जाँच्नुहोस्।";
  else if (/quota|429|exhausted|rate/i.test(msg)) text = /per day|PerDay/i.test(msg) ? "आजको Gemini फ्री सीमा सकियो। भोलि दिउँसो (करिब १:४५ बजे) पछि फेरि चल्छ।" : "Gemini को फ्री सीमा अहिलेलाई सकियो। १ मिनेट पर्खेर फेरि पठाउनुहोस्।";
  else if (/overload|unavailable|503|high demand/i.test(msg)) text = "Gemini सर्भर अहिले धेरै व्यस्त छ। केही सेकेन्डपछि फेरि पठाउनुहोस्।";
  else if (/401|403|api key|permission|unauthenticated|credential/i.test(msg)) text = "Gemini API key मिलेन वा अनुमति छैन।";
  else if (/safety|blocked/i.test(msg)) text = "यो अनुरोध AI ले सुरक्षाका कारण अस्वीकार गर्‍यो।";
  if (code) text += ` (कोड ${code})`;
  res.status(500).json({ error: text });
}

function buildHistory(history) {
  const contents = [];
  const recent = Array.isArray(history) ? history.slice(-20) : [];
  for (const item of recent) {
    if (item?.role === "user" || item?.role === "model") {
      const t = String(item.text || "").slice(0, 5000);
      const prev = contents[contents.length - 1];
      if (prev && prev.role === item.role) prev.parts[0].text += "\n" + t;
      else contents.push({ role: item.role, parts: [{ text: t }] });
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
  res.json({ ready: Boolean(ai), needCode: Boolean(ACCESS_CODE), eleven: elevenReady, models: MODELS });
});

// ElevenLabs बाट आवाज (Bunty)
app.post("/api/eleven", (req, res, next) => {
  if (ACCESS_CODE && req.get("x-access-code") !== ACCESS_CODE) {
    return res.status(401).json({ error: "पहुँच कोड मिलेन।", needCode: true });
  }
  next();
}, heavyLimiter, async (req, res) => {
  try {
    if (!elevenReady) {
      return res.status(503).json({ error: "ElevenLabs सेट छैन। .env मा ELEVENLABS_API_KEY र ELEVEN_VOICE_ID राख्नुहोस्।" });
    }
    const text = String(req.body?.text || "").trim().slice(0, 3000);
    if (!text) return res.status(400).json({ error: "आवाजमा बदल्ने लेख चाहिन्छ।" });

    const r = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(ELEVEN.voice)}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": ELEVEN.key, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({ text, model_id: ELEVEN.model }),
      }
    );
    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      console.error("eleven:", r.status, detail.slice(0, 300));
      let msg = "ElevenLabs बाट आवाज आउन सकेन।";
      if (r.status === 401) msg = "ElevenLabs API key मिलेन।";
      else if (r.status === 404) msg = "ElevenLabs voice ID भेटिएन। ELEVEN_VOICE_ID जाँच्नुहोस्।";
      else if (/quota|credits/i.test(detail)) msg = "ElevenLabs को credit सकियो।";
      else if (r.status === 402 || /paid|subscription|library/i.test(detail)) msg = "यो voice फ्री प्लानमा API बाट चलाउन मिलेन।";
      let why = "";
      try { const j = JSON.parse(detail); why = j?.detail?.message || j?.detail?.status || ""; } catch {}
      msg += ` (कोड ${r.status}${why ? ": " + String(why).slice(0, 120) : ""})`;
      return res.status(502).json({ error: msg });
    }
    const buf = Buffer.from(await r.arrayBuffer());
    res.json({ audio: buf.toString("base64"), mimeType: "audio/mpeg" });
  } catch (err) {
    fail(res, err, "eleven:");
  }
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

    const result = await gen({
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

    const result = await gen({
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

    const result = await gen({
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

    const result = await gen({
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
