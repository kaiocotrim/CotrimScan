====================================================
  NAPS2 WebScan LocalService - Guia de Instalacao
====================================================

INSTALACAO RAPIDA
==================

WINDOWS (Batch):
1. Clique com botao direito em "instalador.bat"
2. Selecione "Executar como administrador"
3. Escolha opcao 1 (Instalar como servico)
4. Escolha opcao 3 (Iniciar servico)

POWERSHELL:
1. Abra PowerShell como Administrador
2. Execute: .\instalador.ps1
3. Escolha opcao 1 (Instalar como servico)
4. Escolha opcao 3 (Iniciar servico)


VERIFICACAO
===========

1. Abra navegador em: http://localhost:5000/api/scanners
2. Deve retornar lista de scanners detectados

Ou use o instalador:
- Batch: opcao 5 (Verificar scanners)
- PowerShell: opcao 5 (Status do servico)


COMANDOS DISPONIVEIS
=====================

instalador.bat (Menu Interativo):
  1. Instalar como servico do Windows
  2. Desinstalar servico
  3. Iniciar servico
  4. Parar servico
  5. Verificar scanners disponiveis
  6. Abrir API no navegador
  0. Sair

instalador.ps1 (Menu Interativo):
  1. Instalar como servico do Windows
  2. Desinstalar servico
  3. Iniciar servico
  4. Parar servico
  5. Status do servico
  6. Ver logs
  0. Sair

instalador.ps1 (Linha de Comando):
  .\instalador.ps1 install     - Instalar servico
  .\instalador.ps1 uninstall   - Desinstalar servico
  .\instalador.ps1 start       - Iniciar servico
  .\instalador.ps1 stop        - Parar servico
  .\instalador.ps1 status      - Ver status
  .\instalador.ps1 logs        - Ver logs


ENDPOINTS DA API
================

API REST (porta 5000):
  GET  http://localhost:5000/api/scanners
  GET  http://localhost:5000/api/scanners/current
  POST http://localhost:5000/api/scanners/{id}/select

Protocolo eSCL (portas 9880+):
  Scanner 1: http://localhost:9880/eSCL/
  Scanner 2: http://localhost:9881/eSCL/
  Scanner 3: http://localhost:9882/eSCL/


TROUBLESHOOTING
===============

Scanners nao aparecem:
1. Verifique se os drivers TWAIN estao instalados
2. Teste o scanner no software nativo
3. Reinstale o servico (opcao 2 depois opcao 1)

Servico nao inicia:
1. Verifique se porta 5000 esta livre
2. Execute: netstat -ano | findstr 5000
3. Veja logs: opcao 6 (PowerShell) ou Event Viewer

Erro ao instalar:
1. Certifique-se de executar como Administrador
2. Verifique se .NET 8.0 Runtime esta instalado
3. Veja logs no Event Viewer


ARQUIVOS INCLUIDOS
==================

NAPS2.WebScan.LocalService.exe  - Executavel principal
instalador.bat                  - Instalador Windows (Batch)
instalador.ps1                  - Instalador PowerShell
README.md                       - Documentacao completa
API_DOCUMENTATION.md            - Documentacao da API
INSTALACAO_SERVICO.md           - Guia detalhado de instalacao
README_INSTALACAO.txt           - Este arquivo


DOCUMENTACAO COMPLETA
======================

Consulte README.md para documentacao completa incluindo:
- Arquitetura do sistema
- Exemplos de codigo (C#, TypeScript, PowerShell)
- Configuracao avancada
- Integracao com outros sistemas


REQUISITOS
==========

- Windows 10/11 ou Windows Server 2016+
- .NET 8.0 Runtime (https://dotnet.microsoft.com/download/dotnet/8.0)
- Drivers TWAIN dos scanners instalados
- Permissoes de Administrador para instalacao


PROXIMOS PASSOS
===============

Apos instalacao bem-sucedida:

1. Teste a API:
   curl http://localhost:5000/api/scanners

2. Acesse o WebServer (se disponivel):
   http://localhost:5154

3. Integre com seu sistema usando a API REST ou protocolo eSCL

4. Consulte API_DOCUMENTATION.md para exemplos de integracao


SUPORTE
=======

1. Verifique README.md na mesma pasta
2. Consulte INSTALACAO_SERVICO.md para troubleshooting detalhado
3. Execute servico em modo console para debug:
   NAPS2.WebScan.LocalService.exe
4. Verifique logs no Event Viewer:
   Aplicativos > NAPS2.WebScan Service


====================================================
Versao 2.0.0 - Sistema pronto para producao
====================================================
