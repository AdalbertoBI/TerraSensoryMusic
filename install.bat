@echo off
cd /d "%~dp0"

echo ========================================
echo MIDI Terra Monitor - Instalacao
echo Terra Eletronica
echo ========================================
echo.

echo Verificando Node.js...
node --version > nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERRO: Node.js nao encontrado!
    echo Baixe e instale Node.js de: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo Node.js encontrado!
node --version
echo.

echo Instalando dependencias...
npm install

if %ERRORLEVEL% NEQ 0 (
    echo ERRO: Falha na instalacao das dependencias!
    pause
    exit /b 1
)

echo.
echo ========================================
echo Instalacao concluida com sucesso!
echo ========================================
echo.
echo Para iniciar o sistema:
echo   1. Execute 'start.bat'
echo   2. Ou execute diretamente: 
echo      node server-demo.js (demonstracao)
echo      node server.js (com MIDI real)
echo   3. Acesse: http://localhost:3000
echo.
echo O sistema iniciara em modo demonstracao
echo com dados MIDI simulados para teste.
echo.
echo Conecte seu dispositivo MIDI-Terra para
echo dados reais em tempo real!
echo.
pause