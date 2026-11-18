# NAPS2 WebScan - Compilador PowerShell
# Execute este script para compilar o LocalService

param(
    [switch]$SelfContained,
    [switch]$SingleFile,
    [string]$OutputDir = "dist"
)

$ErrorActionPreference = "Stop"

function Write-Header {
    param([string]$Text)
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host " $Text" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
}

function Test-DotNetSdk {
    try {
        $version = dotnet --version
        Write-Host "✓ .NET SDK encontrado: $version" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "✗ .NET SDK nao encontrado!" -ForegroundColor Red
        Write-Host ""
        Write-Host "Instale o .NET 8.0 SDK:" -ForegroundColor Yellow
        Write-Host "https://dotnet.microsoft.com/download/dotnet/8.0" -ForegroundColor Cyan
        return $false
    }
}

Clear-Host
Write-Header "NAPS2 WebScan - Compilador"

# Verificar .NET SDK
if (-not (Test-DotNetSdk)) {
    pause
    exit 1
}

$ScriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectPath = Join-Path $ScriptPath "NAPS2.WebScan.LocalService.csproj"
$OutputPath = Join-Path $ScriptPath $OutputDir

Write-Host "Projeto: " -NoNewline
Write-Host $ProjectPath -ForegroundColor Cyan
Write-Host "Output: " -NoNewline
Write-Host $OutputPath -ForegroundColor Cyan
Write-Host ""

# Configurar parametros de build
$publishArgs = @(
    "publish",
    $ProjectPath,
    "-c", "Release",
    "-r", "win-x64",
    "-o", $OutputPath
)

if ($SelfContained) {
    Write-Host "Modo: Self-Contained (inclui .NET Runtime)" -ForegroundColor Yellow
    $publishArgs += "--self-contained", "true"
} else {
    Write-Host "Modo: Framework-Dependent (requer .NET Runtime)" -ForegroundColor Yellow
    $publishArgs += "--self-contained", "false"
}

if ($SingleFile) {
    Write-Host "Single File: Ativado" -ForegroundColor Yellow
    $publishArgs += "-p:PublishSingleFile=true"
}

Write-Host ""

# Limpar pasta de output se existir
if (Test-Path $OutputPath) {
    Write-Host "Limpando pasta de output anterior..." -ForegroundColor Gray
    Remove-Item -Path $OutputPath -Recurse -Force
}

Write-Host "Compilando..." -ForegroundColor Cyan
Write-Host ""

# Executar build
try {
    & dotnet $publishArgs
    
    if ($LASTEXITCODE -eq 0) {
        Write-Header "Compilacao concluida com sucesso!"
        
        Write-Host "Pasta de output: " -NoNewline -ForegroundColor White
        Write-Host $OutputPath -ForegroundColor Cyan
        Write-Host ""
        
        Write-Host "Arquivos gerados:" -ForegroundColor Yellow
        Get-ChildItem $OutputPath | Select-Object Mode, Length, Name | Format-Table -AutoSize
        
        $totalSize = (Get-ChildItem $OutputPath -Recurse | Measure-Object -Property Length -Sum).Sum
        $totalSizeMB = [math]::Round($totalSize / 1MB, 2)
        Write-Host "Tamanho total: $totalSizeMB MB" -ForegroundColor Cyan
        Write-Host ""
        
        Write-Header "Proximo passo"
        
        Write-Host "Para testar localmente:" -ForegroundColor Yellow
        Write-Host "  1. cd $OutputPath" -ForegroundColor White
        Write-Host "  2. .\instalador.bat (como Administrador)" -ForegroundColor White
        Write-Host "  3. Opcao 1 - Instalar servico" -ForegroundColor White
        Write-Host "  4. Opcao 3 - Iniciar servico" -ForegroundColor White
        Write-Host ""
        
        Write-Host "Para distribuir:" -ForegroundColor Yellow
        Write-Host "  Compress-Archive -Path '$OutputPath\*' -DestinationPath 'NAPS2-WebScan-v2.0.0.zip'" -ForegroundColor White
        Write-Host ""
        
        $open = Read-Host "Deseja abrir a pasta de output? (S/N)"
        if ($open -eq 'S' -or $open -eq 's') {
            Invoke-Item $OutputPath
        }
        
        exit 0
        
    } else {
        throw "Erro na compilacao (codigo: $LASTEXITCODE)"
    }
    
} catch {
    Write-Header "ERRO na compilacao!"
    
    Write-Host "Mensagem de erro:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    
    Write-Host "Verifique:" -ForegroundColor Yellow
    Write-Host "  1. .NET 8.0 SDK esta instalado corretamente" -ForegroundColor White
    Write-Host "  2. Nao ha erros de compilacao no projeto" -ForegroundColor White
    Write-Host "  3. Todas as dependencias foram restauradas" -ForegroundColor White
    Write-Host "  4. Nenhum arquivo esta em uso (feche o servico se estiver rodando)" -ForegroundColor White
    Write-Host ""
    
    pause
    exit 1
}
