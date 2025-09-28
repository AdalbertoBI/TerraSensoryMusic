// Detector MIDI Terra - Terra Eletrônica
// Sistema especializado para detectar e conectar dispositivos Terra

class MidiDetector {
    constructor() {
        this.midiAccess = null;
        this.connectedInputs = new Map();
        this.connectedOutputs = new Map();
        this.terraDevices = new Map();
        this.deviceStateCallbacks = [];
        this.midiMessageCallbacks = [];
        
        // Sistema de retry progressivo
        this.retryAttempts = 0;
        this.maxRetries = 3;
        this.retryTimeouts = [5000, 10000, 15000]; // 5s, 10s, 15s
        this.lastErrorType = null;
        
        // Padrões para identificar dispositivos Terra (case insensitive)
        this.terraPatterns = [
            'midi-terra',      // Nome exato do dispositivo
            'terra',
            'terraeletronica', 
            'terra eletronica',
            'sensory',
            'sensor',
            'arduino',         // Muitos dispositivos Terra usam Arduino
            'serial',          // Dispositivos via porta serial
            'usb',             // Dispositivos USB genéricos
            'ch340',           // Chip conversor USB comum
            'cp210x',          // Outro chip conversor USB
            'ftdi'             // Chip FTDI comum em MIDI
        ];
        
        // IDs de vendor conhecidos para dispositivos Terra/Arduino
        this.terraVendorIds = [
            '2341', // Arduino
            '1A86', // CH340 (comum em placas Arduino clones)
            '0403', // FTDI (comum em dispositivos MIDI USB)
            '10C4'  // Silicon Labs (comum em conversores USB-Serial)
        ];
    }

    async initialize() {
        console.log('🔌 Inicializando detector MIDI Terra...');
        console.log('🔍 Verificando suporte Web MIDI API...');
        
        if (!navigator.requestMIDIAccess) {
            console.error('❌ Web MIDI API não suportada neste navegador');
            throw new Error('Web MIDI API não suportada neste navegador');
        }
        
        console.log('✅ Web MIDI API suportada');
        
        // Diagnóstico pré-conexão
        await this.preConnectionDiagnostic();
        
        console.log('🔐 Solicitando acesso aos dispositivos MIDI (pode aparecer popup de permissão)...');

        try {
            console.log('⏳ Aguardando navigator.requestMIDIAccess...');
            
            // Usar timeout baseado na tentativa atual
            const currentTimeout = this.retryTimeouts[Math.min(this.retryAttempts, this.retryTimeouts.length - 1)];
            console.log(`⏰ Timeout configurado para ${currentTimeout/1000} segundos (tentativa ${this.retryAttempts + 1})`);
            
            // Criar timeout progressivo
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error(`Timeout: requestMIDIAccess demorou mais de ${currentTimeout/1000} segundos (tentativa ${this.retryAttempts + 1}/${this.maxRetries})`));
                }, currentTimeout);
            });
            
            // Usar Promise.race para implementar timeout
            this.midiAccess = await Promise.race([
                navigator.requestMIDIAccess({ sysex: true }),
                timeoutPromise
            ]);
            
            console.log('🎯 Acesso MIDI obtido com sucesso!');
            
            // Resetar contador de tentativas em caso de sucesso
            this.retryAttempts = 0;
            
            // Log informações sobre o acesso MIDI
            console.log('📊 Dispositivos de entrada encontrados:', this.midiAccess.inputs.size);
            console.log('📊 Dispositivos de saída encontrados:', this.midiAccess.outputs.size);
            
            // Configurar listeners para mudanças de estado
            this.midiAccess.onstatechange = (event) => {
                console.log('🔄 Mudança de estado do dispositivo:', event);
                this.handleDeviceStateChange(event);
            };
            
            // Fazer scan inicial dos dispositivos
            console.log('🔍 Iniciando escaneamento dos dispositivos...');
            this.scanForDevices();
            
            console.log('✅ Detector MIDI Terra inicializado');
            return true;
            
        } catch (error) {
            console.error('❌ Erro ao inicializar detector MIDI:', error);
            console.error('📋 Tipo do erro:', error.name);
            console.error('📋 Mensagem do erro:', error.message);
            
            // Tratamento específico por tipo de erro
            let userMessage = '';
            let technicalMessage = '';
            
            if (error.message.includes('Timeout')) {
                console.error('⏰ TIMEOUT - requestMIDIAccess demorou mais de 10 segundos');
                userMessage = 'Timeout: A solicitação de acesso MIDI demorou muito. Tente novamente ou verifique se não há popup esperando resposta.';
                technicalMessage = 'O requestMIDIAccess() não respondeu em 10 segundos';
            } else if (error.name === 'SecurityError') {
                console.error('🚫 ERRO DE SEGURANÇA - Permissão negada pelo usuário');
                userMessage = 'Permissão negada. Clique em "Permitir" quando o navegador solicitar acesso aos dispositivos MIDI.';
                technicalMessage = 'SecurityError: Usuário negou permissão ou política de segurança bloqueou';
            } else if (error.name === 'AbortError') {
                console.error('⏹️ OPERAÇÃO CANCELADA - Usuário cancelou');  
                userMessage = 'Operação cancelada. Tente conectar novamente e permita o acesso aos dispositivos MIDI.';
                technicalMessage = 'AbortError: Usuário cancelou a solicitação de permissão';
            } else if (error.name === 'NotSupportedError') {
                console.error('🚫 RECURSO NÃO SUPORTADO - Web MIDI não disponível');
                userMessage = 'Web MIDI API não suportada. Use Chrome 43+, Edge 79+, ou Opera 30+.';
                technicalMessage = 'NotSupportedError: Web MIDI API não disponível neste navegador';
            } else {
                console.error('❓ ERRO DESCONHECIDO');
                userMessage = `Erro inesperado: ${error.message}. Tente recarregar a página.`;
                technicalMessage = `Erro desconhecido: ${error.name} - ${error.message}`;
            }
            
            // Verificar se deve tentar novamente
            const shouldRetry = this.shouldRetryConnection(error);
            
            // Criar erro enriquecido com informações para o usuário
            const enhancedError = new Error(userMessage);
            enhancedError.originalError = error;
            enhancedError.technicalMessage = technicalMessage;
            enhancedError.userMessage = userMessage;
            enhancedError.isRetryable = error.name !== 'NotSupportedError';
            enhancedError.shouldAutoRetry = shouldRetry;
            enhancedError.retryAttempt = this.retryAttempts;
            enhancedError.maxRetries = this.maxRetries;
            
            // Incrementar contador para próxima tentativa
            if (shouldRetry) {
                this.retryAttempts++;
                this.lastErrorType = error.name || 'Unknown';
            }
            
            throw enhancedError;
        }
    }

    async preConnectionDiagnostic() {
        console.log('🔍 Executando diagnóstico pré-conexão...');
        
        // Verificar Permissions API se disponível
        if (navigator.permissions && navigator.permissions.query) {
            try {
                console.log('🔐 Verificando estado de permissão MIDI...');
                const permission = await navigator.permissions.query({ name: 'midi', sysex: true });
                console.log(`📋 Estado da permissão: ${permission.state}`);
                
                if (permission.state === 'denied') {
                    console.warn('🚫 PERMISSÃO MIDI NEGADA - Este é o problema!');
                    const error = new Error('Permissão MIDI foi negada pelo usuário. Recarregue a página e permita o acesso.');
                    error.name = 'SecurityError';
                    error.userMessage = 'Permissão MIDI negada. Recarregue a página e clique em "Permitir" quando solicitado.';
                    error.technicalMessage = 'Permissions API indica que MIDI foi explicitamente negado';
                    error.isRetryable = true;
                    throw error;
                } else if (permission.state === 'prompt') {
                    console.log('❓ Permissão será solicitada - popup deve aparecer');
                } else if (permission.state === 'granted') {
                    console.log('✅ Permissão já concedida anteriormente');
                }
            } catch (permError) {
                // Se Permissions API falhar, continuar (nem todos navegadores suportam)
                console.warn('⚠️ Não foi possível verificar permissão via Permissions API:', permError.message);
            }
        } else {
            console.log('⚠️ Permissions API não disponível - seguindo para requestMIDIAccess');
        }
        
        // Verificar se popup blocker pode estar interferindo
        this.checkPopupBlocker();
        
        // Verificar configurações do navegador conhecidas
        this.checkBrowserConfiguration();
        
        console.log('✅ Diagnóstico pré-conexão concluído');
        
        // Log detalhado do ambiente para depuração avançada
        this.logEnvironmentDetails();
    }

    logEnvironmentDetails() {
        console.log('🔬 === DIAGNÓSTICO AVANÇADO DO AMBIENTE ===');
        console.log('🌐 User Agent:', navigator.userAgent);
        console.log('🖥️ Plataforma:', navigator.platform);
        console.log('🌍 Idioma:', navigator.language);
        console.log('🔗 URL atual:', window.location.href);
        console.log('🔐 Protocolo:', window.location.protocol);
        console.log('🏠 Hostname:', window.location.hostname);
        console.log('⚡ Suporte a Promises:', typeof Promise !== 'undefined');
        console.log('🎵 Web MIDI disponível:', typeof navigator.requestMIDIAccess === 'function');
        console.log('🔑 Permissions API:', typeof navigator.permissions !== 'undefined');
        console.log('🖼️ Em iframe:', window !== window.top);
        console.log('🔒 Contexto seguro:', window.isSecureContext);
        
        // Verificar possíveis conflitos conhecidos
        this.checkKnownConflicts();
        
        console.log('🔬 === FIM DO DIAGNÓSTICO AVANÇADO ===');
    }

    checkKnownConflicts() {
        console.log('⚠️ Verificando conflitos conhecidos...');
        
        // Verificar extensões que podem interferir
        if (window.chrome && window.chrome.runtime) {
            console.log('🔧 Ambiente Chrome com extensões detectado');
        }
        
        // Verificar se há outros scripts MIDI carregados
        const scripts = document.querySelectorAll('script');
        const midiScripts = Array.from(scripts).filter(script => 
            script.src && (script.src.includes('midi') || script.src.includes('web-audio'))
        );
        
        if (midiScripts.length > 0) {
            console.log('⚠️ Outros scripts MIDI detectados:', midiScripts.map(s => s.src));
        }
        
        // Verificar variáveis globais que podem conflitar
        const potentialConflicts = ['MIDI', 'WebMIDI', 'midiAccess'];
        potentialConflicts.forEach(varName => {
            if (window[varName]) {
                console.log(`⚠️ Variável global conflitante detectada: ${varName}`);
            }
        });
    }

    checkPopupBlocker() {
        // Testar se popup blocker está ativo
        try {
            const testWindow = window.open('', '_blank', 'width=1,height=1');
            if (testWindow) {
                testWindow.close();
                console.log('✅ Popup blocker não está interferindo');
            } else {
                console.warn('⚠️ Popup blocker pode estar ativo - isso pode afetar permissões MIDI');
            }
        } catch (error) {
            console.warn('⚠️ Não foi possível testar popup blocker:', error.message);
        }
    }

    checkBrowserConfiguration() {
        const userAgent = navigator.userAgent.toLowerCase();
        
        if (userAgent.includes('chrome')) {
            console.log('🌐 Chrome detectado - Web MIDI deveria funcionar');
            
            // Verificar se é uma versão muito antiga
            const chromeMatch = userAgent.match(/chrome\/(\d+)/);
            if (chromeMatch) {
                const version = parseInt(chromeMatch[1]);
                if (version < 43) {
                    console.warn(`⚠️ Chrome ${version} muito antigo - Web MIDI requer Chrome 43+`);
                } else {
                    console.log(`✅ Chrome ${version} - compatível com Web MIDI`);
                }
            }
        } else if (userAgent.includes('edg')) {
            console.log('🌐 Edge detectado - Web MIDI deveria funcionar');
        } else if (userAgent.includes('opera')) {
            console.log('🌐 Opera detectado - Web MIDI deveria funcionar');
        } else {
            console.warn('⚠️ Navegador não reconhecido - Web MIDI pode não ser suportado');
        }
        
        // Verificar protocolo
        if (location.protocol === 'file:') {
            console.warn('⚠️ Executando via file:// - isso pode causar problemas de permissão');
        } else if (location.protocol === 'https:') {
            console.log('✅ HTTPS detectado - ideal para Web MIDI');
        } else if (location.protocol === 'http:' && location.hostname === 'localhost') {
            console.log('✅ localhost HTTP - deveria funcionar para Web MIDI');
        } else {
            console.warn('⚠️ HTTP não-localhost pode ter restrições de permissão');
        }
    }

    scanForDevices() {
        console.log('🔍 Fazendo scan completo de dispositivos MIDI...');
        console.log(`📊 Inputs disponíveis: ${this.midiAccess.inputs.size}`);
        console.log(`📊 Outputs disponíveis: ${this.midiAccess.outputs.size}`);
        
        this.connectedInputs.clear();
        this.connectedOutputs.clear();
        this.terraDevices.clear();

        // Log detalhado de TODOS os dispositivos encontrados
        console.log('=== SCAN DETALHADO DE DISPOSITIVOS ===');
        
        // Scan inputs
        let inputIndex = 0;
        for (const input of this.midiAccess.inputs.values()) {
            inputIndex++;
            console.log(`📥 INPUT ${inputIndex}:`, {
                id: input.id,
                name: input.name,
                manufacturer: input.manufacturer,
                version: input.version,
                state: input.state,
                connection: input.connection,
                type: input.type
            });
            this.processDevice(input, 'input');
        }

        // Scan outputs  
        let outputIndex = 0;
        for (const output of this.midiAccess.outputs.values()) {
            outputIndex++;
            console.log(`📤 OUTPUT ${outputIndex}:`, {
                id: output.id,
                name: output.name,
                manufacturer: output.manufacturer,
                version: output.version,
                state: output.state,
                connection: output.connection,
                type: output.type
            });
            this.processDevice(output, 'output');
        }

        console.log('=== FIM DO SCAN DETALHADO ===');
        this.reportDeviceStatus();
    }

    processDevice(device, type) {
        const deviceInfo = {
            id: device.id,
            name: device.name || 'Dispositivo sem nome',
            manufacturer: device.manufacturer || 'Fabricante desconhecido',
            version: device.version || 'Versão desconhecida',
            state: device.state,
            connection: device.connection,
            type: type,
            isTerraDevice: this.identifyTerraDevice(device),
            confidence: 0,
            device: device
        };

        // Calcular nível de confiança de que é um dispositivo Terra
        deviceInfo.confidence = this.calculateTerraConfidence(device);

        if (type === 'input') {
            this.connectedInputs.set(device.id, deviceInfo);
            
            // Configurar listener para mensagens MIDI
            device.onmidimessage = (event) => {
                this.handleMidiMessage(event, deviceInfo);
            };
        } else {
            this.connectedOutputs.set(device.id, deviceInfo);
        }

        // Se for identificado como Terra, adicionar à lista especial
        if (deviceInfo.isTerraDevice || deviceInfo.confidence > 0.5) {
            this.terraDevices.set(device.id, deviceInfo);
            console.log(`🎯 Dispositivo Terra detectado: ${deviceInfo.name} (confiança: ${Math.round(deviceInfo.confidence * 100)}%)`);
        }

        console.log(`📱 ${type}: "${deviceInfo.name}" - Terra: ${deviceInfo.isTerraDevice ? 'SIM' : 'NÃO'} (${Math.round(deviceInfo.confidence * 100)}%)`);
    }

    identifyTerraDevice(device) {
        const name = (device.name || '').toLowerCase().trim();
        const manufacturer = (device.manufacturer || '').toLowerCase().trim();
        
        console.log(`🔎 Verificando dispositivo: "${device.name}" | Fabricante: "${device.manufacturer}"`);
        
        // Verificação EXATA para "Midi-Terra"
        if (name === 'midi-terra' || name === 'miditerra') {
            console.log('🎯 DISPOSITIVO MIDI-TERRA ENCONTRADO POR NOME EXATO!');
            return true;
        }
        
        // Verificação por padrões no nome
        for (const pattern of this.terraPatterns) {
            const patternLower = pattern.toLowerCase();
            if (name.includes(patternLower) || manufacturer.includes(patternLower)) {
                console.log(`🎯 Dispositivo Terra encontrado por padrão: "${pattern}" em "${name}" ou "${manufacturer}"`);
                return true;
            }
        }

        // Verificação adicional por ID ou características específicas
        if (this.checkDeviceCharacteristics(device)) {
            console.log('🎯 Dispositivo Terra encontrado por características específicas!');
            return true;
        }

        console.log('❌ Dispositivo não identificado como Terra');
        return false;
    }
    
    checkDeviceCharacteristics(device) {
        // Verificar se tem características típicas de dispositivos Terra
        const name = (device.name || '').toLowerCase();
        const manufacturer = (device.manufacturer || '').toLowerCase();
        
        // Se é uma porta serial/USB sem nome específico mas pode ser Terra
        if (name.includes('usb') && (name.includes('serial') || name.includes('port'))) {
            return true;
        }
        
        // Se tem fabricante relacionado a conversores USB-MIDI comuns
        const commonManufacturers = ['ch340', 'cp210x', 'ftdi', 'prolific', 'silicon labs'];
        for (const mfg of commonManufacturers) {
            if (manufacturer.includes(mfg)) {
                return true;
            }
        }
        
        return false;
    }

    calculateTerraConfidence(device) {
        let confidence = 0;
        const name = (device.name || '').toLowerCase().trim();
        const manufacturer = (device.manufacturer || '').toLowerCase().trim();

        console.log(`🧮 Calculando confiança para: "${name}" | "${manufacturer}"`);

        // Pontuação por padrões específicos - MIDI-Terra tem prioridade máxima
        const patterns = {
            'midi-terra': 1.0,     // Nome exato - máxima confiança
            'miditerra': 1.0,      // Variação sem hífen
            'terra': 0.9,
            'sensory': 0.7,
            'sensor': 0.6,
            'arduino': 0.5,
            'ch340': 0.4,          // Chip conversor comum
            'cp210x': 0.4,         // Chip conversor comum  
            'ftdi': 0.4,           // Chip conversor comum
            'serial': 0.3,
            'usb': 0.2
        };

        for (const [pattern, score] of Object.entries(patterns)) {
            if (name.includes(pattern) || manufacturer.includes(pattern)) {
                confidence = Math.max(confidence, score);
                console.log(`✅ Padrão encontrado: "${pattern}" -> confiança: ${score}`);
            }
        }

        // Bonificação se o nome contém "midi"
        if (name.includes('midi') || manufacturer.includes('midi')) {
            const bonus = 0.2;
            confidence += bonus;
            console.log(`🎵 Bonus MIDI: +${bonus}`);
        }

        // Penalização para dispositivos muito genéricos do sistema
        const genericPatterns = ['microsoft', 'windows', 'realtek', 'intel', 'audio', 'sound'];
        for (const pattern of genericPatterns) {
            if (name.includes(pattern) || manufacturer.includes(pattern)) {
                confidence *= 0.1;
                console.log(`❌ Penalização genérico: "${pattern}" -> confiança reduzida`);
            }
        }

        const finalConfidence = Math.min(confidence, 1.0);
        console.log(`📊 Confiança final: ${Math.round(finalConfidence * 100)}%`);
        
        return finalConfidence;
    }

    handleDeviceStateChange(event) {
        const port = event.port;
        
        console.log(`🔄 Mudança de estado: ${port.name} - ${port.state}`);
        
        if (port.state === 'connected') {
            this.processDevice(port, port.type);
        } else if (port.state === 'disconnected') {
            if (port.type === 'input') {
                this.connectedInputs.delete(port.id);
            } else {
                this.connectedOutputs.delete(port.id);
            }
            this.terraDevices.delete(port.id);
        }

        // Notificar callbacks registrados
        this.deviceStateCallbacks.forEach(callback => {
            callback(event);
        });

        this.reportDeviceStatus();
    }

    handleMidiMessage(event, deviceInfo) {
        // Analisar mensagem para identificar melhor o dispositivo Terra
        if (event.data && event.data.length > 0) {
            const data = Array.from(event.data);
            
            // Log detalhado das mensagens MIDI
            console.log(`🎵 MIDI de ${deviceInfo.name}:`, data.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' '));
            
            // Se recebermos dados MIDI, aumentar a confiança de que é um dispositivo Terra ativo
            if (deviceInfo.confidence < 0.8) {
                deviceInfo.confidence = Math.min(deviceInfo.confidence + 0.1, 0.8);
            }
            
            // 🔥 CORREÇÃO: Repassar mensagem para callbacks registrados
            this.midiMessageCallbacks.forEach(callback => {
                try {
                    callback(event, deviceInfo);
                } catch (error) {
                    console.error('❌ Erro no callback de mensagem MIDI:', error);
                }
            });
        }
    }

    reportDeviceStatus() {
        const totalInputs = this.connectedInputs.size;
        const totalOutputs = this.connectedOutputs.size;
        const terraCount = this.terraDevices.size;

        console.log(`📊 Status: ${totalInputs} inputs, ${totalOutputs} outputs, ${terraCount} dispositivos Terra`);

        if (terraCount > 0) {
            console.log('🎯 Dispositivos Terra encontrados:');
            this.terraDevices.forEach(device => {
                console.log(`   - ${device.name} (${Math.round(device.confidence * 100)}% confiança)`);
            });
        }
    }

    // Métodos públicos para interface
    getTerraDevices() {
        return Array.from(this.terraDevices.values());
    }

    getAllInputs() {
        return Array.from(this.connectedInputs.values());
    }

    getAllOutputs() {
        return Array.from(this.connectedOutputs.values());
    }

    getDeviceById(id) {
        return this.connectedInputs.get(id) || this.connectedOutputs.get(id);
    }

    onDeviceStateChange(callback) {
        this.deviceStateCallbacks.push(callback);
    }

    // 🔥 NOVO: Registrar callback para mensagens MIDI
    onMidiMessage(callback) {
        this.midiMessageCallbacks.push(callback);
        console.log('🔗 Callback de mensagem MIDI registrado');
    }

    shouldRetryConnection(error) {
        // Não retry se já excedeu o máximo
        if (this.retryAttempts >= this.maxRetries) {
            console.log(`❌ Máximo de tentativas (${this.maxRetries}) atingido`);
            return false;
        }
        
        // Não retry para erros não-recuperáveis
        if (error.name === 'NotSupportedError') {
            console.log('❌ Erro não-recuperável: Web MIDI não suportado');
            return false;
        }
        
        // Retry para timeouts e erros de segurança
        if (error.message.includes('Timeout') || error.name === 'SecurityError' || error.name === 'AbortError') {
            console.log(`🔄 Erro recuperável detectado: ${error.name || 'Timeout'} - retry possível`);
            return true;
        }
        
        return false;
    }

    resetRetryState() {
        this.retryAttempts = 0;
        this.lastErrorType = null;
        console.log('🔄 Estado de retry resetado');
    }

    // Método para forçar re-scan
    forceScan() {
        console.log('🔄 Forçando novo scan de dispositivos...');
        this.scanForDevices();
    }

    // Método para testar comunicação com dispositivo específico
    async testDevice(deviceId) {
        const device = this.getDeviceById(deviceId);
        
        if (!device || device.type !== 'output') {
            return false;
        }

        try {
            // Enviar mensagem de teste (Note On seguido de Note Off)
            const testMessage = [0x90, 0x3C, 0x40]; // Note On, C4, velocity 64
            device.device.send(testMessage);
            
            setTimeout(() => {
                const noteOff = [0x80, 0x3C, 0x40]; // Note Off, C4
                device.device.send(noteOff);
            }, 100);
            
            console.log(`🧪 Teste enviado para ${device.name}`);
            return true;
            
        } catch (error) {
            console.error(`❌ Erro ao testar ${device.name}:`, error);
            return false;
        }
    }
}

// Exportar para uso global
window.MidiDetector = MidiDetector;