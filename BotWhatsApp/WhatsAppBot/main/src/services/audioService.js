import fs from 'fs-extra';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import OpenAI from 'openai';
import config from '../config/index.js';

ffmpeg.setFfmpegPath(config.ffmpeg.path);

const openai = new OpenAI({ apiKey: config.api.openai.apiKey });

export async function convertOggToWav(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .outputOptions(config.ffmpeg.outputOptions)
            .on('start', (cmd) => {
                console.log('🎬 Comando FFmpeg:', cmd);
            })
            .on('error', (err) => {
                console.error('❌ Erro ao converter o áudio:', err.message);
                reject(err);
            })
            .on('end', () => {
                console.log('✅ Áudio convertido para WAV.');
                resolve();
            })
            .save(outputPath);
    });
}

export async function transcribeAudio(audioFilePath) {
    try {
        const audioStream = fs.createReadStream(audioFilePath);
        const transcriptResponse = await openai.audio.transcriptions.create({
            model: "gpt-4o-transcribe",
            file: audioStream,
            response_format: "text"
        });
        return transcriptResponse;
    } catch (err) {
        console.error('❌ Erro ao transcrever o áudio via Whisper:', err);
        throw err;
    }
}

export async function processAudioFile(audioFilePath) {
    try {
        const wavFileName = audioFilePath.replace('.ogg', '.wav');

        // Converte o arquivo para WAV
        await convertOggToWav(audioFilePath, wavFileName);

        // Transcreve o áudio
        const transcription = await transcribeAudio(wavFileName);

        // Remove os arquivos temporários
        await fs.remove(audioFilePath);
        await fs.remove(wavFileName);
        console.log('🗑️ Arquivos temporários de áudio removidos.');

        return transcription;
    } catch (error) {
        console.error('❌ Erro ao processar o arquivo de áudio:', error);

        // Tenta remover os arquivos em caso de erro
        try {
            if (fs.existsSync(audioFilePath)) {
                await fs.remove(audioFilePath);
            }

            const wavFileName = audioFilePath.replace('.ogg', '.wav');
            if (fs.existsSync(wavFileName)) {
                await fs.remove(wavFileName);
            }
        } catch (cleanupError) {
            console.error('❌ Erro ao limpar arquivos temporários:', cleanupError);
        }

        throw error;
    }
}