---
name: cotrimscan-developer
description: "Desenvolver, corrigir, revisar e testar funcionalidades no projeto CotrimScan (kaiocotrim/CotrimScan). Use quando a tarefa envolver a arquitetura Electron, React, TypeScript, Tailwind, digitalização, scanner, OCR, indexação, separação de documentos, PDFs, pastas de saída ou interface do CotrimScan. Também use para analisar implementações e planejar mudanças nesse projeto."
---

# CotrimScan Developer

Trabalhe no repositório CotrimScan com alterações pequenas, integradas e verificáveis. Responda ao usuário em português brasileiro.

## Procedimento

1. **Confira o contexto atual.** Localize a raiz do projeto, leia as instruções `AGENTS.md` aplicáveis, examine `git status --short` e identifique os arquivos relacionados à tarefa. Preserve mudanças preexistentes.
2. **Reaproveite o código.** Localize as implementações, utilitários, tipos, interfaces e testes existentes antes de criar novos módulos. Não pressuponha que o repositório ainda tenha a estrutura de uma análise anterior.
3. **Delimite a alteração.** Distinga explicação, análise, correção ou implementação. Quando o pedido for somente um prompt, revisão ou diagnóstico, não altere o projeto.
4. **Implemente de ponta a ponta, quando solicitado.** Integre a interface React ao processo principal do Electron, persistência, validação e exportação sempre que a funcionalidade exigir. Não entregue apenas uma simulação visual.
5. **Preserve compatibilidade.** Mantenha projetos e configurações antigos funcionando. Não substitua fluxos de digitalização, OCR, indexação, assinatura ou separação sem necessidade comprovada.
6. **Verifique.** Atualize/crie testes focados, execute os testes relevantes e o build pertinente. Se algo não puder ser executado, explique a limitação sem afirmar que passou.
7. **Entregue objetivamente.** Resuma o que mudou, onde mudou, quais verificações passaram e o que permanece pendente.

## Regras técnicas

- Respeite os limites de processo do Electron: não exponha acesso irrestrito ao sistema de arquivos ao renderer; use IPC/preload e valide entradas no processo principal.
- Preserve arquivos originais, dados de projetos, correções manuais do OCR e zeros à esquerda em identificadores como matrícula.
- Evite sobrescrever exportações, perder páginas, criar caminhos fora das pastas configuradas ou duplicar resultados em tentativas repetidas.
- Reutilize os tratamentos existentes de colisões, nomes seguros e gravação antes de expandi-los.
- Siga a identidade visual presente no código: interface minimalista, painéis organizados e componentes reutilizáveis. Não redesenhe telas fora do escopo.
- Não adicione bibliotecas nem refatore módulos inteiros sem ganho justificado para a tarefa.
- Não altere credenciais, dados de clientes nem configurações de produção; não inclua informações sensíveis em logs ou exemplos.
- Priorize comportamento real, acessibilidade básica e estados de carregamento/erro nas novas interfaces.
- Não faça push, publicação ou modificações externas sem pedido explícito.

## Guia de navegação

Se a tarefa envolver scanner, OCR, campos, exportação, nomenclatura, lotes ou tela de configuração, leia [references/architecture.md](references/architecture.md) antes de editar. O documento é um mapa inicial, não substitui conferir o código atual.

## Exemplos de solicitação

- "Use $cotrimscan-developer para implementar o nome dinâmico de PDFs por matrícula e contador."
- "Use $cotrimscan-developer para corrigir um erro na separação automática de lotes."
- "Use $cotrimscan-developer para melhorar a tela de revisão sem quebrar a digitalização."
