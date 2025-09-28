const WebSocket = require('ws');
const midi = require('@julusian/midi');
const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const moment = require('moment');

class MIDITerraMonitor {
    constructor() {
        this.app = express();
        this.wss = null;
        this.midiInput = new midi.Input();
        this.clients = new Set();
        this.logFile = null;
        this.midiConnected = false;
        this.hasRealDevice = false;
        this.stats = {
            totalMessages: 0,
            sessionsStarted: new Date(),
            connectedDevices: new Set()
        };
        
        this.init();
    }

    init() {
        this.setupExpress();
        this.setupWebSocket();
        this.setupMIDI();
        this.setupLogging();
        this.startServer();
    }

    setupExpress() {
        // Servir arquivos estáticos
        this.app.use(express.static(__dirname));
        
        // Rota principal
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'index.html'));
        });

        // API para estatísticas
        this.app.get('/api/stats', (req, res) => {
            res.json({
                ...this.stats,
                connectedClients: this.clients.size,
                midiDevices: this.getMIDIDevices(),
                midiConnected: this.midiConnected,
                hasRealDevice: this.hasRealDevice
            });
        });

        // API para logs históricos
        this.app.get('/api/logs/:date?', async (req, res) => {
            try {
                const date = req.params.date || moment().format('YYYY-MM-DD');
                const logFilePath = path.join(__dirname, 'logs', `midi-${date}.json`);
                
                if (await fs.pathExists(logFilePath)) {
                    const logData = await fs.readJson(logFilePath);
                    res.json(logData);
                } else {
                    res.json([]);
                }
            } catch (error) {
                console.error('Erro ao buscar logs:', error);
                res.status(500).json({ error: 'Erro interno do servidor' });
            }
        });
    }

    setupWebSocket() {
        this.wss = new WebSocket.Server({ port: 3001 });
        
        this.wss.on('connection', (ws, req) => {
            console.log(`Nova conexão WebSocket de ${req.socket.remoteAddress}`);
            this.clients.add(ws);
            
            // Enviar estatísticas iniciais
            ws.send(JSON.stringify({
                type: 'stats',
                data: {
                    ...this.stats,
                    connectedClients: this.clients.size,
                    midiDevices: this.getMIDIDevices(),
                    midiConnected: this.midiConnected,
                    hasRealDevice: this.hasRealDevice
                }
            }));
            
            ws.on('close', () => {
                console.log('Conexão WebSocket fechada');
                this.clients.delete(ws);
            });
            
            ws.on('error', (error) => {
                console.error('Erro WebSocket:', error);
                this.clients.delete(ws);
            });
        });
        
        console.log('Servidor WebSocket rodando na porta 3001');
    }

    setupMIDI() {
        // Listar dispositivos MIDI disponíveis
        console.log('Dispositivos MIDI disponíveis:');
        const portCount = this.midiInput.getPortCount();
        
        for (let i = 0; i < portCount; i++) {
            console.log(`  ${i}: ${this.midiInput.getPortName(i)}`);
        }
        
        // Procurar dispositivo MIDI-Terra automaticamente
        let terraDevice = -1;
        for (let i = 0; i < portCount; i++) {
            const deviceName = this.midiInput.getPortName(i).toLowerCase();
            if (deviceName.includes('terra') || deviceName.includes('midi') || deviceName.includes('32u4')) {
                terraDevice = i;
                break;
            }
        }
        
        // Se não encontrou automaticamente, usar o primeiro dispositivo disponível
        if (terraDevice === -1 && portCount > 0) {
            terraDevice = 0;
        }
        
        if (terraDevice !== -1) {
            try {
                this.midiInput.openPort(terraDevice);
                console.log(`Conectado ao dispositivo MIDI: ${this.midiInput.getPortName(terraDevice)}`);
                this.stats.connectedDevices.add(this.midiInput.getPortName(terraDevice));
                this.midiConnected = true;
                this.hasRealDevice = true;
                
                // Configurar callback para mensagens MIDI
                this.midiInput.on('message', (deltaTime, message) => {
                    this.handleMIDIMessage(deltaTime, message);
                });
                
                // Ignorar tipos de mensagem de timing/clock
                this.midiInput.ignoreTypes(false, false, false);
                
            } catch (error) {
                console.error('Erro ao conectar dispositivo MIDI:', error);
                console.log('Nenhum dispositivo MIDI físico disponível. Sistema aguardará conexões.');
                this.midiConnected = false;
                this.hasRealDevice = false;
            }
        } else {
            console.log('Nenhum dispositivo MIDI encontrado. Sistema aguardará conexões.');
            this.midiConnected = false;
            this.hasRealDevice = false;
        }
    }

    // Função removida - não criar porta virtual automaticamente

    handleMIDIMessage(deltaTime, message) {
        const midiData = {
            timestamp: new Date(),
            deltaTime: deltaTime,
            rawData: Array.from(message),
            ...this.parseMIDIMessage(message)
        };
        
        this.stats.totalMessages++;
        
        // Broadcast para todos os clientes conectados
        const messageStr = JSON.stringify({
            type: 'midi',
            data: midiData
        });
        
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(messageStr);
            }
        });
        
        // Log para arquivo
        this.logToFile(midiData);
        
        // Debug no console
        console.log(`MIDI: ${midiData.type} | Canal: ${midiData.channel ? '0x' + midiData.channel.toString(16).toUpperCase() : 'N/A'} | Dados: ${message.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}`);
    }

    parseMIDIMessage(message) {
        if (message.length < 1) return { type: 'unknown' };
        
        const status = message[0];
        const channel = status & 0x0F;
        const command = status & 0xF0;
        
        const result = {
            channel: status >= 0x80 ? status : null,
            command: command
        };
        
        // Identificar slave baseado no padrão do Terra (canais 0x90-0x9F)
        if (status >= 0x90 && status <= 0x9F) {
            result.slave = String(status - 0x90 + 1).padStart(2, '0');
        }
        
        switch (command) {
            case 0x90: // Note On
                if (message.length >= 3) {
                    result.type = message[2] > 0 ? 'noteOn' : 'noteOff';
                    result.note = message[1];
                    result.velocity = message[2];
                    result.frequency = this.midiNoteToFrequency(message[1]);
                }
                break;
                
            case 0x80: // Note Off
                if (message.length >= 3) {
                    result.type = 'noteOff';
                    result.note = message[1];
                    result.velocity = message[2];
                    result.frequency = this.midiNoteToFrequency(message[1]);
                }
                break;
                
            case 0xB0: // Control Change
                if (message.length >= 3) {
                    result.type = 'controlChange';
                    result.control = message[1];
                    result.value = message[2];
                }
                break;
                
            case 0xC0: // Program Change
                if (message.length >= 2) {
                    result.type = 'programChange';
                    result.program = message[1];
                }
                break;
                
            case 0xD0: // Channel Aftertouch
                if (message.length >= 2) {
                    result.type = 'aftertouch';
                    result.pressure = message[1];
                }
                break;
                
            case 0xE0: // Pitch Bend
                if (message.length >= 3) {
                    result.type = 'pitchBend';
                    result.lsb = message[1];
                    result.msb = message[2];
                    result.value = (message[2] << 7) + message[1];
                }
                break;
                
            case 0xF0: // System messages
                result.type = 'system';
                if (status === 0xF8) result.subType = 'clock';
                else if (status === 0xFA) result.subType = 'start';
                else if (status === 0xFB) result.subType = 'continue';
                else if (status === 0xFC) result.subType = 'stop';
                else if (status === 0xFE) result.subType = 'activeSensing';
                else if (status === 0xFF) result.subType = 'systemReset';
                break;
                
            default:
                result.type = 'unknown';
        }
        
        return result;
    }

    midiNoteToFrequency(noteNumber) {
        // A4 = 440 Hz, MIDI note 69
        return 440 * Math.pow(2, (noteNumber - 69) / 12);
    }

    async setupLogging() {
        const logsDir = path.join(__dirname, 'logs');
        await fs.ensureDir(logsDir);
        
        // Rotacionar logs diariamente
        this.rotateLogFile();
        
        // Configurar rotação automática à meia-noite
        setInterval(() => {
            const now = new Date();
            if (now.getHours() === 0 && now.getMinutes() === 0 && now.getSeconds() < 10) {
                this.rotateLogFile();
            }
        }, 10000); // Verificar a cada 10 segundos
    }

    async rotateLogFile() {
        const today = moment().format('YYYY-MM-DD');
        const logFilePath = path.join(__dirname, 'logs', `midi-${today}.json`);
        
        this.logFile = logFilePath;
        
        // Criar arquivo se não existir
        if (!(await fs.pathExists(logFilePath))) {
            await fs.writeJson(logFilePath, [], { spaces: 2 });
        }
        
        console.log(`Log rotacionado para: ${logFilePath}`);
    }

    async logToFile(midiData) {
        if (!this.logFile) return;
        
        try {
            let logData = [];
            
            if (await fs.pathExists(this.logFile)) {
                logData = await fs.readJson(this.logFile);
            }
            
            logData.push(midiData);
            
            // Manter apenas as últimas 10000 mensagens por dia
            if (logData.length > 10000) {
                logData = logData.slice(-10000);
            }
            
            await fs.writeJson(this.logFile, logData, { spaces: 2 });
        } catch (error) {
            console.error('Erro ao escrever no log:', error);
        }
    }

    getMIDIDevices() {
        const devices = [];
        const portCount = this.midiInput.getPortCount();
        
        for (let i = 0; i < portCount; i++) {
            devices.push({
                id: i,
                name: this.midiInput.getPortName(i)
            });
        }
        
        return devices;
    }

    startServer() {
        const PORT = process.env.PORT || 3000;
        
        this.app.listen(PORT, () => {
            console.log(`Servidor HTTP rodando na porta ${PORT}`);
            console.log(`Acesse: http://localhost:${PORT}`);
            console.log('Sistema MIDI Terra Monitor iniciado!');
            console.log('========================================');
            console.log('Conecte seu dispositivo MIDI-Terra e monitore em tempo real.');
            console.log('Os logs serão salvos automaticamente na pasta logs/');
        });
    }

    cleanup() {
        console.log('Finalizando MIDI Terra Monitor...');
        
        if (this.midiInput && this.midiInput.isPortOpen()) {
            this.midiInput.closePort();
        }
        
        if (this.wss) {
            this.wss.close();
        }
        
        console.log('Cleanup concluído');
    }
}

// Inicializar monitor
const monitor = new MIDITerraMonitor();

// Cleanup graceful ao sair
process.on('SIGINT', () => {
    monitor.cleanup();
    process.exit(0);
});

process.on('SIGTERM', () => {
    monitor.cleanup();
    process.exit(0);
});

module.exports = MIDITerraMonitor;