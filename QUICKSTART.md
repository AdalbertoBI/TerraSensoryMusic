# 🚀 MIDI Terra Monitor - Início Rápido

## Instalação em 3 Passos

### 1. Pré-requisitos
- Instale [Node.js](https://nodejs.org/) (versão 16 ou superior)
- Conecte seu dispositivo MIDI-Terra via USB

### 2. Instalação
```bash
# Execute o instalador
install.bat
```
OU instale manualmente:
```bash
npm install
```

### 3. Executar
```bash
# Inicie o sistema
start.bat
```
OU execute manualmente:
```bash
npm start
```

## 📱 Como Usar

1. **Acesse**: `http://localhost:3000`
2. **Clique em "Conectar"** na interface
3. **Teste seu dispositivo MIDI-Terra**
4. **Monitore em tempo real!**

## 🎯 Recursos Principais

### ✅ Monitoramento
- ⚡ **Tempo real**: Visualização instantânea de comandos MIDI
- 🎵 **16 canais**: Suporte completo aos canais 0x90-0x9F
- 🔌 **Auto-conexão**: Detecta automaticamente dispositivos Terra

### ✅ Análise
- 📊 **Gráficos**: Atividade temporal e distribuição de velocity
- 🎼 **Padrões**: Identificação automática de sequências musicais
- 🔥 **Mapa de calor**: Visualização de uso de notas por oitava
- 📈 **Estatísticas**: Mensagens/segundo, canais ativos, slaves conectados

### ✅ Logs
- 💾 **Persistência**: Logs automáticos em JSON/CSV
- 📅 **Rotação**: Arquivos diários organizados
- 📤 **Exportação**: Download de dados históricos
- 🔍 **Filtros**: Por canal, tipo, slave e timestamp

## 🎛️ Interface

### Painel Principal
- **Status de Conexão**: Indicador verde/vermelho
- **Estatísticas em Tempo Real**: Total, mensagens/seg, canais ativos
- **Grid de Canais**: Visualização de todos os 16 canais MIDI

### Filtros Disponíveis
- **Canal**: Específico (0x90-0x9F) ou todos
- **Tipo**: Note On/Off, Control Change, Pitch Bend, etc.
- **Slave**: Dispositivos 01-05 ou todos

### Controles
- **Pausar/Retomar**: Controle de captura
- **Limpar**: Reset do log atual
- **Exportar**: Download JSON + CSV
- **Auto-scroll**: Acompanhar mensagens mais recentes

## 📊 Análise Avançada

### Aba "Gráficos"
- **Atividade Temporal**: Line chart com mensagens por segundo
- **Distribuição de Velocity**: Histograma de intensidade das notas

### Aba "Padrões"
- **Sequências de Notas**: Progressões musicais mais comuns
- **Padrões Rítmicos**: Intervalos de tempo frequentes
- **Uso de Canais**: Estatísticas por canal MIDI

### Aba "Mapa de Calor"
- **Grid 12x11**: Notas (C-B) x Oitavas (0-10)
- **Última Hora**: Intensidade baseada na frequência de uso
- **Tooltip**: Detalhes ao passar o mouse

## 🔧 Troubleshooting Rápido

### ❌ Dispositivo não detectado
```bash
# Verifique dispositivos conectados
# O sistema tentará auto-detectar
# ou criará porta virtual MIDI
```

### ❌ WebSocket não conecta
```bash
# Verifique se o servidor está rodando
node server.js

# Teste no navegador
http://localhost:3000
```

### ❌ Performance lenta
- Use filtros para reduzir volume de dados
- Pause temporariamente o monitoramento
- Limpe o log regularmente

## 📁 Estrutura de Arquivos

```
midi-monitor/
├── index.html          # Interface principal
├── styles.css          # Estilos da interface
├── midi-monitor.js     # Lógica de monitoramento
├── midi-analyzer.js    # Análise avançada
├── server.js           # Servidor Node.js
├── package.json        # Dependências
├── install.bat         # Instalador Windows
├── start.bat          # Inicializador Windows
├── README.md          # Documentação completa
├── QUICKSTART.md      # Este arquivo
└── logs/              # Logs diários (gerado automaticamente)
    ├── midi-2024-01-01.json
    ├── midi-2024-01-02.json
    └── ...
```

## 🎵 Compatibilidade MIDI-Terra

### Hardware Suportado
- **Receptor MIDI 32U4**: Conexão USB direta
- **Sistema RF24**: Comunicação wireless
- **Slaves 01-05**: Configuráveis via jumpers

### Canais MIDI
- **0x90-0x9F**: 16 canais principais
- **Baud Rate**: 31250 (padrão MIDI)
- **RF24 Channels**: 60, 70, 80, 90

### Tipos de Mensagem
- **Note On/Off**: Comandos musicais
- **Control Change**: Modulação e controles
- **Pitch Bend**: Modificação de altura
- **System**: Clock e sincronização

## 🆘 Suporte

### Contato Terra Eletrônica
- **E-mail**: contato@terraeletronica.com.br
- **Site**: terraeletronica.com.br

### Para Suporte, Inclua
1. Versão do Windows e Node.js
2. Modelo do dispositivo MIDI-Terra  
3. Logs de erro (F12 > Console)
4. Passos para reproduzir o problema

---

**Sistema desenvolvido especificamente para Terra Eletrônica**  
MIDI Terra Monitor v1.0.0 © 2024