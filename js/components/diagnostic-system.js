// Sistema de Diagnóstico MIDI - Terra Eletrônica
// Responsável por detectar e diagnosticar problemas de conexão MIDI

class DiagnosticSystem {
    constructor() {
        this.diagnosticLog = [];
        this.terraDevicePatterns = [
            'terra',
            'midi-terra', 
            'terraeletronica',
            'terra eletronica',
            'sensory',
            'sensor'
        ];
    }

    log(message, level = 'info') {
        const logEntry = {
            timestamp: new Date(),
            message: message,
            level: level
        };
        
        this.diagnosticLog.push(logEntry);
        
        // Log no console com cores
        const colors = {
            info: 'color: #17a2b8',
            success: 'color: #28a745', 
            warning: 'color: #ffc107',
            error: 'color: #dc3545',
            terra: 'color: #28a745; font-weight: bold; background: #d4edda; padding: 2px 8px; border-radius: 4px'
        };
        
        console.log(`%c🔍 [DIAGNÓSTICO] ${message}`, colors[level] || colors.info);
        
        // Também mostrar na interface se for importante
        if (level === 'error' || level === 'terra') {
            this.showDiagnosticMessage(message, level);
        }
    }

    showDiagnosticMessage(message, level) {
        // Adicionar animações CSS se não existirem
        this.ensureAnimationStyles();
        
        // Criar elemento de notificação
        const notification = document.createElement('div');
        notification.className = `diagnostic-notification ${level}`;
        notification.innerHTML = `
            <div class="diagnostic-content">
                <span class="diagnostic-icon">${level === 'terra' ? '🎯' : level === 'error' ? '❌' : 'ℹ️'}</span>
                <span class="diagnostic-text">${message}</span>
                <button class="diagnostic-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        // Posicionar no canto inferior esquerdo
        const existingNotifications = document.querySelectorAll('.diagnostic-notification');
        let bottomPosition = 20;
        
        existingNotifications.forEach(existing => {
            bottomPosition += existing.offsetHeight + 10;
        });
        
        // Adicionar styles inline para garantir que funcione
        notification.style.cssText = `
            position: fixed;
            bottom: ${bottomPosition}px;
            left: 20px;
            background: ${level === 'terra' ? '#d4edda' : level === 'error' ? '#f8d7da' : '#d1ecf1'};
            color: ${level === 'terra' ? '#155724' : level === 'error' ? '#721c24' : '#0c5460'};
            padding: 12px;
            border-radius: 8px;
            border: 1px solid ${level === 'terra' ? '#c3e6cb' : level === 'error' ? '#f5c6cb' : '#bee5eb'};
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            max-width: 400px;
            animation: slideInLeft 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remover após 8 segundos
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutLeft 0.3s ease';
                setTimeout(() => notification.remove(), 300);
            }
        }, 8000);
    }

    ensureAnimationStyles() {
        if (!document.getElementById('diagnosticAnimations')) {
            const style = document.createElement('style');
            style.id = 'diagnosticAnimations';
            style.textContent = `
                @keyframes slideInLeft {
                    from { opacity: 0; transform: translateX(-100%); }
                    to { opacity: 1; transform: translateX(0); }
                }
                
                @keyframes slideOutLeft {
                    from { opacity: 1; transform: translateX(0); }
                    to { opacity: 0; transform: translateX(-100%); }
                }
            `;
            document.head.appendChild(style);
        }
    }

    async runFullDiagnosis() {
        this.log('🚀 Iniciando diagnóstico completo do sistema MIDI...', 'info');
        
        const diagnosticReport = {
            timestamp: new Date().toISOString(),
            browser: this.getBrowserInfo(),
            webMidiSupport: !!navigator.requestMIDIAccess,
            permissions: 'unknown',
            system: {
                platform: navigator.platform,
                userAgent: navigator.userAgent,
                language: navigator.language
            },
            devices: {
                inputs: [],
                outputs: [],
                terraDevices: []
            },
            recommendations: []
        };

        // Verificar suporte Web MIDI
        if (!navigator.requestMIDIAccess) {
            this.log('❌ Web MIDI API não suportada neste navegador', 'error');
            diagnosticReport.recommendations.push('Use Chrome 43+, Edge 79+, ou Opera 30+');
            return this.displayDiagnosticReport(diagnosticReport);
        }

        this.log('✅ Web MIDI API suportada', 'success');

        try {
            // Checar status de permissão via Permissions API (se suportada)
            if (navigator.permissions && navigator.permissions.query) {
                try {
                    this.log('🔎 Verificando status de permissão MIDI via Permissions API...', 'info');
                    const perm = await navigator.permissions.query({ name: 'midi', sysex: true });
                    this.log(`🔐 Estado da permissão MIDI: ${perm.state}`, perm.state === 'granted' ? 'success' : perm.state === 'denied' ? 'error' : 'warning');
                    diagnosticReport.permissions = perm.state;

                    // Se estiver denied, já retorna recomendações
                    if (perm.state === 'denied') {
                        this.log('🚫 Permissão MIDI negada por política ou usuário - desistindo de requestMIDIAccess', 'error');
                        diagnosticReport.recommendations.push('Permissão MIDI negada. Verifique políticas do navegador ou configurações de privacidade.');
                        return this.displayDiagnosticReport(diagnosticReport);
                    }
                } catch (permErr) {
                    // Algumas implementações podem não suportar o descriptor sysex; ignorar falha e prosseguir
                    console.warn('⚠️ Não foi possível consultar Permissions API para MIDI:', permErr && permErr.message ? permErr.message : permErr);
                    diagnosticReport.permissions = 'unknown';
                }
            } else {
                this.log('⚠️ Permissions API não disponível - não é possível consultar estado antes do requestMIDIAccess', 'warning');
            }

            // Solicitar acesso MIDI (pode disparar prompt se estado for prompt)
            this.log('🔐 Solicitando acesso aos dispositivos MIDI via requestMIDIAccess...', 'info');
            const midiAccess = await navigator.requestMIDIAccess({ sysex: true });

            diagnosticReport.permissions = 'granted';
            this.log('✅ Permissão concedida para acessar dispositivos MIDI', 'success');

            // Analisar dispositivos de entrada
            this.log(`📥 Analisando ${midiAccess.inputs.size} dispositivos de entrada...`, 'info');
            
            if (midiAccess.inputs.size === 0) {
                this.log('❌ NENHUM DISPOSITIVO MIDI DE ENTRADA ENCONTRADO!', 'error');
                this.log('💡 Verifique se o dispositivo Midi-Terra está conectado via USB', 'warning');
                this.log('💡 Verifique se aparece no Gerenciador de Dispositivos do Windows', 'warning');
            }
            
            for (const input of midiAccess.inputs.values()) {
                const deviceInfo = {
                    type: 'input',
                    name: input.name || 'Dispositivo sem nome',
                    manufacturer: input.manufacturer || 'Fabricante desconhecido',
                    version: input.version || 'Versão desconhecida',
                    id: input.id,
                    state: input.state,
                    connection: input.connection,
                    isTerraDevice: this.isTerraDevice(input),
                    isMidiTerra: this.isMidiTerra(input)
                };

                diagnosticReport.devices.inputs.push(deviceInfo);
                
                // Log detalhado de cada dispositivo
                this.log(`📥 INPUT ENCONTRADO:`, 'info');
                this.log(`   Nome: "${deviceInfo.name}"`, 'info');
                this.log(`   Fabricante: "${deviceInfo.manufacturer}"`, 'info');
                this.log(`   ID: ${deviceInfo.id}`, 'info');
                this.log(`   Estado: ${deviceInfo.state}`, 'info');
                this.log(`   Conexão: ${deviceInfo.connection}`, 'info');
                
                // Verificação específica para Midi-Terra
                if (deviceInfo.isMidiTerra) {
                    diagnosticReport.devices.terraDevices.push(deviceInfo);
                    this.log(`🎯 DISPOSITIVO "MIDI-TERRA" DETECTADO: ${deviceInfo.name}`, 'terra');
                } else if (deviceInfo.isTerraDevice) {
                    diagnosticReport.devices.terraDevices.push(deviceInfo);
                    this.log(`🎯 DISPOSITIVO TERRA DETECTADO: ${deviceInfo.name}`, 'terra');
                } else {
                    this.log(`ℹ️ Dispositivo genérico: ${deviceInfo.name}`, 'info');
                }
                
                this.log('---', 'info');
            }

            // Analisar dispositivos de saída
            this.log(`📤 Analisando ${midiAccess.outputs.size} dispositivos de saída...`, 'info');
            
            for (const output of midiAccess.outputs.values()) {
                const deviceInfo = {
                    type: 'output',
                    name: output.name || 'Dispositivo sem nome',
                    manufacturer: output.manufacturer || 'Fabricante desconhecido',
                    version: output.version || 'Versão desconhecida',
                    id: output.id,
                    state: output.state,
                    connection: output.connection,
                    isTerraDevice: this.isTerraDevice(output)
                };

                diagnosticReport.devices.outputs.push(deviceInfo);
                this.log(`📤 Output: "${deviceInfo.name}" (${deviceInfo.manufacturer}) - Estado: ${deviceInfo.state}`, 'info');
                
                if (deviceInfo.isTerraDevice) {
                    diagnosticReport.devices.terraDevices.push(deviceInfo);
                    this.log(`🎯 DISPOSITIVO TERRA DETECTADO: ${deviceInfo.name}`, 'terra');
                }
            }

            // Gerar recomendações
            this.generateRecommendations(diagnosticReport);

        } catch (error) {
            this.log(`❌ Erro ao acessar dispositivos MIDI: ${error.message}`, 'error');
            diagnosticReport.permissions = 'denied';
            diagnosticReport.error = error.message;
            
            if (error.name === 'SecurityError') {
                diagnosticReport.recommendations.push('Permita o acesso aos dispositivos MIDI quando solicitado');
            } else if (error.name === 'NotSupportedError') {
                diagnosticReport.recommendations.push('Use um navegador que suporte Web MIDI API');
            }
        }

        this.log('📋 Diagnóstico concluído', 'success');
        return this.displayDiagnosticReport(diagnosticReport);
    }

    isTerraDevice(device) {
        const name = (device.name || '').toLowerCase().trim();
        const manufacturer = (device.manufacturer || '').toLowerCase().trim();
        
        // Verificar padrões conhecidos do Terra
        for (const pattern of this.terraDevicePatterns) {
            if (name.includes(pattern.toLowerCase()) || manufacturer.includes(pattern.toLowerCase())) {
                return true;
            }
        }
        
        return false;
    }
    
    isMidiTerra(device) {
        const name = (device.name || '').toLowerCase().trim();
        
        // Verificação específica e exata para o dispositivo "Midi-Terra"
        return name === 'midi-terra' || name === 'miditerra';
    }

    generateRecommendations(report) {
        // Verificar se tem dispositivo Midi-Terra específico
        const midiTerraDevice = report.devices.inputs.find(device => 
            device.name.toLowerCase().trim() === 'midi-terra' || 
            device.name.toLowerCase().trim() === 'miditerra'
        );
        
        if (report.devices.inputs.length === 0) {
            report.recommendations.push('❌ NENHUM dispositivo MIDI detectado pelo sistema');
            report.recommendations.push('🔧 SOLUÇÕES para dispositivo "Midi-Terra":');
            report.recommendations.push('   1. Verifique se está conectado via USB');
            report.recommendations.push('   2. Abra o Gerenciador de Dispositivos (Win+X → Gerenciador de Dispositivos)');
            report.recommendations.push('   3. Procure por "Midi-Terra" em "Dispositivos de som, vídeo e jogos"');
            report.recommendations.push('   4. Se aparecer com "!" amarelo, clique com botão direito → Atualizar driver');
            report.recommendations.push('   5. Teste em outro software MIDI (ex: MIDI-OX)');
            report.recommendations.push('   6. Tente uma porta USB diferente');
            report.recommendations.push('   7. Reinicie o computador com o dispositivo conectado');
        } else if (midiTerraDevice) {
            report.recommendations.push('🎯 DISPOSITIVO "MIDI-TERRA" DETECTADO COM SUCESSO!');
            report.recommendations.push('✅ O dispositivo está funcionando corretamente');
            report.recommendations.push('✅ Pronto para monitoramento MIDI');
            if (midiTerraDevice.state !== 'connected') {
                report.recommendations.push('⚠️ Estado do dispositivo: ' + midiTerraDevice.state);
            }
        } else if (report.devices.terraDevices.length > 0) {
            report.recommendations.push('🔍 Dispositivos Terra detectados (mas não "Midi-Terra" exato):');
            report.devices.terraDevices.forEach(device => {
                report.recommendations.push(`   • ${device.name} (${device.manufacturer})`);
            });
            report.recommendations.push('💡 Se algum destes é o seu "Midi-Terra", ele pode estar usando nome diferente');
        } else if (report.devices.inputs.length > 0) {
            report.recommendations.push('⚠️ Dispositivos MIDI detectados, mas NENHUM identificado como "Midi-Terra"');
            report.recommendations.push('� IMPORTANTE: Você confirmou que "Midi-Terra" está no Windows!');
            report.recommendations.push('�📋 Dispositivos encontrados via Web MIDI:');
            report.devices.inputs.forEach(device => {
                const isLikely = device.name.toLowerCase().includes('midi') || 
                               device.name.toLowerCase().includes('terra') ||
                               device.manufacturer.toLowerCase().includes('terra');
                const marker = isLikely ? '🎯' : '•';
                report.recommendations.push(`   ${marker} ${device.name} (${device.manufacturer})`);
            });
            report.recommendations.push('');
            report.recommendations.push('🚨 DIAGNÓSTICO: Midi-Terra visível no Windows mas não via Web MIDI');
            report.recommendations.push('💊 SOLUÇÕES POSSÍVEIS:');
            report.recommendations.push('   1. 🔄 PRIMEIRO: Recarregue a página completamente (F5)');
            report.recommendations.push('   2. 🔐 Clique "Permitir" quando o navegador pedir acesso aos dispositivos MIDI');
            report.recommendations.push('   3. 🔧 Reinstale os drivers do Midi-Terra');
            report.recommendations.push('   4. 💻 Verifique se aparece como "Dispositivo de áudio" no Windows');
            report.recommendations.push('   5. 🌐 Use o Chrome (melhor compatibilidade com Web MIDI)');
            report.recommendations.push('   6. 🔌 Tente uma porta USB 2.0 (pode ter melhor compatibilidade)');
        }
        
        // Recomendações adicionais específicas para Midi-Terra
        report.recommendations.push('');
        report.recommendations.push('� INFORMAÇÕES TÉCNICAS:');
        report.recommendations.push('   • Web MIDI API só acessa dispositivos que o Windows expõe como MIDI');
        report.recommendations.push('   • Se "Midi-Terra" aparece no Windows mas não aqui, pode ser problema de driver');
        report.recommendations.push('   • Alguns dispositivos USB-MIDI precisam de drivers específicos');
        report.recommendations.push('   • Teste com software nativo (ex: MIDI-OX) para validar funcionamento');
        report.recommendations.push('');
        report.recommendations.push('🔧 CHECKLIST FINAL:');
        report.recommendations.push('   ✓ Dispositivo conectado via USB: SIM (confirmado)');
        report.recommendations.push('   ✓ Aparece no Windows: SIM (confirmado)');
        report.recommendations.push('   ❓ Acessível via Web MIDI: VERIFICANDO...');
        report.recommendations.push('   ❓ Driver MIDI correto: A VERIFICAR');
    }

    getBrowserInfo() {
        const ua = navigator.userAgent;
        let browser = 'Desconhecido';
        let supported = false;
        
        if (ua.includes('Chrome')) {
            browser = 'Chrome';
            supported = true;
        } else if (ua.includes('Edg')) {
            browser = 'Edge';
            supported = true;
        } else if (ua.includes('Opera')) {
            browser = 'Opera';
            supported = true;
        } else if (ua.includes('Firefox')) {
            browser = 'Firefox';
            supported = false;
        } else if (ua.includes('Safari')) {
            browser = 'Safari';
            supported = false;
        }
        
        return {
            name: browser,
            version: navigator.appVersion,
            supported: supported,
            userAgent: ua
        };
    }

    displayDiagnosticReport(report) {
        let html = `
            <div class="diagnostic-report">
                <h4>🔍 Relatório de Diagnóstico MIDI</h4>
                <div class="diagnostic-section">
                    <h5>Sistema</h5>
                    <p><strong>Plataforma:</strong> ${report.system.platform}</p>
                    <p><strong>Navegador:</strong> ${report.browser.name} ${report.browser.supported ? '✅' : '❌'}</p>
                    <p><strong>Web MIDI API:</strong> ${report.webMidiSupport ? '✅ Suportada' : '❌ Não suportada'}</p>
                    <p><strong>Permissões:</strong> ${report.permissions === 'granted' ? '✅ Concedidas' : '❌ Negadas'}</p>
                </div>
        `;

        // Dispositivos Terra
        if (report.devices.terraDevices.length > 0) {
            html += `
                <div class="diagnostic-section success">
                    <h5>🎯 Dispositivos Terra Detectados (${report.devices.terraDevices.length})</h5>
                    <ul>
            `;
            
            report.devices.terraDevices.forEach(device => {
                html += `<li><strong>${device.name}</strong> (${device.manufacturer}) - ${device.type}</li>`;
            });
            
            html += '</ul></div>';
        }

        // Todos os dispositivos
        const totalDevices = report.devices.inputs.length + report.devices.outputs.length;
        html += `
            <div class="diagnostic-section">
                <h5>📱 Todos os Dispositivos (${totalDevices})</h5>
        `;

        if (totalDevices > 0) {
            html += '<ul>';
            
            [...report.devices.inputs, ...report.devices.outputs].forEach(device => {
                const icon = device.type === 'input' ? '📥' : '📤';
                const terraIndicator = device.isTerraDevice ? ' 🎯' : '';
                html += `<li>${icon} <strong>${device.name}</strong> (${device.manufacturer})${terraIndicator}</li>`;
            });
            
            html += '</ul>';
        } else {
            html += '<p><em>Nenhum dispositivo MIDI detectado</em></p>';
        }

        html += '</div>';

        // Recomendações
        if (report.recommendations.length > 0) {
            html += `
                <div class="diagnostic-section">
                    <h5>💡 Recomendações</h5>
                    <ul>
            `;
            
            report.recommendations.forEach(rec => {
                html += `<li>${rec}</li>`;
            });
            
            html += '</ul></div>';
        }

        html += '</div>';

        return html;
    }

    exportDiagnosticLog() {
        const data = {
            timestamp: new Date().toISOString(),
            log: this.diagnosticLog,
            system: {
                platform: navigator.platform,
                userAgent: navigator.userAgent,
                language: navigator.language
            }
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `terra-midi-diagnostic-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.log('📁 Log de diagnóstico exportado', 'success');
    }
}

// Exportar para uso global
window.DiagnosticSystem = DiagnosticSystem;