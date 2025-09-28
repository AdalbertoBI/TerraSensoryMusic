// TerraSensoryMusic - Versão Web Funcional
// Simulador MIDI para demonstração web

class TerraSensoryMusicWeb {
    constructor() {
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
        this.simulationInterval = null;
        this.isSimulating = false;
        
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
                <h3>🎵 Bem-vindo ao TerraSensoryMusic</h3>
                <p>Esta é uma demonstração web do sistema de monitoramento MIDI da Terra Eletrônica.</p>
                <p><strong>Versão Demo:</strong> Clique em "Conectar" para ver dados MIDI simulados em ação!</p>
                <p>🔗 <a href="https://github.com/AdalbertoBI/TerraSensoryMusic" target="_blank">Ver código no GitHub</a></p>
            </div>
        `;
        
        document.querySelector('.container').insertBefore(welcomeMsg, document.querySelector('.control-panel'));
        
        // Remover após 8 segundos
        setTimeout(() => {
            welcomeMsg.style.opacity = '0';
            setTimeout(() => welcomeMsg.remove(), 500);
        }, 8000);
    }

    toggleConnection() {
        if (this.isConnected) {
            this.disconnect();
        } else {
            this.connect();
        }
    }

    connect() {
        this.isConnected = true;
        this.updateConnectionStatus(true);
        this.startSimulation();
        console.log('🎵 TerraSensoryMusic: Simulação iniciada');
    }

    disconnect() {
        this.isConnected = false;
        this.updateConnectionStatus(false);
        this.stopSimulation();
        console.log('🔇 TerraSensoryMusic: Simulação parada');
    }

    startSimulation() {
        if (this.simulationInterval) return;
        
        this.isSimulating = true;
        
        // Simular mensagens MIDI a cada 200-1500ms
        this.simulationInterval = setInterval(() => {
            if (!this.isPaused) {
                this.generateSimulatedMIDIMessage();
            }
        }, Math.random() * 1300 + 200);
        
        // Rajadas ocasionais de notas (acordes)
        setInterval(() => {
            if (this.isSimulating && !this.isPaused && Math.random() < 0.25) {
                for (let i = 0; i < Math.floor(Math.random() * 4) + 2; i++) {
                    setTimeout(() => {
                        if (this.isSimulating) this.generateSimulatedMIDIMessage();
                    }, i * 30);
                }
            }
        }, 4000);
    }

    stopSimulation() {
        if (this.simulationInterval) {
            clearInterval(this.simulationInterval);
            this.simulationInterval = null;
            this.isSimulating = false;
        }
    }

    generateSimulatedMIDIMessage() {
        const channels = [0x90, 0x91, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0x9B, 0x9C, 0x9D, 0x9E, 0x9F];
        const slaves = ['01', '02', '03', '04', '05'];
        const notes = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79]; // Escala musical
        const types = ['noteOn', 'noteOff', 'controlChange'];
        
        const channel = channels[Math.floor(Math.random() * channels.length)];
        const slave = slaves[Math.floor(Math.random() * slaves.length)];
        const type = types[Math.floor(Math.random() * types.length)];
        
        let message = [channel];
        let midiData = {
            timestamp: new Date(),
            channel: channel,
            slave: slave,
            type: type
        };
        
        switch (type) {
            case 'noteOn':
                const note = notes[Math.floor(Math.random() * notes.length)] + Math.floor(Math.random() * 24) - 12;
                const velocity = Math.floor(Math.random() * 80) + 40; // Velocity mais realista
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
        this.handleMIDIMessage({ type: 'midi', data: midiData });
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
            logContainer.innerHTML = '<div class="log-empty">🎵 TerraSensoryMusic aguardando dados MIDI... Clique em "Conectar" para começar!</div>';
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
                <div><strong>Timestamp:</strong> ${message.timestamp.toLocaleString('pt-BR')}</div>
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
            statusText.textContent = '🎵 TerraSensoryMusic Ativo';
            connectBtn.textContent = 'Desconectar';
            connectBtn.classList.remove('btn-primary');
            connectBtn.classList.add('btn-secondary');
        } else {
            statusIndicator.classList.remove('connected');
            statusText.textContent = 'Desconectado - Demo Web';
            connectBtn.textContent = 'Conectar (Demo)';
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

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    window.terraSensoryMusic = new TerraSensoryMusicWeb();
});