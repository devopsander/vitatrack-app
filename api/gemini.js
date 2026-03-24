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
    
    // Map Anthropic-style messages to Gemini format (supporting multimodal)
    let geminiContents = anthropicBody.messages.map(msg => {
        let parts = [];
        
        if (typeof msg.content === 'string') {
            parts.push({ text: msg.content });
        } else if (Array.isArray(msg.content)) {
            msg.content.forEach(part => {
                if (part.type === 'text') {
                    parts.push({ text: part.text });
                } else if (part.type === 'image' || part.source) {
                    // Supporting both {type: 'image', source: {data, media_type}} 
                    // and simplified formats
                    const source = part.source || part;
                    parts.push({
                        inline_data: {
                            mime_type: source.media_type || "image/jpeg",
                            data: source.data
                        }
                    });
                }
            });
        }

        return {
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: parts
        };
    });

    // Prepend system instruction safely
    if (anthropicBody.system && geminiContents.length > 0 && geminiContents[0].role === 'user') {
        const textPart = geminiContents[0].parts.find(p => p.text);
        if (textPart) {
            textPart.text = `INSTRUÇÕES DE SISTEMA:\n${anthropicBody.system}\n\n---\n\n${textPart.text}`;
        } else {
            geminiContents[0].parts.unshift({ text: `INSTRUÇÕES DE SISTEMA:\n${anthropicBody.system}` });
        }
    }

    const geminiPayload = {
        contents: geminiContents
    };

    const modelName = anthropicBody.model || 'gemini-flash-latest';
    // Call Gemini (Using v1beta which is more updated for Flash)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    
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
