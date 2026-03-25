/**
 * VitaTrack Gemini API Integration (via Vercel Proxy)
 */

export class GeminiAPI {
    constructor() {
        this.baseUrl = '/api/gemini';
        this.model = 'gemini-1.5-flash'; 
    }

    async callAPI(systemPrompt, userPrompt, imageBase64 = null) {
        try {
            const body = {
                model: this.model,
                system_instruction: systemPrompt,
                messages: [
                    {
                        role: "user",
                        content: imageBase64 ? [
                            { type: "text", text: userPrompt },
                            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
                        ] : userPrompt
                    }
                ]
            };

            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || response.statusText);
            }

            const data = await response.json();
            return data.candidates[0].content.parts[0].text;
        } catch (error) {
            console.error("error API:", error);
            throw new Error(error.message || "Erro de conexão com API");
        }
    }

    async analyzeMeal(mealString, imageBase64 = null) {
        const sys = `Você é um nutricionista especialista. Analise a refeição e retorne APENAS um JSON:
        {"nome": "string", "calorias": 0, "proteinas": 0, "carboidratos": 0, "gorduras": 0, "fibras": 0, "sodio_mg": 0, "acucar": 0, "vitamina_c_mg": 0, "ferro_mg": 0, "calcio_mg": 0, "comentarios": "string"}`;

        const prompt = imageBase64 ? `Analise esta foto: ${mealString}` : `Refeição: ${mealString}`;
        const text = await this.callAPI(sys, prompt, imageBase64);
        try {
            const jsonStr = text.match(/\{[\s\S]*\}/)[0];
            return JSON.parse(jsonStr);
        } catch (e) {
            throw new Error("Falha ao analisar a resposta da IA.");
        }
    }

    async generateGoals(profileObj) {
        const sys = `Analise os dados e sugira metas. Retorne APENAS JSON:
        {"goalWeight": 70, "goalCalories": 2000, "goalProtein": 150, "goalCarbs": 200, "goalFat": 60}`;
        
        const text = await this.callAPI(sys, `Perfil: ${JSON.stringify(profileObj)}`);
        try {
            const jsonStr = text.match(/\{[\s\S]*\}/)[0];
            return JSON.parse(jsonStr);
        } catch (e) {
            throw new Error("Falha ao processar as metas.");
        }
    }

    async getMotivationalMessage(context) {
        const sys = `Crie uma mensagem curta motivacional (máx 2 frases).`;
        const text = await this.callAPI(sys, `Contexto: ${JSON.stringify(context)}`);
        return text.replace(/"/g, '').trim();
    }

    async chatMessage(history, currentContext, userMessage) {
        const system = `Você é o Vitta, assistente do VitaTrack. Contexto: ${JSON.stringify(currentContext)}`;
        const userPrompt = `Histórico: ${JSON.stringify(history)}\n\nPergunta: ${userMessage}`;
        return await this.callAPI(system, userPrompt);
    }
}

const api = new GeminiAPI();
export default api;
window.api = api;
