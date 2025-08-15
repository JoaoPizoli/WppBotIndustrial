require('dotenv').config();
const oracledb = require('oracledb');
const fs = require('fs');

async function convertToCsv(pathCsv) {
    try {
        oracledb.initOracleClient({ libDir: process.env.INSTANT_CLIENT_PATH });

        const connection = await oracledb.getConnection({
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            connectString: `${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_SERVICE_NAME}`,
        });

        const result = await connection.execute(`
        APAGADO PARA PROTEGER DADOS DA EMPRESA
        `);

        await connection.close();

        const headers = [
            'APAGADO PARA',
            'PROTEGER DADOS',
            'DA EMPRESA'
        ];

        const csvData = [headers.join(',')];

        result.rows.forEach(row => {
            csvData.push(row.map(value => `"${value}"`).join(','));
        });

        fs.writeFileSync(pathCsv, csvData.join('\n'));
        console.log(`Arquivo CSV gerado com sucesso em: ${pathCsv}`);
    } catch (err) {
        console.error('Erro:', err);
    }
}

module.exports = convertToCsv;