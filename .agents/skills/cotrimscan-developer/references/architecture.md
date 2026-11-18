# Mapa técnico do CotrimScan

Referência observada na versão `0b40151` (17/11/2026). **Reconfirme caminhos, APIs e restrições no checkout atual antes de editar.**

## Estrutura

| Camada | Pontos de entrada e responsabilidade |
| --- | --- |
| Interface | `apps/web/src/ui/ProjectEditor.tsx` (projetos e configurações); `CaptureEditor.tsx` (campos OCR); `CapturePanel.tsx` (revisão); `PreviewPanel.tsx` (exportação/visualização). |
| Desktop | `apps/desktop/src/main.cjs` (operações/IPC) e `preload.cjs` (API exposta à interface). |
| Projetos | `apps/desktop/src/projects.cjs`: validação, persistência local, páginas, captura, exportação e separação. |
| Indexação | `apps/desktop/src/capture.cjs` e `document-naming.cjs`: campos capturados, reconhecimento e nomeação. |
| Saídas | `apps/desktop/src/outputs.cjs`: destinos absolutos, gravação e proteção contra sobrescrita. |
| Documentos | `apps/desktop/src/document-separation.cjs` (agrupamento), `pdf.cjs` (geração), `documents.cjs` (processamento). |
| Tipos | `packages/shared/src/types.ts`: `Project`, `CaptureModel`, `CaptureData` e contratos do renderer. |
| Scanner | `packages/scan-core/`, `packages/scan-share/` e `apps/desktop/src/scan-agent.cjs`; preservar integração com dispositivos. |

## Comportamentos existentes a conferir

- `document-naming.cjs` aceita modos `default`, `ocr`, `qr` e `barcode`; possui sanitização de nomes, armazenamento por página e proteção contra colisão.
- `ProjectEditor.tsx` expõe modelo de captura e seleção de um campo OCR para nomenclatura. Ao criar configurações compostas, estenda o mecanismo em vez de duplicá-lo.
- `projects.cjs` salva o projeto e as páginas localmente; os dados de OCR revisados devem ser preservados nas exportações. O fluxo `outputPage` considera metadados de indexação.
- `document-separation.cjs` agrupa páginas por quantidade fixa ou separador de código de barras. Na versão observada, a validação restringia o uso simultâneo de separação e nomeação por código: investigue antes de combinar essas funções.
- `outputs.cjs` grava arquivos com proteção contra sobreposição; qualquer subpasta dinâmica precisa permanecer abaixo de uma pasta de saída autorizada.
- Algumas páginas podem ser exportadas como JPEG ou PDF; documentos agrupados são exportados em PDFs de várias páginas. Não assuma um formato único.

## Verificação

- Testes de desktop: `apps/desktop/test/document-naming.test.cjs`, `document-separation.test.cjs`, `outputs.test.cjs`, `projects.test.cjs` e `capture.test.cjs`.
- Testes de interface: `apps/web/test/`.
- Confira `package.json` e os scripts dos workspaces para executar testes e build adequados; o projeto usa npm workspaces/Turbo.

## Critérios de qualidade

Ao implementar uma funcionalidade, siga o caminho completo dos dados: **interface → preload/IPC → validação/persistência → processamento/exportação → teste**. Ajuste apenas as partes envolvidas; evite reescrever módulos saudáveis.
