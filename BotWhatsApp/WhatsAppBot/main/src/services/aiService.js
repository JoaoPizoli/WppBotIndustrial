import OpenAI from 'openai';
import config from '../config/index.js';
import { queryDatabase } from '../database/db.js';
import { gerarHumanPrompt, gerarSQLPrompt } from '../utils/prompts.js';


const openai = new OpenAI({ apiKey: config.api.openai.apiKey });
const deep = new OpenAI({ baseURL: 'https://api.deepseek.com', apiKey: config.api.deepseek.apiKey });


export async function generateSQLQuery(userMessage, tentativas = 3) {
    const sqlprompt = gerarSQLPrompt(userMessage);
    try {
        console.log(`🤖 Enviando mensagem para a IA Geradora de Query (tentativa ${4 - tentativas})...`);
        const responseSQL = await deep.chat.completions.create({
            model: "deepseek-chat",
            temperature: 0,
            messages: [{ role: "user", content: sqlprompt }]
        });

        const iaResponse = responseSQL.choices[0].message.content;
        console.log(`✅ Query gerada pela IA: ${iaResponse}`);

        return processUserMessage(iaResponse);
    } catch (error) {
        console.error(`❌ Erro ao chamar LLM para gerar query SQL (tentativa ${4 - tentativas}):`, error.message);
        if (tentativas > 1) {
            console.log(`🔁 Tentando novamente gerar query SQL (${tentativas - 1} tentativas restantes)...`);
            await new Promise(resolve => setTimeout(resolve, 1500 * (4 - tentativas)));
            return generateSQLQuery(userMessage, tentativas - 1);
        } else {
            console.error('❌ Falha ao gerar query SQL após múltiplas tentativas de chamada à LLM.');
            return null;
        }
    }
}

export function executeQuery(query) {
    try {
        console.log('🗄️ Executando a consulta local (SQLite em memória)...');
        const rows = queryDatabase(query);
        return rows;
    } catch (err) {
        console.error('❌ Erro ao executar a consulta local:', err.message);
        throw err;
    }
}

export async function respostaHumanizada(userMessage, respostaModelo, tentativas = 2) {
    const humanprompt = gerarHumanPrompt(userMessage, respostaModelo);
    try {
        console.log(`🧠 Enviando mensagem para a IA Humanizadora de Dados (tentativa ${3 - tentativas})...`);

        const responseHuman = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: 0,
            messages: [{ role: "user", content: humanprompt }]
        });
        const iaResponseHumano = responseHuman.choices[0].message.content;
        console.log(`🤖 Resposta da IA Humanizada: ${iaResponseHumano}`);

        return iaResponseHumano;
    } catch (error) {

        const isFetchError = error.message?.includes("fetch failed") || error.message?.includes("ENOTFOUND") || error.message?.includes("EAI_AGAIN");
        if (isFetchError && tentativas > 0) {
            const maxRetries = 2;
            const waitMs = (maxRetries + 1 - tentativas) ** 2 * 1000;
            console.warn(`❗ Erro de fetch na humanização (${error.message}), aguardando ${waitMs}ms antes de tentar de novo (${tentativas - 1} restantes)…`)
            await new Promise(r => setTimeout(r, waitMs))
            return await respostaHumanizada(userMessage, respostaModelo, tentativas - 1)
        } else {
            console.error('❌ Erro final ao humanizar a resposta (ou erro não relacionado a fetch):', error);
            const resposta = await trocarLLMHuman(humanprompt);
            return resposta;
        }
    }
}

function processUserMessage(iaResponse) {
    const query = iaResponse;
    const params = {};
    return { query, params };
}

async function trocarLLMHuman(prompt) {
    console.log('🤖❌ Erro indentificado, Trocando de LLM Humanizadora!')
    try {
        const responseHuman = await openai.responses.create({
            model: "gpt-4o-mini-2024-07-18",
            input: prompt,
            temperature: 0
        });
        return responseHuman.output_text;
    } catch (error) {
        console.log("❌ Erro na Api Humanizada Trocada: ", error.message);
        return "Desculpe, não consegui formatar a resposta adequadamente no momento.";
    }
}
