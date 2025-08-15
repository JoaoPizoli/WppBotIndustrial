import fs from 'fs-extra';
import { parse } from 'csv-parse';
import Database from 'better-sqlite3';
import config from '../config/index.js';

const csvParse = parse;
let db;

function parseCSV(csvString) {
    return new Promise((resolve, reject) => {
        csvParse(csvString, { delimiter: ',', relax_quotes: true }, (err, output) => {
            if (err) {
                return reject(err);
            }
            resolve(output);
        });
    });
}


function normalizeColumnName(name) {
    return name.toLowerCase().replace(/[^a-z0-9]/gi, '_');
}

export async function createOrRecreateDatabaseFromCSV(csvFilePath) {
    try {
        const fileContent = fs.readFileSync(csvFilePath, 'utf8');
        const records = await parseCSV(fileContent);

        if (!records || records.length === 0) {
            throw new Error('O arquivo CSV está vazio ou não pôde ser lido corretamente.');
        }

        const headers = records[0];
        const dataRows = records.slice(1);

        db = new Database(':memory:');

        // Ajuste 1: se a coluna for 'data', declara como DATE, senão como TEXT
        const createTableSQL = `
       CREATE TABLE apontamentos (
           ${headers
                .map((h) => {
                    const colName = normalizeColumnName(h);
                    return colName === 'data' ? `${colName} DATE` : `${colName} TEXT`;
                })
                .join(',')}
            )
            `;
        db.exec(createTableSQL);

        // Monta o comando de inserção
        const insertSQL = `INSERT INTO apontamentos VALUES (${headers.map(() => '?').join(',')})`;
        const insertStmt = db.prepare(insertSQL);

        // Localiza o índice da coluna "data" (caso exista)
        const dataIndex = headers.findIndex((h) => normalizeColumnName(h) === 'data');

        // Ajuste 2: converte DD-MM-YYYY para YYYY-MM-DD na hora de inserir
        const insertMany = db.transaction((rows) => {
            for (const row of rows) {
                // Se for a coluna data e tiver valor, converte
                if (dataIndex !== -1 && row[dataIndex]) {
                    const [dd, mm, yyyy] = row[dataIndex].split('-');
                    // Se o split estiver OK, transforma no padrão YYYY-MM-DD
                    if (dd && mm && yyyy) {
                        row[dataIndex] = `${yyyy}-${mm}-${dd}`;
                    }
                }
                insertStmt.run(row);
            }
        });
        insertMany(dataRows);

        console.log(`Banco de dados criado/recriado a partir de: ${csvFilePath}`);
    } catch (error) {
        console.error('Erro ao criar/recriar o banco de dados:', error);
    }
}


export function queryDatabase(sqlQuery) {
    if (!db) {
        const err = new Error('Banco de dados ainda não foi inicializado.');
        console.error(err.message);
        throw err;
    }

    try {
        const stmt = db.prepare(sqlQuery);
        const result = stmt.all();
        return result;
    }
    catch (error) {
        console.error(`❌ Erro ao executar a query SQL: [${error.message}] para a query [${sqlQuery}]`);
        error.failedQuery = sqlQuery;
        throw error;
    }
}


export function monitorCSVFile(csvPath = config.paths.csv) {
    fs.watchFile(csvPath, { interval: 5000 }, async (curr, prev) => {
        if (curr.mtime > prev.mtime) {
            console.time("CSV Reload Time");
            console.log('🔄 CSV modificado. Recriando banco...');
            await createOrRecreateDatabaseFromCSV(csvPath);
            console.timeEnd("CSV Reload Time");
        }
    });
    console.log(`📊 Monitoramento do arquivo CSV iniciado: ${csvPath}`);
}
