/**
 * VitaTrack Anthropic API Integration
 */

class AnthropicAPI {
    constructor() {
        this.baseUrl = '/api/gemini';
        this.model = 'gemini-2.0-flash'; 
    }

    async callAPI(systemPrompt, userPrompt) {
        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.model, 
                    max_tokens: 1024,
                    system: systemPrompt,
                    messages: [
                        { role: 'user', content: userPrompt }
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

    async analyzeMeal(mealString) {
        const sys = `Você é um nutricionista especialista. O usuário vai descrever uma refeição.
Sua tarefa é estimar as calorias, proteínas (g), carboidratos (g) e gorduras (g) dessa refeição.
Retorne APENAS um objeto JSON válido, sem texto adicional, no formato:
{"calorias": 0, "proteinas": 0, "carboidratos": 0, "gorduras": 0}`;

        const text = await this.callAPI(sys, `Refeição: ${mealString}`);
        try {
            // Find JSON in the response in case Claude added markdown like \`\`\`json
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
