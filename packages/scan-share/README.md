# NAPS2 WebScan LocalService

Serviço local que detecta os scanners do sistema e os expõe via protocolo eSCL (compatível com AirPrint/eSCL) e por uma API REST. É um fork do NAPS2 WebScan baseado em NAPS2.Sdk 1.2.1 e é consumido pelo CotrimScan (`apps/desktop`, por meio de `packages/scan-core`).

## Recursos

- Enumera os scanners com o driver do sistema: **TWAIN** no Windows (com worker de 32 bits) e **SANE** no Linux.
- Expõe cada scanner em uma porta eSCL própria, a partir de **9880**. A atribuição é persistida em `ports.json`.
- API REST em `127.0.0.1:5000` para listar, consultar, reenumerar e contar scanners.
- Digitalização de múltiplas páginas pelo alimentador (ADF) e duplex, quando suportado pelo driver.
- Hospedagem como **Serviço do Windows** ou unidade **systemd** no Linux (`Type=notify`).
- CORS liberado para qualquer origem (`AllowAnyOrigin`) nas rotas REST e eSCL.

## Requisitos

- .NET 8 SDK para compilar e .NET 8 runtime para executar a publicação dependente de framework.
- Windows 10/11 x64 com o driver TWAIN do fabricante do scanner.
- Linux x64 com `libsane1` e `sane-utils`; `sane-airscan` é opcional, para scanners de rede. A execução em scanner físico no Linux ainda não foi validada.

## Estrutura

| Arquivo | Função |
| --- | --- |
| `Program.cs` | Hospedagem (Windows Service ou systemd), CORS e registro dos serviços |
| `Worker.cs` | `BackgroundService` que enumera os scanners ao iniciar e encerra o servidor ao parar |
| `Services/ScanShareHost.cs` | Escolhe o driver (`Twain` no Windows, `Sane` no Linux), registra os scanners e inicia um servidor eSCL por dispositivo |
| `Services/PortRegistryService.cs` | Associa cada scanner a uma porta a partir de 9880 e grava o mapa em `ports.json` |
| `Services/ScannerRegistryService.cs` | Mantém em memória a lista de scanners usada pela API |
| `Controllers/ScannersController.cs` | Rotas REST em `api/scanners` |
| `Models/ScannerModels.cs` | DTOs da API |
| `deploy/linux/` | `naps2-webscan.service` (unidade systemd) e `install.sh` |
| `compilar.ps1`, `compilar.bat`, `instalador.ps1`, `instalador.bat` | Build e instalação do serviço no Windows |

O arquivo de portas fica em `%ProgramData%\NAPS2.WebScan\ports.json` no Windows e em `/var/lib/naps2-webscan/ports.json` no Linux. Para usar outro caminho, configure `ScanShare:PortsFile`.

## Instalação

### Windows

Gere a pasta de distribuição com `.\compilar.ps1` (ou `compilar.bat`) e, como administrador, use `.\instalador.ps1` (ou `instalador.bat`) para instalar, iniciar, parar, consultar o status e ver os logs do serviço **NAPS2.WebScan Service**. Detalhes na seção [Scripts](#scripts).

Instalação manual, a partir de `packages/scan-share`:

```powershell
dotnet publish -c Release -r win-x64 --self-contained false -o .\publish\win-x64
sc.exe create "NAPS2.WebScan Service" binPath= "C:\caminho\completo\publish\win-x64\NAPS2.WebScan.LocalService.exe" start= auto
sc.exe start "NAPS2.WebScan Service"
```

### Linux

Forma recomendada: gere o pacote com `./compilar.sh` e instale com `instalador.sh` (seção [Scripts](#scripts)).

Instalação manual, a partir de `packages/scan-share`:

```sh
sudo apt install -y libsane1 sane-utils sane-airscan
dotnet publish -c Release -r linux-x64 --self-contained false -o publish/linux-x64
sudo ./deploy/linux/install.sh publish/linux-x64
sudo systemctl start naps2-webscan
```

O `install.sh` cria o usuário de serviço `naps2scan`, copia os arquivos para `/opt/naps2-webscan` e instala a unidade `naps2-webscan.service`, que inclui o grupo `scanner` para acesso a scanners USB. Comandos úteis:

```sh
sudo systemctl status naps2-webscan
sudo journalctl -u naps2-webscan -f
```

### Desenvolvimento

Na raiz do repositório, `npm run dev` inicia este serviço junto com a interface web. Também é possível executar diretamente:

```sh
dotnet run --project NAPS2.WebScan.LocalService.csproj
```

Ao executar manualmente no Linux com um usuário comum, aponte o arquivo de portas para um caminho gravável:

```sh
ScanShare__PortsFile=/tmp/naps2-ports.json dotnet run --project NAPS2.WebScan.LocalService.csproj
```

Para conferir os scanners, use `curl.exe http://127.0.0.1:5000/api/scanners` no Windows ou `curl http://127.0.0.1:5000/api/scanners` no Linux. No Linux, `scanimage -L` lista os dispositivos SANE diretamente.

## Scripts

Todos os scripts ficam em `packages/scan-share`. Os de Windows geram `dist\`; os de Linux geram `dist-linux/`.

| Script | Plataforma | Função |
| --- | --- | --- |
| `compilar.bat` | Windows | Publica win-x64 dependente de framework em `dist\` |
| `compilar.ps1` | Windows | Mesma publicação, com opções `-SelfContained`, `-SingleFile` e `-OutputDir` |
| `compilar.sh` | Linux | Publica linux-x64 em `dist-linux/`; opção `--self-contained` |
| `instalador.bat` | Windows | Menu: instalar, desinstalar, iniciar, parar, listar scanners e abrir a API |
| `instalador.ps1` | Windows | Menu ou comando: `install`, `uninstall`, `start`, `stop`, `status`, `logs` |
| `instalador.sh` | Linux | Menu ou comando: `install`, `uninstall`, `start`, `stop`, `status`, `logs`, `scanners` |
| `deploy/linux/install.sh` | Linux | Chamado pelo `instalador.sh`; cria o usuário `naps2scan`, copia os arquivos e instala a unit systemd |

### Windows

Execute os scripts de compilação e instalação em um terminal como administrador, dentro de `packages/scan-share`:

```powershell
.\compilar.bat
.\compilar.ps1 -SelfContained -SingleFile -OutputDir dist

cd dist
.\instalador.ps1 install
.\instalador.ps1 start
.\instalador.ps1 status
.\instalador.ps1 logs
```

Sem argumentos, `instalador.bat` e `instalador.ps1` abrem o menu interativo. Os dois instalam o mesmo serviço, **NAPS2.WebScan Service**.

### Linux

Os scripts `.sh` precisam de permissão de execução e de finais de linha LF. Após clonar o repositório em Windows, o Git pode não manter o `chmod +x`; por isso rode o `chmod` no Linux:

```sh
chmod +x compilar.sh instalador.sh deploy/linux/install.sh

./compilar.sh                    # dependente do .NET 8 runtime
./compilar.sh --self-contained   # inclui o runtime

cd dist-linux
sudo ./instalador.sh install
sudo ./instalador.sh start
./instalador.sh status           # não exige root
./instalador.sh scanners         # não exige root
```

Rode `./instalador.sh` sem argumentos para abrir o menu. `uninstall` remove a unit e `/opt/naps2-webscan`, mas mantém `/var/lib/naps2-webscan/ports.json`. Para ajuda de qualquer script, use `-h`.

## API REST

**Base URL:** `http://127.0.0.1:5000` (configurável por `Urls`). A API não tem autenticação e, na configuração padrão, só aceita conexões locais.

### Listar scanners
```http
GET /api/scanners
```

**Resposta:**
```json
[
  {
    "id": "Canon DR-C240",
    "name": "Canon DR-C240",
    "port": 9880,
    "registeredAt": "2026-02-27T10:00:00Z"
  }
]
```

### Consultar um scanner
```http
GET /api/scanners/{id}
```

Retorna o scanner correspondente ao `id` ou 404, se não existir.

### Quantidade de scanners
```http
GET /api/scanners/count
```

### Reenumerar scanners
```http
POST /api/scanners/refresh
```

Enumera os dispositivos novamente, reinicia os servidores eSCL e interrompe digitalizações em andamento. Use depois de conectar ou remover um scanner.

Veja [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) para detalhes das rotas e do protocolo eSCL.

## Protocolo eSCL

Cada scanner registrado recebe sua própria porta eSCL, atribuída a partir de **9880** e persistida por id do dispositivo. Por exemplo:

```
Scanner A → http://127.0.0.1:9880/eSCL/
Scanner B → http://127.0.0.1:9881/eSCL/
```

### Endpoints eSCL

```http
GET  /eSCL/ScannerCapabilities        # Capacidades do scanner
GET  /eSCL/ScannerStatus              # Status atual
POST /eSCL/ScanJobs                   # Criar job de digitalização
GET  /eSCL/ScanJobs/{id}              # Status do job
GET  /eSCL/ScanJobs/{id}/NextDocument # Próxima página digitalizada
```

Os servidores eSCL aceitam qualquer origem (`EsclSecurityPolicy.ServerAllowAnyOrigin`).

## Arquitetura

```
Worker (BackgroundService)
  └── ScanShareHost
        ├── Controlador NAPS2 (driver Twain no Windows, Sane no Linux) → enumera os scanners
        ├── PortRegistryService → porta por dispositivo (9880+), persistida em ports.json
        ├── ScannerRegistryService → lista exposta pela API REST
        └── Servidor eSCL (uma porta por scanner)

ScannersController (REST, 127.0.0.1:5000) → ScannerRegistryService
```

A escolha do driver é feita em tempo de execução: `OperatingSystem.IsWindows() ? Driver.Twain : Driver.Sane`. O mesmo binário publicado para `win-x64` e `linux-x64` contém os dois caminhos.

## Configuração

### appsettings.json

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.Hosting.Lifetime": "Information"
    }
  },
  "Urls": "http://127.0.0.1:5000"
}
```

| Chave | Padrão | Descrição |
| --- | --- | --- |
| `Urls` | `http://127.0.0.1:5000` | Endereço da API REST |
| `ScanShare:PortsFile` | Windows: `%ProgramData%\NAPS2.WebScan\ports.json`; Linux: `/var/lib/naps2-webscan/ports.json` | Arquivo com a associação dispositivo → porta |

Qualquer chave pode ser sobrescrita por variável de ambiente, usando `__` como separador (por exemplo, `ScanShare__PortsFile`).

A porta inicial dos scanners eSCL é 9880 (constante `BasePort` em `Services/PortRegistryService.cs`). Alterá-la exige recompilar o serviço.

## Solução de problemas

### Nenhum scanner aparece

- **Windows:** confirme que o software do fabricante reconhece o scanner e que o driver TWAIN está instalado. O serviço usa um worker TWAIN de 32 bits; verifique os logs de erro se a enumeração falhar.
- **Linux:** execute `scanimage -L` como o usuário do serviço (`sudo -u naps2scan scanimage -L`). Confira também se o backend está habilitado em `/etc/sane.d/dll.conf`.
- Depois de conectar ou trocar um scanner, chame `POST /api/scanners/refresh` ou reinicie o serviço.

Para reiniciar:

```powershell
sc.exe stop "NAPS2.WebScan Service"
sc.exe start "NAPS2.WebScan Service"
```

```sh
sudo systemctl restart naps2-webscan
```

### Porta 5000 em uso

Altere `Urls` no `appsettings.json`. O CotrimScan usa `FORK_URL` (`http://127.0.0.1:5000`) em `packages/scan-core/src/escl-client.cjs`; atualize também esse valor.

### Erro ao gravar ports.json

Em execução manual no Linux, use `ScanShare__PortsFile` apontando para um caminho gravável. Quando o arquivo está corrompido, o serviço ignora o conteúdo e recria o mapa.

### Logs

```powershell
# Windows: Event Viewer > Logs de Aplicativo, origem "NAPS2.WebScan Service"
Get-EventLog -LogName Application -Source "NAPS2.WebScan Service" -Newest 20
```

```sh
# Linux
sudo journalctl -u naps2-webscan -f
```

## Segurança

- A API REST escuta em `127.0.0.1` e não tem autenticação.
- CORS com `AllowAnyOrigin` nas rotas REST e nos servidores eSCL. Isso é adequado para uso local; restrinja a política em `Program.cs` se o serviço for exposto à rede.
- Windows: o serviço roda, por padrão, com a conta LocalSystem. Linux: o serviço roda com o usuário dedicado `naps2scan`.

## Requisitos de sistema

- .NET 8 runtime.
- Windows 10/11 x64 com drivers TWAIN, ou Linux x64 com systemd e SANE.
- Permissão de administrador para instalar o serviço no Windows, e `sudo` para instalar no Linux.

## Integração

O CotrimScan consome a API em `packages/scan-core/src/escl-client.cjs`: `listDevices` lê `GET /api/scanners` e `refreshDevices` chama `POST /api/scanners/refresh`. A digitalização usa o protocolo eSCL na porta de cada scanner.

```typescript
const scanners = await (await fetch('http://127.0.0.1:5000/api/scanners')).json();
await fetch('http://127.0.0.1:5000/api/scanners/refresh', { method: 'POST' });
```

## Documentação

- [API_DOCUMENTATION.md](./API_DOCUMENTATION.md): rotas REST e eSCL, com exemplos de uso.
- [INSTALACAO_SERVICO.md](./INSTALACAO_SERVICO.md): instalação, controle e verificação do serviço no Windows e no Linux.
- [BUILD.md](./BUILD.md): compilação, publicação e distribuição.
- [LEIA-ME.txt](./LEIA-ME.txt) e [README_INSTALACAO.txt](./README_INSTALACAO.txt): resumo e guia rápido que acompanham o pacote Windows.

## Licença

Este projeto usa o NAPS2 SDK, distribuído sob a licença LGPL.
