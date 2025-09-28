const WebSocket = require('ws');
const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const moment = require('moment');

class MIDITerraMonitor {
    constructor() {
        this.app = express();
        this.wss = null;
        this.clients = new Set();
        this.logFile = null;
        this.stats = {
            totalMessages: 0,
            sessionsStarted: new Date(),
            connectedDevices: new Set()
        };
        
        // Simulação de dados MIDI para demonstração
        this.simulationMode = true;
        this.simulationInterval = null;
        
        this.init();
    }

    init() {
        this.setupExpress();
        this.setupWebSocket();
        this.setupLogging();
        this.startSimulation(); // Para demonstração
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
                simulationMode: this.simulationMode
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

        // Controle da simulação
        this.app.post('/api/simulation/:action', (req, res) => {
            const action = req.params.action;
            
            if (action === 'start') {
                this.startSimulation();
                res.json({ status: 'Simulação iniciada' });
            } else if (action === 'stop') {
                this.stopSimulation();
                res.json({ status: 'Simulação parada' });
            } else {
                res.status(400).json({ error: 'Ação inválida' });
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
                    simulationMode: this.simulationMode
                }
            }));
            
            // Enviar mensagem de boas-vindas
            ws.send(JSON.stringify({
                type: 'info',
                data: {
                    message: this.simulationMode ? 
                        'Sistema em modo demonstração. Conecte um dispositivo MIDI-Terra para dados reais.' :
                        'Conectado ao dispositivo MIDI-Terra.',
                    timestamp: new Date()
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

    startSimulation() {
        if (this.simulationInterval) return;
        
        console.log('🎵 Iniciando simulação de dados MIDI-Terra...');
        this.simulationMode = true;
        
        // Simular mensagens MIDI a cada 100-2000ms
        this.simulationInterval = setInterval(() => {
            if (this.clients.size > 0) {
                this.generateSimulatedMIDIMessage();
            }
        }, Math.random() * 1900 + 100);
        
        // Rajadas ocasionais de notas
        setInterval(() => {
            if (this.clients.size > 0 && Math.random() < 0.3) {
                for (let i = 0; i < Math.floor(Math.random() * 5) + 2; i++) {
                    setTimeout(() => {
                        this.generateSimulatedMIDIMessage();
                    }, i * 50);
                }
            }
        }, 5000);
    }

    stopSimulation() {
        if (this.simulationInterval) {
            clearInterval(this.simulationInterval);
            this.simulationInterval = null;
            this.simulationMode = false;
            console.log('🔇 Simulação de dados MIDI parada');
        }
    }

    generateSimulatedMIDIMessage() {
        const channels = [0x90, 0x91, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0x9B, 0x9C, 0x9D, 0x9E, 0x9F];
        const slaves = ['01', '02', '03', '04', '05'];
        const notes = [60, 62, 64, 65, 67, 69, 71, 72]; // Escala de Dó maior
        const types = ['noteOn', 'noteOff', 'controlChange'];
        
        const channel = channels[Math.floor(Math.random() * channels.length)];
        const slave = slaves[Math.floor(Math.random() * slaves.length)];
        const type = types[Math.floor(Math.random() * types.length)];
        
        let message = [channel];
        let midiData = {
            channel: channel,
            slave: slave,
            type: type
        };
        
        switch (type) {
            case 'noteOn':
                const note = notes[Math.floor(Math.random() * notes.length)] + Math.floor(Math.random() * 24) - 12;
                const velocity = Math.floor(Math.random() * 100) + 27;
                message.push(note, velocity);
                midiData.note = note;
                midiData.velocity = velocity;
                midiData.frequency = this.midiNoteToFrequency(note);
                break;
                
            case 'noteOff':
                const noteOff = notes[Math.floor(Math.random() * notes.length)] + Math.floor(Math.random() * 24) - 12;
                message.push(noteOff, 0);
                midiData.note = noteOff;
                midiData.velocity = 0;
                midiData.frequency = this.midiNoteToFrequency(noteOff);
                break;
                
            case 'controlChange':
                const control = Math.floor(Math.random() * 127);
                const value = Math.floor(Math.random() * 127);
                message.push(control, value);
                midiData.control = control;
                midiData.value = value;
                break;
        }
        
        midiData.rawData = message;
        midiData.timestamp = new Date();
        midiData.deltaTime = 0;
        
        this.handleMIDIMessage(0, message, midiData);
    }

    handleMIDIMessage(deltaTime, message, parsedData = null) {
        const midiData = parsedData || {
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
        
        // Debug no console (apenas para mensagens importantes)
        if (midiData.type !== 'system' || Math.random() < 0.1) {
            console.log(`MIDI: ${midiData.type} | Canal: ${midiData.channel ? '0x' + midiData.channel.toString(16).toUpperCase() : 'N/A'} | Slave: ${midiData.slave || 'N/A'} | ${midiData.note ? 'Nota: ' + midiData.note : ''}`);
        }
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
        // Em modo de simulação, retornar dispositivos fictícios
        if (this.simulationMode) {
            return [
                { id: 0, name: 'MIDI Terra Simulator' },
                { id: 1, name: 'Virtual MIDI Port' }
            ];
        }
        
        // Aqui seria implementada a detecção real de dispositivos MIDI
        return [];
    }

    startServer() {
        const PORT = process.env.PORT || 3000;
        
        this.app.listen(PORT, () => {
            console.log('========================================');
            console.log('🎵 MIDI Terra Monitor v1.0.0');
            console.log('========================================');
            console.log(`Servidor HTTP: http://localhost:${PORT}`);
            console.log(`WebSocket: ws://localhost:3001`);
            console.log('');
            if (this.simulationMode) {
                console.log('⚠️  MODO DEMONSTRAÇÃO ATIVO');
                console.log('   Dados MIDI simulados para teste');
                console.log('   Conecte um dispositivo MIDI-Terra real');
                console.log('   para dados em tempo real.');
            } else {
                console.log('🔌 Conecte seu dispositivo MIDI-Terra');
                console.log('   e monitore em tempo real!');
            }
            console.log('');
            console.log('📁 Logs salvos em: logs/');
            console.log('🌐 Interface: Acesse no navegador');
            console.log('========================================');
        });
    }

    cleanup() {
        console.log('Finalizando MIDI Terra Monitor...');
        
        this.stopSimulation();
        
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