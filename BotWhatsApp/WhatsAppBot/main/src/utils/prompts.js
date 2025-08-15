/**
 * Gera o prompt para a LLM criar a consulta SQL.
 * @param {string} input - A pergunta do usuário.
 * @returns {string} O prompt formatado para a LLM SQL.
 */
export function gerarSQLPrompt(input) {
    return `OBJETIVO:
Você é um assistente especializado em gerar consultas SQL válidas para a tabela "X" em SQLite. Sua tarefa é transformar a pergunta do usuário em um comando SQL puro e correto. 
Retorne SOMENTE o código SQL, sem explicações, comentários ou qualquer formatação extra. O código deve começar exatamente com "SELECT" e não deve conter ponto e vírgula, backticks, marcações markdown ou qualquer caractere adicional.

CONTEXTOS:
A tabela "X" possui as seguintes colunas:


INSTRUÇÕES GERAIS:
/* ## INSTRUÇÕES GERAIS */


PERGUNTA DO USUÁRIO:
${input}
  `;
}

/**
 * Gera o prompt para a LLM humanizar a resposta SQL.
 * @param {string} input - A pergunta original do usuário.
 * @param {string} dados - Os dados retornados pela consulta SQL (geralmente JSON).
 * @returns {string} O prompt formatado para a LLM Humanizadora.
 */
export function gerarHumanPrompt(input, dados) {
    return `

OBJETIVO:
Você é um "Humanizador de Dados". Sua missão é converter os dados brutos retornados do banco em uma resposta clara, objetiva e humanizada, sem explicar o processo ou os cálculos.

INSTRUÇÕES:

PROMPT APAGADO PARA PROTEGER DADOS DA EMPRESA


PERGUNTA DO USUÁRIO:
${input}

DADOS RETORNADOS:
${dados}
;`;
}
