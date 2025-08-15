# 🤖 BotWhatsApp - Sistema Inteligente de Consultas via WhatsApp

Um sistema completo que combina um bot do WhatsApp com inteligência artificial para consultas dinâmicas de dados empresariais através de processamento de linguagem natural.

## 👨‍💻 Autor

**João Pedro Pizoli Carvalho**

## 📋 Sobre o Projeto

Este projeto é composto por dois módulos principais que trabalham em conjunto:

1. **WhatsAppBot**: Bot inteligente que recebe mensagens no WhatsApp, converte para consultas SQL usando IA e retorna respostas humanizadas
2. **OracleCsvGenerator**: Servidor que conecta com banco Oracle e gera arquivos CSV para alimentar o bot

## 🚀 Funcionalidades

### 🤖 WhatsApp Bot
- ✅ Integração completa com WhatsApp Web
- 🎤 Processamento de mensagens de áudio (transcrição automática)
- 🧠 Geração inteligente de consultas SQL via IA (OpenAI + DeepSeek)
- 📊 Geração automática de gráficos dinâmicos
- 💾 Cache inteligente para otimização de performance
- 🔄 Monitoramento automático de arquivos CSV
- 📱 Respostas humanizadas e contextualizadas

### 🗄️ Oracle CSV Generator
- 🔗 Conexão com banco Oracle
- 📄 Geração de arquivos CSV/XLSX
- 🚀 API REST para integração
- ⚡ Processamento em tempo real

## 🛠️ Tecnologias Utilizadas

### WhatsApp Bot
- **Node.js** - Runtime JavaScript
- **whatsapp-web.js** - Integração com WhatsApp
- **OpenAI API** - Inteligência artificial
- **DeepSeek API** - Geração de consultas SQL
- **SQLite** - Banco de dados local
- **FFmpeg** - Processamento de áudio
- **Puppeteer** - Geração de gráficos
- **Better-SQLite3** - Interface SQLite otimizada

### Oracle CSV Generator
- **Express.js** - Framework web
- **OracleDB** - Conectividade com Oracle
- **ExcelJS** - Manipulação de arquivos Excel
- **PDFKit** - Geração de PDFs

## 📁 Estrutura do Projeto

```
BotWhatsApp/
├── README.md
├── OracleCsvGenerator/
│   └── main/
│       ├── main.js              # Servidor Express
│       ├── package.json         # Dependências Oracle Generator
│       └── src/
│           └── csv.js           # Lógica de conexão Oracle
└── WhatsAppBot/
    └── main/
        ├── app.js               # Aplicação principal
        ├── package.json         # Dependências WhatsApp Bot
        └── src/
            ├── config/
            │   └── index.js     # Configurações gerais
            ├── database/
            │   └── db.js        # Gerenciamento SQLite
            ├── services/
            │   ├── aiService.js # Serviços de IA
            │   ├── audioService.js # Processamento de áudio
            │   ├── csvService.js   # Manipulação CSV
            │   └── graphicService.js # Geração de gráficos
            ├── utils/
            │   └── prompts.js   # Templates de prompts IA
            └── whatsapp/
                └── bot.js       # Lógica principal do bot
```

## ⚙️ Configuração e Instalação

### Pré-requisitos
- Node.js 18+
- Oracle Instant Client (para OracleCsvGenerator)
- FFmpeg (para processamento de áudio)

### 1. Clone o repositório
```bash
git clone <url-do-repositorio>
cd BotWhatsApp
```

### 2. Configuração do WhatsApp Bot

```bash
cd WhatsAppBot/main
npm install
```

### 3. Configuração do Oracle CSV Generator

```bash
cd OracleCsvGenerator/main
npm install
```

### 4. Variáveis de Ambiente

Crie um arquivo `.env` em cada módulo:

#### WhatsApp Bot (.env)
```env
OPENAI_API_KEY=sua_chave_openai
DEEP_API_KEY=sua_chave_deepseek
```

#### Oracle CSV Generator (.env)
```env
DB_USER=usuario_oracle
DB_PASSWORD=senha_oracle
DB_HOST=host_oracle
DB_PORT=1521
DB_SERVICE_NAME=nome_servico
INSTANT_CLIENT_PATH=caminho_instant_client
```

## 🚀 Como Executar

### 1. Inicie o Oracle CSV Generator
```bash
cd OracleCsvGenerator/main
npm start
```

### 2. Inicie o WhatsApp Bot
```bash
cd WhatsAppBot/main
npm start
```

### 3. Escaneie o QR Code
- O QR Code aparecerá no terminal
- Escaneie com o WhatsApp do celular
- Aguarde a mensagem "WhatsApp conectado!"

## 📱 Como Usar

1. **Mensagens de Texto**: Envie perguntas em linguagem natural sobre os dados
   - Exemplo: "Quantos produtos foram vendidos este mês?"

2. **Mensagens de Áudio**: Envie áudios que serão transcritos automaticamente

3. **Gráficos**: Peça gráficos específicos
   - Exemplo: "Gere um gráfico das vendas por mês"

## 🔧 API Endpoints

### Oracle CSV Generator

#### POST /
Gera arquivo CSV a partir do banco Oracle

**Body:**
```json
{
  "caminho": "/caminho/para/arquivo.csv"
}
```

**Resposta:**
```json
{
  "resposta": "Arquivo CSV ou XLSX gerado com sucesso!"
}
```

## 🎯 Fluxo de Funcionamento

1. **Recepção**: Bot recebe mensagem no WhatsApp
2. **Processamento**: 
   - Se for áudio: transcreve usando OpenAI Whisper
   - Se for texto: processa diretamente
3. **IA**: DeepSeek converte pergunta em consulta SQL
4. **Consulta**: Executa SQL no banco SQLite local
5. **Humanização**: OpenAI converte resultado em resposta natural
6. **Gráficos**: Se solicitado, gera visualizações dinâmicas
7. **Resposta**: Envia resposta formatada via WhatsApp

## 🔒 Segurança

- Cache temporário com limpeza automática
- Controle de rate limiting
- Validação de entrada de dados
- Logs detalhados para auditoria

