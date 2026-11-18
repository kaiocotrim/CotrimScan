# NAPS2 WebScan LocalService

Serviço Windows que detecta automaticamente scanners TWAIN e os expõe via protocolo eSCL (AirPrint), permitindo scan via HTTP/REST.

## 🎯 Recursos

- ✅ Detecta automaticamente **todos os scanners TWAIN** conectados
- ✅ Expõe cada scanner via protocolo **eSCL** em portas separadas
- ✅ API REST para gerenciamento de scanners
- ✅ Suporte a **TWAIN 64-bit** com worker 32-bit
- ✅ **Múltiplas páginas** (feeder/ADF)
- ✅ Instalável como **Serviço do Windows**
- ✅ CORS habilitado para integração web
- ✅ Detecção automática em tempo real

## 📦 Instalação

### Método 1: Instalador Batch (Recomendado)

**Windows Command Prompt:**
```cmd
# Como Administrador
instalador.bat
```

**Siga o menu:**
1. Publicar executável (primeira vez)
2. Instalar como serviço
3. Iniciar serviço

### Método 2: Instalador PowerShell

**PowerShell como Administrador:**
```powershell
# Interativo
.\instalador.ps1

# Ou comandos diretos
.\instalador.ps1 publish     # Publicar executável
.\instalador.ps1 install     # Instalar serviço
.\instalador.ps1 start       # Iniciar serviço
.\instalador.ps1 status      # Ver status
```

### Método 3: Manual

```powershell
# 1. Publicar
dotnet publish -c Release -r win-x64 --self-contained false -o .\publish

# 2. Instalar
sc create "NAPS2.WebScan Service" binPath= "C:\caminho\completo\publish\NAPS2.WebScan.LocalService.exe" start= auto

# 3. Iniciar
sc start "NAPS2.WebScan Service"
```

Veja [INSTALACAO_SERVICO.md](./INSTALACAO_SERVICO.md) para detalhes completos.

## 🚀 Uso Rápido

### Desenvolvimento (Modo Console)
```powershell
dotnet run
```

### Como Serviço
```powershell
# Instalar e iniciar
instalador.bat

# Verificar scanners
curl http://localhost:5000/api/scanners
```

## 📡 API REST

**Base URL:** `http://localhost:5000`

### Listar Scanners
```http
GET /api/scanners
```

**Resposta:**
```json
[
  {
    "id": "Canon DR-C240 TWAIN",
    "name": "Canon DR-C240 TWAIN",
    "port": 9880,
    "capabilitiesUrl": "http://localhost:9880/eSCL/ScannerCapabilities",
    "registeredAt": "2026-02-27T10:00:00Z"
  }
]
```

### Scanner Atual
```http
GET /api/scanners/current
```

### Selecionar Scanner
```http
POST /api/scanners/{id}/select
```

Veja [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) para documentação completa.

## 🖨️ Protocolo eSCL

Cada scanner detectado recebe sua própria porta eSCL:

```
Scanner 1 → http://localhost:9880/eSCL/
Scanner 2 → http://localhost:9881/eSCL/
Scanner 3 → http://localhost:9882/eSCL/
```

### Endpoints eSCL

```http
GET  /eSCL/ScannerCapabilities      # Capac

idades do scanner
GET  /eSCL/ScannerStatus             # Status atual
POST /eSCL/ScanJobs                  # Criar job de scan
GET  /eSCL/ScanJobs/{id}             # Status do job
GET  /eSCL/ScanJobs/{id}/NextDocument # Obter imagem
```

## 🎨 Arquitetura

```
┌─────────────────────────────────────┐
│   NAPS2.WebScan.LocalService        │
│   (Windows Service - Porta 5000)    │
├─────────────────────────────────────┤
│                                     │
│  ┌────────────────────────────────┐ │
│  │   API REST Controller          │ │
│  │   /api/scanners                │ │
│  └────────────────────────────────┘ │
│            ▼                         │
│  ┌────────────────────────────────┐ │
│  │   Scanner Registry Service     │ │
│  │   (Gerencia lista de scanners) │ │
│  └────────────────────────────────┘ │
│            ▼                         │
│  ┌────────────────────────────────┐ │
│  │   NAPS2 Scan Controller        │ │
│  │   (Detecta scanners TWAIN)     │ │
│  └────────────────────────────────┘ │
│            ▼                         │
│  ┌────────────────────────────────┐ │
│  │   eSCL Server (Multi-port)     │ │
│  │   Scanner 1 → :9880            │ │
│  │   Scanner 2 → :9881            │ │
│  │   Scanner 3 → :9882            │ │
│  └────────────────────────────────┘ │
│            ▼                         │
│  ┌────────────────────────────────┐ │
│  │   TWAIN Worker (32-bit)        │ │
│  │   (Comunicação com drivers)    │ │
│  └────────────────────────────────┘ │
│            ▼                         │
└─────────────────────────────────────┘
             ▼
    ┌────────────────┐
    │ Drivers TWAIN  │
    │ (scanners)     │
    └────────────────┘
```

## 🔧 Configuração

### appsettings.json

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.Hosting.Lifetime": "Information"
    }
  },
  "Urls": "http://localhost:5000"
}
```

### Mudar Porta da API

```json
{
  "Urls": "http://localhost:5001"
}
```

### Porta Base dos Scanners eSCL

Editável em `Worker.cs`:
```csharp
int portBase = 9880; // Primeira porta eSCL
```

## 🐛 Troubleshooting

### Scanners não aparecem

1. **Verificar drivers TWAIN:**
   - Abra o software nativo do scanner
   - Teste se funciona normalmente

2. **Verificar arquitetura:**
   ```powershell
   # No console do serviço deve aparecer:
   # "Arquitetura do processo: 64-bit"
   # "Worker TWAIN 32-bit configurado"
   ```

3. **Reiniciar serviço:**
   ```powershell
   sc stop "NAPS2.WebScan Service"
   sc start "NAPS2.WebScan Service"
   ```

### Porta em uso

Se porta 5000 já estiver em uso:

```json
// appsettings.json
{
  "Urls": "http://localhost:5001"
}
```

### Ver Logs

```powershell
# Event Viewer
Get-EventLog -LogName Application -Source "NAPS2.WebScan Service" -Newest 20

# Ou modo console
dotnet run
```

## 📚 Documentação

- [INSTALACAO_SERVICO.md](./INSTALACAO_SERVICO.md) - Guia completo de instalação
- [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) - Documentação da API REST e eSCL
- [instalador.bat](./instalador.bat) - Script de instalação Windows
- [instalador.ps1](./instalador.ps1) - Script PowerShell

## 🔐 Segurança

- CORS habilitado (`AllowAnyOrigin`) para desenvolvimento
- Para produção, configure CORS específico no `Program.cs`
- Serviço roda como LocalSystem por padrão

## 📊 Requisitos de Sistema

- **.NET 8.0 Runtime**
- **Windows 10/11** ou **Windows Server 2016+**
- **Drivers TWAIN** dos scanners instalados
- **4GB RAM** mínimo (recomendado 8GB para múltiplos scanners)
- **Permissões de Administrador** para instalação

## 🤝 Integração

### Com React/TypeScript

```typescript
// Verificar scanners disponíveis
const response = await fetch('http://localhost:5000/api/scanners');
const scanners = await response.json();

// Selecionar scanner
await fetch(`http://localhost:5000/api/scanners/${scannerId}/select`, {
  method: 'POST'
});

// Usar SDK eSCL
import Scanner from 'escl-sdk-ts';
const scanner = new Scanner({ ip: 'localhost', port: 9880 });
const jobUrl = await scanner.ScanJobs({ Resolution: 300 });
```

### Com C#

```csharp
using System.Net.Http;
using System.Net.Http.Json;

var client = new HttpClient { BaseAddress = new Uri("http://localhost:5000") };

// Listar scanners
var scanners = await client.GetFromJsonAsync<List<ScannerDto>>("/api/scanners");

// Selecionar scanner
await client.PostAsync($"/api/scanners/{scannerId}/select", null);
```

## 🆘 Suporte

1. **Verifique os logs** no Event Viewer
2. **Execute em modo console** (`dotnet run`) para debug
3. **Teste o scanner** no software nativo primeiro
4. **Verifique as portas** com `netstat -ano | findstr 5000`

## 📝 Licença

Este projeto usa NAPS2 SDK que é open source (LGPL).

## ✨ Features

- [x] Detecção automática de scanners TWAIN
- [x] Multi-scanner simultâneo
- [x] API REST completa
- [x] Protocolo eSCL
- [x] Instalável como serviço Windows
- [x] Worker TWAIN 32-bit
- [x] CORS habilitado
- [x] Logs Event Viewer
- [x] Múltiplas páginas (feeder)
- [x] Otimizações de performance

## 🚀 Próximos Passos

1. Execute `instalador.bat` como Administrador
2. Escolha opção 6 para publicar
3. Escolha opção 1 para instalar
4. Escolha opção 3 para iniciar
5. Acesse http://localhost:5000/api/scanners

**Pronto! Seus scanners TWAIN agora são acessíveis via HTTP/eSCL!** 🎉
