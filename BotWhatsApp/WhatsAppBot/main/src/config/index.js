import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

export default {
    whatsapp: {
        armazenamentoMensagens: 5 * 60 * 1000,
    },

    api: {
        openai: {
            apiKey: process.env.OPENAI_API_KEY,
        },
        deepseek: {
            apiKey: process.env.DEEP_API_KEY
        }
    },

    paths: {
        root: rootDir,
        audios: path.resolve(rootDir, 'audios'),
        csv: '/dados/botwhatsapp/resultado.csv',
        graficos: path.resolve(rootDir, 'graficos'),
    },

    ffmpeg: {
        path: '/usr/bin/ffmpeg',
        outputOptions: [
            '-f wav',
            '-acodec pcm_s16le',
            '-ar 16000',
            '-ac 1',
        ],
    },

    csvService: {
        updateHours: ['06:00', '15:00'],
        apiUrl: 'http://localhost:8003/',
    },

    // Configuração para limitação de requisições e cache
    services: {
        rateLimit: 5, // Número máximo de requisições simultâneas
        cacheOptions: {
            stdTTL: 3600,   // Tempo padrão de vida de um item no cache em segundos
            checkperiod: 120, // Intervalo de verificação para limpeza de itens expirados em segundos
        },
    },
};
