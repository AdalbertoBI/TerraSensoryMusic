// Gerenciador de Interface - Terra Eletrônica
// Responsável por toda a interação com a interface do usuário

class UIManager {
    constructor() {
        this.notifications = [];
        this.modalQueue = [];
        this.isModalOpen = false;
        this.logContainer = null;
        this.autoScroll = true;
    }

    initialize() {
        console.log('🎨 Inicializando gerenciador de interface...');
        
        this.setupElements();
        this.setupEventListeners();
        this.setupNotificationStyles();
        this.setupModalStyles();
        
        console.log('✅ Gerenciador de interface inicializado');
    }

    setupElements() {
        // Elementos principais
        this.logContainer = document.getElementById('logContainer');
        this.autoScrollCheckbox = document.getElementById('autoScroll');
        
        // Elementos de estatísticas
        this.statsElements = {
            totalMessages: document.getElementById('totalMessages'),
            messagesPerSecond: document.getElementById('messagesPerSecond'),
            activeChannels: document.getElementById('activeChannels'),
            connectedSlaves: document.getElementById('connectedSlaves')
        };

        // Elementos de status
        this.statusElements = {
            connectionStatus: document.getElementById('connectionStatus'),
            connectBtn: document.getElementById('connectBtn'),
            logCount: document.getElementById('logCount'),
            logSize: document.getElementById('logSize')
        };
    }

    setupEventListeners() {
        // Auto-scroll
        if (this.autoScrollCheckbox) {
            this.autoScrollCheckbox.addEventListener('change', (e) => {
                this.autoScroll = e.target.checked;
            });
        }

        // Fechar modal ao clicar fora
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal();
            }
        });

        // Fechar notificações ao clicar no X
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('notification-close')) {
                const notification = e.target.closest('.diagnostic-notification');
                if (notification) {
                    notification.style.animation = 'slideOutLeft 0.3s ease';
                    setTimeout(() => {
                        if (notification.parentNode) {
                            notification.remove();
                            this.repositionNotifications();
                        }
                    }, 300);
                }
            }
        });
    }

    setupNotificationStyles() {
        if (!document.getElementById('notificationStyles')) {
            const style = document.createElement('style');
            style.id = 'notificationStyles';
            style.textContent = `
                .diagnostic-notification {
                    position: fixed;
                    bottom: 20px;
                    left: 20px;
                    min-width: 300px;
                    max-width: 450px;
                    z-index: 10001;
                    border-radius: 8px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                    animation: slideInLeft 0.3s ease;
                    margin-top: 10px;
                    transition: bottom 0.3s ease;
                }
                
                .diagnostic-notification.terra {
                    background: linear-gradient(135deg, #d4edda, #c3e6cb);
                    border: 1px solid #28a745;
                    color: #155724;
                }
                
                .diagnostic-notification.error {
                    background: linear-gradient(135deg, #f8d7da, #f5c6cb);
                    border: 1px solid #dc3545;
                    color: #721c24;
                }
                
                .diagnostic-notification.info {
                    background: linear-gradient(135deg, #d1ecf1, #bee5eb);
                    border: 1px solid #17a2b8;
                    color: #0c5460;
                }
                
                .diagnostic-content {
                    display: flex;
                    align-items: flex-start;
                    padding: 12px 16px;
                    gap: 10px;
                }
                
                .diagnostic-icon {
                    font-size: 1.2em;
                    flex-shrink: 0;
                    margin-top: 2px;
                }
                
                .diagnostic-text {
                    flex: 1;
                    font-weight: 500;
                    line-height: 1.4;
                }
                
                .diagnostic-close {
                    background: none;
                    border: none;
                    font-size: 1.2em;
                    cursor: pointer;
                    opacity: 0.7;
                    padding: 0;
                    width: 20px;
                    height: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 4px;
                }
                
                .diagnostic-close:hover {
                    opacity: 1;
                    background: rgba(0,0,0,0.1);
                }
                
                @keyframes slideInLeft {
                    from { opacity: 0; transform: translateX(-100%); }
                    to { opacity: 1; transform: translateX(0); }
                }
                
                @keyframes slideOutLeft {
                    from { opacity: 1; transform: translateX(0); }
                    to { opacity: 0; transform: translateX(-100%); }
                }
                
                @media (max-width: 500px) {
                    .diagnostic-notification {
                        left: 10px;
                        right: 10px;
                        min-width: auto;
                        max-width: none;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }

    setupModalStyles() {
        if (!document.getElementById('modalStyles')) {
            const style = document.createElement('style');
            style.id = 'modalStyles';
            style.textContent = `
                .diagnostic-report {
                    max-height: 70vh;
                    overflow-y: auto;
                }
                
                .diagnostic-section {
                    margin-bottom: 20px;
                    padding: 15px;
                    border-radius: 8px;
                    background: #f8f9fa;
                    border-left: 4px solid #007bff;
                }
                
                .diagnostic-section.success {
                    background: #d4edda;
                    border-left-color: #28a745;
                }
                
                .diagnostic-section h5 {
                    margin: 0 0 10px 0;
                    color: #1e3c72;
                    font-size: 1.1em;
                }
                
                .diagnostic-section ul {
                    margin: 10px 0;
                    padding-left: 20px;
                }
                
                .diagnostic-section li {
                    margin-bottom: 5px;
                    line-height: 1.4;
                }
            `;
            document.head.appendChild(style);
        }
    }

    // Métodos de notificação
    showNotification(message, type = 'info', duration = 8000) {
        const notification = document.createElement('div');
        notification.className = `diagnostic-notification ${type}`;
        
        const icon = {
            terra: '🎯',
            success: '✅', 
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        }[type] || 'ℹ️';

        notification.innerHTML = `
            <div class="diagnostic-content">
                <span class="diagnostic-icon">${icon}</span>
                <span class="diagnostic-text">${message}</span>
                <button class="diagnostic-close notification-close">×</button>
            </div>
        `;

        // Posicionar notificações (empilhar de baixo para cima)
        const existingNotifications = document.querySelectorAll('.diagnostic-notification');
        let bottomPosition = 20;
        
        existingNotifications.forEach(existing => {
            bottomPosition += existing.offsetHeight + 10;
        });
        
        notification.style.bottom = `${bottomPosition}px`;
        
        document.body.appendChild(notification);
        this.notifications.push(notification);

        // Auto-remover
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutLeft 0.3s ease';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                        this.notifications = this.notifications.filter(n => n !== notification);
                    }
                }, 300);
            }
        }, duration);

        return notification;
    }

    repositionNotifications() {
        const visibleNotifications = document.querySelectorAll('.diagnostic-notification');
        let bottomPosition = 20;
        
        visibleNotifications.forEach(notification => {
            notification.style.bottom = `${bottomPosition}px`;
            bottomPosition += notification.offsetHeight + 10;
        });
    }

    // Métodos de modal
    showModal(title, content, options = {}) {
        const modal = document.getElementById('messageModal');
        const modalHeader = modal.querySelector('.modal-header h3');
        const modalBody = document.getElementById('modalBody');

        if (modalHeader) modalHeader.textContent = title;
        modalBody.innerHTML = content;

        modal.style.display = 'block';
        this.isModalOpen = true;

        // Adicionar classe para animação
        modal.classList.add('modal-show');

        // Se tem callback de fechamento
        if (options.onClose) {
            modal.setAttribute('data-close-callback', 'true');
            this.modalCloseCallback = options.onClose;
        }
    }

    closeModal() {
        const modal = document.getElementById('messageModal');
        
        if (modal && this.isModalOpen) {
            modal.style.display = 'none';
            modal.classList.remove('modal-show');
            this.isModalOpen = false;

            // Executar callback se existir
            if (modal.getAttribute('data-close-callback') && this.modalCloseCallback) {
                this.modalCloseCallback();
                modal.removeAttribute('data-close-callback');
                this.modalCloseCallback = null;
            }

            // Processar fila de modais
            if (this.modalQueue.length > 0) {
                const next = this.modalQueue.shift();
                setTimeout(() => {
                    this.showModal(next.title, next.content, next.options);
                }, 100);
            }
        }
    }

    // Métodos de atualização de status
    updateConnectionStatus(status) {
        const statusElement = this.statusElements.connectionStatus;
        const connectBtn = this.statusElements.connectBtn;
        
        if (!statusElement || !connectBtn) return;

        const statusDot = statusElement.querySelector('.status-dot');
        const statusText = statusElement.querySelector('.status-text');

        statusElement.className = `status-indicator ${status}`;
        
        switch (status) {
            case 'connecting':
                if (statusText) statusText.textContent = 'Conectando...';
                connectBtn.textContent = 'Conectando...';
                connectBtn.disabled = true;
                break;
            case 'connected':
                if (statusText) statusText.textContent = 'Conectado';
                connectBtn.textContent = 'Desconectar';
                connectBtn.disabled = false;
                break;
            case 'fallback':
                if (statusText) statusText.textContent = 'Modo Diagnóstico';
                connectBtn.textContent = '🔄 Re-escanear';
                connectBtn.disabled = false;
                statusElement.className = 'status-indicator fallback';
                break;
            case 'disconnected':
            default:
                if (statusText) statusText.textContent = 'Desconectado';
                connectBtn.textContent = 'Conectar MIDI';
                connectBtn.disabled = false;
                break;
        }
    }

    // Métodos de estatísticas
    updateStats(stats) {
        if (this.statsElements.totalMessages) {
            this.statsElements.totalMessages.textContent = stats.totalMessages?.toLocaleString() || '0';
        }
        
        if (this.statsElements.messagesPerSecond) {
            this.statsElements.messagesPerSecond.textContent = stats.messagesPerSecond || '0';
        }
        
        if (this.statsElements.activeChannels) {
            this.statsElements.activeChannels.textContent = stats.activeChannels || '0';
        }
        
        if (this.statsElements.connectedSlaves) {
            this.statsElements.connectedSlaves.textContent = stats.connectedDevices || '0';
        }
    }

    // Métodos de log
    updateLogDisplay(logEntries, filteredCount) {
        if (!this.logContainer) return;

        const logCount = this.statusElements.logCount;
        const logSize = this.statusElements.logSize;

        // Atualizar contadores
        if (logCount) {
            logCount.textContent = `${filteredCount || 0} mensagens`;
        }
        
        if (logSize) {
            const sizeKB = Math.round((JSON.stringify(logEntries).length / 1024) * 100) / 100;
            logSize.textContent = `${sizeKB} KB`;
        }

        // Se não há entradas, mostrar mensagem vazia
        if (!logEntries || logEntries.length === 0) {
            this.logContainer.innerHTML = `
                <div class="log-empty">
                    🎵 Clique em "Conectar MIDI" e use seu dispositivo Terra para ver as mensagens...
                </div>
            `;
            return;
        }

        // Construir HTML das entradas
        let html = '';
        const maxEntries = 1000; // Limitar para performance
        const entries = logEntries.slice(-maxEntries);

        entries.forEach((entry, index) => {
            html += this.formatLogEntry(entry, index);
        });

        this.logContainer.innerHTML = html;

        // Auto-scroll se habilitado
        if (this.autoScroll) {
            this.logContainer.scrollTop = this.logContainer.scrollHeight;
        }
    }

    formatLogEntry(message, index) {
        const timestamp = message.timestamp ? message.timestamp.toLocaleTimeString() : '';
        const typeClass = message.type ? message.type.replace(/([A-Z])/g, '-$1').toLowerCase() : '';
        
        return `
            <div class="log-entry ${typeClass}" onclick="window.terraSensoryMusic.showMessageDetails(${index})">
                <div class="log-timestamp">${timestamp}</div>
                <div class="log-channel">CH ${message.channel ?? 'N/A'}</div>
                <div class="log-type">${message.type || 'Unknown'}</div>
                <div class="log-note">${message.note ? `${message.note} (${this.midiNoteToName(message.note)})` : 'N/A'}</div>
                <div class="log-velocity">${message.velocity ?? 'N/A'}</div>
                <div class="log-slave">DEV</div>
                <div class="log-raw">${message.rawData ? message.rawData.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ') : 'N/A'}</div>
            </div>
        `;
    }

    midiNoteToName(note) {
        if (typeof note !== 'number') return 'N/A';
        
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(note / 12) - 1;
        const noteName = noteNames[note % 12];
        
        return `${noteName}${octave}`;
    }

    // Métodos de canais
    updateChannelActivity(channel, active = false) {
        const channelCard = document.getElementById(`channel-${channel}`);
        
        if (channelCard) {
            if (active) {
                channelCard.classList.add('active');
                channelCard.querySelector('.channel-status').textContent = 'Ativo';
                channelCard.querySelector('.channel-activity-bar').style.width = '100%';
            } else {
                channelCard.classList.remove('active');
                channelCard.querySelector('.channel-status').textContent = 'Inativo';
                channelCard.querySelector('.channel-activity-bar').style.width = '0%';
            }
        }
    }

    // Limpeza
    clearAllNotifications() {
        this.notifications.forEach(notification => {
            if (notification.parentNode) {
                notification.remove();
            }
        });
        this.notifications = [];
    }

    clearLog() {
        if (this.logContainer) {
            this.logContainer.innerHTML = `
                <div class="log-empty">
                    🎵 Log limpo. Use seu dispositivo Terra para ver novas mensagens...
                </div>
            `;
        }
    }
}

// Exportar para uso global
window.UIManager = UIManager;