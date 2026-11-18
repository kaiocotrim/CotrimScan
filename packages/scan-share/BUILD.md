# Como compilar - NAPS2 WebScan LocalService

Guia para gerar os pacotes de distribuição do LocalService para Windows (win-x64) e Linux (linux-x64).

## Pré-requisitos

- .NET 8 SDK (`dotnet --version` deve retornar 8.x).
- Windows: ferramentas de linha de comando do Windows (PowerShell 5.1 ou superior, ou `cmd`).
- Linux: bash, `curl` e o .NET 8 SDK instalado.

## Scripts de compilação

| Script | Plataforma | Saída | Observação |
|--------|-----------|-------|------------|
| `compilar.bat` | Windows (win-x64) | `dist\` | Framework-dependent. Limpa a pasta de saída anterior. |
| `compilar.ps1` | Windows (win-x64) | `dist\` | Parâmetros: `-SelfContained`, `-SingleFile`, `-OutputDir`. |
| `compilar.sh` | Linux (linux-x64) | `dist-linux/` | Opção: `--self-contained`. |

Os scripts copiam para a saída os arquivos de instalação e documentação necessários. A pasta de saída é recriada a cada execução.

### Windows

```bat
compilar.bat
```

```powershell
.\compilar.ps1
.\compilar.ps1 -SelfContained -SingleFile
```

O equivalente manual é:

```powershell
dotnet publish NAPS2.WebScan.LocalService.csproj -c Release -r win-x64 --self-contained false -o dist
```

### Linux

```bash
chmod +x compilar.sh instalador.sh deploy/linux/install.sh
./compilar.sh
./compilar.sh --self-contained
```

O equivalente manual é:

```bash
dotnet publish NAPS2.WebScan.LocalService.csproj -c Release -r linux-x64 --self-contained false -o dist-linux
```

> Use `chmod +x` após clonar o repositório no Linux. O Git no Windows não preserva a permissão de execução.

## Conteúdo do pacote

Windows (`dist\`):

```
NAPS2.WebScan.LocalService.exe
worker32\                       (worker TWAIN 32-bit)
instalador.bat / instalador.ps1
README.md, README_INSTALACAO.txt, LEIA-ME.txt
API_DOCUMENTATION.md, INSTALACAO_SERVICO.md, BUILD.md
appsettings.json e DLLs
```

Linux (`dist-linux/`):

```
NAPS2.WebScan.LocalService      (executável)
instalador.sh                   (menu e comandos do systemd)
install.sh                      (instalação da unit systemd)
naps2-webscan.service           (unit systemd)
appsettings.json e DLLs
```

## Tamanhos aproximados

| Modo | Tamanho | .NET no destino |
|------|---------|-----------------|
| Framework-dependent | ~5 MB | Necessário (.NET 8 Runtime) |
| Self-contained | ~60 MB | Não necessário |

## Distribuição

### Windows

```powershell
Compress-Archive -Path .\dist\* -DestinationPath NAPS2-WebScan-win-x64.zip
```

No destino: extrair o ZIP, executar `instalador.bat` como Administrador e usar as opções 1 (instalar) e 3 (iniciar).

### Linux

```bash
tar -czf NAPS2-WebScan-linux-x64.tar.gz -C dist-linux .
```

No destino: extrair, entrar na pasta e executar `sudo ./instalador.sh install` e depois `sudo ./instalador.sh start`.

## Verificação antes de distribuir

- [ ] Compilação concluída sem erros.
- [ ] `GET http://127.0.0.1:5000/api/scanners` responde após iniciar o serviço.
- [ ] Scanners aparecem na lista, com porta a partir de 9880.
- [ ] Pacote contém os arquivos de instalação e a documentação.

## Solução de problemas

- **SDK não encontrado**: instale com `winget install Microsoft.DotNet.SDK.8` (Windows) ou pelo gerenciador de pacotes da distribuição (Linux).
- **Arquivo em uso ao compilar (Windows)**: pare o serviço com `sc stop "NAPS2.WebScan Service"` ou finalize o processo `NAPS2.WebScan.LocalService.exe`.
- **Permissão negada (Linux)**: confirme que o script tem permissão de execução (`chmod +x`).
- **Erro de fim de linha (Linux)**: `$'\r': command not found` indica arquivo com CRLF. Converta com `sed -i 's/\r$//' compilar.sh`.




