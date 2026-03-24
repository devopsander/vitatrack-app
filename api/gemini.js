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
    let geminiContents = anthropicBody.messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
    }));

    // Prepend system instruction to the first message to avoid "unknown field" errors across different API versions
    if (anthropicBody.system && geminiContents.length > 0 && geminiContents[0].role === 'user') {
        geminiContents[0].parts[0].text = `INSTRUÇÕES DE SISTEMA:\n${anthropicBody.system}\n\n---\n\nMENSAGEM DO USUÁRIO:\n${geminiContents[0].parts[0].text}`;
    }

    const geminiPayload = {
        contents: geminiContents
    };

    const modelName = anthropicBody.model || 'gemini-1.5-flash';
    // Call Gemini (Using v1beta which is more updated for Flash)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    
    console.log("Calling Gemini API:", geminiUrl.replace(apiKey, "HIDDEN"));
    
    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(geminiPayload),
    });

    const data = await response.json();
    
    if (!response.ok) {
        // Diagnostic: If model not found, try to list models to see what's available
        if (data.error && data.error.message && (data.error.message.includes("not found") || data.error.message.includes("not supported"))) {
            try {
                const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
                const listRes = await fetch(listUrl);
                const listData = await listRes.json();
                const availableModels = listData.models ? listData.models.map(m => m.name.replace("models/", "")).join(", ") : "none";
                data.error.message += `. Modelos disponíveis para sua chave: ${availableModels}`;
            } catch (listErr) {
                data.error.message += `. (Falha ao listar modelos: ${listErr.message})`;
            }
        }
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
