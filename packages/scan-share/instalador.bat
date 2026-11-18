@echo off
setlocal EnableDelayedExpansion
echo ========================================
echo  NAPS2 WebScan LocalService - Instalador
echo ========================================
echo.

REM Verificar status do servico
sc query "NAPS2.WebScan Service" >nul 2>&1
if %errorLevel% equ 0 (
    echo Status: Servico ja instalado
    for /f "tokens=3" %%i in ('sc query "NAPS2.WebScan Service" ^| find "STATE"') do set "status=%%i"
    echo Estado: !status!
) else (
    echo Status: Servico nao instalado
)
echo.

REM Verificar se está executando como administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERRO: Este script deve ser executado como Administrador
    echo Clique com botao direito e selecione "Executar como administrador"
    pause
    exit /B 1
)

:inicio
echo Escolha uma opcao:
echo.
echo 1. Instalar como servico do Windows
echo 2. Desinstalar servico
echo 3. Iniciar servico
echo 4. Parar servico
echo 5. Verificar scanners disponiveis
echo 6. Abrir API no navegador
echo 0. Sair
echo.

set /p opcao="Digite sua opcao (0-6): "

if "%opcao%"=="1" goto instalar
if "%opcao%"=="2" goto desinstalar
if "%opcao%"=="3" goto iniciar
if "%opcao%"=="4" goto parar
if "%opcao%"=="5" goto scanners
if "%opcao%"=="6" goto api
if "%opcao%"=="0" goto sair

echo Opcao invalida!
pause
goto inicio

REM ============================================
REM  Funcoes de Instalacao
REM ============================================

:instalar
echo.
echo Verificando se o executavel existe...
if not exist "%~dp0NAPS2.WebScan.LocalService.exe" (
    echo ERRO: Executavel nao encontrado!
    echo.
    echo Compile primeiro o projeto com:
    echo dotnet publish -c Release -r win-x64
    echo.
    echo Os arquivos compilados devem estar na mesma pasta deste instalador.
    pause
    goto inicio
)

echo Instalando NAPS2 WebScan LocalService como servico...
sc create "NAPS2.WebScan Service" binPath= "\"%~dp0NAPS2.WebScan.LocalService.exe\"" DisplayName= "NAPS2 WebScan Service" start= auto
if %errorLevel% equ 0 (
    echo Servico instalado com sucesso!
    echo.
    echo Configuracao do servico:
    echo - Nome: NAPS2.WebScan Service
    echo - Inicio: Automatico
    echo - API REST: http://localhost:5000/api/scanners
    echo - Portas eSCL: a partir de 9880 (uma por scanner)
    echo.
    echo IMPORTANTE: O servico detecta automaticamente scanners TWAIN
    echo conectados ao sistema e expoe cada um em uma porta separada.
    echo.
    echo Deseja iniciar o servico agora? (S/N)
    set /p start="Digite S ou N: "
    if /i "%start%"=="S" (
        sc start "NAPS2.WebScan Service"
        if %errorLevel% equ 0 (
            echo Servico iniciado com sucesso!
            timeout /t 3 >nul
            echo.
            echo Verificando scanners disponiveis...
            curl -s http://localhost:5000/api/scanners 2>nul
            echo.
            echo API disponivel em: http://localhost:5000/api/scanners
        ) else (
            echo ERRO ao iniciar o servico!
            echo Verifique os logs do Windows Event Viewer.
        )
    )
) else (
    echo ERRO ao instalar o servico!
    echo Possivel causa: Servico ja existe ou caminho invalido.
)
pause
goto sair

:desinstalar
echo.
echo Parando servico...
sc stop "NAPS2.WebScan Service" >nul 2>&1
timeout /t 3 >nul
echo Desinstalando NAPS2 WebScan Service...
sc delete "NAPS2.WebScan Service"
if %errorLevel% equ 0 (
    echo Servico desinstalado com sucesso!
) else (
    echo ERRO ao desinstalar o servico!
)
pause
goto sair

:iniciar
echo.
echo Iniciando servico...
sc start "NAPS2.WebScan Service"
if %errorLevel% equ 0 (
    echo Servico iniciado com sucesso!
    timeout /t 3 >nul
    echo.
    echo Verificando scanners disponiveis...
    curl -s http://localhost:5000/api/scanners 2>nul
    echo.
    echo API REST: http://localhost:5000/api/scanners
    echo Portas eSCL: a partir de 9880 (uma por scanner)
) else (
    echo ERRO ao iniciar o servico!
    echo Verifique os logs do Windows Event Viewer.
)
pause
goto sair

:parar
echo.
echo Parando servico...
sc stop "NAPS2.WebScan Service"
if %errorLevel% equ 0 (
    echo Servico parado com sucesso!
) else (
    echo ERRO ao parar o servico!
)
pause
goto sair

:scanners
echo.
echo Verificando scanners disponiveis...
echo.
curl -s http://localhost:5000/api/scanners 2>nul
if %errorLevel% neq 0 (
    echo ERRO: Servico nao esta respondendo.
    echo Verifique se o servico esta iniciado com a opcao 3.
) else (
    echo.
    echo Use http://localhost:5000/api/scanners para ver a lista completa.
)
pause
goto inicio

:api
echo.
echo Abrindo API no navegador...
start "" "http://localhost:5000/api/scanners"
echo.
echo API aberta no navegador!
echo.
echo Endpoints disponiveis:
echo - GET  /api/scanners           - Lista scanners
echo - GET  /api/scanners/{id}      - Detalhes de um scanner
echo - POST /api/scanners/refresh   - Atualiza a lista de scanners
echo - GET  /api/scanners/count     - Total de scanners
goto sair

:sair
echo.
echo Saindo...
exit /B 0
