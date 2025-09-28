# 🚀 Configuração Live Server - Terra Sensory Music

## ✅ Configuração Automática Implementada

### 📋 O que foi configurado:

#### **1. Settings.json (.vscode/settings.json)**
- ✅ **Porta**: 5500 (padrão Live Server)
- ✅ **Browser**: Chrome com flags MIDI habilitadas
- ✅ **Root**: Diretório atual do projeto
- ✅ **Auto-reload**: Habilitado para mudanças em tempo real
- ✅ **Headers CORS**: Configurados para Web MIDI API
- ✅ **Permissions-Policy**: MIDI habilitado

#### **2. Tasks.json (.vscode/tasks.json)**
- 🚀 **Start Live Server**: Instruções para iniciar
- 🔧 **Setup Chrome for MIDI**: Chrome com flags automáticas
- 📦 **Install Dependencies**: npm install
- 🌐 **HTTP Server**: Servidor alternativo na porta 8080
- 🔒 **HTTPS Server**: Servidor seguro na porta 8443
- 🧪 **Test MIDI Connection**: Guia de teste

#### **3. Launch.json (.vscode/launch.json)**
- 🚀 **Launch Chrome with MIDI**: Debug com Chrome + MIDI
- 🔧 **Debug Current File**: Debug arquivo atual
- 🌐 **Attach to Chrome**: Anexar ao Chrome em execução

## 🎯 Como usar:

### **Método 1: Live Server (Recomendado)**
```bash
1. Clique com botão direito em index.html
2. Selecione "Open with Live Server"
3. Ou use Ctrl+Shift+P > "Live Server: Open with Live Server"
```

### **Método 2: Via Tasks (Ctrl+Shift+P)**
```bash
1. Ctrl+Shift+P
2. Digite "Tasks: Run Task"
3. Escolha "🚀 Start Live Server"
```

### **Método 3: Debug Mode (F5)**
```bash
1. Pressione F5
2. Escolha "🚀 Launch Chrome with MIDI"
3. Chrome abrirá automaticamente com flags MIDI
```

### **Método 4: Terminal**
```bash
npm run start
# ou
npm run dev
```

## 🔧 Configurações Específicas:

### **Chrome Flags Habilitadas:**
- `--disable-web-security`: Permite acesso local
- `--enable-web-midi`: Habilita Web MIDI API  
- `--user-data-dir`: Sessão isolada para desenvolvimento
- `--allow-running-insecure-content`: Conteúdo local

### **Headers CORS Configurados:**
- `Access-Control-Allow-Origin: *`
- `Permissions-Policy: midi=*`
- Headers para desenvolvimento local seguro

### **Portas Configuradas:**
- **5500**: Live Server (padrão)
- **8080**: HTTP Server alternativo
- **8443**: HTTPS Server (futuro)

## 🚨 Troubleshooting:

### **Live Server não funciona:**
```bash
1. Verificar se extensão está instalada
2. Reiniciar VS Code
3. Usar Tasks: "🔧 Setup Chrome for MIDI"
```

### **MIDI não conecta:**
```bash
1. Verificar se dispositivo MIDI está conectado
2. Usar Chrome (não Firefox/Safari)
3. Aceitar permissões do navegador
4. Verificar console para erros
```

### **Erro de CORS:**
```bash
1. Usar Live Server (não arquivo local)
2. Verificar settings.json
3. Chrome com flags corretas
```

## ⚡ Comandos Rápidos:

| Ação | Comando |
|------|---------|
| Iniciar Live Server | `Ctrl+Shift+P` > Live Server |
| Debug com Chrome | `F5` |
| Executar Task | `Ctrl+Shift+P` > Tasks |
| Terminal integrado | `Ctrl+`` |
| Comando rápido | `Ctrl+Shift+P` |

## 📁 Estrutura de Arquivos:
```
.vscode/
├── settings.json     # Configurações Live Server
├── tasks.json        # Tarefas automatizadas  
├── launch.json       # Configurações debug
└── extensions.json   # Extensões recomendadas
```

**✅ Configuração completa! Use qualquer método acima para executar.** 🎵