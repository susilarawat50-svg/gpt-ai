# GPT AI Assistant

कुराकानी, फोटो बनाउने, आवाज बनाउने र वेबसाइट बनाउने AI वेबसाइट। भित्र Google Gemini API चल्छ।

## फोल्डरमा के-के छ

```
ai-site/
├── server.js          ← सर्भर (AI सँग कुरा गर्ने)
├── package.json       ← चाहिने package को सूची
├── .env.example       ← key राख्ने नमुना
├── .gitignore         ← .env लाई GitHub मा जान नदिने
└── public/
    └── index.html     ← वेबसाइटको पेज
```

## १. कम्प्युटरमा चलाउने

1. `.env.example` लाई copy गरेर नाम `.env` राख्नुहोस्।
2. त्यसमा आफ्नो `GEMINI_API_KEY` राख्नुहोस्।
3. Terminal मा:
   ```
   npm install
   npm start
   ```
4. Browser मा `http://localhost:3000` खोल्नुहोस्।

## २. अनलाइन राख्ने (Render.com, सुरुमा निःशुल्क)

1. **GitHub मा राख्नुहोस्:** github.com मा नयाँ repository बनाउनुहोस्, अनि यो फोल्डरका सबै फाइल upload गर्नुहोस्। तर `.env` फाइल upload **नगर्नुहोस्**।
2. **Render मा जोड्नुहोस्:** render.com मा GitHub बाट login गर्नुहोस्। **New → Web Service** थिचेर आफ्नो repository छान्नुहोस्।
3. **सेटिङ यस्तो राख्नुहोस्:**
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance Type: Free
4. **Environment Variables मा थप्नुहोस्:**
   - `GEMINI_API_KEY` = तपाईंको key
   - `ACCESS_CODE` = आफूले रोजेको पासवर्ड
5. **Deploy** थिच्नुहोस्। केही मिनेटमा `https://तपाईंको-नाम.onrender.com` जस्तो link पाउनुहुन्छ।

Free plan मा केही बेर कसैले नचलाए सर्भर सुत्छ। त्यसपछि पहिलोपटक खोल्दा ३०–५० सेकेन्ड लाग्न सक्छ।

## पहुँच कोड (ACCESS_CODE) किन?

अनलाइन राखेपछि link पाउने जोसुकैले तपाईंको API key खर्च गर्न सक्छन्। `ACCESS_CODE` राख्नुभयो भने पहिलोपटक खोल्दा पासवर्ड माग्छ। पासवर्ड जान्नेले मात्र चलाउन पाउँछन्।

## समस्या आयो भने

| देखिएको सन्देश | के गर्ने |
|---|---|
| API key सेट छैन | `.env` वा Render को Environment मा `GEMINI_API_KEY` जाँच्नुहोस् |
| AI model भेटिएन | Google AI Studio मा model को सही नाम हेरेर `.env` मा बदल्नुहोस् |
| API को सीमा सकियो | Free key को दैनिक सीमा सकियो। भोलि प्रयास गर्नुहोस् वा billing चालु गर्नुहोस् |
| फोटो/आवाज बनेन | फोटो र आवाज बनाउने model लाई free key मा कम सीमा हुन्छ |
