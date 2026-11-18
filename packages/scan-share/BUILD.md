# Como Compilar - NAPS2 WebScan LocalService

Guia rápido para compilar e distribuir o LocalService.

## 🚀 Compilação Rápida

### Opção 1: Release Simples (Recomendado)

```powershell
# Na pasta do projeto
cd NAPS2.WebScan.LocalService

# Publicar em modo Release
dotnet publish -c Release -r win-x64 -o .\bin\Release\net8.0-windows\win-x64\publish
```

**Resultado:**
- Pasta: `bin\Release\net8.0-windows\win-x64\publish`
- Todos os arquivos necessários + instaladores
- Pronto para distribuir

### Opção 2: Single File (Arquivo Único)

```powershell
dotnet publish -c Release -r win-x64 --self-contained false -p:PublishSingleFile=true -o .\dist
```

**Resultado:**
- Pasta: `dist`
- Um único executável + instaladores + documentação
- Menor tamanho, mais fácil distribuir

### Opção 3: Self-Contained (Independente)

```powershell
dotnet publish -c Release -r win-x64 --self-contained true -o .\standalone
```

**Resultado:**
- Pasta: `standalone`
- Inclui .NET Runtime (não precisa instalar .NET no cliente)
- ~60MB maior, mas funciona em qualquer Windows

## 📦 O Que é Compilado

Após `dotnet publish`, a pasta de output contém:

```
bin\Release\net8.0-windows\win-x64\publish\
├── NAPS2.WebScan.LocalService.exe    ✅ Executável principal
├── instalador.bat                    ✅ Instalador Windows
├── instalador.ps1                    ✅ Instalador PowerShell
├── README.md                         ✅ Documentação completa
├── README_INSTALACAO.txt             ✅ Guia rápido
├── API_DOCUMENTATION.md              ✅ Docs da API
├── INSTALACAO_SERVICO.md             ✅ Guia de instalação
├── appsettings.json                  ✅ Configuração
├── *.dll                            ✅ Bibliotecas necessárias
└── worker32/                        ✅ Worker TWAIN 32-bit
```

## 🎯 Distribuição

### 1. Zipar a pasta

```powershell
# PowerShell
Compress-Archive -Path .\bin\Release\net8.0-windows\win-x64\publish\* -DestinationPath NAPS2-WebScan-LocalService-v2.0.0.zip

# Ou use 7-Zip, WinRAR, etc
```

### 2. Enviar para cliente

O cliente recebe um arquivo ZIP com tudo incluído.

### 3. Cliente extrai e instala

```powershell
# 1. Extrair ZIP
# 2. Executar como Administrador: instalador.bat ou instalador.ps1
# 3. Opção 1 - Instalar
# 4. Opção 3 - Iniciar
```

## 🔧 Configurações de Compilação

### appsettings.json

O arquivo é copiado automaticamente. Você pode editá-lo antes de distribuir:

```json
{
  "Urls": "http://localhost:5000",
  "Logging": {
    "LogLevel": {
      "Default": "Information"
    }
  }
}
```

### Variáveis de Build

No `.csproj`:

```xml
<PropertyGroup>
    <PublishSingleFile>true</PublishSingleFile>       <!-- Um único arquivo -->
    <RuntimeIdentifier>win-x64</RuntimeIdentifier>     <!-- Windows 64-bit -->
    <PlatformTarget>x64</PlatformTarget>              <!-- Target 64-bit -->
    <ServerGarbageCollection>true</ServerGarbageCollection> <!-- Performance -->
</PropertyGroup>
```

## 🧪 Testar Localmente

Antes de distribuir, teste:

```powershell
# 1. Compilar
dotnet publish -c Release -r win-x64

# 2. Ir para pasta de output
cd .\bin\Release\net8.0-windows\win-x64\publish

# 3. Testar executável diretamente
.\NAPS2.WebScan.LocalService.exe

# 4. Verificar API (em outro terminal)
curl http://localhost:5000/api/scanners

# 5. Testar instalador
# Como Administrador:
.\instalador.bat
```

## 📊 Tamanhos Aproximados

| Modo | Tamanho | .NET Necessário |
|------|---------|-----------------|
| Release simples | ~5 MB | Sim (.NET 8 Runtime) |
| Single File | ~5 MB | Sim (.NET 8 Runtime) |
| Self-Contained | ~65 MB | Não (incluso) |

## 🔄 Build Automático (CI/CD)

### GitHub Actions

```yaml
# .github/workflows/build.yml
name: Build LocalService

on:
  push:
    branches: [ main ]

jobs:
  build:
    runs-on: windows-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup .NET
      uses: actions/setup-dotnet@v3
      with:
        dotnet-version: 8.0.x
    
    - name: Publish
      run: |
        cd NAPS2.WebScan.LocalService
        dotnet publish -c Release -r win-x64 -o ../publish
    
    - name: Upload Artifact
      uses: actions/upload-artifact@v3
      with:
        name: NAPS2-WebScan-LocalService
        path: publish/
```

### Script Batch

```batch
@echo off
echo Compilando NAPS2 WebScan LocalService...

cd NAPS2.WebScan.LocalService
dotnet publish -c Release -r win-x64 -o ..\dist

if %errorLevel% equ 0 (
    echo.
    echo ✓ Compilacao concluida com sucesso!
    echo.
    echo Pasta de output: dist\
    echo.
    echo Proximo passo: Zipar a pasta 'dist' e enviar para o cliente.
) else (
    echo.
    echo ✗ Erro na compilacao!
)

pause
```

### Script PowerShell

```powershell
# build.ps1
Write-Host "Compilando NAPS2 WebScan LocalService..." -ForegroundColor Cyan

$projectPath = "NAPS2.WebScan.LocalService\NAPS2.WebScan.LocalService.csproj"
$outputPath = "dist"

dotnet publish $projectPath -c Release -r win-x64 -o $outputPath

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✓ Compilacao concluida com sucesso!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Pasta de output: $outputPath" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Arquivos incluidos:" -ForegroundColor Yellow
    Get-ChildItem $outputPath | Select-Object Name, Length | Format-Table -AutoSize
    Write-Host ""
    Write-Host "Proximo passo:" -ForegroundColor Yellow
    Write-Host "  Compress-Archive -Path $outputPath\* -DestinationPath NAPS2-WebScan-v2.0.0.zip"
} else {
    Write-Host ""
    Write-Host "✗ Erro na compilacao!" -ForegroundColor Red
}
```

## 🐛 Troubleshooting

### Erro: SDK não encontrado

```powershell
# Instalar .NET SDK
winget install Microsoft.DotNet.SDK.8
```

### Erro: Arquivo em uso

```powershell
# Parar o serviço se estiver rodando
sc stop "NAPS2.WebScan Service"

# Ou matar processo
taskkill /F /IM NAPS2.WebScan.LocalService.exe
```

### Erro: Permissão negada

```powershell
# Executar PowerShell como Administrador
# Ou usar outro diretório de output
dotnet publish -c Release -r win-x64 -o C:\temp\naps2-output
```

## 📝 Checklist de Distribuição

Antes de enviar para o cliente:

- [ ] Compilado em modo Release
- [ ] Testado localmente o executável
- [ ] Testado o instalador
- [ ] Verificado que scanners são detectados
- [ ] Verificado que API responde
- [ ] Incluído README_INSTALACAO.txt
- [ ] Incluído toda a documentação
- [ ] Zipado com nome versionado (ex: NAPS2-WebScan-v2.0.0.zip)
- [ ] Tamanho do ZIP ~5-65MB dependendo do modo

## 🚀 Deploy em Servidor

### IIS (Opcional)

Se quiser hospedar via IIS ao invés de Windows Service:

1. Publicar com `dotnet publish -c Release`
2. Instalar IIS + ASP.NET Core Module
3. Criar Application Pool
4. Criar Site apontando para pasta de publish

Mas **recomendamos Windows Service** para este projeto.

## 📞 Próximos Passos

1. Compilar: `dotnet publish -c Release -r win-x64`
2. Testar: `.\bin\Release\net8.0-windows\win-x64\publish\instalador.bat`
3. Zipar: `Compress-Archive -Path .\bin\Release\net8.0-windows\win-x64\publish\* ...`
4. Distribuir: Enviar ZIP para cliente

**Pronto! Seu LocalService está compilado e pronto para instalar!** 🎉
