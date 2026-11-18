# Instalação do serviço - NAPS2 WebScan LocalService

Este guia cobre a instalação, o controle e a verificação do LocalService como serviço do sistema, no Windows e no Linux.

## Pré-requisitos

**Windows**
- Windows 10/11 ou Windows Server 2016+.
- .NET 8 Runtime (não é necessário se o pacote foi gerado com `--self-contained`).
- Permissão de Administrador.
- Driver TWAIN do scanner instalado e funcionando no aplicativo nativo do fabricante.

**Linux**
- Distribuição com systemd.
- .NET 8 Runtime (ou pacote self-contained).
- SANE instalado (pacotes `sane-utils` e `libsane`). Confirme com `scanimage -L`.
- Permissão root (sudo).

## Windows

### Instalação pelo instalador (recomendado)

1. Gere o pacote com `compilar.bat` ou `compilar.ps1` (pasta `dist`), ou extraia o ZIP de distribuição.
2. Abra a pasta e execute `instalador.bat` como Administrador (botão direito, "Executar como administrador").
3. No menu, use a opção `1` (instalar) e depois a opção `3` (iniciar).

### Menu do `instalador.bat`

| Opção | Descrição |
|-------|-----------|
| 1 | Instalar como serviço do Windows |
| 2 | Desinstalar serviço |
| 3 | Iniciar serviço |
| 4 | Parar serviço |
| 5 | Listar scanners (consulta a API) |
| 6 | Mostrar endpoints da API |
| 0 | Sair |

### Menu do `instalador.ps1`

| Opção | Descrição |
|-------|-----------|
| 1 | Instalar como serviço do Windows |
| 2 | Desinstalar serviço |
| 3 | Iniciar serviço |
| 4 | Parar serviço |
| 5 | Status do serviço |
| 6 | Ver logs |
| 0 | Sair |

Linha de comando (PowerShell como Administrador, dentro da pasta `dist`):

```powershell
.\instalador.ps1 install
.\instalador.ps1 start
.\instalador.ps1 status
.\instalador.ps1 logs
.\instalador.ps1 stop
.\instalador.ps1 uninstall
```

### Instalação manual com `sc`

```powershell
cd C:\caminho\para\dist
sc.exe create "NAPS2.WebScan Service" binPath= "$PWD\NAPS2.WebScan.LocalService.exe" DisplayName= "NAPS2 WebScan Service" start= auto
sc.exe start "NAPS2.WebScan Service"
```

### Verificação (Windows)

```powershell
sc.exe query "NAPS2.WebScan Service"
curl.exe http://127.0.0.1:5000/api/scanners
```

Cada scanner listado tem uma porta eSCL a partir de 9880.

### Atualização (Windows)

1. Parar o serviço: `.\instalador.ps1 stop` (ou opção 4 do `instalador.bat`).
2. Substituir os arquivos da pasta de instalação pelos novos.
3. Iniciar o serviço: `.\instalador.ps1 start`.

### Desinstalação (Windows)

`.\instalador.ps1 uninstall` ou opção 2 do `instalador.bat`. Os arquivos da pasta de instalação não são removidos automaticamente.

## Linux

### Instalação pelo instalador (recomendado)

1. Gere o pacote na raiz de `packages/scan-share`:
   ```bash
   chmod +x compilar.sh instalador.sh deploy/linux/install.sh
   ./compilar.sh
   ```
2. Entre na pasta gerada e instale:
   ```bash
   cd dist-linux
   sudo ./instalador.sh install
   sudo ./instalador.sh start
   ```

`instalador.sh install` chama `install.sh`, que:

- cria o usuário de sistema `naps2scan` (se não existir), no grupo `scanner` e `lp`;
- copia os arquivos para `/opt/naps2-webscan`;
- instala a unit `/etc/systemd/system/naps2-webscan.service`;
- executa `systemctl daemon-reload` e `systemctl enable --now naps2-webscan`.

### Instalação manual

```bash
sudo ./install.sh /caminho/para/dist-linux
```

### Comandos do `instalador.sh`

| Comando | Descrição | Requer root |
|---------|-----------|-------------|
| `install` | Instala e habilita o serviço | Sim |
| `uninstall` | Para, desabilita e remove a unit e `/opt/naps2-webscan` | Sim |
| `start` | Inicia e aguarda a API responder | Sim |
| `stop` | Para o serviço | Sim |
| `status` | Mostra se está instalado, ativo e habilitado | Não |
| `logs` | Mostra as últimas 50 linhas do journal | Depende de permissão de journal |
| `scanners` | Consulta `http://127.0.0.1:5000/api/scanners` | Não |

Sem argumentos, o `instalador.sh` abre um menu com as mesmas ações (1 a 7 e 0 para sair).

### Permissões de acesso ao scanner

A unit roda como `naps2scan`, com os grupos suplementares `scanner` e `lp`. Se o scanner não aparecer:

```bash
sudo -u naps2scan scanimage -L
```

Se o grupo `scanner` não existir, instale `sane-utils` ou crie o grupo antes de instalar o serviço.

### Arquivos instalados (Linux)

| Caminho | Conteúdo |
|---------|----------|
| `/opt/naps2-webscan` | Binário e dependências |
| `/etc/systemd/system/naps2-webscan.service` | Unit systemd |
| `/var/lib/naps2-webscan/ports.json` | Mapeamento scanner-porta (mantido na desinstalação) |

### Verificação (Linux)

```bash
systemctl status naps2-webscan
journalctl -u naps2-webscan -n 50 --no-pager
curl http://127.0.0.1:5000/api/scanners
```

### Atualização (Linux)

```bash
cd dist-linux
sudo ./instalador.sh stop
sudo ./instalador.sh uninstall
sudo ./instalador.sh install
sudo ./instalador.sh start
```

O `ports.json` é preservado, então cada scanner mantém sua porta.

### Desinstalação (Linux)

```bash
sudo ./instalador.sh uninstall
```

Para remover também o mapeamento de portas: `sudo rm -rf /var/lib/naps2-webscan`.

## Configuração comum

- Endereço da API: `Urls` em `appsettings.json` (padrão `http://127.0.0.1:5000`).
- Arquivo de portas: `ScanShare:PortsFile` (ou variável de ambiente `ScanShare__PortsFile`). O padrão é `%ProgramData%\NAPS2.WebScan\ports.json` no Windows e `/var/lib/naps2-webscan/ports.json` no Linux.

## Solução de problemas

- **Serviço não inicia (Windows)**: confirme que `NAPS2.WebScan.LocalService.exe` existe na pasta de instalação e veja o Event Viewer (Aplicativo).
- **Serviço não inicia (Linux)**: `journalctl -u naps2-webscan -n 100`. Erro de grupo indica que `scanner` ou `lp` não existe.
- **Nenhum scanner aparece**: teste o driver no aplicativo do fabricante (Windows) ou `scanimage -L` (Linux). Depois use `POST /api/scanners/refresh`.
- **Porta 5000 em uso**: altere `Urls` no `appsettings.json` e reinicie o serviço.
