import fs from 'fs-extra';
import config from './src/config/index.js';
import { WhatsAppBot } from './src/whatsapp/bot.js';
import { carregarCSV } from './src/services/csvService.js';
import { createOrRecreateDatabaseFromCSV, monitorCSVFile } from './src/database/db.js';


async function main() {
    console.log('🚀 Iniciando aplicação...');

    try {
        await fs.ensureDir(config.paths.audios);
        console.log(`📁 Diretório de áudios garantido em ${config.paths.audios}`);

        await fs.ensureDir(config.paths.graficos);
        console.log(`📁 Diretório de gráficos garantido em ${config.paths.graficos}`);

        console.log('📊 Iniciando carregamento do CSV...');
        await carregarCSV();

        console.log('🗃️ Criando banco de dados a partir do CSV...');
        await createOrRecreateDatabaseFromCSV(config.paths.csv);

        monitorCSVFile();

        const whatsappBot = new WhatsAppBot();
        whatsappBot.initialize();

        console.log('✅ Todos os serviços inicializados com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao inicializar a aplicação:', error);
        process.exit(1);
    }
}

main();
