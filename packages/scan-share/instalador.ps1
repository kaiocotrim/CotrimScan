# NAPS2 WebScan LocalService - Instalador PowerShell
# Execute como Administrador

param(
    [Parameter(Position=0)]
    [ValidateSet('install','uninstall','start','stop','status','logs')]
    [string]$Action = ''
)

$ServiceName = "NAPS2.WebScan Service"
$DisplayName = "NAPS2 WebScan Service"
$ScriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$ExePath = Join-Path $ScriptPath "NAPS2.WebScan.LocalService.exe"

function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Show-Banner {
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host " NAPS2 WebScan LocalService - Instalador" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
}

function Show-Menu {
    Write-Host "Escolha uma opcao:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. Instalar como servico do Windows" -ForegroundColor White
    Write-Host "2. Desinstalar servico" -ForegroundColor White
    Write-Host "3. Iniciar servico" -ForegroundColor Green
    Write-Host "4. Parar servico" -ForegroundColor Red
    Write-Host "5. Status do servico" -ForegroundColor Cyan
    Write-Host "6. Ver logs" -ForegroundColor Gray
    Write-Host "0. Sair" -ForegroundColor DarkGray
    Write-Host ""
}

function Get-ServiceStatus {
    try {
        $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
        if ($service) {
            Write-Host "Status: Servico instalado" -ForegroundColor Green
            Write-Host "Estado: $($service.Status)" -ForegroundColor $(if($service.Status -eq 'Running'){'Green'}else{'Yellow'})
            Write-Host "Tipo de inicio: $($service.StartType)" -ForegroundColor Cyan
        } else {
            Write-Host "Status: Servico nao instalado" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "Status: Erro ao verificar servico" -ForegroundColor Red
    }
}

function Install-LocalService {
    Write-Host ""
    Write-Host "Instalando servico..." -ForegroundColor Cyan
    
    if (-not (Test-Path $ExePath)) {
        Write-Host "ERRO: Executavel nao encontrado em:" -ForegroundColor Red
        Write-Host $ExePath -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Compile primeiro o projeto com:" -ForegroundColor Yellow
        Write-Host "dotnet publish -c Release -r win-x64" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Os arquivos compilados devem estar na mesma pasta deste instalador." -ForegroundColor Yellow
        return
    }

    try {
        $existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
        if ($existingService) {
            Write-Host "Servico ja existe. Desinstale primeiro (opcao 2)." -ForegroundColor Yellow
            return
        }

        New-Service -Name $ServiceName `
                    -BinaryPathName "`"$ExePath`"" `
                    -DisplayName $DisplayName `
                    -StartupType Automatic `
                    -Description "NAPS2 WebScan LocalService - Scanner TWAIN to eSCL Bridge"

        Write-Host "Servico instalado com sucesso!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Configuracao:" -ForegroundColor Cyan
        Write-Host "- Nome: $ServiceName" -ForegroundColor White
        Write-Host "- Inicio: Automatico" -ForegroundColor White
        Write-Host "- API REST: http://localhost:5000/api/scanners" -ForegroundColor White
        Write-Host "- ESCL Base: http://localhost:9880/eSCL/" -ForegroundColor White
        Write-Host ""
        
        $start = Read-Host "Deseja iniciar o servico agora? (S/N)"
        if ($start -eq 'S' -or $start -eq 's') {
            Start-LocalService
        }
    } catch {
        Write-Host "ERRO ao instalar servico: $($_.Exception.Message)" -ForegroundColor Red
    }
}

function Uninstall-LocalService {
    Write-Host ""
    Write-Host "Desinstalando servico..." -ForegroundColor Cyan
    
    try {
        $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
        if (-not $service) {
            Write-Host "Servico nao esta instalado." -ForegroundColor Yellow
            return
        }

        if ($service.Status -eq 'Running') {
            Write-Host "Parando servico..." -ForegroundColor Yellow
            Stop-Service -Name $ServiceName -Force
            Start-Sleep -Seconds 2
        }

        sc.exe delete $ServiceName
        Write-Host "Servico desinstalado com sucesso!" -ForegroundColor Green
    } catch {
        Write-Host "ERRO ao desinstalar servico: $($_.Exception.Message)" -ForegroundColor Red
    }
}

function Start-LocalService {
    Write-Host ""
    Write-Host "Iniciando servico..." -ForegroundColor Cyan
    
    try {
        Start-Service -Name $ServiceName
        Start-Sleep -Seconds 3
        
        Write-Host "Servico iniciado com sucesso!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Verificando scanners..." -ForegroundColor Cyan
        
        try {
            $response = Invoke-RestMethod -Uri "http://localhost:5000/api/scanners" -Method Get -TimeoutSec 5
            Write-Host "Scanners detectados: $($response.Count)" -ForegroundColor Green
            $response | ForEach-Object {
                Write-Host "  - $($_.name) (Porta: $($_.port))" -ForegroundColor White
            }
        } catch {
            Write-Host "Servico iniciado, mas ainda carregando scanners..." -ForegroundColor Yellow
        }
    } catch {
        Write-Host "ERRO ao iniciar servico: $($_.Exception.Message)" -ForegroundColor Red
    }
}

function Stop-LocalService {
    Write-Host ""
    Write-Host "Parando servico..." -ForegroundColor Cyan
    
    try {
        Stop-Service -Name $ServiceName -Force
        Write-Host "Servico parado com sucesso!" -ForegroundColor Green
    } catch {
        Write-Host "ERRO ao parar servico: $($_.Exception.Message)" -ForegroundColor Red
    }
}

function Show-Logs {
    Write-Host ""
    Write-Host "Logs do servico (ultimos 20):" -ForegroundColor Cyan
    Write-Host ""
    
    try {
        Get-EventLog -LogName Application -Source $ServiceName -Newest 20 -ErrorAction SilentlyContinue | 
            Format-Table -AutoSize TimeGenerated, EntryType, Message
    } catch {
        Write-Host "Nenhum log encontrado ou servico nao esta instalado." -ForegroundColor Yellow
    }
}

# Main
Clear-Host
Show-Banner

if (-not (Test-Administrator)) {
    Write-Host "ERRO: Execute este script como Administrador" -ForegroundColor Red
    Write-Host "Clique com botao direito no PowerShell e selecione 'Executar como Administrador'" -ForegroundColor Yellow
    Write-Host ""
    pause
    exit 1
}

Get-ServiceStatus
Write-Host ""

# Se foi passado um parametro, executa diretamente
if ($Action) {
    switch ($Action.ToLower()) {
        'install'   { Install-LocalService }
        'uninstall' { Uninstall-LocalService }
        'start'     { Start-LocalService }
        'stop'      { Stop-LocalService }
        'status'    { Get-ServiceStatus }
        'logs'      { Show-Logs }
    }
    exit 0
}

# Menu interativo
while ($true) {
    Show-Menu
    $opcao = Read-Host "Digite sua opcao (0-6)"
    
    switch ($opcao) {
        '1' { Install-LocalService; pause }
        '2' { Uninstall-LocalService; pause }
        '3' { Start-LocalService; pause }
        '4' { Stop-LocalService; pause }
        '5' { Get-ServiceStatus; pause }
        '6' { Show-Logs; pause }
        '0' { Write-Host "Saindo..."; exit 0 }
        default { Write-Host "Opcao invalida!" -ForegroundColor Red; pause }
    }
    
    Clear-Host
    Show-Banner
    Get-ServiceStatus
    Write-Host ""
}
