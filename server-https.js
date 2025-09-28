const https = require('https');
const fs = require('fs');
const path = require('path');
const express = require('express');

const app = express();

// Servir arquivos estáticos
app.use(express.static(__dirname));

// Certificado auto-assinado (para desenvolvimento)
const options = {
  key: fs.readFileSync(path.join(__dirname, 'server-key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'server-cert.pem'))
};

// Criar servidor HTTPS
https.createServer(options, app).listen(3000, () => {
  console.log('🚀 Servidor HTTPS rodando em: https://localhost:3000');
  console.log('📱 Acesse no Chrome: https://localhost:3000');
});