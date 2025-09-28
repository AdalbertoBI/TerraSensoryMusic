// Parser de Mensagens MIDI - Terra Eletrônica
// Sistema especializado para interpretar mensagens MIDI, incluindo protocolos Terra

class MidiParser {
    constructor() {
        this.messageTypes = {
            0x80: 'noteOff',
            0x90: 'noteOn', 
            0xA0: 'polyAftertouch',
            0xB0: 'controlChange',
            0xC0: 'programChange',
            0xD0: 'channelAftertouch',
            0xE0: 'pitchBend',
            0xF0: 'systemExclusive'
        };

        // Controladores comuns usados em dispositivos Terra
        this.terraControllers = {
            1: 'Modulation',
            2: 'Breath Controller',
            4: 'Foot Controller',
            5: 'Portamento Time',
            7: 'Volume',
            8: 'Balance',
            10: 'Pan',
            11: 'Expression',
            16: 'Sensor 1', // Controladores customizados Terra
            17: 'Sensor 2',
            18: 'Sensor 3',
            19: 'Sensor 4',
            64: 'Sustain Pedal',
            65: 'Portamento On/Off',
            66: 'Sostenuto',
            67: 'Soft Pedal'
        };

        // Cache para otimização
        this.noteCache = new Map();
        this.controllerCache = new Map();
    }

    parseMessage(data, timestamp = new Date(), deviceInfo = null) {
        if (!data || data.length === 0) {
            return this.createEmptyMessage(timestamp, data);
        }

        const rawData = Array.isArray(data) ? data : Array.from(data);
        const status = rawData[0];
        
        // 🔥 DEBUG: Verificar se parser está sendo chamado
        console.log('🎵 Parser processando:', {
            status: '0x' + status.toString(16).toUpperCase(),
            data: rawData.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' '),
            length: rawData.length
        });
        
        // Verificar se é uma mensagem de sistema real-time (0xF8-0xFF)
        if (status >= 0xF8) {
            return this.parseSystemRealTime(rawData, timestamp, deviceInfo);
        }

        // Verificar se é uma mensagem de sistema comum (0xF0-0xF7)
        if (status >= 0xF0 && status <= 0xF7) {
            return this.parseSystemCommon(rawData, timestamp, deviceInfo);
        }

        // Mensagem de canal regular
        const channel = status & 0x0F;
        const command = status & 0xF0;
        
        const message = {
            timestamp,
            rawData,
            channel,
            statusByte: status,
            command,
            deviceInfo,
            isValidMidi: true,
            terraSpecific: false
        };

        switch (command) {
            case 0x80: // Note Off
                return this.parseNoteOff(message, rawData);
                
            case 0x90: // Note On (ou Note Off se velocity = 0)
                return this.parseNoteOn(message, rawData);
                
            case 0xA0: // Polyphonic Aftertouch
                return this.parsePolyAftertouch(message, rawData);
                
            case 0xB0: // Control Change
                return this.parseControlChange(message, rawData);
                
            case 0xC0: // Program Change
                return this.parseProgramChange(message, rawData);
                
            case 0xD0: // Channel Aftertouch
                return this.parseChannelAftertouch(message, rawData);
                
            case 0xE0: // Pitch Bend
                return this.parsePitchBend(message, rawData);
                
            default:
                message.type = 'unknown';
                message.isValidMidi = false;
                return message;
        }
    }

    parseNoteOff(message, data) {
        if (data.length < 3) {
            message.isValidMidi = false;
            message.type = 'noteOff';
            return message;
        }

        message.type = 'noteOff';
        message.note = data[1];
        message.velocity = data[2];
        message.noteName = this.getNoteNameCached(message.note);
        message.frequency = this.midiNoteToFrequency(message.note);
        message.octave = Math.floor(message.note / 12) - 1;
        
        return message;
    }

    parseNoteOn(message, data) {
        if (data.length < 3) {
            message.isValidMidi = false;
            message.type = 'noteOn';
            return message;
        }

        const velocity = data[2];
        
        // Note On com velocity 0 é tratado como Note Off
        message.type = velocity > 0 ? 'noteOn' : 'noteOff';
        message.note = data[1];
        message.velocity = velocity;
        message.noteName = this.getNoteNameCached(message.note);
        message.frequency = this.midiNoteToFrequency(message.note);
        message.octave = Math.floor(message.note / 12) - 1;
        
        // Detectar padrões Terra específicos
        if (this.isTerraPattern(message)) {
            message.terraSpecific = true;
        }
        
        return message;
    }

    parsePolyAftertouch(message, data) {
        if (data.length < 3) {
            message.isValidMidi = false;
            message.type = 'polyAftertouch';
            return message;
        }

        message.type = 'polyAftertouch';
        message.note = data[1];
        message.pressure = data[2];
        message.noteName = this.getNoteNameCached(message.note);
        
        return message;
    }

    parseControlChange(message, data) {
        if (data.length < 3) {
            message.isValidMidi = false;
            message.type = 'controlChange';
            return message;
        }

        message.type = 'controlChange';
        message.controller = data[1];
        message.value = data[2];
        message.controllerName = this.getControllerNameCached(message.controller);
        message.normalizedValue = message.value / 127;
        
        // Detectar controladores Terra específicos
        if (message.controller >= 16 && message.controller <= 31) {
            message.terraSpecific = true;
            message.sensorType = this.identifySensorType(message.controller, message.value);
        }
        
        return message;
    }

    parseProgramChange(message, data) {
        if (data.length < 2) {
            message.isValidMidi = false;
            message.type = 'programChange';
            return message;
        }

        message.type = 'programChange';
        message.program = data[1];
        
        return message;
    }

    parseChannelAftertouch(message, data) {
        if (data.length < 2) {
            message.isValidMidi = false;
            message.type = 'channelAftertouch';
            return message;
        }

        message.type = 'channelAftertouch';
        message.pressure = data[1];
        message.normalizedPressure = message.pressure / 127;
        
        return message;
    }

    parsePitchBend(message, data) {
        if (data.length < 3) {
            message.isValidMidi = false;
            message.type = 'pitchBend';
            return message;
        }

        message.type = 'pitchBend';
        message.lsb = data[1];
        message.msb = data[2];
        message.value = data[1] | (data[2] << 7);
        message.bendValue = (message.value - 8192) / 8192; // Normalizado entre -1 e 1
        message.cents = message.bendValue * 200; // Assumindo range de ±2 semitons
        
        return message;
    }

    parseSystemRealTime(data, timestamp, deviceInfo) {
        const message = {
            timestamp,
            rawData: data,
            deviceInfo,
            isValidMidi: true,
            terraSpecific: false,
            type: 'systemRealTime'
        };

        switch (data[0]) {
            case 0xF8: message.subType = 'clock'; break;
            case 0xFA: message.subType = 'start'; break;
            case 0xFB: message.subType = 'continue'; break;
            case 0xFC: message.subType = 'stop'; break;
            case 0xFE: message.subType = 'activeSensing'; break;
            case 0xFF: message.subType = 'reset'; break;
            default: 
                message.subType = 'unknown';
                message.isValidMidi = false;
        }

        return message;
    }

    parseSystemCommon(data, timestamp, deviceInfo) {
        const message = {
            timestamp,
            rawData: data,
            deviceInfo,
            isValidMidi: true,
            terraSpecific: false
        };

        switch (data[0]) {
            case 0xF0: // System Exclusive
                message.type = 'sysex';
                message.data = data.slice(1);
                
                // Verificar se é SysEx Terra específico
                if (this.isTerraSystem(data)) {
                    message.terraSpecific = true;
                    message.terraData = this.parseTerraSystem(data);
                }
                break;
                
            case 0xF1: // MIDI Time Code Quarter Frame
                message.type = 'mtcQuarterFrame';
                if (data.length >= 2) {
                    message.nibble = (data[1] & 0x70) >> 4;
                    message.value = data[1] & 0x0F;
                }
                break;
                
            case 0xF2: // Song Position Pointer
                message.type = 'songPosition';
                if (data.length >= 3) {
                    message.position = data[1] | (data[2] << 7);
                }
                break;
                
            case 0xF3: // Song Select
                message.type = 'songSelect';
                if (data.length >= 2) {
                    message.song = data[1];
                }
                break;
                
            case 0xF6: // Tune Request
                message.type = 'tuneRequest';
                break;
                
            default:
                message.type = 'systemCommon';
                message.isValidMidi = false;
        }

        return message;
    }

    createEmptyMessage(timestamp, data) {
        return {
            timestamp,
            rawData: data || [],
            type: 'empty',
            isValidMidi: false,
            terraSpecific: false
        };
    }

    // Métodos auxiliares com cache
    getNoteNameCached(note) {
        if (typeof note !== 'number') return 'N/A';
        
        if (this.noteCache.has(note)) {
            return this.noteCache.get(note);
        }
        
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(note / 12) - 1;
        const noteName = noteNames[note % 12];
        const fullName = `${noteName}${octave}`;
        
        this.noteCache.set(note, fullName);
        return fullName;
    }

    getControllerNameCached(controller) {
        if (this.controllerCache.has(controller)) {
            return this.controllerCache.get(controller);
        }
        
        const name = this.terraControllers[controller] || `CC${controller}`;
        this.controllerCache.set(controller, name);
        return name;
    }

    midiNoteToFrequency(note) {
        if (typeof note !== 'number') return null;
        return 440 * Math.pow(2, (note - 69) / 12);
    }

    // Detecção de padrões Terra específicos
    isTerraPattern(message) {
        // Verificar se usa canais específicos Terra
        if (message.channel >= 8 && message.channel <= 15) {
            return true;
        }
        
        // Verificar se usa notas em ranges específicos de sensores
        if (message.note >= 36 && message.note <= 51) { // C2 a D#3 - range comum para sensores
            return true;
        }
        
        return false;
    }

    isTerraSystem(data) {
        // Verificar se é SysEx Terra (precisa conhecer o manufacturer ID)
        if (data.length >= 4 && data[0] === 0xF0) {
            // Placeholder para ID do fabricante Terra (se definido)
            // return data[1] === 0x7D && data[2] === 0x00; // Exemplo
        }
        
        return false;
    }

    parseTerraSystem(data) {
        // Parser específico para mensagens de sistema Terra
        const terraData = {
            type: 'terraSystem',
            command: data[3] || 0,
            parameters: data.slice(4, -1) // Remover F7 final
        };
        
        switch (terraData.command) {
            case 0x01:
                terraData.commandName = 'sensorConfig';
                break;
            case 0x02:
                terraData.commandName = 'deviceInfo';
                break;
            case 0x03:
                terraData.commandName = 'calibration';
                break;
            default:
                terraData.commandName = 'unknown';
        }
        
        return terraData;
    }

    identifySensorType(controller, value) {
        // Identificar tipo de sensor baseado no controlador e valor
        const sensorMap = {
            16: 'pressure',
            17: 'distance',
            18: 'light',
            19: 'temperature',
            20: 'humidity',
            21: 'acceleration',
            22: 'gyroscope',
            23: 'magnetic'
        };
        
        return sensorMap[controller] || 'unknown';
    }

    // Método para estatísticas de mensagens
    getMessageStats(messages) {
        const stats = {
            total: messages.length,
            byType: {},
            byChannel: {},
            terraMessages: 0,
            timeSpan: 0
        };

        if (messages.length === 0) return stats;

        // Calcular span de tempo
        const first = messages[0].timestamp;
        const last = messages[messages.length - 1].timestamp;
        stats.timeSpan = (last.getTime() - first.getTime()) / 1000; // segundos

        messages.forEach(msg => {
            // Por tipo
            stats.byType[msg.type] = (stats.byType[msg.type] || 0) + 1;
            
            // Por canal
            if (typeof msg.channel === 'number') {
                stats.byChannel[msg.channel] = (stats.byChannel[msg.channel] || 0) + 1;
            }
            
            // Terra específico
            if (msg.terraSpecific) {
                stats.terraMessages++;
            }
        });

        return stats;
    }
}

// Exportar para uso global
window.MidiParser = MidiParser;