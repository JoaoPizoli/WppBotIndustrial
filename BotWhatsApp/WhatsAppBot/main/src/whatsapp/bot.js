import pkg from 'whatsapp-web.js';
const { Client: WhatsAppClient, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode-terminal';
import fs from 'fs-extra';
import path from 'path';
import NodeCache from 'node-cache';
import pLimit from 'p-limit';
import config from '../config/index.js';
import { processAudioFile } from '../services/audioService.js';
import { generateSQLQuery, executeQuery, respostaHumanizada } from '../services/aiService.js';
import { gerarGrafico } from '../services/graphicService.js';

// Inicialização de cache, limites e controle de mensagens
const cache = new NodeCache(config.services.cacheOptions);
const limit = pLimit(config.services.rateLimit);
const mensagensRespondidas = new Map();
const userRequests = new Map();
const lastInteraction = new Map();

export class WhatsAppBot {
    constructor() {
        this.client = new WhatsAppClient({
            authStrategy: new LocalAuth({
                dataPath: '/dados/botwhatsapp'
            }),
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox'
                ]
            },
        });

        this.client.on('qr', this.onQrCode.bind(this));
        this.client.on('ready', this.onReady.bind(this));
        this.client.on('message', this.onMessage.bind(this));

        setInterval(this.limparMensagensRespondidas.bind(this), config.whatsapp.armazenamentoMensagens / 2);
    }

    initialize() {
        this.client.initialize();
        console.log('🤖 Inicializando bot do WhatsApp...');
    }

    onQrCode(qrCode) {
        qrcode.generate(qrCode, { small: true });
        console.log('🔗 Escaneie o QR Code acima com o WhatsApp.');
    }

    onReady() {
        console.log('✅ Bot WhatsApp pronto!');
    }

    async onMessage(msg) {
        const userNumber = msg.from;
        const messageTextOriginal = msg.body ? msg.body.trim() : '';
        const querGerar = messageTextOriginal.includes('&');
        const now = Date.now();
        const trinta_min = 30 * 60 * 1000;
        const requestId = `${Date.now()}-${msg.id.id}-${Math.random().toString(36).substr(2, 5)}`;

        const lastMsgTimestamp = lastInteraction.get(userNumber) || 0;

        if (now - lastMsgTimestamp > trinta_min) {
            await this.client.sendMessage(
                msg.from,
                '⏳*Gerando a consulta com AI...*\n\n' +
                'Período de Dados: Últimos *5 anos*\n' +
                '- Mande sua Requisição por *Áudio* ou *Texto*!\n' +
                '- Questões por Ordem de Produção ou item (Produto) = Quantidade produzida na última operação.\n' +
                '- Questões Gerais, por Unidade Produtiva ou Recurso (Linha / Máquina) = Produção total.\n' +
                'Para *Gerar Gráfico*, utilize *&* antes da Consulta\n' +
                '- EX: & Compare o mês de janeiro de 2025 ao mês de janeiro de 2023'
            );
            lastInteraction.set(userNumber, now);
        }


        try {
            if (messageTextOriginal.toLowerCase() === 'cancelar') {
                return this.handleCancelRequest(userNumber);
            }

            const userReqs = userRequests.get(userNumber) || [];
            userReqs.push({ requestId, cancelRequested: false, queryInProgress: true });
            userRequests.set(userNumber, userReqs);

            const msgId = msg.id._serialized;
            if (mensagensRespondidas.has(msgId)) {
                console.log(`🔁 Mensagem ${msgId} já processada ou em processamento. Ignorando.`);
                return;
            }
            mensagensRespondidas.set(msgId, Date.now());


            const checkCancel = () => {
                const reqs = userRequests.get(userNumber) || [];
                const thisReq = reqs.find(r => r.requestId === requestId);
                return !thisReq || thisReq.cancelRequested;
            };

            const finalizeRequest = () => {
                const reqs = userRequests.get(userNumber) || [];
                userRequests.set(userNumber, reqs.filter(r => r.requestId !== requestId));
            };

            console.log(`📩 Mensagem [${requestId}] de ${msg.from}: ${msg.body}`);
            let userMessageContent = '';
            if (msg.hasMedia && (msg.type === 'audio' || msg.type === 'ptt')) {
                userMessageContent = await this.handleAudioMessage(msg, checkCancel);
                if (checkCancel()) {
                    console.log(`🚫 Requisição [${requestId}] cancelada durante processamento de áudio.`);
                    finalizeRequest();
                    return;
                }
            } else {
                userMessageContent = messageTextOriginal;
            }

            if (!userMessageContent || userMessageContent.trim() === '') {
                console.log(`🤷 Mensagem [${requestId}] vazia de ${msg.from}.`);
                finalizeRequest();
                return;
            }

            console.log(`🗣️ Conteúdo da mensagem [${requestId}] para IA: ${userMessageContent}`);

            let queryResponse = await generateSQLQuery(userMessageContent);
            let query = queryResponse ? queryResponse.query : null;
            let params = queryResponse ? queryResponse.params : {};

            if (!query) {
                console.log(`❌ A IA não conseguiu gerar uma query SQL inicial para [${requestId}].`);
                if (!checkCancel()) {
                    await this.client.sendMessage(msg.from, '❌ Desculpe, não consegui gerar uma consulta para sua solicitação neste momento.');
                }
                finalizeRequest();
                return;
            }

            let rows;
            let queryAttempts = 0;
            const maxQueryAttempts = 3;

            while (queryAttempts < maxQueryAttempts) {
                if (checkCancel()) {
                    console.log(`🚫 Requisição [${requestId}] cancelada antes da tentativa ${queryAttempts + 1} de executar query.`);
                    finalizeRequest();
                    return;
                }
                try {
                    console.log(`🔄 [${requestId}] Tentativa ${queryAttempts + 1}/${maxQueryAttempts} de executar a query SQL: ${query}`);
                    rows = executeQuery(query, params);
                    console.log(`✅ [${requestId}] Query executada com sucesso no DB local!`);
                    break;
                } catch (dbError) {
                    console.error(`❌ [${requestId}] Tentativa ${queryAttempts + 1} falhou ao executar query. Erro: ${dbError.message}`);
                    queryAttempts++;

                    if (dbError.code === 'SQLITE_ERROR' && queryAttempts < maxQueryAttempts) {
                        console.log(`📝 Erro de SQL (${dbError.code}) detectado em [${requestId}]. Tentando gerar nova query (nova tentativa ${queryAttempts})...`);

                        const feedbackUserMessage =
                            `A pergunta original do usuário foi: "${userMessageContent}".
             A tentativa anterior de gerar uma query SQL para esta pergunta resultou no seguinte erro de sintaxe SQLite: "${dbError.message}".
             A query incorreta que causou o erro foi: "${dbError.failedQuery || query}".
             Por favor, gere uma nova query SQL SELECT válida para SQLite que corrija esse problema e responda à solicitação original do usuário.
             Siga todas as regras de formatação e contexto da tabela "apontamentos" fornecidas anteriormente.
             A query deve começar com SELECT e não deve terminar com ponto e vírgula.`;

                        queryResponse = await generateSQLQuery(feedbackUserMessage);
                        query = queryResponse ? queryResponse.query : null;
                        params = queryResponse ? queryResponse.params : {};

                        if (!query) {
                            console.log(`❌ [${requestId}] A IA não conseguiu gerar uma nova query após o erro de SQL.`);
                            finalizeRequest();
                            return;
                        }
                    } else {
                        const errorMessage = queryAttempts >= maxQueryAttempts ?
                            '❌ Desculpe, não consegui processar sua consulta após várias tentativas de correção.' :
                            `❌ Desculpe, ocorreu um erro (${dbError.code || 'desconhecido'}) ao consultar o banco de dados.`;

                        console.error(`Erro final ao executar a consulta [${requestId}]: ${dbError.message}`, dbError);
                        if (!checkCancel()) {
                            await this.client.sendMessage(msg.from, errorMessage);
                        }
                        finalizeRequest();
                        return;
                    }
                }
            }

            if (queryAttempts >= maxQueryAttempts && typeof rows === 'undefined') {
                console.log(`❌ [${requestId}] Excedido o número máximo de tentativas para gerar e executar a query.`);
                if (!checkCancel()) {
                    await this.client.sendMessage(msg.from, '❌ Desculpe, não consegui processar sua solicitação após múltiplas tentativas de correção da consulta.');
                }
                finalizeRequest();
                return;
            }

            if (checkCancel()) {
                console.log(`🚫 Requisição [${requestId}] cancelada antes de enviar resposta.`);
                finalizeRequest();
                return;
            }

            let respostaModelo = '';
            const MAX_ROWS = 790;

            if (typeof rows !== 'undefined') {
                if (rows.length > 0) {
                    rows.slice(0, MAX_ROWS).forEach(row => {
                        respostaModelo += JSON.stringify(row) + '\n';
                    });
                } else {
                    respostaModelo = '✅ Nenhum resultado encontrado para sua consulta.';
                }
            } else if (!query) {
                respostaModelo = '❌ Não foi possível gerar uma consulta para sua solicitação.';
            } else {
                respostaModelo = '❌ Ocorreu um problema ao buscar os dados para sua consulta, ou a consulta não retornou resultados válidos.';
            }

            console.log(`📊 [${requestId}] Dados Brutos da Consulta (para humanização): ${respostaModelo.substring(0, 200)}...`);

            if (respostaModelo !== '❌ Não foi possível gerar uma consulta para sua solicitação.' &&
                respostaModelo !== '❌ Desculpe, não consegui gerar uma consulta válida após o erro inicial.' &&
                !respostaModelo.startsWith('❌ Ocorreu um problema ao buscar os dados')) {

                const respostaHuman = await respostaHumanizada(userMessageContent, respostaModelo);
                if (!checkCancel()) {
                    await this.client.sendMessage(msg.from, respostaHuman);
                }

                if (querGerar) {
                    if (!checkCancel()) {
                        console.log(`📊 [${requestId}] Gerando gráfico para: ${userMessageContent}`);
                        const chartData = typeof rows !== 'undefined' ? JSON.stringify(rows) : "[]";
                        await gerarGrafico(userMessageContent, chartData);
                        const mediaPath = path.join(config.paths.graficos, 'grafico.png');
                        if (fs.existsSync(mediaPath)) {
                            const media = MessageMedia.fromFilePath(mediaPath);
                            await this.client.sendMessage(msg.from, media);
                        } else {
                            console.error(`❌ [${requestId}] Arquivo de gráfico não encontrado em ${mediaPath}`);
                            await this.client.sendMessage(msg.from, "❌ Erro ao gerar o arquivo do gráfico.");
                        }
                    }
                }
            } else if (!checkCancel() && respostaModelo.startsWith('❌')) {
                console.log(`[${requestId}] Resposta final já era uma mensagem de erro: ${respostaModelo}`);
            }

            console.log(`✅ [${requestId}] Processamento da mensagem de ${msg.from} concluído.`);
            finalizeRequest();

        } catch (error) {
            console.error(`❌ Erro crítico [${requestId}] ao processar a mensagem de ${userNumber}:`, error);
            const reqs = userRequests.get(userNumber) || [];
            const thisReq = reqs.find(r => r.requestId === requestId);
            if (thisReq && !thisReq.cancelRequested) {
                await this.client.sendMessage(
                    msg.from,
                    '❌ Desculpe, ocorreu um erro inesperado ao processar sua mensagem.'
                );
            }
            userRequests.set(
                userNumber,
                (userRequests.get(userNumber) || []).filter(r => r.requestId !== requestId)
            );
        }
    }

    async handleAudioMessage(msg, checkCancel) {
        const media = await msg.downloadMedia();
        const buffer = Buffer.from(media.data, 'base64');
        const audioFile = path.resolve(config.paths.audios, `${msg.id.id}.ogg`);
        await fs.writeFile(audioFile, buffer);
        console.log(`📁 Áudio salvo em ${audioFile} para msg ${msg.id.id}`);

        if (checkCancel()) {
            console.log(`🚫 Transcrição cancelada para ${audioFile}.`);
            try { await fs.remove(audioFile); } catch (e) { console.error(`Erro ao remover ${audioFile} após cancelamento:`, e); }
            return '';
        }

        try {
            const text = await processAudioFile(audioFile);
            console.log(`📝 Transcrição para msg ${msg.id.id}: ${text}`);
            return text;
        } catch (err) {
            console.error(`❌ Erro ao processar áudio ${audioFile}:`, err);
            throw err;
        }
    }

    async handleCancelRequest(userNumber) {
        const reqs = userRequests.get(userNumber) || [];
        let cancelled = false;
        if (reqs.length > 0) {
            // Cancela a requisição mais recente que ainda está em progresso
            for (let i = reqs.length - 1; i >= 0; i--) {
                if (reqs[i].queryInProgress && !reqs[i].cancelRequested) {
                    reqs[i].cancelRequested = true;
                    reqs[i].queryInProgress = false;
                    console.log(`🚫 Cancelando requisição ${reqs[i].requestId} para ${userNumber}.`);
                    cancelled = true;
                    break;
                }
            }
        }

        if (cancelled) {
            await this.client.sendMessage(userNumber, '🚫 Sua última requisição foi cancelada.');
        } else {
            await this.client.sendMessage(userNumber, '❌ Não há requisição em andamento para cancelar.');
        }
    }

    limparMensagensRespondidas() {
        const agora = Date.now();
        let count = 0;
        for (const [msgId, ts] of mensagensRespondidas) {
            if (agora - ts > config.whatsapp.armazenamentoMensagens) {
                mensagensRespondidas.delete(msgId);
                count++;
            }
        }
        if (count > 0) {
            console.log(`🧹 Limpas ${count} mensagens da lista de controle de duplicidade.`);
        }
    }
}
