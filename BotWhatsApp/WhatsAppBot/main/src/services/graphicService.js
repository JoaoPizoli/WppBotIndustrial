import OpenAI from 'openai';
import fs from "fs-extra";
import path from "path";
import puppeteer from 'puppeteer';
import config from '../config/index.js';


const deep = new OpenAI({ baseURL: 'https://api.deepseek.com', apiKey: config.api.deepseek.apiKey });

export async function gerarGrafico(userRequest, dados) {
    try {
        const htmlPath = path.join(config.paths.graficos, 'index.html');
        const prompt = generateGraphPrompt(userRequest, dados);

        const result = await deep.chat.completions.create({
            model: "deepseek-chat",
            temperature: 0,
            messages: [{ role: "user", content: prompt }]
        });

        let htmlCode = result.choices[0].message.content;
        htmlCode = htmlCode.replace(/^```html\s*/, '').replace(/\s*```$/, '');

        // Salva o HTML gerado
        fs.writeFileSync(htmlPath, htmlCode);
        console.log('✅ HTML do gráfico gerado com sucesso!');

        // Gera a imagem PNG do gráfico
        await gerarImagemDoGrafico(htmlPath);
        console.log('✅ PNG do gráfico gerado com sucesso!');

        return path.join(config.paths.graficos, 'grafico.png');
    } catch (error) {
        console.error('❌ Erro ao gerar gráfico:', error);
        throw error;
    }
}

function generateGraphPrompt(userRequest, dados) {
    return `Tarefa Principal: Analise os DADOS dinâmicos (fornecidos na seção \`#Dados\`) e a Requisição do Usuário para:
1.  Determinar o TIPO DE GRÁFICO MAIS ADEQUADO (ex: \`bar\`, \`line\`) para a visualização **usando Chart.js**. Priorize \`line\` para séries temporais/tendências, \`bar\` para comparações diretas. A escolha deve ser CONSISTENTE. **Pizza não deve ser escolhida automaticamente.** Se o usuário pedir explicitamente \`pie\` ou pizza, use-o.
2.  Gerar um TÍTULO claro e conciso para o gráfico, baseado OBRIGATORIAMENTE na Requisição do Usuário.
3.  Criar o gráfico usando Chart.js v4.4.1 e chartjs-plugin-datalabels v2.2.0 dentro de um único arquivo HTML. **A GERAÇÃO DEVE SER DETERMINÍSTICA E REPRODUZÍVEL.**

REGRAS E ESPECIFICAÇÕES OBRIGATÓRIAS (CHART.JS) - **APLICAR SEM VARIAÇÃO**:

1.  Dados de Entrada: Seção \`#Dados\` (JSON), Seção \`#Requisição do Usuário\` (texto). Processar/Ordenar dados de forma determinística ANTES de passar para Chart.js. Ordem das séries consistente. Atribuir nomes significativos às séries (para legenda!).
2.  Não Interativo e Animado: ESTÁTICO em interação, mas PODE ter animação inicial (REMOVER \`animation: false\` se presente). \`options\`: \`plugins.tooltip.enabled: false\`, \`events: []\`.
3.  Layout e Container (HTML/CSS):
    * Estrutura: EXATAMENTE \`<div id='chartContainer' style='width: 80%; max-width: 1000px; margin: 20px auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);'><canvas id='myChart'></canvas></div>\`.
    * Estilo \`#myChart\`: \`width: 100% !important; height: auto !important;\` (Chart.js gerencia altura com base na proporção).
    * Estilo \`body\`: FIXO \`background-color: #f0f0f0; font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0;\`
4.  Estilo e Configuração Fixos (Aplicar consistentemente via API Chart.js - **SEM DESVIOS**):
    * Título (options.plugins.title): FIXO \`display: true\`, \`text: [Título Gerado]\`, \`color: '#111111'\`, \`font: { family: 'Arial', size: 16, weight: 'bold' }\`, \`padding: { top: 10, bottom: 35 }\` (Padding inferior aumentado).
    * Legenda (options.plugins.legend): FIXO E OBRIGATÓRIO \`display: true\`, \`position: 'bottom'\`, \`labels: { color: '#333333', font: { family: 'Arial', size: 12 } }\`.
    * Padding Interno (options.layout.padding): FIXO \`{ right: 35 }\` (Para evitar corte de label na borda direita).
    * Eixos (options.scales) - **APENAS para \`bar\`/\`line\`**:
        * Y (\`y\`): FIXO \`beginAtZero: true\`, Grid \`color: 'rgba(200, 200, 200, 0.3)'\`, Ticks \`color: '#333333'\`, Ticks \`font: { family: 'Arial', size: 12 }\`, Ticks \`callback: function(value) { try { return value.toLocaleString('de-DE'); } catch(e) { return value; } }\`.
        * X (\`x\`): FIXO Grid \`display: false\`, Ticks \`color: '#333333'\`, Ticks \`font: { family: 'Arial', size: 12 }\`.
        * **Para \`pie\`:** Desabilitar eixos (\`scales: { x: { display: false }, y: { display: false } }\`).
    * Paleta de Cores: FIXA. Aplicar ciclicamente às séries:
        * Cores: \`backgroundColor\` (com opacidade 0.7) e \`borderColor\` (sólida) usando a sequência: Azul (\`54, 162, 235\`), Vermelho (\`255, 99, 132\`), Verde (\`75, 192, 192\`), Amarelo (\`255, 206, 86\`), Roxo (\`153, 102, 255\`).
        * Para \`bar\`: Aplicar a cada barra. \`borderWidth: 1\`.
        * Para \`line\`: Aplicar \`borderColor\` à linha, \`pointBackgroundColor\` ao ponto. \`tension: 0.1\`, \`borderWidth: 2\`.
        * Para \`pie\`: Aplicar \`backgroundColor\` aos segmentos. \`borderColor: '#ffffff'\`, \`borderWidth: 2\`.
    * **Data Labels (options.plugins.datalabels):** OBRIGATÓRIO exibir permanentemente. **PRIORIDADE MÁXIMA: SEM SOBREPOSIÇÃO E NÍTIDOS.**
        * Configurações FIXAS Iniciais (Aplicar globalmente ou por dataset):
            * \`display: true\`
            * \`color: '#ffffff'\`
            * \`font: { family: 'Arial', size: 10, weight: 'bold' }\` **(Fonte reduzida)**
            * \`formatter: (value, context) => { try { return Number(value).toLocaleString('de-DE'); } catch(e) { return value; } }\` (Formato numérico consistente)
            * \`backgroundColor: 'rgba(0, 0, 0, 0.65)'\` **(Opacidade aumentada)**
            * \`borderRadius: 3\` **(Reduzido)**
            * \`padding: { top: 3, bottom: 2, left: 5, right: 5 }\` **(Ajustado)**
        * **Estratégia Anti-Sobreposição (Aplicar DENTRO da configuração \`datalabels\` por dataset, SE MÚLTIPLOS DATASETS \`line\`/\`bar\`):**
            *   1. **Posição Base (\`align\`/\`anchor\`):** Usar \`anchor: 'end'\`. Tentar \`align: 'top'\` ou \`align: 'bottom'\` alternadamente entre datasets adjacentes. (Para \`pie\`, usar \`anchor: 'center'\`, \`align: 'center'\`).
            *   2. **Offset Vertical DETERMINÍSTICO (\`offset\`):** Aplicar offsets verticais DISTINTOS e CALCULADOS de forma consistente para CADA dataset para separá-los. Ex: \`offset: (context.datasetIndex % 2 === 0 ? 10 : -15) + Math.floor(context.datasetIndex / 2) * 10\`. A lógica deve ser fixa.
            *   3. **Limite (\`clamp\`):** \`false\`.
            *   **Meta Final:** Minimizar sobreposição usando offset calculado. (Aceitar que pode não ser perfeito em Chart.js).
        * **Posicionamento Barra Única/Baixa (Aplicar na config \`datalabels\` do dataset \`bar\`):**
            * Se for gráfico de barra E o valor for baixo (perto do eixo X): Usar \`align: 'end'\`, \`anchor: 'end'\` (acima da barra).
            * Senão (barra alta): Usar \`align: 'center'\`, \`anchor: 'center'\` (dentro da barra).
5.  Tecnologias: TUDO em um único \`index.html\`. HTML5, CSS3, JS(ES6+).
    * Inclua Chart.js v4.4.1 via CDN: \`<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>\`
    * Inclua Chartjs-plugin-datalabels v2.2.0 via CDN: \`<script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0/dist/chartjs-plugin-datalabels.min.js"></script>\`
    * Registre o plugin DataLabels no JS: \`Chart.register(ChartDataLabels);\`
6.  Formato da Resposta: APENAS código HTML completo. Sem \`\`\`html, comentários, texto extra. \`<!DOCTYPE html>...\`</html>\`. **O código gerado deve ser idêntico para a mesma entrada.**
 #Requisição do Usuário:

 ${userRequest}

 #Dados:

  ${dados}
`
}


async function gerarImagemDoGrafico(htmlPath) {
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ]
    });

    const page = await browser.newPage();

    const fileUrl = `file://${htmlPath}`;
    await page.goto(fileUrl, { waitUntil: 'networkidle2' });

    const screenshotPath = path.join(path.dirname(htmlPath), 'grafico.png');
    await fs.ensureDir(path.dirname(screenshotPath));

    await page.screenshot({ path: screenshotPath, fullPage: true });

    await browser.close();
}
