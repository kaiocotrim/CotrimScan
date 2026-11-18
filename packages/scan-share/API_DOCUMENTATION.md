# API de Scanners - NAPS2 WebScan LocalService

Este documento descreve as rotas expostas pelo LocalService (Windows e Linux).
Há duas superfícies: a API REST de gerenciamento (porta 5000) e os servidores eSCL, um por scanner, a partir da porta 9880.

## Visão geral

| Superfície | Endereço | Uso |
|------------|----------|-----|
| API REST | `http://127.0.0.1:5000` | Listar e atualizar scanners |
| eSCL | `http://<host>:9880`, `9881`, ... | Protocolo de escaneamento de cada dispositivo |

O serviço escuta em `127.0.0.1` (configurável em `appsettings.json`, chave `Urls`). Para acesso pela rede, use as portas eSCL a partir de 9880 em conjunto com o IP da máquina.

## API REST (porta 5000)

### 1. Listar scanners
```http
GET http://127.0.0.1:5000/api/scanners
```

**Resposta (200 OK):** array JSON com os scanners detectados.
```json
[
  {
    "id": "Canon DR-C240 TWAIN",
    "name": "Canon DR-C240 TWAIN",
    "port": 9880,
    "capabilitiesUrl": "http://127.0.0.1:9880/eSCL/ScannerCapabilities",
    "registeredAt": "2024-01-01T10:00:00Z"
  }
]
```

Lista vazia (`[]`) indica que nenhum dispositivo foi encontrado.

### 2. Detalhes de um scanner
```http
GET http://127.0.0.1:5000/api/scanners/{id}
```

Retorna um objeto com os mesmos campos da lista. Retorna 404 se o `id` não existir.

### 3. Atualizar a lista de scanners
```http
POST http://127.0.0.1:5000/api/scanners/refresh
```

Reenumera os dispositivos (TWAIN no Windows, SANE no Linux) e reinicia o servidor eSCL sem reiniciar o serviço.

**Resposta (200 OK):**
```json
{
  "count": 2,
  "timestamp": "2024-01-01T10:05:00Z"
}
```

### 4. Contar scanners
```http
GET http://127.0.0.1:5000/api/scanners/count
```

**Resposta (200 OK):**
```json
{
  "count": 2,
  "timestamp": "2024-01-01T10:05:00Z"
}
```

> As rotas `/api/scanners/current` e `/api/scanners/{id}/select` não existem mais. A seleção de scanner é feita pelo cliente (o aplicativo desktop guarda a escolha em `scanner.json`).

---

## Endpoints eSCL (portas 9880+)

Cada scanner tem seu próprio servidor eSCL. Os caminhos seguem o padrão eSCL (AirScan). Substitua `127.0.0.1` pelo IP da máquina para acesso pela rede.

### Capacidades do scanner
```http
GET http://127.0.0.1:9880/eSCL/ScannerCapabilities
```

**Resposta:** XML com resoluções, formatos e fontes suportados.

### Status do scanner
```http
GET http://127.0.0.1:9880/eSCL/ScannerStatus
```

**Resposta:** XML com o estado atual do dispositivo (por exemplo, `Idle`).

### Criar job de escaneamento
```http
POST http://127.0.0.1:9880/eSCL/ScanJobs
Content-Type: text/xml
```

Corpo (exemplo simplificado):
```xml
<scan:ScanSettings xmlns:scan="http://schemas.hp.com/imaging/escl/2011/05/03"
                   xmlns:pwg="http://www.pwg.org/schemas/2010/12/sm">
  <pwg:Version>2.0</pwg:Version>
  <scan:Intent>Document</scan:Intent>
  <pwg:ScanRegions>
    <pwg:ScanRegion>
      <pwg:XResolution>300</pwg:XResolution>
      <pwg:YResolution>300</pwg:YResolution>
    </pwg:ScanRegion>
  </pwg:ScanRegions>
</scan:ScanSettings>
```

**Resposta (201 Created):** header `Location` com a URL do job (por exemplo, `/eSCL/ScanJobs/<id>`).

### Obter próximo documento
```http
GET http://127.0.0.1:9880/eSCL/ScanJobs/{jobId}/NextDocument
```

**Resposta:**
- **200 OK**: imagem escaneada (JPEG ou PDF, conforme o formato pedido).
- **503 Service Unavailable**: o scanner ainda está processando; tente novamente.
- **404 Not Found**: não há mais documentos no job (fim do escaneamento).

---

## Fluxo de uso

1. Liste os scanners em `GET /api/scanners` (porta 5000) e escolha um `port`.
2. Crie o job em `POST /eSCL/ScanJobs` na porta escolhida e leia o header `Location`.
3. Chame `GET .../NextDocument` repetidamente até receber 404. Trate 503 com nova tentativa após um intervalo curto.

```javascript
const base = 'http://127.0.0.1:9880/eSCL';
const post = await fetch(`${base}/ScanJobs`, {
  method: 'POST',
  headers: { 'Content-Type': 'text/xml' },
  body: scanSettingsXml
});
const jobPath = post.headers.get('Location');   // ex: /eSCL/ScanJobs/123

while (true) {
  const res = await fetch(`http://127.0.0.1:9880${jobPath}/NextDocument`);
  if (res.status === 404) break;               // fim do job
  if (res.status === 503) { await new Promise(r => setTimeout(r, 1000)); continue; }
  const page = await res.arrayBuffer();        // processar a página
}
```

---

## Arquitetura

- **Porta 5000**: API REST de gerenciamento (`127.0.0.1`).
- **Portas 9880+**: um servidor eSCL por scanner. A porta é atribuída na primeira detecção e mantida entre reinícios no arquivo `ports.json`:
  - Windows: `%ProgramData%\NAPS2.WebScan\ports.json`
  - Linux: `/var/lib/naps2-webscan/ports.json`

Os dispositivos são enumerados na inicialização e a lista pode ser atualizada com `POST /api/scanners/refresh`.

