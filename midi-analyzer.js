// Extensão para análise avançada de dados MIDI
class MIDIAnalyzer {
    constructor(monitor) {
        this.monitor = monitor;
        this.charts = {};
        this.patterns = new Map();
        this.init();
    }

    init() {
        this.createAnalysisPanel();
        this.setupCharts();
        this.startPatternAnalysis();
    }

    createAnalysisPanel() {
        const analysisHTML = `
            <div class="analysis-panel">
                <h3>📊 Análise Avançada</h3>
                <div class="analysis-tabs">
                    <button class="tab-btn active" data-tab="charts">Gráficos</button>
                    <button class="tab-btn" data-tab="patterns">Padrões</button>
                    <button class="tab-btn" data-tab="heatmap">Mapa de Calor</button>
                </div>
                
                <div class="tab-content" id="charts-tab">
                    <div class="chart-container">
                        <canvas id="activityChart"></canvas>
                    </div>
                    <div class="chart-container">
                        <canvas id="velocityChart"></canvas>
                    </div>
                </div>
                
                <div class="tab-content" id="patterns-tab" style="display: none;">
                    <div class="patterns-list" id="patternsList">
                        <!-- Padrões serão adicionados dinamicamente -->
                    </div>
                </div>
                
                <div class="tab-content" id="heatmap-tab" style="display: none;">
                    <div class="heatmap-container" id="heatmapContainer">
                        <!-- Mapa de calor será gerado aqui -->
                    </div>
                </div>
            </div>
        `;

        // Adicionar após o painel de canais
        const channelsPanel = document.querySelector('.channels-panel');
        channelsPanel.insertAdjacentHTML('afterend', analysisHTML);

        // Configurar eventos das abas
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });
    }

    setupCharts() {
        // Gráfico de atividade temporal
        const activityCtx = document.getElementById('activityChart');
        this.charts.activity = new Chart(activityCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Mensagens/seg',
                    data: [],
                    borderColor: '#007bff',
                    backgroundColor: 'rgba(0, 123, 255, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'second',
                            displayFormats: {
                                second: 'HH:mm:ss'
                            }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Mensagens por Segundo'
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Atividade MIDI em Tempo Real'
                    }
                }
            }
        });

        // Gráfico de distribuição de velocity
        const velocityCtx = document.getElementById('velocityChart');
        this.charts.velocity = new Chart(velocityCtx, {
            type: 'histogram',
            data: {
                datasets: [{
                    label: 'Distribuição de Velocity',
                    data: [],
                    backgroundColor: 'rgba(40, 167, 69, 0.6)',
                    borderColor: '#28a745',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    x: {
                        type: 'linear',
                        position: 'bottom',
                        min: 0,
                        max: 127,
                        title: {
                            display: true,
                            text: 'Velocity (0-127)'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Frequência'
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Distribuição de Intensity (Velocity)'
                    }
                }
            }
        });

        // Atualizar gráficos periodicamente
        setInterval(() => this.updateCharts(), 2000);
    }

    updateCharts() {
        if (!this.monitor.midiLog.length) return;

        // Atualizar gráfico de atividade
        const now = new Date();
        const messagesPerSecond = this.monitor.stats.messagesPerSecond;
        
        if (this.charts.activity.data.labels.length > 60) {
            this.charts.activity.data.labels.shift();
            this.charts.activity.data.datasets[0].data.shift();
        }
        
        this.charts.activity.data.labels.push(now);
        this.charts.activity.data.datasets[0].data.push(messagesPerSecond);
        this.charts.activity.update('none');

        // Atualizar gráfico de velocity
        const velocities = this.monitor.midiLog
            .filter(msg => msg.velocity !== undefined)
            .map(msg => msg.velocity);

        if (velocities.length > 0) {
            const histogram = this.calculateHistogram(velocities, 0, 127, 16);
            this.charts.velocity.data.datasets[0].data = histogram.map((count, index) => ({
                x: index * 8 + 4, // Centro dos bins
                y: count
            }));
            this.charts.velocity.update('none');
        }
    }

    calculateHistogram(data, min, max, bins) {
        const histogram = new Array(bins).fill(0);
        const binSize = (max - min) / bins;

        data.forEach(value => {
            const binIndex = Math.floor((value - min) / binSize);
            const clampedIndex = Math.max(0, Math.min(bins - 1, binIndex));
            histogram[clampedIndex]++;
        });

        return histogram;
    }

    startPatternAnalysis() {
        setInterval(() => {
            this.analyzePatterns();
            this.updateHeatmap();
        }, 5000);
    }

    analyzePatterns() {
        if (this.monitor.midiLog.length < 10) return;

        const recentMessages = this.monitor.midiLog.slice(-100);
        
        // Analisar sequências de notas
        const noteSequences = this.findNoteSequences(recentMessages);
        
        // Analisar padrões rítmicos
        const rhythmPatterns = this.findRhythmPatterns(recentMessages);
        
        // Analisar uso de canais
        const channelUsage = this.analyzeChannelUsage(recentMessages);

        this.updatePatternsDisplay(noteSequences, rhythmPatterns, channelUsage);
    }

    findNoteSequences(messages) {
        const noteOns = messages.filter(msg => msg.type === 'noteOn');
        const sequences = new Map();
        
        for (let i = 0; i < noteOns.length - 2; i++) {
            const sequence = [
                noteOns[i].note,
                noteOns[i + 1]?.note,
                noteOns[i + 2]?.note
            ].filter(note => note !== undefined);
            
            if (sequence.length === 3) {
                const key = sequence.join('-');
                sequences.set(key, (sequences.get(key) || 0) + 1);
            }
        }
        
        return Array.from(sequences.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
    }

    findRhythmPatterns(messages) {
        const noteOns = messages.filter(msg => msg.type === 'noteOn');
        const intervals = [];
        
        for (let i = 1; i < noteOns.length; i++) {
            const interval = new Date(noteOns[i].timestamp) - new Date(noteOns[i-1].timestamp);
            intervals.push(Math.round(interval / 100) * 100); // Arredondar para 100ms
        }
        
        const rhythmMap = new Map();
        intervals.forEach(interval => {
            rhythmMap.set(interval, (rhythmMap.get(interval) || 0) + 1);
        });
        
        return Array.from(rhythmMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);
    }

    analyzeChannelUsage(messages) {
        const channelStats = new Map();
        
        messages.forEach(msg => {
            if (msg.channel) {
                const channel = msg.channel;
                if (!channelStats.has(channel)) {
                    channelStats.set(channel, {
                        count: 0,
                        types: new Set(),
                        velocitySum: 0,
                        velocityCount: 0
                    });
                }
                
                const stats = channelStats.get(channel);
                stats.count++;
                stats.types.add(msg.type);
                
                if (msg.velocity) {
                    stats.velocitySum += msg.velocity;
                    stats.velocityCount++;
                }
            }
        });
        
        return Array.from(channelStats.entries()).map(([channel, stats]) => ({
            channel,
            count: stats.count,
            types: Array.from(stats.types),
            avgVelocity: stats.velocityCount > 0 ? Math.round(stats.velocitySum / stats.velocityCount) : 0
        })).sort((a, b) => b.count - a.count);
    }

    updatePatternsDisplay(noteSequences, rhythmPatterns, channelUsage) {
        const patternsList = document.getElementById('patternsList');
        
        patternsList.innerHTML = `
            <div class="pattern-section">
                <h4>🎵 Sequências de Notas Mais Comuns</h4>
                <div class="pattern-list">
                    ${noteSequences.map(([sequence, count]) => `
                        <div class="pattern-item">
                            <span class="pattern-sequence">${sequence.split('-').map(note => this.monitor.midiNoteToName(parseInt(note))).join(' → ')}</span>
                            <span class="pattern-count">${count}x</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="pattern-section">
                <h4>🥁 Padrões Rítmicos</h4>
                <div class="pattern-list">
                    ${rhythmPatterns.map(([interval, count]) => `
                        <div class="pattern-item">
                            <span class="pattern-sequence">${interval}ms intervalo</span>
                            <span class="pattern-count">${count}x</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="pattern-section">
                <h4>📊 Uso de Canais</h4>
                <div class="pattern-list">
                    ${channelUsage.slice(0, 5).map(usage => `
                        <div class="pattern-item">
                            <span class="pattern-sequence">
                                Canal 0x${usage.channel.toString(16).toUpperCase().padStart(2, '0')} 
                                (${usage.types.join(', ')})
                                Vel. média: ${usage.avgVelocity}
                            </span>
                            <span class="pattern-count">${usage.count}x</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    updateHeatmap() {
        const heatmapContainer = document.getElementById('heatmapContainer');
        
        // Criar mapa de calor de notas por hora
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        
        const recentMessages = this.monitor.midiLog.filter(msg => 
            new Date(msg.timestamp) > oneHourAgo && msg.note !== undefined
        );
        
        // Criar grid 12x11 (notas C-B, oitavas 0-10)
        const noteGrid = Array(11).fill().map(() => Array(12).fill(0));
        
        recentMessages.forEach(msg => {
            if (msg.note >= 0 && msg.note <= 127) {
                const octave = Math.floor(msg.note / 12);
                const note = msg.note % 12;
                if (octave < 11) {
                    noteGrid[octave][note]++;
                }
            }
        });
        
        // Encontrar valor máximo para normalização
        const maxValue = Math.max(...noteGrid.flat());
        
        // Gerar HTML do mapa de calor
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        
        heatmapContainer.innerHTML = `
            <h4>🔥 Mapa de Calor de Notas (última hora)</h4>
            <div class="heatmap-grid">
                <div class="heatmap-labels">
                    ${Array.from({length: 11}, (_, i) => `<div class="octave-label">Oct ${i}</div>`).join('')}
                </div>
                <div class="heatmap-notes">
                    ${noteNames.map((noteName, noteIndex) => `
                        <div class="note-row">
                            <div class="note-label">${noteName}</div>
                            ${noteGrid.map((octave, octaveIndex) => {
                                const value = octave[noteIndex];
                                const intensity = maxValue > 0 ? value / maxValue : 0;
                                return `<div class="heat-cell" 
                                    style="background-color: rgba(255, 87, 34, ${intensity})"
                                    title="${noteName}${octaveIndex}: ${value} notas"
                                ></div>`;
                            }).join('')}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    switchTab(tabName) {
        // Atualizar botões
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        // Mostrar conteúdo da aba
        document.querySelectorAll('.tab-content').forEach(content => {
            content.style.display = content.id === `${tabName}-tab` ? 'block' : 'none';
        });
        
        // Redimensionar gráficos se necessário
        if (tabName === 'charts') {
            setTimeout(() => {
                Object.values(this.charts).forEach(chart => chart.resize());
            }, 100);
        }
    }
}

// Estender o CSS
const analysisCSS = `
.analysis-panel {
    background: rgba(255, 255, 255, 0.95);
    border-radius: 12px;
    padding: 25px;
    margin-bottom: 20px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.analysis-tabs {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
    border-bottom: 2px solid #e9ecef;
}

.tab-btn {
    padding: 10px 20px;
    border: none;
    background: transparent;
    color: #666;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all 0.3s ease;
}

.tab-btn.active {
    color: #1e3c72;
    border-bottom-color: #1e3c72;
}

.tab-btn:hover {
    background: rgba(30, 60, 114, 0.1);
}

.chart-container {
    margin-bottom: 30px;
    height: 300px;
}

.pattern-section {
    margin-bottom: 25px;
}

.pattern-section h4 {
    color: #1e3c72;
    margin-bottom: 15px;
    font-weight: 600;
}

.pattern-list {
    display: grid;
    gap: 10px;
}

.pattern-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    background: #f8f9fa;
    border-radius: 6px;
    border-left: 4px solid #007bff;
}

.pattern-sequence {
    font-family: 'Courier New', monospace;
    color: #495057;
}

.pattern-count {
    background: #007bff;
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-weight: 600;
    font-size: 0.8em;
}

.heatmap-grid {
    display: grid;
    grid-template-columns: 100px 1fr;
    gap: 10px;
    font-size: 0.8em;
}

.heatmap-labels {
    display: grid;
    grid-template-rows: repeat(11, 1fr);
    gap: 2px;
}

.octave-label {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #e9ecef;
    padding: 4px;
    border-radius: 4px;
    font-weight: 600;
    color: #495057;
}

.heatmap-notes {
    display: grid;
    gap: 2px;
}

.note-row {
    display: grid;
    grid-template-columns: 40px repeat(11, 1fr);
    gap: 2px;
    align-items: center;
}

.note-label {
    background: #6c757d;
    color: white;
    text-align: center;
    padding: 4px;
    border-radius: 4px;
    font-weight: 600;
}

.heat-cell {
    aspect-ratio: 1;
    border-radius: 2px;
    cursor: pointer;
    transition: transform 0.2s ease;
}

.heat-cell:hover {
    transform: scale(1.1);
    z-index: 10;
    position: relative;
}
`;

// Adicionar CSS ao documento
const style = document.createElement('style');
style.textContent = analysisCSS;
document.head.appendChild(style);

// Inicializar análise quando o monitor estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.midiMonitor) {
            window.midiAnalyzer = new MIDIAnalyzer(window.midiMonitor);
        }
    }, 1000);
});