@echo off
echo ========================================
echo  NAPS2 WebScan - Compilador
echo ========================================
echo.

REM Verificar se .NET SDK esta instalado
dotnet --version >nul 2>&1
if %errorLevel% neq 0 (
    echo ERRO: .NET SDK nao encontrado!
    echo.
    echo Instale o .NET 8.0 SDK:
    echo https://dotnet.microsoft.com/download/dotnet/8.0
    pause
    exit /B 1
)

echo .NET SDK encontrado!
dotnet --version
echo.

set "OUTPUT_DIR=%~dp0dist"

echo Compilando NAPS2.WebScan.LocalService...
echo Pasta de output: %OUTPUT_DIR%
echo.

REM Limpar pasta de output se existir
if exist "%OUTPUT_DIR%" (
    echo Limpando pasta de output anterior...
    rmdir /S /Q "%OUTPUT_DIR%"
)

REM Compilar projeto
dotnet publish "%~dp0NAPS2.WebScan.LocalService.csproj" -c Release -r win-x64 --self-contained false -o "%OUTPUT_DIR%"

if %errorLevel% equ 0 (
    echo.
    echo ========================================
    echo  Compilacao concluida com sucesso!
    echo ========================================
    echo.
    echo Pasta de output: %OUTPUT_DIR%
    echo.
    echo Arquivos incluidos:
    dir /B "%OUTPUT_DIR%"
    echo.
    echo ========================================
    echo.
    echo Proximo passo:
    echo 1. Va para a pasta: %OUTPUT_DIR%
    echo 2. Execute como Administrador: instalador.bat
    echo 3. Escolha opcao 1 para instalar o servico
    echo.
    echo Para distribuir:
    echo - Zipear a pasta 'dist' completa
    echo - O cliente extrai e executa instalador.bat
    echo.
    pause
    
    REM Perguntar se deseja abrir a pasta
    set /p open="Deseja abrir a pasta de output? (S/N): "
    if /i "%open%"=="S" (
        explorer "%OUTPUT_DIR%"
    )
) else (
    echo.
    echo ========================================
    echo  ERRO na compilacao!
    echo ========================================
    echo.
    echo Verifique:
    echo 1. .NET 8.0 SDK esta instalado
    echo 2. Nao ha erros de codigo no projeto
    echo 3. Todas as dependencias foram restauradas
    echo.
    pause
    exit /B 1
)

exit /B 0
