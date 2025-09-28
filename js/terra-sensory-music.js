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

        // Configurar sistema de abas
        this.setupTabs();
    }

    setupTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabPanels = document.querySelectorAll('.tab-panel');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.getAttribute('data-tab');
                
                // Remover classe active de todas as abas e painéis
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabPanels.forEach(panel => panel.classList.remove('active'));
                
                // Ativar a aba clicada
                button.classList.add('active');
                const targetPanel = document.getElementById(targetTab + '-panel');
                if (targetPanel) {
                    targetPanel.classList.add('active');
                }

                // Log para debug
                console.log(`🔄 Aba ativada: ${targetTab}`);
            });
        });
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
            this.uiManager.showNotification('🔄 Conectando... Aguarde resposta do navegador', 'info', 3000);
            this.diagnosticSystem.log('🔄 Iniciando conexão MIDI...', 'info');
            this.diagnosticSystem.log('💡 Dispositivo "Midi-Terra" detectado no Windows - tentando acessar via Web MIDI...', 'info');
            
            // Inicializar detector MIDI
            await this.midiDetector.initialize();
            
            // 🔥 CORREÇÃO: Registrar callback ao invés de configurar handlers
            this.midiDetector.onMidiMessage((event, deviceInfo) => {
                this.handleMidiMessage(event, deviceInfo);
            });
            
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
            
            // Usar informações enriquecidas do erro se disponível
            const userMessage = error.userMessage || error.message;
            const technicalMessage = error.technicalMessage || error.message;
            
            this.diagnosticSystem.log(`❌ Erro de conexão: ${technicalMessage}`, 'error');
            
            // Mostrar mensagem específica baseada no tipo de erro
            if (error.message.includes('Timeout')) {
                this.uiManager.showNotification('⏰ Timeout: Clique em "🔄 Re-escanear" para tentar novamente', 'warning');
                this.diagnosticSystem.log('💡 Dica: Verifique se não há popup de permissão aguardando resposta', 'info');
            } else if (error.originalError?.name === 'SecurityError' || error.message.includes('Permissão negada')) {
                this.uiManager.showNotification('🔒 Permissão negada. Clique em "🔄 Re-escanear" e permita o acesso MIDI', 'error');
                this.diagnosticSystem.log('💡 Dica: Procure por popup de permissão ou recarregue a página', 'info');
            } else if (error.originalError?.name === 'NotSupportedError') {
                this.uiManager.showNotification('❌ Navegador não suporta Web MIDI. Use Chrome, Edge ou Opera', 'error');
                this.diagnosticSystem.log('💡 Solução: Mude para um navegador compatível', 'warning');
            } else {
                this.uiManager.showNotification(`❌ ${userMessage}`, 'error');
            }
            
            // Verificar se deve tentar retry automático
            if (error.shouldAutoRetry && error.retryAttempt < error.maxRetries) {
                const nextAttempt = error.retryAttempt + 1;
                this.uiManager.showNotification(`🔄 Tentativa ${nextAttempt}/${error.maxRetries} em 3 segundos...`, 'info', 3000);
                this.diagnosticSystem.log(`🔄 Agendando retry automático ${nextAttempt}/${error.maxRetries}`, 'info');
                
                setTimeout(async () => {
                    this.diagnosticSystem.log(`🔄 Executando retry automático ${nextAttempt}/${error.maxRetries}`, 'info');
                    await this.connect();
                }, 3000);
                
                return; // Não entrar em fallback ainda
            }
            
            // Se não há mais retries ou erro não é recuperável
            if (error.retryAttempt >= error.maxRetries) {
                this.uiManager.showNotification(`❌ Falha após ${error.maxRetries} tentativas. Use "🔄 Re-escanear" para tentar novamente`, 'error');
                this.diagnosticSystem.log(`❌ Todas as tentativas automáticas falharam (${error.maxRetries}/${error.maxRetries})`, 'error');
            } else if (error.isRetryable !== false) {
                setTimeout(() => {
                    this.uiManager.showNotification('🔄 Clique em "Re-escanear" para tentar novamente', 'info');
                }, 2000);
            }
            
            // Entrar em modo fallback para manter funcionalidade
            this.enableFallbackMode();
        }
    }

    disconnect() {
        this.isConnected = false;
        this.uiManager.updateConnectionStatus('disconnected');
        this.uiManager.showNotification('🔌 Desconectado dos dispositivos MIDI', 'info');
        this.diagnosticSystem.log('🔌 Sistema desconectado', 'info');
    }

    // 🔥 REMOVIDO: setupMidiMessageHandlers - agora usa callback system

    handleMidiMessage(event, deviceInfo) {
        if (this.isPaused || !event.data) return;

        // 🔥 DEBUG: Verificar se está recebendo mensagens
        console.log('🎯 Sistema principal recebeu mensagem MIDI:', {
            device: deviceInfo.name,
            data: Array.from(event.data).map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ')
        });

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
        if (typeof message.channel !== 'number') {
            console.log('⚠️ Canal inválido:', message.channel);
            return;
        }
        
        // 🔥 DEBUG: Atividade do canal
        console.log('📊 Atualizando canal:', message.channel, 'tipo:', message.type);
        
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
        
        // 🔥 DEBUG: Verificar aplicação de filtros
        console.log('🔍 Aplicando filtros:', {
            totalMessages: this.midiLog.length,
            channelFilter,
            typeFilter
        });
        
        this.filteredLog = this.midiLog.filter(message => {
            if (channelFilter && message.channel !== parseInt(channelFilter.replace('0x9', ''))) {
                return false;
            }
            
            if (typeFilter && message.type !== typeFilter) {
                return false;
            }
            
            return true;
        });
        
        // 🔥 DEBUG: Verificar resultado dos filtros
        console.log('🔍 Resultado dos filtros:', {
            filtered: this.filteredLog.length,
            total: this.midiLog.length
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
    async forceScan() {
        this.diagnosticSystem.log('🔄 Forçando novo scan de dispositivos...', 'info');
        this.uiManager.showNotification('🔄 Re-escaneando dispositivos MIDI...', 'info');
        
        // Resetar estado de retry para nova tentativa manual
        if (this.midiDetector) {
            this.midiDetector.resetRetryState();
        }
        
        // Se estiver em modo fallback ou não conectado, tentar conectar novamente
        if (!this.isConnected || !this.midiDetector || !this.midiDetector.midiAccess) {
            this.diagnosticSystem.log('🔄 Tentando reconectar MIDI...', 'info');
            await this.connect();
            return;
        }
        
        // Se já conectado, fazer apenas scan
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
                    this.diagnosticSystem.log(`🎯 Re-scan concluído: ${terraDevices.length} dispositivos Terra`, 'terra');
                } else if (allInputs.length > 0) {
                    this.uiManager.showNotification(`📊 ${allInputs.length} dispositivos MIDI encontrados (nenhum Terra)`, 'warning');
                    this.diagnosticSystem.log(`📊 Re-scan: ${allInputs.length} dispositivos genéricos, 0 Terra`, 'warning');
                } else {
                    this.uiManager.showNotification('❌ Nenhum dispositivo MIDI encontrado no re-scan', 'error');
                    this.diagnosticSystem.log('❌ Re-scan: nenhum dispositivo encontrado', 'error');
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

    // Método de fallback quando MIDI não está disponível
    enableFallbackMode() {
        console.log('🔄 Entrando em modo fallback...');
        this.diagnosticSystem.log('🔄 Entrando em modo fallback - interface funcional sem MIDI', 'warning');
        
        // Simular conexão parcial para manter a interface funcionando
        this.isConnected = false;
        this.uiManager.updateConnectionStatus('fallback');
        
        // Mostrar instruções claras
        const fallbackMessage = `
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 10px 0;">
                <h4>🔧 Modo Diagnóstico Ativo</h4>
                <p><strong>A interface está funcionando sem conexão MIDI real.</strong></p>
                
                <h5>💡 Para conectar o Midi-Terra:</h5>
                <ol>
                    <li>Verifique se o dispositivo está conectado via USB</li>
                    <li>Confirme que aparece no Gerenciador de Dispositivos do Windows</li>
                    <li>Clique em "🔄 Re-escanear" para tentar novamente</li>
                    <li>Se aparecer popup de permissão, clique em "Permitir" <strong>rapidamente</strong></li>
                    <li>O sistema fará 3 tentativas automáticas com timeouts crescentes (5s, 10s, 15s)</li>
                </ol>
                
                <h5>🛠️ Diagnóstico avançado:</h5>
                <ul>
                    <li>Clique em "🔍 Diagnosticar" para análise completa</li>
                    <li>Use "🔄 Re-escanear" para nova tentativa (reseta contador)</li>
                    <li>Verifique o Console do navegador (F12) para logs detalhados</li>
                </ul>
                
                <h5>⚠️ Possíveis causas do timeout:</h5>
                <ul>
                    <li>Popup de permissão não foi respondido a tempo</li>
                    <li>Conflito com outro software MIDI</li>
                    <li>Problema de driver do dispositivo Midi-Terra</li>
                    <li>Política de segurança do navegador/empresa</li>
                </ul>
            </div>
        `;
        
        // Mostrar no log
        const logContainer = document.getElementById('logContainer');
        if (logContainer) {
            logContainer.innerHTML = `
                <div class="log-message fallback-mode">
                    ${fallbackMessage}
                </div>
            `;
        }
        
        this.uiManager.showNotification('🔧 Modo diagnóstico: Interface funcional, MIDI desconectado', 'warning', 8000);
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