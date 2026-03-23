export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not set in Vercel." });
    }

    const anthropicBody = req.body;
    
    // Map Anthropic format to Gemini format
    const geminiContents = anthropicBody.messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
    }));

    const geminiPayload = {
        contents: geminiContents
    };

    if (anthropicBody.system) {
        geminiPayload.systemInstruction = {
            parts: [{ text: anthropicBody.system }]
        };
    }

    // Call Gemini 1.5 Flash
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(geminiPayload),
    });

    const data = await response.json();
    
    if (!response.ok) {
        return res.status(response.status).json(data);
    }

    // Map Gemini response back to Anthropic format for the frontend
    const answerText = data.candidates && data.candidates[0] && data.candidates[0].content 
        ? data.candidates[0].content.parts[0].text 
        : "";

    return res.status(200).json({
        content: [{ text: answerText }]
    });

  } catch (err) {
    return res.status(500).json({ error: "Proxy error", detail: err.message });
  }
}
