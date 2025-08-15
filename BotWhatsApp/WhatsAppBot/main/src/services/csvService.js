import axios from "axios";
import config from '../config/index.js';

export async function carregarCSV() {
    console.log('📊 Iniciando monitor de horário para carregar CSV...');

    setInterval(async () => {
        const data = new Date();
        const horaFormatada = data.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit'
        });

        if (config.csvService.updateHours.includes(horaFormatada)) {
            console.log(`⏰ [carregarCSV] Horário bateu: ${horaFormatada}. Chamando a API...`);

            const url = config.csvService.apiUrl;
            const body = {
                "caminho": config.paths.csv
            };

            try {
                const response = await axios.post(url, body, {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                console.log('✅ Resposta da API:', response.data);
            } catch (error) {
                console.error('❌ Erro na requisição:', error);
            }
        }
    }, 60 * 1000);

    return 'Monitor de horário iniciado!';
}
