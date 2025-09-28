@echo off
echo ========================================
echo MIDI Terra Monitor - Iniciando Servidor
echo Terra Eletronica
echo ========================================
echo.

cd /d "%~dp0"

echo Iniciando TerraSensoryMusic...
echo.
echo Sistema de Monitoramento MIDI - Terra Eletronica
echo Conecte seu dispositivo MIDI-Terra via USB
echo.

node server.js

pause