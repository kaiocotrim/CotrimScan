====================================================
  NAPS2 WebScan LocalService - Guia de Instalacao
====================================================

Este pacote expoe os scanners TWAIN via HTTP (API REST e eSCL).
Detalhes completos: INSTALACAO_SERVICO.md e API_DOCUMENTATION.md.


INSTALACAO RAPIDA (WINDOWS)
===========================

1. Clique com o botao direito em "instalador.bat" e escolha
   "Executar como administrador"
2. Digite 1 (instalar como servico) e pressione ENTER
3. Digite 3 (iniciar servico) e pressione ENTER

Ou via PowerShell (como Administrador, na pasta do pacote):

  .\instalador.ps1 install
  .\instalador.ps1 start


VERIFICACAO
===========

Abra no navegador: http://127.0.0.1:5000/api/scanners
Ou use a opcao 5 do instalador.bat.


COMANDOS DISPONIVEIS
=====================

instalador.bat (menu):
  1. Instalar como servico do Windows
  2. Desinstalar servico
  3. Iniciar servico
  4. Parar servico
  5. Listar scanners (consulta a API)
  6. Mostrar endpoints da API
  0. Sair

instalador.ps1 (menu):
  1. Instalar como servico do Windows
  2. Desinstalar servico
  3. Iniciar servico
  4. Parar servico
  5. Status do servico
  6. Ver logs
  0. Sair

instalador.ps1 (linha de comando):
  .\instalador.ps1 install     - Instalar servico
  .\instalador.ps1 uninstall   - Desinstalar servico
  .\instalador.ps1 start       - Iniciar servico
  .\instalador.ps1 stop        - Parar servico
  .\instalador.ps1 status      - Ver status
  .\instalador.ps1 logs        - Ver logs


ENDPOINTS DA API (127.0.0.1:5000)
=================================

  GET  /api/scanners            Lista os scanners
  GET  /api/scanners/{id}       Dados de um scanner
  GET  /api/scanners/count      Total de scanners
  POST /api/scanners/refresh    Atualiza a lista de scanners

Protocolo eSCL: cada scanner recebe uma porta a partir de 9880
(uma por scanner). Exemplo:

  http://127.0.0.1:9880/eSCL/ScannerCapabilities

As portas ficam salvas em %ProgramData%\NAPS2.WebScan\ports.json.


TROUBLESHOOTING
===============

Scanners nao aparecem:
1. Verifique se os drivers TWAIN estao instalados
2. Teste o scanner no software nativo do fabricante
3. Execute POST /api/scanners/refresh ou reinstale o servico

Servico nao inicia:
1. Verifique se a porta 5000 esta livre: netstat -ano | findstr 5000
2. Veja o Event Viewer (Aplicativo)

Erro ao instalar:
1. Execute como Administrador
2. Verifique se o .NET 8.0 Runtime esta instalado


Para Linux, use o pacote dist-linux gerado por compilar.sh (veja README.md).


ARQUIVOS INCLUIDOS
==================

NAPS2.WebScan.LocalService.exe   Executavel principal
instalador.bat                   Instalador Windows (Batch)
instalador.ps1                   Instalador Windows (PowerShell)
README_INSTALACAO.txt            Este guia
LEIA-ME.txt                      Resumo rapido
README.md                        Documentacao do projeto
API_DOCUMENTATION.md             Documentacao da API
INSTALACAO_SERVICO.md            Guia detalhado de instalacao e servico


REQUISITOS
==========

- Windows 10/11 ou Windows Server 2016+
- .NET 8.0 Runtime (ou pacote self-contained)
- Drivers TWAIN dos scanners instalados
- Permissao de Administrador para instalar o servico
