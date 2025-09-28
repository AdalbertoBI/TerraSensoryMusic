# Terra Sensory Music - Live Server Quick Start
# Configuração automática para desenvolvimento MIDI

Write-Host "🎵 Terra Sensory Music - Live Server Setup" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""

# Verificar se Live Server está instalado
$liveServerInstalled = code --list-extensions | Select-String "ritwickdey.LiveServer"

if (-not $liveServerInstalled) {
    Write-Host "📦 Instalando Live Server..." -ForegroundColor Yellow
    code --install-extension ritwickdey.LiveServer
    Write-Host "✅ Live Server instalado!" -ForegroundColor Green
}
else {
    Write-Host "✅ Live Server já está instalado" -ForegroundColor Green
}

Write-Host ""
Write-Host "🔧 Configurações aplicadas:" -ForegroundColor Cyan
Write-Host "   • Porta: 5500" -ForegroundColor White
Write-Host "   • Browser: Chrome com flags MIDI" -ForegroundColor White  
Write-Host "   • Auto-reload: Habilitado" -ForegroundColor White
Write-Host "   • CORS: Configurado para MIDI" -ForegroundColor White

Write-Host ""
Write-Host "🚀 Como usar:" -ForegroundColor Cyan
Write-Host "   1. Clique com botão direito em index.html" -ForegroundColor White
Write-Host "   2. Selecione 'Open with Live Server'" -ForegroundColor White
Write-Host "   3. Ou pressione Ctrl+Shift+P > 'Live Server'" -ForegroundColor White

Write-Host ""
Write-Host "🎯 URLs de acesso:" -ForegroundColor Cyan  
Write-Host "   • Live Server: http://127.0.0.1:5500" -ForegroundColor White
Write-Host "   • HTTP Server: http://127.0.0.1:8080" -ForegroundColor White

Write-Host ""
Write-Host "🔗 Atalhos VS Code:" -ForegroundColor Cyan
Write-Host "   • F5: Debug com Chrome+MIDI" -ForegroundColor White
Write-Host "   • Ctrl+Shift+P: Paleta de comandos" -ForegroundColor White
Write-Host "   • Ctrl+`: Terminal integrado" -ForegroundColor White

Write-Host ""
Write-Host "✅ Configuração concluída! Pronto para desenvolvimento MIDI." -ForegroundColor Green