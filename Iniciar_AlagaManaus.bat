@echo off
setlocal
cd /d "%~dp0"
title AlagaManaus
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado. Instale o Node.js 24 ou superior.
  pause
  exit /b 1
)
if not exist "node_modules" (
  echo Instalando dependencias...
  call npm.cmd ci
  if errorlevel 1 (
    echo Falha ao instalar dependencias.
    pause
    exit /b 1
  )
)
if not exist ".env" (
  echo Configure o arquivo .env antes de iniciar.
  pause
  exit /b 1
)
echo Abra http://localhost:3000 no navegador quando aparecer o endereco.
echo Mantenha esta janela aberta enquanto estiver usando o sistema.
call npm.cmd start
if errorlevel 1 pause
endlocal
