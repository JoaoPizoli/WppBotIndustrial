import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config/index.js';
import { createOrRecreateDatabaseFromCSV } from '../database/db.js';
import { generateSQLQuery, executeQuery } from '../services/aiService.js';

// Obter o diretório raiz do projeto para que config.paths funcione corretamente
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Casos de Teste ---
// Definir as perguntas e os dados brutos esperados aqui.
// Os dadosEsperados devem ser um array de objetos, exatamente como retornado pelo better-sqlite3.
const testCases = [
    {
        id: 1,
        pergunta: "Qual o percentual de perda do item 41157?",
        // Exemplo de dadosEsperados (substitua com seus dados reais baseados no seu CSV de teste)
        dadosEsperados: [
            // { ITE_CODIGO: '41157', ITEM: 'NOME DO ITEM EXEMPLO', percentual_perda: 10.50 }
        ],

    },
    {
        id: 2,
        pergunta: "Liste todos os operadores da unidade de montagem",
        dadosEsperados: [
            // { OPERADOR: 'OPERADOR A' },
            // { OPERADOR: 'OPERADOR B' },
        ]
    },
    // {
    //   id: 3,
    //   pergunta: "Qual a produção total no turno 1 em 01/04/2025?",
    //   dadosEsperados: [{ total_producao: 12345 }]
    // },
];

// --- Funções Auxiliares de Comparação ---

/**
 * Converte um objeto para uma string JSON canônica (chaves ordenadas).
 * Ajuda a comparar objetos independentemente da ordem das chaves.
 */
function canonicalJsonString(obj) {
    if (obj === null || typeof obj !== 'object') {
        return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
        // Para arrays dentro dos dados, a ordem dos elementos importa.
        return `[${obj.map(canonicalJsonString).join(',')}]`;
    }
    const keys = Object.keys(obj).sort();
    const props = keys.map(key => `${JSON.stringify(key)}:${canonicalJsonString(obj[key])}`);
    return `{${props.join(',')}}`;
}

/**
 * Compara dois resultados (arrays de objetos).
 * A ordem das linhas no array importa. A ordem das chaves nos objetos não.
 */
function areResultsEqual(obtido, esperado) {
    // Se 'obtido' for um objeto de erro explícito do script
    if (typeof obtido === 'object' && obtido !== null && obtido.hasOwnProperty('error') && !Array.isArray(esperado)) {
        console.warn('      Resultado obtido foi um erro do script:', obtido.error);
        return false;
    }

    // Se um não é array e o outro é, são diferentes.
    if (Array.isArray(obtido) !== Array.isArray(esperado)) return false;

    // Se ambos não são arrays (caso raro, mas para cobrir)
    if (!Array.isArray(obtido) && !Array.isArray(esperado)) {
        return canonicalJsonString(obtido) === canonicalJsonString(esperado);
    }

    // Se ambos são arrays
    if (obtido.length !== esperado.length) {
        console.warn(`      Diferença no número de linhas: obtido ${obtido.length}, esperado ${esperado.length}`);
        return false;
    }

    for (let i = 0; i < obtido.length; i++) {
        const objObtidoStr = canonicalJsonString(obtido[i]);
        const objEsperadoStr = canonicalJsonString(esperado[i]);
        if (objObtidoStr !== objEsperadoStr) {
            console.warn(`      Diferença na linha ${i + 1}:`);
            console.warn(`        Obtido: ${JSON.stringify(obtido[i])}`);
            console.warn(`        Esperado: ${JSON.stringify(esperado[i])}`);
            return false;
        }
    }
    return true;
}



async function runDiagnostics() {
    console.log("🚀 Iniciando Diagnóstico do Bot...");


    try {
        console.log(`\n🗃️  Carregando banco de dados a partir de: ${config.paths.csv}`);
        await createOrRecreateDatabaseFromCSV(config.paths.csv);
        console.log("✅ Banco de dados carregado com sucesso.");
    } catch (error) {
        console.error("💥 Falha crítica ao carregar o banco de dados. Testes não podem continuar.", error);
        return;
    }

    let testsPassed = 0;
    let testsFailed = 0;
    const failedTestDetails = [];

    console.log("\n🔬 Executando Casos de Teste:");

    for (const testCase of testCases) {
        console.log(`\n--- Teste #${testCase.id}: "${testCase.pergunta}" ---`);
        let queryResponse = await generateSQLQuery(testCase.pergunta);
        let query = queryResponse ? queryResponse.query : null;
        let params = queryResponse ? queryResponse.params : {};
        let rowsObtidos;
        let queryGeradaFinal = query;
        let executionError = null;

        if (!query) {
            console.error("  [FALHA] IA não conseguiu gerar a query SQL inicial.");
            executionError = "Falha na geração inicial da query pela IA.";
            rowsObtidos = { error: executionError };
        } else {
            let queryAttempts = 0;
            const maxQueryAttempts = 3;

            while (queryAttempts < maxQueryAttempts) {
                try {
                    console.log(`     Tentativa ${queryAttempts + 1}/${maxQueryAttempts} de executar: ${query}`);
                    rowsObtidos = executeQuery(query, params); // executeQuery é síncrona
                    queryGeradaFinal = query;
                    executionError = null; // Limpa erro se a execução for bem-sucedida
                    console.log("      Query executada com sucesso!");
                    break;
                } catch (dbError) {
                    console.warn(`    Tentativa ${queryAttempts + 1} falhou: ${dbError.message}`);
                    queryGeradaFinal = dbError.failedQuery || query; // Pega a query que efetivamente falhou
                    executionError = dbError.message;
                    queryAttempts++;

                    if (dbError.code === 'SQLITE_ERROR' && queryAttempts < maxQueryAttempts) {
                        console.log("      Erro de SQL. Tentando gerar nova query...");
                        const feedbackUserMessage = `A pergunta original do usuário foi: "${testCase.pergunta}".
A tentativa anterior de gerar uma query SQL para esta pergunta resultou no seguinte erro de sintaxe SQLite: "${dbError.message}".
A query incorreta que causou o erro foi: "${queryGeradaFinal}".
Por favor, gere uma nova query SQL SELECT válida para SQLite que corrija esse problema e responda à solicitação original do usuário.`;

                        queryResponse = await generateSQLQuery(feedbackUserMessage);
                        query = queryResponse ? queryResponse.query : null;

                        if (!query) {
                            console.error("      IA não conseguiu regenerar query após erro de SQL.");
                            executionError = "Falha na regeneração da query pela IA após erro SQL.";
                            rowsObtidos = { error: executionError };
                            break;
                        }
                    } else {
                        if (dbError.code !== 'SQLITE_ERROR') {
                            console.error(`      Erro não relacionado a sintaxe SQL ou erro inesperado: ${dbError.message}`);
                        } else {
                            console.error("      Máximo de tentativas de correção da query atingido.");
                        }
                        rowsObtidos = { error: executionError };
                        break;
                    }
                }
            }
        }

        // Comparação
        const passed = areResultsEqual(rowsObtidos, testCase.dadosEsperados);

        if (passed) {
            console.log("  [SUCESSO] Resultado corresponde ao esperado.");
            testsPassed++;
        } else {
            console.error("  [FALHA] Resultado NÃO corresponde ao esperado.");
            testsFailed++;
            failedTestDetails.push({
                id: testCase.id,
                pergunta: testCase.pergunta,
                queryGerada: queryGeradaFinal || "N/A (falha na geração)",
                erroNaExecucao: executionError,
                esperado: JSON.stringify(testCase.dadosEsperados, null, 2),
                obtido: typeof rowsObtidos === 'object' && rowsObtidos !== null && rowsObtidos.hasOwnProperty('error') ?
                    `Erro: ${rowsObtidos.error}` :
                    JSON.stringify(rowsObtidos, null, 2),
            });
        }
    }

    // Relatório Final
    console.log("\n\n--- Resumo do Diagnóstico ---");
    console.log(`Total de Testes: ${testCases.length}`);
    console.log(`✅ Testes Passados: ${testsPassed}`);
    console.log(`❌ Testes Falhados: ${testsFailed}`);

    if (testsFailed > 0) {
        console.log("\n--- Detalhes das Falhas ---");
        failedTestDetails.forEach(failure => {
            console.log(`\nFalha no Teste #${failure.id}: ${failure.pergunta}`);
            console.log(`  Query Gerada/Tentada: ${failure.queryGerada}`);
            if (failure.erroNaExecucao) {
                console.log(`  Erro na Execução: ${failure.erroNaExecucao}`);
            }
            console.log(`  Resultado Esperado:\n${failure.esperado}`);
            console.log(`  Resultado Obtido:\n${failure.obtido}`);
        });
    }
}

runDiagnostics()
    .then(() => {
        console.log("\n🏁 Diagnóstico Concluído.");
        process.exit(0);
    })
    .catch(error => {
        console.error("\n💥 Erro crítico durante a execução do diagnóstico:", error);
        process.exit(1);
    });