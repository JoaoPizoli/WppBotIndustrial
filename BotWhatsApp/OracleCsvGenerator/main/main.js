const express = require('express');
const convertToCsv = require('./src/csv');
const app = express()

app.use(express.json());

app.post('/',(req,res)=>{
    const {caminho} = req.body
    if (!caminho) {
        return res.status(400).send({ erro: 'Digite o caminho que o arquivo será instalado' });
      }

    const result = convertToCsv(caminho)
    if(result){
        return res.status(200).send({resposta: 'Arquivo CSV ou XLSX gerado com sucesso!'})
    }else{
        return res.status(400).send({erro: 'Erro ao gerar o arquivo CSV ou XLSX!'})
    }
})


app.listen(8003,'0.0.0.0',()=>{
    console.log('API Exel rodando na porta 8003')
})
