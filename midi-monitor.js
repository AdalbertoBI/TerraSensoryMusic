class MIDIMonitor {
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
        
        this.init();
    }

    init() {
        this.setupUI();
        this.setupWebSocket();
        this.setupChannels();
        this.startStatsUpdater();
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

    setupWebSocket() {
        try {
            this.socket = new WebSocket('ws://localhost:3001');
            
            this.socket.onopen = () => {
                this.isConnected = true;
                this.updateConnectionStatus(true);
                console.log('Conectado ao servidor MIDI');
            };
            
            this.socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'stats') {
                        this.updateMIDIConnectionStatus(data.data);
                    } else {
                        this.handleMIDIMessage(data);
                    }
                } catch (error) {
                    console.error('Erro ao processar mensagem:', error);
                }
            };
            
            this.socket.onclose = () => {
                this.isConnected = false;
                this.updateConnectionStatus(false);
                console.log('Conexão fechada');
                
                // Tentar reconectar após 3 segundos
                setTimeout(() => this.setupWebSocket(), 3000);
            };
            
            this.socket.onerror = (error) => {
                console.error('Erro WebSocket:', error);
                this.updateConnectionStatus(false);
            };
        } catch (error) {
            console.error('Erro ao conectar WebSocket:', error);
            this.updateConnectionStatus(false);
        }
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

    handleMIDIMessage(data) {
        if (this.isPaused) return;
        
        const midiMessage = {
            timestamp: new Date(),
            ...data
        };
        
        this.midiLog.push(midiMessage);
        this.updateStats(midiMessage);
        this.updateChannelActivity(midiMessage);
        this.applyFilters();
        this.updateLogDisplay();
    }

    updateStats(message) {
        this.stats.totalMessages++;
        this.messageRateCounter++;
        
        // Extrair canal do comando MIDI
        if (message.channel) {
            this.stats.activeChannels.add(message.channel);
        }
        
        // Extrair slave do endereço
        if (message.slave) {
            this.stats.connectedSlaves.add(message.slave);
        }
        
        // Atualizar elementos da UI
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
            
            // Atualizar visual do canal
            channel.element.classList.add('active');
            channel.element.querySelector('.channel-status').textContent = 'Ativo';
            
            // Animar barra de atividade
            const activityBar = channel.element.querySelector('.channel-activity-bar');
            activityBar.style.width = '100%';
            
            // Remover atividade após 2 segundos
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
            // Filtro por canal
            if (channelFilter && message.channel !== parseInt(channelFilter, 16)) {
                return false;
            }
            
            // Filtro por tipo
            if (typeFilter && message.type !== typeFilter) {
                return false;
            }
            
            // Filtro por slave
            if (slaveFilter && message.slave !== slaveFilter) {
                return false;
            }
            
            return true;
        });
    }

    updateLogDisplay() {
        const logContainer = document.getElementById('logContainer');
        const logCount = document.getElementById('logCount');
        const logSize = document.getElementById('logSize');
        
        // Limpar container se necessário
        if (this.filteredLog.length === 0) {
            logContainer.innerHTML = '<div class="log-empty">Nenhuma mensagem encontrada</div>';
            return;
        }
        
        // Limpar container existente
        if (logContainer.querySelector('.log-empty')) {
            logContainer.innerHTML = '';
        }
        
        // Mostrar apenas as últimas 1000 mensagens para performance
        const messagesToShow = this.filteredLog.slice(-1000);
        
        // Adicionar novas mensagens
        const fragment = document.createDocumentFragment();
        
        messagesToShow.forEach((message, index) => {
            if (!document.getElementById(`log-${message.timestamp.getTime()}`)) {
                const logEntry = this.createLogEntry(message);
                fragment.appendChild(logEntry);
            }
        });
        
        logContainer.appendChild(fragment);
        
        // Auto-scroll se habilitado
        if (this.autoScrollCheckbox.checked) {
            logContainer.scrollTop = logContainer.scrollHeight;
        }
        
        // Atualizar informações do log
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

    midiNoteToName(noteNumber) {
        if (typeof noteNumber !== 'number' || noteNumber < 0 || noteNumber > 127) return null;
        
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(noteNumber / 12) - 1;
        const note = noteNames[noteNumber % 12];
        
        return `${note}${octave}`;
    }

    showMessageDetails(message) {
        const modalBody = document.getElementById('modalBody');
        
        modalBody.innerHTML = `
            <div style="display: grid; gap: 15px;">
                <div><strong>Timestamp:</strong> ${message.timestamp.toLocaleString('pt-BR')}</div>
                <div><strong>Canal MIDI:</strong> ${message.channel ? `0x${message.channel.toString(16).toUpperCase().padStart(2, '0')} (Canal ${message.channel - 0x90})` : 'N/A'}</div>
                <div><strong>Tipo:</strong> ${message.type || 'Desconhecido'}</div>
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

    toggleConnection() {
        const connectBtn = document.getElementById('connectBtn');
        
        if (this.isConnected) {
            this.socket.close();
            connectBtn.textContent = 'Conectar';
        } else {
            this.setupWebSocket();
            connectBtn.textContent = 'Desconectar';
        }
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
        document.getElementById('logContainer').innerHTML = '<div class="log-empty">Log limpo. Aguardando mensagens...</div>';
        
        // Resetar estatísticas
        this.stats.totalMessages = 0;
        this.stats.activeChannels.clear();
        this.stats.connectedSlaves.clear();
        
        document.getElementById('totalMessages').textContent = '0';
        document.getElementById('activeChannels').textContent = '0';
        document.getElementById('connectedSlaves').textContent = '0';
        document.getElementById('logCount').textContent = '0 mensagens';
        document.getElementById('logSize').textContent = '0 KB';
    }

    exportLog() {
        const dataStr = JSON.stringify(this.filteredLog, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `midi-log-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
        link.click();
        
        // Também exportar como CSV
        const csvData = this.convertToCSV(this.filteredLog);
        const csvBlob = new Blob([csvData], {type: 'text/csv'});
        
        const csvLink = document.createElement('a');
        csvLink.href = URL.createObjectURL(csvBlob);
        csvLink.download = `midi-log-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
        csvLink.click();
    }

    convertToCSV(data) {
        if (data.length === 0) return '';
        
        const headers = ['Timestamp', 'Canal', 'Tipo', 'Nota', 'Velocity', 'Slave', 'Dados Brutos'];
        const csvRows = [headers.join(',')];
        
        data.forEach(message => {
            const row = [
                message.timestamp.toISOString(),
                message.channel ? `0x${message.channel.toString(16).toUpperCase().padStart(2, '0')}` : '',
                message.type || '',
                message.note || '',
                message.velocity || '',
                message.slave || '',
                message.rawData ? `"${message.rawData.map(b => `0x${b.toString(16).toUpperCase().padStart(2, '0')}`).join(' ')}"` : ''
            ];
            csvRows.push(row.join(','));
        });
        
        return csvRows.join('\n');
    }

    updateConnectionStatus(connected) {
        const statusIndicator = document.getElementById('connectionStatus');
        const statusText = statusIndicator.querySelector('.status-text');
        const connectBtn = document.getElementById('connectBtn');
        
        if (connected) {
            statusIndicator.classList.add('connected');
            statusText.textContent = 'Conectado ao Servidor';
            connectBtn.textContent = 'Desconectar';
            connectBtn.classList.remove('btn-primary');
            connectBtn.classList.add('btn-secondary');
        } else {
            statusIndicator.classList.remove('connected');
            statusText.textContent = 'Desconectado';
            connectBtn.textContent = 'Conectar';
            connectBtn.classList.remove('btn-secondary');
            connectBtn.classList.add('btn-primary');
        }
    }

    updateMIDIConnectionStatus(stats) {
        const statusIndicator = document.getElementById('connectionStatus');
        const statusText = statusIndicator.querySelector('.status-text');
        
        if (this.isConnected) {
            if (stats.midiConnected && stats.hasRealDevice) {
                statusIndicator.classList.add('connected');
                statusIndicator.classList.remove('warning');
                statusText.textContent = 'MIDI Conectado';
            } else {
                statusIndicator.classList.remove('connected');
                statusIndicator.classList.add('warning');
                statusText.textContent = 'Aguardando MIDI';
            }
        }
    }

    startStatsUpdater() {
        // Atualizar mensagens por segundo a cada segundo
        setInterval(() => {
            this.stats.messagesPerSecond = this.messageRateCounter;
            document.getElementById('messagesPerSecond').textContent = this.stats.messagesPerSecond;
            this.messageRateCounter = 0;
        }, 1000);
        
        // Limpar canais inativos a cada 5 segundos
        setInterval(() => {
            const now = Date.now();
            this.channels.forEach((channel, channelHex) => {
                if (now - channel.lastActivity > 5000) {
                    channel.element.classList.remove('active');
                    channel.element.querySelector('.channel-status').textContent = 'Inativo';
                    channel.element.querySelector('.channel-activity-bar').style.width = '0%';
                }
            });
        }, 5000);
    }
}

// Inicializar monitor quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    window.midiMonitor = new MIDIMonitor();
});