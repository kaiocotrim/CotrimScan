# CotrimScan — versão inicial

App Electron para Windows e Linux que acessa o serviço NAPS2 WebScan em `127.0.0.1`. Inclui teste de conexão, resolução, vidro/alimentador, prévias e salvamento de páginas em JPEG ou PDF assinado por certificado digital. A escolha do scanner é feita pela porta do serviço; não há descoberta automática nem seleção de dispositivos físicos nesta versão.

## Executar
Instale Node.js 22 ou superior e, nesta pasta, execute:

```sh
npm install
npm start
```

O serviço local deve estar ativo antes de digitalizar. Projeto original: https://github.com/cyanfish/naps2-webscan

**Windows:** compile e configure `NAPS2.WebScan.LocalService` do projeto original. Ele usa o primeiro dispositivo WIA e a porta 9880. Este app não instala nem inicia esse serviço automaticamente.

**Linux:** a interface Electron é preparada para Linux, mas o serviço original usa WIA, exclusivo do Windows. É necessário adaptar o serviço com NAPS2.Sdk para um driver compatível, como SANE, e expor a API eSCL na máquina local. Esse serviço Linux não está incluído nem validado nesta entrega. Não basta executar o serviço WIA no Linux.

O nome exibido no aplicativo e nos instaladores é **CotrimScan**. O identificador interno e a pasta de dados `naps2-desktop` são mantidos para preservar contas e projetos existentes.

## Login local

Na primeira abertura, crie um usuário (3 a 40 letras, números, pontos, traços ou sublinhados) e uma senha de 8 a 256 caracteres. Esta versão tem uma conta por perfil local do aplicativo, sem internet, cadastro remoto ou recuperação automática de senha. Ao reabrir o aplicativo, faça login novamente. O usuário aceita maiúsculas ou minúsculas; a senha diferencia maiúsculas e minúsculas.

A conta é salva em `account.json` no diretório `userData` do Electron. A senha é armazenada com salt aleatório e hash scrypt, sem texto puro. Após cinco tentativas incorretas, novas tentativas são bloqueadas por 30 segundos durante a execução atual. O login é exigido também nas operações internas de conexão, digitalização, limpeza e salvamento.

O botão **Sair** encerra a sessão e limpa as páginas da memória. As páginas já recebidas ficam salvas no projeto local. Aguarde operações em andamento antes de encerrar a sessão. Esse login controla o acesso pelo aplicativo; não adiciona autenticação ao serviço eSCL nem protege contra pessoas com controle dos arquivos do computador.

Se o Electron falhar com conflito Wayland/Vulkan no Linux, tente:

```sh
npm start -- --ozone-platform=x11
```

Se necessário, acrescente `--disable-gpu` ao comando.

## Projetos

Depois do login, a tela **Meus projetos** mostra pastas azuis com o nome acima. Use **Novo projeto** para cadastrar o nome, porta, resolução, origem, cor do documento e pastas de saída. O editor tem formato horizontal amplo, dividido entre digitalização, destinos e certificado digital, com rolagem em janelas menores. O lápis edita essas opções. Um clique seleciona a pasta; dois cliques abrem o projeto. Pelo teclado, use Tab e Enter para abrir.

Cada projeto guarda suas configurações e páginas JPEG no diretório `projects` dentro do `userData` do Electron. Uma página só é exibida depois de ser salva no projeto. Ao voltar em **Projetos**, sair ou reabrir o aplicativo, as páginas permanecem disponíveis. **Salvar JPEG** exporta uma cópia para o local escolhido. Com certificado ativado, esse botão passa a **Salvar PDF assinado**. Na tela de revisão, escolha uma miniatura para ver a página em tamanho maior. Use as caixas de seleção ou Ctrl/Cmd + clique para selecionar várias páginas. **Excluir selecionadas** (ou a tecla Delete) pede confirmação e remove somente essas páginas do projeto, mantendo cópias já exportadas. **Selecionar todas** permite excluir todas as páginas de uma vez. As pastas da interface representam projetos locais do aplicativo.

### Cor e pastas de saída

Escolha **Colorido**, **Tons de cinza** ou **Preto e branco** no editor do projeto. A tela de revisão usa automaticamente as configurações salvas de porta, resolução, origem e cor; esses campos não aparecem na área de documentos. O modo é persistido no projeto e enviado ao serviço eSCL como `RGB24`, `Grayscale8` ou `BlackAndWhite1`. O suporte efetivo ao modo e ao retorno em JPEG depende do serviço e do driver; não há conversão local como alternativa. [Referência dos modos de cor](https://learn.microsoft.com/en-us/windows-hardware/drivers/image/colorentry).

Em **Pastas de saída**, use **Adicionar pasta de saída** para escolher diretórios no computador ou **Digitar um caminho** para informar um caminho completo. Adicione e remova quantas saídas precisar. Os diretórios precisam existir e permitir gravação; caminhos de rede precisam estar acessíveis. Uma pasta repetida é considerada apenas uma vez.

A cada digitalização, o aplicativo preserva a imagem original no projeto e salva uma cópia JPEG em cada saída quando a assinatura está desativada. Com certificado ativado, as saídas recebem somente o PDF assinado. Os arquivos são nomeados `pagina-<identificador único>.jpg`, sem sobrescrever arquivos existentes. Se uma saída falhar durante a gravação, a página permanece no projeto e o aplicativo informa a pasta com problema. **Enviar para saídas** envia todas as páginas existentes aos destinos atuais e permite repetir uma tentativa sem duplicar os mesmos arquivos. Nenhuma saída configurada mantém apenas a cópia no projeto. Excluir páginas do projeto não apaga cópias das saídas.

## Conectar celular pela rede local

1. Abra um projeto e clique em **Conectar celular** na tela de revisão.
2. Escolha a interface de rede do computador e clique em **Gerar QR Code**. Celular e computador precisam estar na mesma rede, com comunicação entre dispositivos permitida. O computador também pode estar conectado por cabo à mesma rede Wi-Fi do telefone.
3. Leia o QR Code com a câmera do celular e abra a página no navegador. Nenhum aplicativo de celular precisa ser instalado.
4. No telefone, informe um nome e solicite a conexão. Compare o código de seis dígitos nas duas telas e clique em **Permitir conexão** no computador.
5. Use **Tirar foto** ou **Escolher imagens**, confira a fila e clique em **Enviar**. As páginas são acrescentadas ao projeto na ordem de envio, junto das páginas do scanner, sem atualizar a tela.

Cada conexão permite um celular aprovado. O QR Code expira em cinco minutos e deixa de aceitar novos pareamentos assim que um aparelho é aprovado; solicitações pendentes expiram em dois minutos. O celular é desconectado após 30 minutos sem enviar imagens ou duas horas de conexão. **Encerrar conexão**, gerar outro QR, trocar/fechar o projeto, sair da conta ou fechar o aplicativo revoga o acesso e encerra o servidor. Fechar apenas a janela do QR mantém a conexão ativa. **Copiar link** permite abrir o mesmo endereço temporário no telefone.

São aceitos JPEG, PNG e WebP estáticos, até 20 MB e 40 megapixels por imagem. O celular mantém até 50 imagens na fila; a conexão aceita até 200 envios. As fotos são validadas pelo conteúdo, têm a orientação EXIF corrigida e os metadados removidos, mantêm a resolução original dentro do limite de 40 megapixels e são convertidas em JPEG. O modo colorido, cinza ou preto e branco do projeto é aplicado à foto recebida. HEIC, PDF, SVG, GIF e imagens animadas não são aceitos. A abertura da câmera depende do navegador/sistema; a seleção da galeria é a alternativa.

Os originais normalizados ficam no projeto e seguem as mesmas pastas de saída e assinatura configuradas. Gerar o QR e conectar o celular não solicitam senha do certificado. A assinatura reutiliza a liberação feita na configuração do projeto durante a sessão; a senha e a chave privada nunca são enviadas ao telefone. Se o certificado não estiver liberado, a foto ainda é recebida e preservada, com aviso de que a assinatura/exportação ficou pendente. Se houver falha de saída ou assinatura depois do recebimento, a página permanece no projeto, o telefone informa o problema e o computador mostra o detalhe. **Enviar para saídas** permite tentar novamente. Uma repetição do mesmo envio na mesma conexão não cria outra página.

O servidor só inicia após a ação do usuário, escuta um IPv4 privado selecionado, em uma porta temporária, e não publica listas de projetos ou arquivos do computador. Há credenciais temporárias, aprovação no computador, verificação de origem/host, limite de tamanho e recebimento serial. A transferência usa **HTTP sem criptografia**, apenas em rede local de confiança. Não funciona pela internet, 4G/5G ou redes isoladas; não há servidor na nuvem, encaminhamento de portas ou alteração automática do firewall. No Windows, permita o CotrimScan apenas na rede privada quando solicitado. Redes de convidados e isolamento entre clientes podem bloquear a conexão.

No Linux, a conversão usa um processo separado do **Node.js 22 ou superior**, disponível pelo comando `node`, para evitar o conflito conhecido de GLib entre Electron e Sharp. Isso também é necessário para receber fotos na versão AppImage/deb. No Windows, o aplicativo empacotado usa o runtime do próprio Electron. Os auxiliares e dependências nativas são incluídos nos padrões de `asarUnpack`. Referência: [Sharp com Electron/Linux](https://sharp.pixelplumbing.com/install/#electron-and-linux).

A interface do computador recebe as páginas por IPC do Electron; o telefone usa HTTP para envio e consulta o estado do pareamento. Nenhum serviço externo é necessário. As fotos recebidas passam pelo jscanify para detectar a folha, recortar as bordas e corrigir a perspectiva antes da assinatura e das saídas. Se o contorno não passar nas verificações de geometria e tamanho, o enquadramento completo é mantido. O processamento é local, sem serviços externos. Fotos antigas não são reprocessadas. O botão **Reconhecer texto (OCR)** usa Tesseract.js com dados locais de português. Depois do OCR, **Salvar PDF pesquisável** (ou **Salvar PDF assinado**, em projetos com certificado) e **Enviar para saídas** exportam a página com texto pesquisável. Girar ou melhorar a página invalida o OCR anterior: execute-o novamente após as edições. Manuscritos, nomes e números precisam de revisão. PDF de várias páginas continua fora desta primeira versão.

## Certificado digital por projeto

Na terceira área do editor, escolha **Sem assinatura digital**, **A1** ou **A3**. O formato assinado é **um PDF por página**. Marque **Mostrar carimbo visual no PDF assinado** para incluir titular e data em uma faixa acima do documento, sem cobrir a imagem. O carimbo é apenas uma indicação visual; a assinatura criptográfica é incorporada ao PDF antes de qualquer envio às pastas de saída. As imagens JPEG originais permanecem no projeto. Uma falha na assinatura preserva a imagem local e interrompe a digitalização; nenhuma cópia JPEG sem assinatura é enviada como alternativa.

**A1:** selecione o arquivo `.pfx` ou `.p12` e informe a senha na configuração do projeto. O certificado é validado ao salvar; uma senha incorreta impede o salvamento. O projeto guarda apenas o caminho; mantenha o arquivo acessível. Marque **Lembrar senha neste computador** para liberar o certificado automaticamente nas próximas sessões. A senha é gravada separadamente do projeto, criptografada pela proteção de credenciais do sistema; essa opção só funciona quando o armazenamento seguro está disponível. Sem ela, informe a senha novamente depois de sair ou reabrir o aplicativo. O arquivo deve conter uma chave privada RSA e seu certificado compatível, dentro da validade. A senha não é gravada no projeto, argumentos de processo nem logs. Arquivos com chave ECDSA não são suportados nesta implementação.

**A3:** disponível no Windows 10/11 com Windows PowerShell 5.1 e driver do fabricante que publique o certificado e a chave no repositório pessoal do usuário (`CurrentUser/My`). Conecte o token/cartão, clique em **Buscar certificados do Windows** e selecione o certificado correspondente. A lista também pode conter A1 instalados nesse repositório; o usuário escolhe o certificado do token. A assinatura usa o provedor criptográfico do Windows, que pode solicitar o PIN, sem exportar a chave privada. Tokens disponíveis somente por PKCS#11, sem integração ao repositório do Windows, não são suportados. A3 não está implementado para Linux nesta versão.

Os PDFs usam CMS/PKCS#7 destacado com SHA-256 (`adbe.pkcs7.detached`). A aplicação não faz validação da cadeia ICP-Brasil/revogação nem inclui carimbo do tempo, DSS ou conformidade PAdES de longo prazo. Não equivale a uma homologação ICP-Brasil. A validade de confiança precisa ser avaliada pelo verificador de assinaturas e pelo certificado utilizado. Referências técnicas: [node-signpdf](https://github.com/vbuch/node-signpdf), [assinatura CMS do Windows e solicitação de PIN](https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.pkcs.signedcms.computesignature?view=windowsdesktop-9.0).

O PDF assinado é preservado no projeto para repetir envios sem alterar sua assinatura ou duplicar o arquivo. Os nomes incluem um identificador da página e da configuração de certificado. Excluir uma página remove seu original e seus PDFs assinados internos; cópias já exportadas continuam nas pastas de saída.

## Gerar pacotes

```sh
npm run dist:win
npm run dist:linux
```

Gere preferencialmente o instalador Windows no Windows e os pacotes Linux no Linux. Os arquivos serão criados em `dist/`. A entrega é código-fonte, sem instaladores compilados ou assinatura de código dos instaladores.

## Validação e limites

`npm test` verifica o cliente eSCL com respostas HTTP simuladas, incluindo páginas do alimentador e falhas. Os testes incluem criação e persistência da conta, login, encerramento de sessão, limitação de tentativas e bloqueio das operações internas sem autenticação. A tela de projetos e o editor foram conferidos visualmente no Chrome, com APIs simuladas, incluindo clique simples, duplo clique, criação, edição e navegação. A persistência e o bloqueio das operações sem login foram testados com arquivos temporários. O A1 foi testado com certificado RSA fictício, incluindo senha incorreta, verificação criptográfica da assinatura, rejeição de conteúdo alterado, descarte da sessão e ausência de senha no projeto. O PDF foi renderizado e conferido, e a assinatura foi reconhecida como válida pelo `pdfsig`. O caminho A3 foi testado por adaptador simulado; não houve teste real no Windows ou em token físico. O pareamento foi testado com HTTP real em loopback, incluindo recusa, expiração, origem/host, limite de upload, envio repetido e encerramento. O navegador móvel foi simulado no Chrome com envio JPEG/PNG e persistência real; o QR e a aprovação no desktop foram conferidos visualmente em duas resoluções. A normalização foi executada no runtime do Electron/Linux, usando o auxiliar isolado. Não houve teste com celular físico, Wi-Fi/firewall real, captura pela câmera ou empacotamento Windows/Linux nesta validação. Nenhum scanner físico foi usado na validação. A compatibilidade com modelos, resoluções e alimentadores depende do serviço e dos drivers. PDF com várias páginas por trabalho, cancelamento durante a digitalização não estão implementados. Limite de 200 páginas por trabalho; as páginas ficam salvas no projeto e são carregadas na memória quando ele é aberto.

A interface usa isolamento de contexto, sem acesso direto ao Node.js. Conexões são restritas ao próprio computador e redirecionamentos HTTP são recusados.

## Qualidade da digitalização

O seletor na revisão oferece **Automático profissional** (padrão), **Documento colorido**, **Escala de cinza** e **Preto e branco**. O mesmo padrão pode ser definido no editor do projeto. No scanner físico, o modo automático solicita captura colorida; o botão **Melhorar PDF** aplica o tratamento da imagem recebida. Nas fotos do celular, o processamento é aplicado no recebimento.

O pipeline usa jscanify na detecção da folha, transformação de perspectiva, máscara externa quando necessária e correção de iluminação em luminância Lab com OpenCV.js. A estimativa de fundo utiliza fechamento morfológico e suavização; o contraste local usa CLAHE com limite baixo e mistura moderada. O automático estima o tom do papel sem neutralizar tinta saturada. O colorido mantém os componentes de cor; o preto e branco usa limiarização adaptativa. A saída usa Sharp com nitidez moderada e JPEG 97, 4:4:4. O PDF incorpora esse JPEG sem recompressão adicional.

**Comparar original** abre as imagens lado a lado. A partir desta versão, o projeto conserva o arquivo recebido em um auxiliar `.source`; trocar de modo reprocessa essa referência, sem acumular filtros. A correção manual usa a mesma referência. Os originais de imagens sobrescritas por versões antigas não podem ser recuperados: para essas páginas, a primeira referência é a imagem que ainda existe no projeto. A rotação acompanha a referência. Excluir a página também remove seu auxiliar interno, mantendo exportações anteriores.

Melhorar ou girar invalida o OCR e o PDF assinado anterior da página; execute o OCR novamente, se necessário. Uma nova exportação é assinada novamente. Páginas melhoradas podem ser exportadas em PDF mesmo sem certificado.

O tratamento não recupera texto desfocado, oculto por dedos ou perdido por reflexos. Papel curvado pode manter ondulações; use **Ajustar recorte** quando a detecção não produzir o enquadramento desejado. Fotografe a folha plana, com todas as bordas visíveis. O modo automático é recomendado para preservar canetas coloridas e traços claros.

Para repetir a revisão visual sem modificar projetos: `node scripts/review-scan-quality.cjs DIRETORIO_DE_SAIDA FOTO1 FOTO2`. O utilitário grava comparações, PDFs e métricas indicativas do fundo. As métricas não substituem a inspeção dos textos, assinaturas e códigos.

### Simplex e duplex

No editor do projeto, **Lados da digitalização** permite escolher **Simplex · Somente frente** ou **Duplex · Frente e verso**. A escolha é salva por projeto; projetos antigos continuam em simplex. Duplex usa o alimentador, envia `scan:Duplex=true` ao serviço e recebe as faces no mesmo trabalho, na ordem devolvida pelo driver. A disponibilidade depende do scanner e do driver. No vidro, a interface seleciona simplex e desabilita o campo. Os documentos enviados pelo celular não são afetados por essa opção.

### Revisar e editar OCR

Após **Reconhecer texto (OCR)**, o documento fica à esquerda e um editor de texto à direita. Use **Salvar correções** para persistir a revisão por página. Ao reabrir o projeto, **Revisar texto (OCR)** mostra a revisão salva, sem repetir o reconhecimento nem substituir as correções. Rascunhos de diferentes páginas são mantidos durante a revisão; sair do projeto ou da conta avisa sobre alterações não salvas.

Salvar o PDF ou enviar para as saídas também salva as correções pendentes. A camada de texto pesquisável é atualizada, mantendo os mesmos bytes JPEG da imagem. Edições livres são organizadas por linha nessa camada invisível; a fotografia, os campos impressos e as assinaturas desenhadas não são modificados. O próximo PDF assinado recebe uma nova assinatura sobre a revisão; exportações anteriores não são sobrescritas.

### Nomear arquivos por QR Code ou código de barras

Em **Editar projeto > Nome dos arquivos**, escolha **Nome padrão**, **Ler QR Code** ou **Ler código de barras**. A configuração é independente para cada projeto; projetos existentes e novos começam com nome padrão. A escolha vale para scanner, fotos do celular, **Enviar para saídas** e o nome sugerido no salvamento manual.

A leitura local usa ZXing-C++/WebAssembly (`zxing-wasm`), com os arquivos WASM incluídos na instalação, sem serviço externo. O leitor procura apenas o tipo escolhido. No modo barras, suporta os formatos lineares do leitor, incluindo Code 128, Code 39, EAN e UPC. O original preservado é consultado primeiro, com tentativa na imagem atual quando necessário. O leitor executa em processo separado e tem limite de tempo.

Um conteúdo como `0019295` gera `0019295.pdf` ou `0019295.jpg`, conforme o formato atual do documento; zeros à esquerda são preservados. Links e caracteres que não podem compor um nome de arquivo são adaptados para um nome válido. O conteúdo não é executado nem acessado como endereço da internet.

Se não houver leitura válida, ou se houver valores diferentes do mesmo tipo na página, a exportação usa o nome padrão e mostra um aviso. A página permanece no projeto. Para documentos distintos com o mesmo código, ou arquivos diferentes já existentes na pasta de saída, são usados sufixos como `0019295-2.pdf`. O nome é reservado por página e mantido nos reenvios, evitando duplicação dos mesmos arquivos. Todas as saídas usam o mesmo nome; arquivos anteriores não são sobrescritos automaticamente. A assinatura permanece incorporada ao PDF quando configurada.

### Zoom e lupa na revisão

A barra **Zoom** permite ampliar ou reduzir a prévia, escolher porcentagens de 10% a 400%, exibir **100% · Tamanho original** ou **Ajustar à tela**. Depois de ampliar, arraste a imagem para navegar. **Ctrl + rolagem** amplia a região sob o ponteiro. Com o foco na prévia, use `+`, `-` e `0` (ajustar). Um clique duplo alterna entre tamanho original e ajuste à tela.

**Lupa 3×** ativa uma janela circular que acompanha o ponteiro sobre a imagem. A ampliação usa o mesmo documento carregado, sem processá-lo novamente. A lupa some ao sair da imagem ou rolar a prévia. O zoom funciona também com o editor de OCR aberto; seus atalhos não alteram o texto digitado. Ao selecionar outra imagem, a prévia volta ao ajuste à tela. Os controles não modificam a imagem salva nem a qualidade do PDF exportado.
# Canhotos e comprovantes pequenos

Em **Editar projeto → Tipo de documento**, selecione **Canhoto / comprovante pequeno**. O recorte e a melhoria são aplicados a cada página recebida do scanner, inclusive em lote, e às fotos do celular. As saídas usam PDF com as proporções do recorte, preservando a imagem original no projeto para comparar ou ajustar os quatro cantos.

Quando a borda do papel está visível, o sistema corrige a perspectiva. Em capturas sobre fundo branco, reduz as margens ao redor do conjunto de textos e marcas com margem de segurança de aproximadamente 4 mm. Se não houver um recorte seguro, mantém o enquadramento completo; no scanner, mostra um aviso para usar **Ajustar recorte**.

Ajuste as guias do alimentador e respeite o tamanho mínimo de papel aceito pelo equipamento. Use o vidro para canhotos menores. Essa opção faz o recorte por software e não altera os limites físicos do scanner.

### Modelos de captura — OCR por zona

Na revisão, digitalize uma página de referência e abra **Modelos de captura**. Informe o nome do modelo, arraste retângulos sobre os campos e configure nome, tipo, obrigatoriedade e quantidade de dígitos, quando aplicável. É possível cadastrar até 30 campos: texto, identificador numérico, CPF ou data em DD/MM/AAAA. As coordenadas são proporcionais à página e também podem ser ajustadas em porcentagem. Salvar ativa o modelo no projeto; o editor do projeto permite escolher outro modelo salvo ou desativar a captura automática.

Novas páginas do scanner e do celular recebem extração local em português nas regiões configuradas. Para a página de referência ou páginas anteriores, abra **Campos extraídos** e use **Extrair campos**. Cada página conserva uma cópia da versão do modelo utilizada. Alterar o modelo não modifica capturas existentes.

Os campos aparecem ao lado da prévia. Clique em um valor para destacar a região, corrija o texto e marque **Conferido com o documento**. **Salvar revisão** persiste os valores; salvar o documento ou enviar para as saídas também salva os rascunhos de captura. O resultado original do OCR, a confiança, o valor atual e a indicação de correção permanecem separados. Identificadores são texto, preservando zeros à esquerda. Validação de formato ou CPF não garante que o OCR leu o documento corretamente.

Cada exportação com captura gera **um único PDF**, com a indexação incorporada no anexo interno `cotrimscan-indexacao.json`. O anexo inclui identificadores do projeto/página, modelo, regiões, valores originais, correções e revisão. Leitores que oferecem painel de anexos permitem recuperar esses dados; integrações podem extrair o JSON do próprio PDF. Não é criado JSON externo. A indexação é incluída antes da assinatura digital, ficando protegida junto do documento. Revisões diferentes recebem novos nomes nas saídas; reenvios da mesma revisão reutilizam o mesmo PDF sem duplicar arquivos. A exportação permite pendências e informa um aviso. Os arquivos JSON internos do projeto continuam sendo usados para edição local.

Falhas de OCR preservam a página e permitem preencher os valores manualmente. Repetir a extração não sobrescreve correções ou campos conferidos. Girar, recortar ou melhorar a imagem conserva os valores e exige nova conferência. Use páginas com o mesmo layout, orientação e enquadramento do exemplo: esta versão não identifica modelos automaticamente; o alinhamento e as referências são configurados no modelo. Cada página é indexada separadamente; não há agrupamento de várias páginas em um documento lógico ou interface de pesquisa por índices nesta entrega.

Validação: `node --test test/capture.test.cjs test/capture-ui.test.cjs` cobre OCR real em região delimitada, zeros iniciais, correção persistida, indexação incorporada no PDF, modelos versionados, falha de OCR e edição no painel. Os testes de IPC incluem bloqueio dos comandos de captura sem login.

Na aba **Captura e índices**, **Definir áreas…** abre o editor sem precisar salvar ou abrir um projeto. Use **Digitalizar folha de exemplo** para receber uma página com as configurações atuais de porta, origem, resolução e tratamento. A captura usa simplex e encerra o trabalho após a primeira página; coloque apenas uma folha no alimentador. A amostra é temporária: não é indexada, assinada, acrescentada ao projeto nem exportada. Marque as regiões na prévia, ajuste as propriedades à direita e use **Salvar modelo e selecionar**. O modelo fica disponível na biblioteca; sua vinculação ao projeto só ocorre ao salvar o formulário do projeto. Cancelar o formulário não exclui um modelo já salvo na biblioteca.


### Nome do arquivo por campo OCR e teste de leitura

Em **Captura e índices > Nome dos arquivos**, escolha **Valor de campo OCR** e selecione o campo do modelo em **Campo usado no nome**. O valor atual daquele documento, incluindo correções manuais, é usado no nome do PDF, que contém a indexação internamente. Zeros iniciais são preservados. Valores vazios, inválidos, indisponíveis ou ainda não conferidos após uma alteração da imagem usam o nome padrão com aviso. Caracteres incompatíveis com nomes de arquivo são adaptados. Nomes repetidos e revisões diferentes recebem sufixos numéricos, preservando exportações anteriores; reenviar a mesma revisão não duplica arquivos.

Na janela **Definição de áreas**, digitalize uma amostra e use **Ler campo** nas propriedades de cada região. O teste executa OCR local apenas nessa região e mostra texto, confiança estimada e validação de formato. O resultado é uma prévia: não preenche os índices de outros documentos nem altera o modelo salvo. Depois de mudar a região ou a amostra, repita a leitura para conferir o novo resultado.


### Tolerância de posição dos campos

Em **Definir áreas**, cada campo permite **Margem de busca** entre 0 e 10% da página, aplicada em cada lado do retângulo e limitada às bordas. Comece com 0,5% a 1% e use **Ler campo** para conferir: margens maiores podem incluir textos vizinhos. A linha tracejada mostra a área de busca ou a área efetivamente localizada no último teste.

Para **Alinhar automaticamente posição e inclinação**, digitalize a folha de referência, marque os campos e use **Calibrar com esta folha**. O modelo guarda posições de palavras distintas da amostra. Nas próximas páginas, o OCR procura essas palavras e estima deslocamento, escala e rotação, rejeitando correspondências inconsistentes. A compensação atua apenas na leitura das zonas: não altera a imagem nem invalida assinaturas. O teste **Ler campo** usa a mesma calibração. Para conferir outro exemplar, digitalize outra amostra sem recalibrar. Recalibre quando mudar o layout ou o enquadramento de referência.

Em cada campo, **Localizar pelo texto de referência** permite informar uma palavra ou expressão impressa, escolher **à direita** ou **abaixo** e a distância em porcentagem da página. O retângulo continua definindo largura e altura da leitura; a referência passa a definir a posição. A busca ignora acentos, maiúsculas e pontuação. Referências ausentes ou repetidas geram um campo vazio com aviso, sem ler silenciosamente a posição antiga. Escolha uma expressão que apareça uma única vez.

As três opções podem ser combinadas. O alinhamento exige pelo menos três palavras distintas reconhecidas com confiança e distribuídas na folha. Esta versão compensa rotação de até aproximadamente 15 graus, deslocamentos moderados e escala entre 80% e 125%; não corrige páginas invertidas, deformações locais ou mudanças grandes de layout. Quando não há alinhamento seguro, os campos ficam pendentes com aviso. Modelos existentes começam sem alinhamento, sem margem e sem referência; ative as opções conforme a necessidade. Nenhum resultado com confiança alta dispensa a conferência do conteúdo.

A inclusão da indexação vale para novas exportações de páginas com campos capturados, inclusive páginas existentes. Arquivos PDF/JPEG e JSON já exportados continuam intactos. O PDF mantém a aparência e a imagem original sem recompressão; a indexação não cria texto visível nem substitui a camada de OCR pesquisável. Para exportar novamente com os dados internos, use **Salvar documento** ou **Enviar para saídas**.
