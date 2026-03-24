/**
 * VitaTrack Anthropic API Integration
 */

class AnthropicAPI {
    constructor() {
        this.baseUrl = '/api/gemini';
        this.model = 'gemini-flash-latest'; 
    }

    async callAPI(systemPrompt, userPrompt, imageBase64 = null) {
        try {
            let content;
            if (imageBase64) {
                content = [
                    { type: 'text', text: userPrompt },
                    { type: 'image', source: { data: imageBase64, media_type: "image/jpeg" } }
                ];
            } else {
                content = userPrompt;
            }

            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.model, 
                    max_tokens: 2048,
                    system: systemPrompt,
                    messages: [
                        { role: 'user', content: content }
                    ]
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error("Erro na API: " + (errData.error?.message || response.statusText));
            }

            const data = await response.json();
            return data.content[0].text;
        } catch (error) {
            console.error("error API:", error);
            throw new Error(error.message || "Erro de conexão com API");
        }
    }

    async analyzeMeal(mealString, imageBase64 = null) {
        const sys = `Você é um nutricionista especialista. 
Sua tarefa é analisar a refeição (seja por descrição textual ou imagem).
Estime as calorias, macronutrientes e micronutrientes principais.
Retorne APENAS um objeto JSON válido no seguinte formato:
{
  "nome": "string",
  "calorias": 0,
  "proteinas": 0,
  "carboidratos": 0,
  "gorduras": 0,
  "fibras": 0,
  "sodio_mg": 0,
  "acucar": 0,
  "vitamina_c_mg": 0,
  "ferro_mg": 0,
  "calcio_mg": 0,
  "comentarios": "string curta"
}`;

        const prompt = imageBase64 ? `Analise esta foto de refeição: ${mealString}` : `Refeição: ${mealString}`;
        const text = await this.callAPI(sys, prompt, imageBase64);
        try {
            const jsonStr = text.match(/\{[\s\S]*\}/)[0];
            return JSON.parse(jsonStr);
        } catch (e) {
            throw new Error("Falha ao analisar a resposta da IA como JSON.");
        }
    }

    async generateGoals(profileObj) {
        const sys = `Você é um nutricionista especialista. Com base nos dados do usuário, sugira uma meta de peso, meta de calorias diárias e distribuição de macronutrientes.
Os objetivos podem ser: 'lose' (emagrecer), 'maintain' (manter), 'gain' (ganhar massa).
Retorne APENAS um JSON válido:
{"goalWeight": 70, "goalCalories": 2000, "goalProtein": 150, "goalCarbs": 200, "goalFat": 60}`;
        
        const userPrompt = `Perfil: ${JSON.stringify(profileObj)}`;
        const text = await this.callAPI(sys, userPrompt);
        
        try {
            const jsonStr = text.match(/\{[\s\S]*\}/)[0];
            return JSON.parse(jsonStr);
        } catch (e) {
            throw new Error("Falha ao processar as metas geradas pela IA.");
        }
    }

    async getMotivationalMessage(context) {
        const sys = `Você é um coach de saúde motivador e empático. Crie uma mensagem curta (máx 2 frases) encorajando o usuário com base no progresso de hoje. Use um tom positivo.`;
        const text = await this.callAPI(sys, `Contexto de hoje: ${JSON.stringify(context)}`);
        return text.replace(/"/g, '').trim();
    }

    async chatMessage(history, currentContext, userMessage) {

        // Build messages array
        const messages = history.map(msg => ({
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: msg.content
        }));
        
        messages.push({ role: 'user', content: userMessage });

        const system = `Você é o Vitta, um assistente virtual especialista em nutrição e saúde para o app VitaTrack. 
Use um tom amigável, encorajador e direto. 
Se você notar que o usuário está abaixo da meta calórica, sugira refeições saudáveis.
Contexto atual do usuário (peso, calorias da meta, calorias consumidas hoje): 
${JSON.stringify(currentContext)}`;

        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.model,
                    max_tokens: 1024,
                    system: system,
                    messages: messages
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error("Erro na API: " + (errData.error?.message || response.statusText));
            }

            const data = await response.json();
            return data.content[0].text;
        } catch (error) {
            console.error("error chatMessage:", error);
            throw new Error(error.message || "Erro de conexão com API (CORS ou falha de rede)");
        }
    }
}

const api = new AnthropicAPI();
