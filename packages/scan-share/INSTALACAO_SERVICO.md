# NAPS2 WebScan LocalService - Instalação como Serviço do Windows

## 📋 Pré-requisitos

- Windows 10/11 ou Windows Server 2016+
- .NET 8.0 Runtime instalado
- Permissões de Administrador
- Scanners TWAIN conectados ao sistema

## 🚀 Instalação Rápida

### Opção 1: Usando Instalador (Recomendado)

**Pré-requisito:** Compile o projeto primeiro.

1. **Compilar o projeto:**
   ```powershell
   # Na pasta do projeto
   .\compilar.bat
   # Ou
   .\compilar.ps1
   ```
   
   Isso vai gerar uma pasta `dist` com todos os arquivos necessários.

2. **Ir para a pasta compilada:**
   ```powershell
   cd dist
   ```

3. **Executar o instalador como Administrador:**
   ```
   Clique com botão direito em "instalador.bat" → "Executar como administrador"
   ```

4. **Siga as opções do menu:**
   ```
   1. Instalar como serviço do Windows
   3. Iniciar serviço
   ```

### Opção 2: PowerShell Avançado

```powershell
# 1. Compilar
.\compilar.ps1

# 2. Ir para pasta compilada
cd dist

# 3. Instalar (como Administrador)
.\instalador.ps1 install

# 4. Iniciar
.\instalador.ps1 start
```

### Opção 3: Instalação Manual

1. **Publicar o executável:**
   ```powershell
   dotnet publish -c Release -r win-x64 --self-contained false
   ```

2. **Ir para pasta de output:**
   ```powershell
   cd bin\Release\net8.0-windows\win-x64\publish
   ```

3. **Instalar o serviço:**
   ```powershell
   sc create "NAPS2.WebScan Service" binPath= "%CD%\NAPS2.WebScan.LocalService.exe" DisplayName= "NAPS2 WebScan Service" start= auto
   ```

4. **Iniciar o serviço:**
   ```powershell
   sc start "NAPS2.WebScan Service"
   ```

## 🎯 Opções do Instalador

### instalador.bat (Menu Batch)

| Opção | Descrição |
|-------|-----------|
| **1** | Instalar como serviço do Windows |
| **2** | Desinstalar serviço |
| **3** | Iniciar serviço |
| **4** | Parar serviço |
| **5** | Verificar scanners disponíveis |
| **6** | Abrir API no navegador |
| **0** | Sair |

### instalador.ps1 (Menu PowerShell)

| Opção | Descrição |
|-------|-----------|
| **1** | Instalar como serviço do Windows |
| **2** | Desinstalar serviço |
| **3** | Iniciar serviço |
| **4** | Parar serviço |
| **5** | Status do serviço |
| **6** | Ver logs do Event Viewer |
| **0** | Sair |

**Linha de comando PowerShell:**
```powershell
.\instalador.ps1 install     # Instalar
.\instalador.ps1 uninstall   # Desinstalar
.\instalador.ps1 start       # Iniciar
.\instalador.ps1 stop        # Parar
.\instalador.ps1 status      # Ver status
.\instalador.ps1 logs        # Ver logs
```

## 🔧 Configuração

### Portas Utilizadas

- **5000** - API REST para gerenciamento de scanners
- **9880+** - Servidores eSCL (um por scanner TWAIN detectado)

### Endpoints da API

```
GET  http://localhost:5000/api/scanners          # Lista todos os scanners
GET  http://localhost:5000/api/scanners/current  # Scanner atualmente selecionado
POST http://localhost:5000/api/scanners/{id}/select # Seleciona um scanner
GET  http://localhost:5000/api/scanners/count    # Total de scanners
```

### Endpoints eSCL por Scanner

Cada scanner TWAIN detectado recebe sua própria porta eSCL:

```
GET  http://localhost:9880/eSCL/ScannerCapabilities  # Scanner 1
GET  http://localhost:9881/eSCL/ScannerCapabilities  # Scanner 2
GET  http://localhost:9882/eSCL/ScannerCapabilities  # Scanner 3
```

## 📊 Verificação do Serviço

### Via PowerShell
```powershell
# Status do serviço
Get-Service "NAPS2.WebScan Service"

# Logs do Event Viewer
Get-EventLog -LogName Application -Source "NAPS2.WebScan Service" -Newest 20
```

### Via Linha de Comando
```cmd
# Status
sc query "NAPS2.WebScan Service"

# Iniciar
sc start "NAPS2.WebScan Service"

# Parar
sc stop "NAPS2.WebScan Service"
```

### Via API REST
```powershell
# Verificar scanners disponíveis
curl http://localhost:5000/api/scanners

# Verificar scanner atual
curl http://localhost:5000/api/scanners/current
```

## 🐛 Resolução de Problemas

### Serviço não inicia

1. **Verificar se o executável existe:**
   ```
   dir publish\NAPS2.WebScan.LocalService.exe
   ```

2. **Verificar logs do Windows:**
   ```
   Event Viewer → Windows Logs → Application
   ```

3. **Testar em modo console:**
   ```
   Opção 5 do instalador ou:
   dotnet run
   ```

### Scanners não são detectados

1. **Verificar drivers TWAIN:**
   - Abra o aplicativo nativo do scanner
   - Teste se o scan funciona normalmente

2. **Verificar arquitetura:**
   - O serviço usa worker TWAIN 32-bit
   - Funciona em processo 64-bit

3. **Reiniciar o serviço:**
   ```
   sc stop "NAPS2.WebScan Service"
   sc start "NAPS2.WebScan Service"
   ```

### Porta já em uso

Se a porta 5000 já estiver em uso, edite `appsettings.json`:

```json
{
  "Urls": "http://localhost:5001"
}
```

## 🔐 Permissões

O serviço é executado por padrão como **LocalSystem**. Se necessário, altere para uma conta específica:

```powershell
sc config "NAPS2.WebScan Service" obj= "DOMAIN\Usuario" password= "Senha"
```

## 🔄 Atualização do Serviço

1. Parar o serviço
2. Publicar nova versão
3. Substituir arquivos em `publish\`
4. Iniciar o serviço

```powershell
sc stop "NAPS2.WebScan Service"
dotnet publish -c Release -r win-x64 --self-contained false -o .\publish
sc start "NAPS2.WebScan Service"
```

## 📝 Logs

Os logs são gravados em:

- **Event Viewer:** Application → NAPS2.WebScan Service
- **Console:** Quando executado em modo console (opção 5)

## 🌐 Integração com WebServer

O WebServer (interface web) deve apontar para o LocalService:

```json
// appsettings.json do WebServer
{
  "LocalService": {
    "Url": "http://localhost:5000"
  }
}
```

## 🆘 Suporte

### Desinstalar Completamente

```powershell
# Parar e remover serviço
sc stop "NAPS2.WebScan Service"
sc delete "NAPS2.WebScan Service"

# Remover arquivos
Remove-Item -Recurse -Force .\publish
```

### Reinstalar do Zero

```powershell
# 1. Desinstalar
sc delete "NAPS2.WebScan Service"

# 2. Limpar
Remove-Item -Recurse -Force .\publish

# 3. Publicar novamente
dotnet publish -c Release -r win-x64 --self-contained false -o .\publish

# 4. Instalar
sc create "NAPS2.WebScan Service" binPath= "C:\caminho\completo\publish\NAPS2.WebScan.LocalService.exe" DisplayName= "NAPS2 WebScan Service" start= auto

# 5. Iniciar
sc start "NAPS2.WebScan Service"
```

## 📚 Documentação Adicional

- [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) - Documentação completa da API
- Logs no Event Viewer para diagnósticos
- Use modo console (opção 5) para debug

## ✅ Verificação Pós-Instalação

1. ✓ Serviço instalado: `sc query "NAPS2.WebScan Service"`
2. ✓ Serviço iniciado: Estado deve ser "RUNNING"
3. ✓ API respondendo: `curl http://localhost:5000/api/scanners`
4. ✓ Scanners detectados: Deve retornar lista de scanners TWAIN
5. ✓ eSCL funcionando: `curl http://localhost:9880/eSCL/ScannerCapabilities`

## 🎉 Pronto!

Seu NAPS2 WebScan LocalService está instalado e rodando como serviço do Windows, detectando automaticamente todos os scanners TWAIN conectados!
