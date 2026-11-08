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

## Certificado digital por projeto

Na terceira área do editor, escolha **Sem assinatura digital**, **A1** ou **A3**. O formato assinado é **um PDF por página**, sem carimbo visual. As imagens JPEG originais permanecem no projeto, e a assinatura é incorporada ao PDF antes de qualquer envio às pastas de saída. Uma falha na assinatura preserva a imagem local e interrompe a digitalização; nenhuma cópia JPEG sem assinatura é enviada como alternativa.

**A1:** selecione o arquivo `.pfx` ou `.p12`. O projeto guarda apenas o caminho; mantenha o arquivo acessível. Na primeira operação de assinatura após o login, informe a senha na janela do próprio aplicativo. O arquivo deve conter uma chave privada RSA e seu certificado compatível, dentro da validade. A chave e a senha ficam somente em memória durante a sessão; não são gravadas no projeto, argumentos de processo nem logs. **Sair** ou fechar o aplicativo descarta essa sessão. Arquivos com chave ECDSA não são suportados nesta implementação.

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

`npm test` verifica o cliente eSCL com respostas HTTP simuladas, incluindo páginas do alimentador e falhas. Os testes incluem criação e persistência da conta, login, encerramento de sessão, limitação de tentativas e bloqueio das operações internas sem autenticação. A tela de projetos e o editor foram conferidos visualmente no Chrome, com APIs simuladas, incluindo clique simples, duplo clique, criação, edição e navegação. A persistência e o bloqueio das operações sem login foram testados com arquivos temporários. O A1 foi testado com certificado RSA fictício, incluindo senha incorreta, verificação criptográfica da assinatura, rejeição de conteúdo alterado, descarte da sessão e ausência de senha no projeto. O PDF foi renderizado e conferido, e a assinatura foi reconhecida como válida pelo `pdfsig`. O caminho A3 foi testado por adaptador simulado; não houve teste real no Windows ou em token físico. O aplicativo Electron completo e os empacotamentos não foram executados nesta validação. Nenhum scanner físico foi usado na validação. A compatibilidade com modelos, resoluções e alimentadores depende do serviço e dos drivers. OCR, PDF com várias páginas por trabalho, frente e verso e cancelamento durante a digitalização não estão implementados. Limite de 200 páginas por trabalho; as páginas ficam salvas no projeto e são carregadas na memória quando ele é aberto.

A interface usa isolamento de contexto, sem acesso direto ao Node.js. Conexões são restritas ao próprio computador e redirecionamentos HTTP são recusados.
