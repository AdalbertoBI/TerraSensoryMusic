// TerraSensoryMusic - Sistema Principal
// Integração de todos os módulos para monitoramento MIDI Terra Eletrônica

class TerraSensoryMusicSystem {
    constructor() {
        this.version = '2.0.0';
        this.isConnected = false;
        this.isPaused = false;
        
        // Instâncias dos módulos
        this.diagnosticSystem = new DiagnosticSystem();
        this.midiDetector = new MidiDetector();
        this.uiManager = new UIManager();
        this.midiParser = new MidiParser();
        
        // Dados
        this.midiLog = [];
        this.filteredLog = [];
        this.stats = {
            totalMessages: 0,
            messagesPerSecond: 0,
            activeChannels: new Set(),
            connectedDevices: 0
        };
        
        this.messageRateCounter = 0;
        this.channels = new Map();
        
        // Inicializar sistema
        this.initialize();
    }

    async initialize() {
        console.log(`🎵 Inicializando TerraSensoryMusic v${this.version}...`);
        
        try {
            // Inicializar UI Manager
            this.uiManager.initialize();
            
            // Configurar interface
            this.setupUI();
            this.setupChannels();
            
            // Iniciar sistema de estatísticas
            this.startStatsUpdater();
            
            // Verificar suporte Web MIDI
            this.checkWebMIDISupport();
            
            // Configurar callbacks do detector MIDI
            this.setupMidiDetectorCallbacks();
            
            console.log('✅ TerraSensoryMusic inicializado com sucesso!');
            
            // Mostrar mensagem de boas-vindas
            this.showWelcomeMessage();
            
        } catch (error) {
            console.error('❌ Erro ao inicializar TerraSensoryMusic:', error);
            this.uiManager.showNotification('Erro ao inicializar o sistema: ' + error.message, 'error');
        }
    }

    setupUI() {
        // Event listeners dos botões principais
        const buttons = {
            connectBtn: () => this.toggleConnection(),
            clearLog: () => this.clearLog(),
            pauseBtn: () => this.togglePause(),
            exportBtn: () => this.exportLog(),
            diagnoseBtn: () => this.runDiagnosis(),
            rescanBtn: () => this.forceScan()
        };

        Object.entries(buttons).forEach(([id, handler]) => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('click', handler);
            }
        });

        // Event listeners dos filtros
        const filters = ['channelFilter', 'messageType', 'slaveFilter'];
        filters.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', () => this.applyFilters());
            }
        });

        // Modal
        const modalClose = document.getElementById('modalClose');
        if (modalClose) {
            modalClose.addEventListener('click', () => this.uiManager.closeModal());
        }

        const messageModal = document.getElementById('messageModal');
        if (messageModal) {
            messageModal.addEventListener('click', (e) => {
                if (e.target.id === 'messageModal') this.uiManager.closeModal();
            });
        }
    }

    setupChannels() {
        const channelsGrid = document.getElementById('channelsGrid');
        if (!channelsGrid) return;

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

    setupMidiDetectorCallbacks() {
        // Callback para mudanças de estado dos dispositivos
        this.midiDetector.onDeviceStateChange((event) => {
            this.handleDeviceStateChange(event);
        });
    }

    checkWebMIDISupport() {
        if (!navigator.requestMIDIAccess) {
            const message = 'Web MIDI API não suportada. Use Chrome, Edge ou Opera.';
            this.uiManager.showNotification(message, 'error');
            this.diagnosticSystem.log(message, 'error');
            return false;
        }
        
        this.diagnosticSystem.log('✅ Web MIDI API suportada', 'success');
        return true;
    }

    showWelcomeMessage() {
        setTimeout(() => {
            this.uiManager.showNotification(
                '🎯 TerraSensoryMusic v2.0 iniciado! Conecte seu dispositivo Terra via USB e clique em "Conectar MIDI".',
                'terra',
                10000
            );
        }, 1000);
    }

    // Métodos de conexão
    async toggleConnection() {
        if (this.isConnected) {
            this.disconnect();
        } else {
            await this.connect();
        }
    }

    async connect() {
        try {
            this.uiManager.updateConnectionStatus('connecting');
            this.diagnosticSystem.log('🔄 Iniciando conexão MIDI...', 'info');
            this.diagnosticSystem.log('💡 Dispositivo "Midi-Terra" detectado no Windows - tentando acessar via Web MIDI...', 'info');
            
            // Inicializar detector MIDI
            await this.midiDetector.initialize();
            
            // Configurar handlers para mensagens MIDI
            this.setupMidiMessageHandlers();
            
            this.isConnected = true;
            this.uiManager.updateConnectionStatus('connected');
            
            const terraDevices = this.midiDetector.getTerraDevices();
            const allInputs = this.midiDetector.getAllInputs();
            
            this.stats.connectedDevices = allInputs.length;
            this.uiManager.updateStats(this.stats);
            
            // Verificação específica para Midi-Terra
            const midiTerraFound = allInputs.find(device => 
                device.name.toLowerCase().includes('midi-terra') || 
                device.name.toLowerCase().includes('miditerra')
            );
            
            if (midiTerraFound) {
                this.uiManager.showNotification(`🎯 MIDI-TERRA CONECTADO: ${midiTerraFound.name}`, 'terra');
                this.diagnosticSystem.log(`🎯 SUCESSO: Midi-Terra detectado como "${midiTerraFound.name}"`, 'terra');
            } else if (terraDevices.length > 0) {
                const deviceNames = terraDevices.map(d => d.name).join(', ');
                this.uiManager.showNotification(`🔍 Dispositivos Terra detectados: ${deviceNames}`, 'terra');
                this.diagnosticSystem.log(`🔍 Dispositivos Terra encontrados (pode incluir Midi-Terra): ${deviceNames}`, 'info');
            } else if (allInputs.length > 0) {
                this.uiManager.showNotification(`⚠️ ${allInputs.length} dispositivos MIDI detectados, mas nenhum identificado como Terra`, 'warning');
                this.diagnosticSystem.log(`⚠️ Dispositivos genéricos encontrados (Midi-Terra pode estar entre eles):`, 'warning');
                allInputs.forEach((device, index) => {
                    this.diagnosticSystem.log(`   ${index + 1}. "${device.name}" (${device.manufacturer})`, 'info');
                });
                this.uiManager.showNotification('💡 Use "🔍 Diagnosticar" para análise detalhada', 'info');
            } else {
                this.uiManager.showNotification('❌ Nenhum dispositivo MIDI acessível via Web MIDI API', 'error');
                this.diagnosticSystem.log('❌ PROBLEMA: Midi-Terra visível no Windows mas não acessível via navegador', 'error');
                this.diagnosticSystem.log('💡 Possíveis causas: drivers, permissões ou configuração do dispositivo', 'warning');
            }
            
        } catch (error) {
            console.error('❌ Erro ao conectar:', error);
            this.diagnosticSystem.log(`❌ Erro de conexão: ${error.message}`, 'error');
            
            if (error.name === 'SecurityError') {
                this.uiManager.showNotification('❌ Permissão negada. Recarregue a página e permita o acesso aos dispositivos MIDI', 'error');
            } else {
                this.uiManager.showNotification(`❌ Erro: ${error.message}`, 'error');
            }
            
            this.uiManager.updateConnectionStatus('disconnected');
        }
    }

    disconnect() {
        this.isConnected = false;
        this.uiManager.updateConnectionStatus('disconnected');
        this.uiManager.showNotification('🔌 Desconectado dos dispositivos MIDI', 'info');
        this.diagnosticSystem.log('🔌 Sistema desconectado', 'info');
    }

    setupMidiMessageHandlers() {
        const inputs = this.midiDetector.getAllInputs();
        
        inputs.forEach(inputInfo => {
            if (inputInfo.device && inputInfo.device.onmidimessage !== undefined) {
                inputInfo.device.onmidimessage = (event) => {
                    this.handleMidiMessage(event, inputInfo);
                };
            }
        });
    }

    handleMidiMessage(event, deviceInfo) {
        if (this.isPaused || !event.data) return;

        // Usar o parser para interpretar a mensagem
        const parsedMessage = this.midiParser.parseMessage(
            event.data, 
            new Date(), 
            deviceInfo
        );

        // Adicionar informações extras
        parsedMessage.deviceName = deviceInfo.name;
        parsedMessage.isTerraDevice = deviceInfo.isTerraDevice;

        // Adicionar ao log
        this.midiLog.push(parsedMessage);

        // Atualizar estatísticas
        this.updateStats(parsedMessage);

        // Atualizar atividade dos canais
        this.updateChannelActivity(parsedMessage);

        // Aplicar filtros e atualizar interface
        this.applyFilters();

        // Log detalhado para dispositivos Terra
        if (deviceInfo.isTerraDevice) {
            this.diagnosticSystem.log(
                `🎵 Terra MIDI: ${parsedMessage.type} | Canal: ${parsedMessage.channel} | Dados: ${parsedMessage.rawData?.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}`,
                'terra'
            );
        }
    }

    handleDeviceStateChange(event) {
        const port = event.port;
        const action = port.state === 'connected' ? 'conectado' : 'desconectado';
        
        this.diagnosticSystem.log(`🔄 Dispositivo ${action}: ${port.name}`, 'info');
        
        // Se é um dispositivo Terra sendo conectado
        if (port.state === 'connected') {
            const isTerra = this.midiDetector.identifyTerraDevice(port);
            if (isTerra) {
                this.uiManager.showNotification(`🎯 Dispositivo Terra conectado: ${port.name}`, 'terra');
            }
        }
        
        // Atualizar contadores
        const allInputs = this.midiDetector.getAllInputs();
        this.stats.connectedDevices = allInputs.length;
        this.uiManager.updateStats(this.stats);
    }

    updateStats(message) {
        this.stats.totalMessages++;
        this.messageRateCounter++;
        
        if (typeof message.channel === 'number') {
            this.stats.activeChannels.add(message.channel);
        }
        
        this.uiManager.updateStats({
            ...this.stats,
            activeChannels: this.stats.activeChannels.size
        });
    }

    updateChannelActivity(message) {
        if (typeof message.channel !== 'number') return;
        
        const channel = this.channels.get(message.channel);
        
        if (channel) {
            channel.lastActivity = Date.now();
            channel.messageCount++;
            
            this.uiManager.updateChannelActivity(message.channel, true);
            
            // Auto-desativar após 2 segundos
            setTimeout(() => {
                if (Date.now() - channel.lastActivity >= 2000) {
                    this.uiManager.updateChannelActivity(message.channel, false);
                }
            }, 2000);
        }
    }

    // Métodos de filtros e interface
    applyFilters() {
        const channelFilter = document.getElementById('channelFilter')?.value;
        const typeFilter = document.getElementById('messageType')?.value;
        
        this.filteredLog = this.midiLog.filter(message => {
            if (channelFilter && message.channel !== parseInt(channelFilter.replace('0x9', ''))) {
                return false;
            }
            
            if (typeFilter && message.type !== typeFilter) {
                return false;
            }
            
            return true;
        });
        
        this.uiManager.updateLogDisplay(this.filteredLog, this.filteredLog.length);
    }

    // Métodos de controle
    togglePause() {
        this.isPaused = !this.isPaused;
        const pauseBtn = document.getElementById('pauseBtn');
        
        if (pauseBtn) {
            pauseBtn.textContent = this.isPaused ? 'Retomar' : 'Pausar';
            pauseBtn.className = this.isPaused ? 'btn btn-success' : 'btn btn-warning';
        }
        
        const message = this.isPaused ? '⏸️ Monitoramento pausado' : '▶️ Monitoramento retomado';
        this.uiManager.showNotification(message, 'info');
        this.diagnosticSystem.log(message, 'info');
    }

    clearLog() {
        this.midiLog = [];
        this.filteredLog = [];
        
        this.stats.totalMessages = 0;
        this.stats.activeChannels.clear();
        
        this.uiManager.updateStats(this.stats);
        this.uiManager.clearLog();
        
        // Limpar atividade dos canais
        this.channels.forEach((channel, channelNum) => {
            this.uiManager.updateChannelActivity(channelNum, false);
        });
        
        this.uiManager.showNotification('🗑️ Log limpo', 'info');
        this.diagnosticSystem.log('🗑️ Log de mensagens limpo', 'info');
    }

    exportLog() {
        const data = {
            timestamp: new Date().toISOString(),
            version: this.version,
            stats: {
                ...this.stats,
                activeChannels: Array.from(this.stats.activeChannels)
            },
            devices: this.midiDetector.getTerraDevices(),
            messages: this.midiLog,
            messageStats: this.midiParser.getMessageStats(this.midiLog)
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `terra-sensory-music-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.uiManager.showNotification('📁 Log exportado com sucesso!', 'success');
        this.diagnosticSystem.log('📁 Dados exportados', 'success');
    }

    // Método para forçar re-scan de dispositivos
    forceScan() {
        this.diagnosticSystem.log('🔄 Forçando novo scan de dispositivos...', 'info');
        
        if (!this.isConnected) {
            this.uiManager.showNotification('⚠️ Conecte-se ao MIDI primeiro', 'warning');
            return;
        }
        
        if (this.midiDetector) {
            this.midiDetector.forceScan();
            
            // Atualizar interface após scan
            setTimeout(() => {
                const terraDevices = this.midiDetector.getTerraDevices();
                const allInputs = this.midiDetector.getAllInputs();
                
                this.stats.connectedDevices = allInputs.length;
                this.uiManager.updateStats(this.stats);
                
                if (terraDevices.length > 0) {
                    const deviceNames = terraDevices.map(d => d.name).join(', ');
                    this.uiManager.showNotification(`🎯 Dispositivos Terra encontrados: ${deviceNames}`, 'terra');
                } else {
                    this.uiManager.showNotification('⚠️ Nenhum dispositivo Terra detectado no re-scan', 'warning');
                }
            }, 500);
        }
    }

    // Diagnóstico
    async runDiagnosis() {
        this.diagnosticSystem.log('🔍 Executando diagnóstico completo...', 'info');
        
        try {
            const reportHtml = await this.diagnosticSystem.runFullDiagnosis();
            
            this.uiManager.showModal('🔍 Diagnóstico do Sistema MIDI', reportHtml, {
                onClose: () => {
                    this.diagnosticSystem.log('📋 Diagnóstico concluído', 'success');
                }
            });
            
        } catch (error) {
            console.error('❌ Erro no diagnóstico:', error);
            this.uiManager.showNotification(`Erro no diagnóstico: ${error.message}`, 'error');
        }
    }

    showMessageDetails(index) {
        if (index < 0 || index >= this.filteredLog.length) return;
        
        const message = this.filteredLog[index];
        
        let detailsHtml = `
            <div class="message-details">
                <h5>Detalhes da Mensagem MIDI</h5>
                <div><strong>Timestamp:</strong> ${message.timestamp.toLocaleString('pt-BR')}</div>
                <div><strong>Dispositivo:</strong> ${message.deviceName || 'Desconhecido'}</div>
                <div><strong>Terra Device:</strong> ${message.isTerraDevice ? '🎯 SIM' : 'Não'}</div>
                <div><strong>Tipo:</strong> ${message.type}</div>
                <div><strong>Canal:</strong> ${typeof message.channel === 'number' ? `Canal ${message.channel}` : 'N/A'}</div>
        `;

        if (message.note !== undefined) {
            detailsHtml += `<div><strong>Nota:</strong> ${message.note} (${message.noteName || 'N/A'})</div>`;
            if (message.frequency) {
                detailsHtml += `<div><strong>Frequência:</strong> ${message.frequency.toFixed(2)} Hz</div>`;
            }
        }

        if (message.velocity !== undefined) {
            detailsHtml += `<div><strong>Velocity:</strong> ${message.velocity}</div>`;
        }

        if (message.controller !== undefined) {
            detailsHtml += `<div><strong>Controller:</strong> ${message.controller} (${message.controllerName || 'CC' + message.controller})</div>`;
        }

        if (message.value !== undefined) {
            detailsHtml += `<div><strong>Value:</strong> ${message.value}</div>`;
        }

        if (message.terraSpecific) {
            detailsHtml += `<div class="terra-specific"><strong>🎯 Específico Terra:</strong> SIM</div>`;
        }

        detailsHtml += `
                <div><strong>Dados Brutos:</strong> ${message.rawData ? message.rawData.map(b => `0x${b.toString(16).toUpperCase().padStart(2, '0')}`).join(' ') : 'N/A'}</div>
                <div><strong>MIDI Válido:</strong> ${message.isValidMidi ? '✅' : '❌'}</div>
            </div>
        `;

        this.uiManager.showModal('Detalhes da Mensagem', detailsHtml);
    }

    startStatsUpdater() {
        setInterval(() => {
            this.stats.messagesPerSecond = this.messageRateCounter;
            this.messageRateCounter = 0;
            
            this.uiManager.updateStats({
                ...this.stats,
                activeChannels: this.stats.activeChannels.size
            });
        }, 1000);
    }
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Iniciando TerraSensoryMusic...');
    window.terraSensoryMusic = new TerraSensoryMusicSystem();
});