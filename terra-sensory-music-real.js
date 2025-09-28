// TerraSensoryMusic - Versão Completa (Dados Reais)
// Sistema de monitoramento MIDI para dispositivos Terra Eletrônica

class TerraSensoryMusicReal {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.isPaused = false;
        this.midiLog = [];
        this.filteredLog = [];
        this.stats = {
            totalMessages: 0,
            messagesPerSecond: 0,
            activeChannels: new Set(),
            connectedSlaves: new Set()
        };
        this.messageRateCounter = 0;
        this.channels = new Map();
        this.reconnectInterval = null;
        this.serverStatus = {
            midiConnected: false,
            hasRealDevice: false
        };
        
        this.init();
    }

    init() {
        this.setupUI();
        this.setupChannels();
        this.startStatsUpdater();
        this.showWelcomeMessage();
    }

    setupUI() {
        // Botões
        document.getElementById('connectBtn').addEventListener('click', () => this.toggleConnection());
        document.getElementById('clearLog').addEventListener('click', () => this.clearLog());
        document.getElementById('pauseBtn').addEventListener('click', () => this.togglePause());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportLog());
        
        // Filtros
        document.getElementById('channelFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('messageType').addEventListener('change', () => this.applyFilters());
        document.getElementById('slaveFilter').addEventListener('change', () => this.applyFilters());
        
        // Modal
        document.getElementById('modalClose').addEventListener('click', () => this.closeModal());
        document.getElementById('messageModal').addEventListener('click', (e) => {
            if (e.target.id === 'messageModal') this.closeModal();
        });
        
        // Auto-scroll
        this.autoScrollCheckbox = document.getElementById('autoScroll');
    }

    setupChannels() {
        const channelsGrid = document.getElementById('channelsGrid');
        
        // Criar cards para cada canal MIDI (0x90 - 0x9F)
        for (let i = 0; i < 16; i++) {
            const channelHex = (0x90 + i).toString(16).toUpperCase();
            const channelCard = document.createElement('div');
            channelCard.className = 'channel-card';
            channelCard.id = `channel-${channelHex}`;
            
            channelCard.innerHTML = `
                <div class="channel-number">Canal ${i}</div>
                <div class="channel-hex">0x${channelHex}</div>
                <div class="channel-status">Inativo</div>
                <div class="channel-activity">
                    <div class="channel-activity-bar"></div>
                </div>
            `;
            
            channelsGrid.appendChild(channelCard);
            this.channels.set(channelHex, {
                element: channelCard,
                lastActivity: 0,
                messageCount: 0
            });
        }
    }

    showWelcomeMessage() {
        const welcomeMsg = document.createElement('div');
        welcomeMsg.className = 'welcome-message';
        welcomeMsg.innerHTML = `
            <div class="welcome-content">
                <h3>🎵 TerraSensoryMusic - Sistema MIDI Real</h3>
                <p>Sistema de monitoramento MIDI para dispositivos Terra Eletrônica.</p>
                <p><strong>Instruções:</strong></p>
                <ol>
                    <li>Conecte seu dispositivo MIDI-Terra via USB</li>
                    <li>Execute o servidor local (npm start)</li>
                    <li>Clique em "Conectar MIDI" para iniciar o monitoramento</li>
                </ol>
                <p>🔗 <a href="https://github.com/AdalbertoBI/TerraSensoryMusic" target="_blank">Ver código no GitHub</a></p>
            </div>
        `;
        
        document.querySelector('.container').insertBefore(welcomeMsg, document.querySelector('.control-panel'));
        
        // Remover após 10 segundos
        setTimeout(() => {
            if (welcomeMsg.parentNode) {
                welcomeMsg.style.opacity = '0';
                setTimeout(() => {
                    if (welcomeMsg.parentNode) welcomeMsg.remove();
                }, 500);
            }
        }, 10000);
    }

    toggleConnection() {
        if (this.isConnected) {
            this.disconnect();
        } else {
            this.connect();
        }
    }

    connect() {
        this.setupWebSocket();
    }

    disconnect() {
        if (this.socket) {
            this.socket.close();
        }
        this.isConnected = false;
        this.updateConnectionStatus(false);
        
        if (this.reconnectInterval) {
            clearInterval(this.reconnectInterval);
            this.reconnectInterval = null;
        }
        
        console.log('🔇 TerraSensoryMusic: Desconectado');
    }

    setupWebSocket() {
        try {
            // Tentar conectar no servidor local primeiro
            const wsUrl = window.location.protocol === 'file:' ? 
                'ws://localhost:3001' : 
                `ws://${window.location.hostname}:3001`;
                
            this.socket = new WebSocket(wsUrl);
            
            this.socket.onopen = () => {
                this.isConnected = true;
                this.updateConnectionStatus(true);
                console.log('🎵 TerraSensoryMusic: Conectado ao servidor MIDI');
                
                if (this.reconnectInterval) {
                    clearInterval(this.reconnectInterval);
                    this.reconnectInterval = null;
                }
            };
            
            this.socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'stats') {
                        this.updateMIDIConnectionStatus(data.data);
                    } else if (data.type === 'midi') {
                        this.handleMIDIMessage(data);
                    } else if (data.type === 'info') {
                        this.showServerMessage(data.data);
                    }
                } catch (error) {
                    console.error('Erro ao processar mensagem:', error);
                }
            };
            
            this.socket.onclose = () => {
                this.isConnected = false;
                this.updateConnectionStatus(false);
                console.log('🔌 Conexão com servidor perdida');
                
                // Tentar reconectar automaticamente
                if (!this.reconnectInterval) {
                    this.reconnectInterval = setInterval(() => {
                        console.log('🔄 Tentando reconectar...');
                        this.setupWebSocket();
                    }, 3000);
                }
            };
            
            this.socket.onerror = (error) => {
                console.error('❌ Erro WebSocket:', error);
                this.showConnectionError();
            };
            
        } catch (error) {
            console.error('❌ Erro ao conectar WebSocket:', error);
            this.showConnectionError();
        }
    }

    showConnectionError() {
        const errorMsg = document.createElement('div');
        errorMsg.className = 'error-message';
        errorMsg.innerHTML = `
            <div class="error-content">
                <h3>⚠️ Erro de Conexão</h3>
                <p>Não foi possível conectar ao servidor MIDI.</p>
                <p><strong>Verifique se:</strong></p>
                <ul>
                    <li>O servidor está rodando (execute: <code>npm start</code>)</li>
                    <li>A porta 3001 está disponível</li>
                    <li>Seu dispositivo MIDI-Terra está conectado</li>
                </ul>
                <button onclick="this.parentElement.parentElement.remove()" class="btn btn-secondary">Fechar</button>
            </div>
        `;
        
        document.body.appendChild(errorMsg);
        
        // Remover automaticamente após 15 segundos
        setTimeout(() => {
            if (errorMsg.parentNode) errorMsg.remove();
        }, 15000);
    }

    showServerMessage(data) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'server-message';
        messageDiv.innerHTML = `
            <div class="message-content">
                <p>📡 ${data.message}</p>
            </div>
        `;
        
        document.querySelector('.header').appendChild(messageDiv);
        
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.style.opacity = '0';
                setTimeout(() => {
                    if (messageDiv.parentNode) messageDiv.remove();
                }, 500);
            }
        }, 5000);
    }

    updateMIDIConnectionStatus(stats) {
        this.serverStatus = {
            midiConnected: stats.midiConnected || false,
            hasRealDevice: stats.hasRealDevice || false
        };
        
        const statusIndicator = document.getElementById('connectionStatus');
        const statusText = statusIndicator.querySelector('.status-text');
        
        if (this.isConnected) {
            if (stats.midiConnected && stats.hasRealDevice) {
                statusIndicator.classList.add('connected');
                statusIndicator.classList.remove('warning');
                statusText.textContent = '🎵 MIDI Conectado';
            } else {
                statusIndicator.classList.remove('connected');
                statusIndicator.classList.add('warning');
                statusText.textContent = '⏳ Aguardando Dispositivo MIDI';
            }
        }
    }

    handleMIDIMessage(data) {
        if (this.isPaused) return;
        
        const midiMessage = data.data;
        
        this.midiLog.push(midiMessage);
        this.updateStats(midiMessage);
        this.updateChannelActivity(midiMessage);
        this.applyFilters();
        this.updateLogDisplay();
    }

    updateStats(message) {
        this.stats.totalMessages++;
        this.messageRateCounter++;
        
        if (message.channel) {
            this.stats.activeChannels.add(message.channel);
        }
        
        if (message.slave) {
            this.stats.connectedSlaves.add(message.slave);
        }
        
        document.getElementById('totalMessages').textContent = this.stats.totalMessages.toLocaleString();
        document.getElementById('activeChannels').textContent = this.stats.activeChannels.size;
        document.getElementById('connectedSlaves').textContent = this.stats.connectedSlaves.size;
    }

    updateChannelActivity(message) {
        if (!message.channel) return;
        
        const channelHex = message.channel.toString(16).toUpperCase().padStart(2, '0');
        const channel = this.channels.get(channelHex);
        
        if (channel) {
            channel.lastActivity = Date.now();
            channel.messageCount++;
            
            channel.element.classList.add('active');
            channel.element.querySelector('.channel-status').textContent = 'Ativo';
            
            const activityBar = channel.element.querySelector('.channel-activity-bar');
            activityBar.style.width = '100%';
            
            setTimeout(() => {
                if (Date.now() - channel.lastActivity >= 2000) {
                    channel.element.classList.remove('active');
                    channel.element.querySelector('.channel-status').textContent = 'Inativo';
                    activityBar.style.width = '0%';
                }
            }, 2000);
        }
    }

    applyFilters() {
        const channelFilter = document.getElementById('channelFilter').value;
        const typeFilter = document.getElementById('messageType').value;
        const slaveFilter = document.getElementById('slaveFilter').value;
        
        this.filteredLog = this.midiLog.filter(message => {
            if (channelFilter && message.channel !== parseInt(channelFilter, 16)) {
                return false;
            }
            
            if (typeFilter && message.type !== typeFilter) {
                return false;
            }
            
            if (slaveFilter && message.slave !== slaveFilter) {
                return false;
            }
            
            return true;
        });
        
        this.updateLogDisplay();
    }

    updateLogDisplay() {
        const logContainer = document.getElementById('logContainer');
        const logCount = document.getElementById('logCount');
        const logSize = document.getElementById('logSize');
        
        if (this.filteredLog.length === 0) {
            logContainer.innerHTML = '<div class="log-empty">🎵 TerraSensoryMusic aguardando conexão MIDI... Conecte seu dispositivo Terra!</div>';
            logCount.textContent = '0 mensagens';
            logSize.textContent = '0 KB';
            return;
        }
        
        const messagesToShow = this.filteredLog.slice(-100);
        const fragment = document.createDocumentFragment();
        
        logContainer.innerHTML = '';
        
        messagesToShow.forEach((message) => {
            const logEntry = this.createLogEntry(message);
            fragment.appendChild(logEntry);
        });
        
        logContainer.appendChild(fragment);
        
        if (this.autoScrollCheckbox.checked) {
            logContainer.scrollTop = logContainer.scrollHeight;
        }
        
        logCount.textContent = `${this.filteredLog.length} mensagens`;
        const sizeKB = Math.round(JSON.stringify(this.filteredLog).length / 1024);
        logSize.textContent = `${sizeKB} KB`;
    }

    createLogEntry(message) {
        const entry = document.createElement('div');
        entry.className = `log-entry ${message.type || ''}`;
        entry.id = `log-${message.timestamp.getTime()}`;
        
        const timestamp = new Date(message.timestamp).toLocaleTimeString('pt-BR', {
            hour12: false,
            millisecond: true
        });
        
        const channelHex = message.channel ? `0x${message.channel.toString(16).toUpperCase().padStart(2, '0')}` : '-';
        const note = this.midiNoteToName(message.note) || message.note || '-';
        const velocity = message.velocity || '-';
        const slave = message.slave || '-';
        const rawData = message.rawData ? message.rawData.map(b => `0x${b.toString(16).toUpperCase().padStart(2, '0')}`).join(' ') : '-';
        
        entry.innerHTML = `
            <div class="log-timestamp">${timestamp}</div>
            <div class="log-channel">${channelHex}</div>
            <div class="log-type">${message.type || 'Unknown'}</div>
            <div class="log-note">${note}</div>
            <div class="log-velocity">${velocity}</div>
            <div class="log-slave">S${slave}</div>
            <div class="log-raw">${rawData}</div>
        `;
        
        entry.addEventListener('click', () => this.showMessageDetails(message));
        entry.classList.add('new');
        
        return entry;
    }

    midiNoteToName(note) {
        if (!note || note < 0 || note > 127) return null;
        
        const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(note / 12) - 1;
        const noteName = names[note % 12];
        
        return `${noteName}${octave}`;
    }

    midiNoteToFrequency(note) {
        return 440 * Math.pow(2, (note - 69) / 12);
    }

    showMessageDetails(message) {
        document.getElementById('modalBody').innerHTML = `
            <div class="message-details">
                <div><strong>Timestamp:</strong> ${new Date(message.timestamp).toLocaleString('pt-BR')}</div>
                <div><strong>Tipo:</strong> ${message.type}</div>
                <div><strong>Canal:</strong> ${message.channel ? `0x${message.channel.toString(16).toUpperCase().padStart(2, '0')}` : 'N/A'}</div>
                <div><strong>Nota:</strong> ${message.note ? `${message.note} (${this.midiNoteToName(message.note)})` : 'N/A'}</div>
                <div><strong>Velocity:</strong> ${message.velocity || 'N/A'}</div>
                <div><strong>Slave:</strong> ${message.slave || 'N/A'}</div>
                <div><strong>Dados Brutos:</strong> ${message.rawData ? message.rawData.map(b => `0x${b.toString(16).toUpperCase().padStart(2, '0')}`).join(' ') : 'N/A'}</div>
                ${message.frequency ? `<div><strong>Frequência:</strong> ${message.frequency.toFixed(2)} Hz</div>` : ''}
            </div>
        `;
        
        document.getElementById('messageModal').style.display = 'block';
    }

    closeModal() {
        document.getElementById('messageModal').style.display = 'none';
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        const pauseBtn = document.getElementById('pauseBtn');
        pauseBtn.textContent = this.isPaused ? 'Retomar' : 'Pausar';
        pauseBtn.classList.toggle('btn-warning', this.isPaused);
    }

    clearLog() {
        this.midiLog = [];
        this.filteredLog = [];
        this.updateLogDisplay();
        
        this.stats.totalMessages = 0;
        this.stats.activeChannels.clear();
        this.stats.connectedSlaves.clear();
        
        document.getElementById('totalMessages').textContent = '0';
        document.getElementById('activeChannels').textContent = '0';
        document.getElementById('connectedSlaves').textContent = '0';
        
        // Limpar atividade dos canais
        this.channels.forEach(channel => {
            channel.element.classList.remove('active');
            channel.element.querySelector('.channel-status').textContent = 'Inativo';
            channel.element.querySelector('.channel-activity-bar').style.width = '0%';
        });
    }

    exportLog() {
        const data = JSON.stringify(this.filteredLog, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `terra-sensory-music-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    updateConnectionStatus(connected) {
        const statusIndicator = document.getElementById('connectionStatus');
        const statusText = statusIndicator.querySelector('.status-text');
        const connectBtn = document.getElementById('connectBtn');
        
        if (connected) {
            statusIndicator.classList.add('connected');
            statusIndicator.classList.remove('warning');
            statusText.textContent = '🔗 Servidor Conectado';
            connectBtn.textContent = 'Desconectar';
            connectBtn.classList.remove('btn-primary');
            connectBtn.classList.add('btn-secondary');
        } else {
            statusIndicator.classList.remove('connected', 'warning');
            statusText.textContent = 'Desconectado';
            connectBtn.textContent = 'Conectar MIDI';
            connectBtn.classList.remove('btn-secondary');
            connectBtn.classList.add('btn-primary');
        }
    }

    startStatsUpdater() {
        setInterval(() => {
            this.stats.messagesPerSecond = this.messageRateCounter;
            document.getElementById('messagesPerSecond').textContent = this.stats.messagesPerSecond;
            this.messageRateCounter = 0;
        }, 1000);
    }
}

// CSS adicional para mensagens de erro e servidor
const additionalStyles = `
<style>
.error-message, .server-message {
    position: fixed;
    top: 20px;
    right: 20px;
    background: rgba(220, 53, 69, 0.95);
    color: white;
    padding: 20px;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    z-index: 10000;
    max-width: 400px;
    backdrop-filter: blur(10px);
}

.server-message {
    background: rgba(23, 162, 184, 0.95);
}

.error-content, .message-content {
    margin: 0;
}

.error-content h3 {
    margin-bottom: 10px;
    font-size: 1.2em;
}

.error-content ul {
    margin: 10px 0 10px 20px;
}

.error-content code {
    background: rgba(255, 255, 255, 0.2);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: monospace;
}
</style>
`;

// Adicionar estilos ao head
document.head.insertAdjacentHTML('beforeend', additionalStyles);

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    window.terraSensoryMusic = new TerraSensoryMusicReal();
});