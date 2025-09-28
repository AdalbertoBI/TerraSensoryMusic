// TerraSensoryMusic - Web MIDI API Real
// Sistema de monitoramento MIDI usando Web MIDI API do navegador

class TerraSensoryMusicWebMIDI {
    constructor() {
        this.midiAccess = null;
        this.isConnected = false;
        this.isPaused = false;
        this.midiLog = [];
        this.filteredLog = [];
        this.connectedInputs = new Map();
        this.connectedOutputs = new Map();
        this.stats = {
            totalMessages: 0,
            messagesPerSecond: 0,
            activeChannels: new Set(),
            connectedDevices: new Set()
        };
        this.messageRateCounter = 0;
        this.channels = new Map();
        
        this.init();
    }

    init() {
        this.setupUI();
        this.setupChannels();
        this.startStatsUpdater();
        this.checkWebMIDISupport();
    }

    checkWebMIDISupport() {
        if (!navigator.requestMIDIAccess) {
            this.showError('Web MIDI API não suportada', 
                'Seu navegador não suporta Web MIDI API. Use Chrome, Edge ou outro navegador compatível.');
            return;
        }
        
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
        
        // Criar cards para cada canal MIDI (0-15)
        for (let i = 0; i < 16; i++) {
            const channelCard = document.createElement('div');
            channelCard.className = 'channel-card';
            channelCard.id = `channel-${i}`;
            
            channelCard.innerHTML = `
                <div class="channel-number">Canal ${i}</div>
                <div class="channel-hex">CH ${i}</div>
                <div class="channel-status">Inativo</div>
                <div class="channel-activity">
                    <div class="channel-activity-bar"></div>
                </div>
            `;
            
            channelsGrid.appendChild(channelCard);
            this.channels.set(i, {
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
                <h3>🎵 TerraSensoryMusic - Web MIDI</h3>
                <p>Sistema de monitoramento MIDI usando Web MIDI API nativa do navegador.</p>
                <p><strong>Instruções:</strong></p>
                <ol>
                    <li>Conecte seu dispositivo MIDI via USB</li>
                    <li>Clique em "Conectar MIDI"</li>
                    <li>Permita o acesso aos dispositivos MIDI</li>
                    <li>Comece a tocar/usar seu dispositivo MIDI</li>
                </ol>
                <p><strong>⚡ Funciona com qualquer dispositivo MIDI!</strong></p>
                <p>🔗 <a href="https://github.com/AdalbertoBI/TerraSensoryMusic" target="_blank" rel="noopener">Ver código no GitHub</a></p>
            </div>
        `;
        
        document.querySelector('.container').insertBefore(welcomeMsg, document.querySelector('.control-panel'));
        
        // Remover após 12 segundos
        setTimeout(() => {
            if (welcomeMsg.parentNode) {
                welcomeMsg.style.opacity = '0';
                setTimeout(() => {
                    if (welcomeMsg.parentNode) welcomeMsg.remove();
                }, 500);
            }
        }, 12000);
    }

    async toggleConnection() {
        if (this.isConnected) {
            this.disconnect();
        } else {
            await this.connect();
        }
    }

    async connect() {
        try {
            this.updateConnectionStatus('connecting');
            
            // Solicitar acesso MIDI
            this.midiAccess = await navigator.requestMIDIAccess({ sysex: true });
            
            if (this.midiAccess) {
                this.setupMIDIInputs();
                this.setupMIDIOutputs();
                this.setupMIDIStateChange();
                
                this.isConnected = true;
                this.updateConnectionStatus('connected');
                this.showInfo(`🎵 Conectado! ${this.connectedInputs.size} dispositivos MIDI encontrados`);
                
                console.log('🎵 TerraSensoryMusic: Conectado à Web MIDI API');
                this.logConnectedDevices();
            }
            
        } catch (error) {
            console.error('❌ Erro ao conectar MIDI:', error);
            this.showError('Erro de Conexão MIDI', 
                'Não foi possível conectar aos dispositivos MIDI. Verifique se há dispositivos conectados e permita o acesso.');
            this.updateConnectionStatus('disconnected');
        }
    }

    disconnect() {
        if (this.midiAccess) {
            // Desconectar inputs
            this.connectedInputs.forEach(input => {
                input.onmidimessage = null;
            });
            this.connectedInputs.clear();
            this.connectedOutputs.clear();
            
            this.midiAccess = null;
        }
        
        this.isConnected = false;
        this.updateConnectionStatus('disconnected');
        this.showInfo('🔌 Desconectado dos dispositivos MIDI');
        console.log('🔇 TerraSensoryMusic: Desconectado');
    }

    setupMIDIInputs() {
        this.connectedInputs.clear();
        
        for (const input of this.midiAccess.inputs.values()) {
            console.log(`📥 MIDI Input: ${input.name} (${input.manufacturer})`);
            this.connectedInputs.set(input.id, input);
            this.stats.connectedDevices.add(input.name);
            
            // Configurar listener para mensagens MIDI
            input.onmidimessage = (event) => {
                this.handleMIDIMessage(event);
            };
        }
    }

    setupMIDIOutputs() {
        this.connectedOutputs.clear();
        
        for (const output of this.midiAccess.outputs.values()) {
            console.log(`📤 MIDI Output: ${output.name} (${output.manufacturer})`);
            this.connectedOutputs.set(output.id, output);
        }
    }

    setupMIDIStateChange() {
        this.midiAccess.onstatechange = (event) => {
            const port = event.port;
            const isInput = port.type === 'input';
            
            if (port.state === 'connected') {
                if (isInput) {
                    this.connectedInputs.set(port.id, port);
                    this.stats.connectedDevices.add(port.name);
                    port.onmidimessage = (event) => {
                        this.handleMIDIMessage(event);
                    };
                    this.showInfo(`🔌 Dispositivo conectado: ${port.name}`);
                } else {
                    this.connectedOutputs.set(port.id, port);
                }
            } else if (port.state === 'disconnected') {
                if (isInput) {
                    this.connectedInputs.delete(port.id);
                    this.stats.connectedDevices.delete(port.name);
                    this.showInfo(`🔌 Dispositivo desconectado: ${port.name}`);
                } else {
                    this.connectedOutputs.delete(port.id);
                }
            }
            
            this.logConnectedDevices();
        };
    }

    handleMIDIMessage(event) {
        if (this.isPaused || !event.data) return;
        
        const data = Array.from(event.data);
        const timestamp = new Date();
        
        // Analisar mensagem MIDI
        const midiMessage = this.parseMIDIMessage(data, timestamp);
        
        this.midiLog.push(midiMessage);
        this.updateStats(midiMessage);
        this.updateChannelActivity(midiMessage);
        this.applyFilters();
        this.updateLogDisplay();
        
        // Log no console
        console.log(`🎵 MIDI: ${midiMessage.type} | Canal: ${midiMessage.channel} | Dados: ${data.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}`);
    }

    parseMIDIMessage(data, timestamp) {
        if (data.length < 1) return { type: 'unknown', timestamp, rawData: data };
        
        const status = data[0];
        const channel = status & 0x0F;
        const command = status & 0xF0;
        
        const message = {
            timestamp,
            rawData: data,
            channel: channel,
            statusByte: status
        };
        
        // Interpretar tipo de mensagem
        switch (command) {
            case 0x80: // Note Off
                message.type = 'noteOff';
                message.note = data[1];
                message.velocity = data[2] || 0;
                message.frequency = this.midiNoteToFrequency(message.note);
                break;
                
            case 0x90: // Note On
                message.type = data[2] > 0 ? 'noteOn' : 'noteOff';
                message.note = data[1];
                message.velocity = data[2] || 0;
                message.frequency = this.midiNoteToFrequency(message.note);
                break;
                
            case 0xA0: // Polyphonic Aftertouch
                message.type = 'polyAftertouch';
                message.note = data[1];
                message.pressure = data[2];
                break;
                
            case 0xB0: // Control Change
                message.type = 'controlChange';
                message.controller = data[1];
                message.value = data[2];
                break;
                
            case 0xC0: // Program Change
                message.type = 'programChange';
                message.program = data[1];
                break;
                
            case 0xD0: // Channel Aftertouch
                message.type = 'channelAftertouch';
                message.pressure = data[1];
                break;
                
            case 0xE0: // Pitch Bend
                message.type = 'pitchBend';
                message.value = data[1] | (data[2] << 7);
                message.bendValue = (message.value - 8192) / 8192;
                break;
                
            default:
                if (status === 0xF0) {
                    message.type = 'sysex';
                } else if (status >= 0xF8) {
                    message.type = 'systemRealtime';
                } else {
                    message.type = 'unknown';
                }
        }
        
        return message;
    }

    logConnectedDevices() {
        const inputCount = this.connectedInputs.size;
        const outputCount = this.connectedOutputs.size;
        
        document.getElementById('connectedSlaves').textContent = inputCount;
        
        if (inputCount === 0) {
            this.showInfo('⚠️ Nenhum dispositivo MIDI detectado. Conecte um dispositivo e clique em "Conectar MIDI" novamente.');
        }
    }

    updateStats(message) {
        this.stats.totalMessages++;
        this.messageRateCounter++;
        
        if (typeof message.channel === 'number') {
            this.stats.activeChannels.add(message.channel);
        }
        
        document.getElementById('totalMessages').textContent = this.stats.totalMessages.toLocaleString();
        document.getElementById('activeChannels').textContent = this.stats.activeChannels.size;
    }

    updateChannelActivity(message) {
        if (typeof message.channel !== 'number') return;
        
        const channel = this.channels.get(message.channel);
        
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
        
        this.filteredLog = this.midiLog.filter(message => {
            if (channelFilter && message.channel !== parseInt(channelFilter.replace('0x9', ''))) {
                return false;
            }
            
            if (typeFilter && message.type !== typeFilter) {
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
            const statusText = this.isConnected ? 
                '🎵 Conectado! Toque em seu dispositivo MIDI para ver as mensagens...' :
                '🎵 Clique em "Conectar MIDI" para começar o monitoramento!';
            logContainer.innerHTML = `<div class="log-empty">${statusText}</div>`;
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
        
        const timestamp = message.timestamp.toLocaleTimeString('pt-BR', {
            hour12: false,
            millisecond: true
        });
        
        const channelDisplay = typeof message.channel === 'number' ? `CH ${message.channel}` : '-';
        const note = this.midiNoteToName(message.note) || message.note || '-';
        const velocity = message.velocity !== undefined ? message.velocity : '-';
        const rawData = message.rawData ? message.rawData.map(b => `0x${b.toString(16).toUpperCase().padStart(2, '0')}`).join(' ') : '-';
        
        entry.innerHTML = `
            <div class="log-timestamp">${timestamp}</div>
            <div class="log-channel">${channelDisplay}</div>
            <div class="log-type">${message.type || 'Unknown'}</div>
            <div class="log-note">${note}</div>
            <div class="log-velocity">${velocity}</div>
            <div class="log-slave">-</div>
            <div class="log-raw">${rawData}</div>
        `;
        
        entry.addEventListener('click', () => this.showMessageDetails(message));
        entry.classList.add('new');
        
        return entry;
    }

    midiNoteToName(note) {
        if (typeof note !== 'number' || note < 0 || note > 127) return null;
        
        const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(note / 12) - 1;
        const noteName = names[note % 12];
        
        return `${noteName}${octave}`;
    }

    midiNoteToFrequency(note) {
        if (typeof note !== 'number') return null;
        return 440 * Math.pow(2, (note - 69) / 12);
    }

    showMessageDetails(message) {
        document.getElementById('modalBody').innerHTML = `
            <div class="message-details">
                <div><strong>Timestamp:</strong> ${message.timestamp.toLocaleString('pt-BR')}</div>
                <div><strong>Tipo:</strong> ${message.type}</div>
                <div><strong>Canal:</strong> ${typeof message.channel === 'number' ? `Canal ${message.channel}` : 'N/A'}</div>
                <div><strong>Nota:</strong> ${message.note ? `${message.note} (${this.midiNoteToName(message.note)})` : 'N/A'}</div>
                <div><strong>Velocity:</strong> ${message.velocity !== undefined ? message.velocity : 'N/A'}</div>
                <div><strong>Controller:</strong> ${message.controller !== undefined ? message.controller : 'N/A'}</div>
                <div><strong>Value:</strong> ${message.value !== undefined ? message.value : 'N/A'}</div>
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
        
        this.showInfo(this.isPaused ? '⏸️ Monitoramento pausado' : '▶️ Monitoramento retomado');
    }

    clearLog() {
        this.midiLog = [];
        this.filteredLog = [];
        this.updateLogDisplay();
        
        this.stats.totalMessages = 0;
        this.stats.activeChannels.clear();
        
        document.getElementById('totalMessages').textContent = '0';
        document.getElementById('activeChannels').textContent = '0';
        
        // Limpar atividade dos canais
        this.channels.forEach(channel => {
            channel.element.classList.remove('active');
            channel.element.querySelector('.channel-status').textContent = 'Inativo';
            channel.element.querySelector('.channel-activity-bar').style.width = '0%';
        });
        
        this.showInfo('🗑️ Log limpo');
    }

    exportLog() {
        const data = JSON.stringify({
            timestamp: new Date().toISOString(),
            deviceInfo: {
                connectedInputs: Array.from(this.connectedInputs.values()).map(input => ({
                    id: input.id,
                    name: input.name,
                    manufacturer: input.manufacturer
                })),
                connectedOutputs: Array.from(this.connectedOutputs.values()).map(output => ({
                    id: output.id,
                    name: output.name,
                    manufacturer: output.manufacturer
                }))
            },
            statistics: {
                totalMessages: this.stats.totalMessages,
                activeChannels: Array.from(this.stats.activeChannels),
                connectedDevices: Array.from(this.stats.connectedDevices)
            },
            messages: this.filteredLog
        }, null, 2);
        
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `terra-sensory-music-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showInfo('💾 Log exportado com sucesso!');
    }

    updateConnectionStatus(status) {
        const statusIndicator = document.getElementById('connectionStatus');
        const statusText = statusIndicator.querySelector('.status-text');
        const connectBtn = document.getElementById('connectBtn');
        
        statusIndicator.className = 'status-indicator';
        
        switch (status) {
            case 'connected':
                statusIndicator.classList.add('connected');
                statusText.textContent = '🎵 MIDI Conectado';
                connectBtn.textContent = 'Desconectar';
                connectBtn.classList.remove('btn-primary');
                connectBtn.classList.add('btn-secondary');
                break;
                
            case 'connecting':
                statusIndicator.classList.add('warning');
                statusText.textContent = '🔄 Conectando...';
                connectBtn.textContent = 'Conectando...';
                connectBtn.disabled = true;
                break;
                
            case 'disconnected':
            default:
                statusText.textContent = 'Desconectado';
                connectBtn.textContent = 'Conectar MIDI';
                connectBtn.classList.remove('btn-secondary');
                connectBtn.classList.add('btn-primary');
                connectBtn.disabled = false;
                break;
        }
    }

    showInfo(message) {
        this.showNotification(message, 'info');
    }

    showError(title, message) {
        this.showNotification(`${title}: ${message}`, 'error');
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <p>${message}</p>
                <button onclick="this.parentElement.parentElement.remove()" class="notification-close">×</button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove após tempo baseado no tipo
        const timeout = type === 'error' ? 8000 : 4000;
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.opacity = '0';
                setTimeout(() => {
                    if (notification.parentNode) notification.remove();
                }, 300);
            }
        }, timeout);
    }

    startStatsUpdater() {
        setInterval(() => {
            this.stats.messagesPerSecond = this.messageRateCounter;
            document.getElementById('messagesPerSecond').textContent = this.stats.messagesPerSecond;
            this.messageRateCounter = 0;
        }, 1000);
    }
}

// CSS para notificações
const notificationStyles = `
<style>
.notification {
    position: fixed;
    top: 20px;
    right: 20px;
    max-width: 400px;
    padding: 15px 20px;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    z-index: 10000;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    animation: slideInRight 0.3s ease-out;
    opacity: 1;
    transition: opacity 0.3s ease;
}

.notification-info {
    background: rgba(23, 162, 184, 0.95);
    color: white;
    border-left: 4px solid #17a2b8;
}

.notification-error {
    background: rgba(220, 53, 69, 0.95);
    color: white;
    border-left: 4px solid #dc3545;
}

.notification-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 0;
}

.notification-content p {
    margin: 0;
    flex: 1;
}

.notification-close {
    background: none;
    border: none;
    color: white;
    font-size: 20px;
    cursor: pointer;
    margin-left: 10px;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: background 0.2s;
}

.notification-close:hover {
    background: rgba(255, 255, 255, 0.2);
}

@keyframes slideInRight {
    from {
        opacity: 0;
        transform: translateX(100%);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
}
</style>
`;

// Adicionar estilos ao head
document.head.insertAdjacentHTML('beforeend', notificationStyles);

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    window.terraSensoryMusic = new TerraSensoryMusicWebMIDI();
});