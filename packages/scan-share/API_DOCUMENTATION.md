# API de Scanners - NAPS2 LocalService

## 🚀 Endpoints Disponíveis

### API REST (Porta 5000)

### 1. Listar todos os scanners
```http
GET http://localhost:5000/api/scanners
```

**Resposta:**
```json
[
  {
    "id": "Canon DR-C240 TWAIN",
    "name": "Canon DR-C240 TWAIN",
    "port": 9880,
    "capabilitiesUrl": "http://localhost:9880/eSCL/ScannerCapabilities",
    "registeredAt": "2024-01-01T10:00:00Z"
  }
]
```

### 2. Obter detalhes de um scanner específico
```http
GET http://localhost:5000/api/scanners/{id}
```

### 3. Selecionar scanner para usar
```http
POST http://localhost:5000/api/scanners/{id}/select
```

**Resposta de sucesso:**
```json
{
  "message": "Scanner 'Canon DR-C240 TWAIN' selecionado com sucesso",
  "scannerId": "Canon DR-C240 TWAIN",
  "scannerName": "Canon DR-C240 TWAIN",
  "port": 9880,
  "capabilitiesUrl": "http://localhost:9880/eSCL/ScannerCapabilities"
}
```

### 4. Ver scanner atualmente selecionado
```http
GET http://localhost:5000/api/scanners/current
```

### 5. Contar scanners disponíveis
```http
GET http://localhost:5000/api/scanners/count
```

---

## 📡 Endpoints eSCL (Portas 9880+)

### Status do Scanner
```http
GET http://localhost:9880/eSCL/ScannerStatus
```

**Resposta:** Estado atual do scanner (Idle, Processing, etc.)

### Capacidades do Scanner
```http
GET http://localhost:9880/eSCL/ScannerCapabilities
```

**Resposta:** XML com capacidades do scanner (resoluções, formatos, etc.)

### Criar Job de Scan
```http
POST http://localhost:9880/eSCL/ScanJobs
Content-Type: text/xml

<scan:ScanSettings xmlns:scan="http://schemas.hp.com/imaging/escl/2011/05/03">
  <pwg:Version xmlns:pwg="http://www.pwg.org/schemas/2010/12/sm">2.0</pwg:Version>
  <scan:Intent>Document</scan:Intent>
  <pwg:ScanRegions xmlns:pwg="http://www.pwg.org/schemas/2010/12/sm">
    <pwg:ScanRegion>
      <pwg:XResolution>300</pwg:XResolution>
      <pwg:YResolution>300</pwg:YResolution>
    </pwg:ScanRegion>
  </pwg:ScanRegions>
</scan:ScanSettings>
```

**Resposta:** Header `Location` com a URL do job criado (ex: `/eSCL/ScanJobs/12345`)

### Verificar Status do Job ⚡ NOVO
```http
GET http://localhost:9880/eSCL/ScanJobs/{jobId}
```

**Resposta:** XML com status do job (Pending, Processing, Completed, etc.)

```xml
<scan:ScanJobInfo>
  <pwg:JobState>Processing</pwg:JobState>
  <pwg:JobStateReasons>JobScanning</pwg:JobStateReasons>
  <scan:ImagesCompleted>0</scan:ImagesCompleted>
</scan:ScanJobInfo>
```

### Informações da Imagem do Job ⚡ OTIMIZAÇÃO
```http
GET http://localhost:9880/eSCL/ScanJobs/{jobId}/ScanImageInfo
```

**Resposta:** Informações sobre a imagem escaneada (formato, tamanho, etc.)
- **200 OK**: Imagem pronta para download
- **404 Not Found**: Imagem ainda não disponível
- **409 Conflict**: Scan ainda em progresso

### Obter Próximo Documento
```http
GET http://localhost:9880/eSCL/ScanJobs/{jobId}/NextDocument
```

**Resposta:** Imagem escaneada (JPEG/PNG/PDF)
- **200 OK**: Documento pronto e retornado
- **404 Not Found**: Nenhum documento disponível (fim do scan)
- **503 Service Unavailable**: Scanner ainda processando, tente novamente

---

## 📝 Fluxo Otimizado de Scan

### Método 1: Polling no Status da Imagem (Recomendado)
```javascript
// 1. Criar job de scan
const jobUrl = await scanner.ScanJobs({ Resolution: 300 });
const jobId = jobUrl.split('/').pop();

// 2. Aguardar imagem estar pronta (polling otimizado)
let ready = false;
let attempts = 0;
const maxAttempts = 30; // 30 tentativas = 15 segundos máx

while (!ready && attempts < maxAttempts) {
  try {
    const imageInfo = await scanner.ScanImageInfo(jobId);
    if (imageInfo) {
      ready = true;
      break;
    }
  } catch (err) {
    if (err.response?.status === 404 || err.response?.status === 409) {
      // Ainda não pronto, aguardar 500ms
      await new Promise(resolve => setTimeout(resolve, 500));
      attempts++;
      continue;
    }
    throw err;
  }
}

// 3. Obter documento
if (ready) {
  const doc = await scanner.NextDocument(jobId);
  // Processar imagem...
}
```

### Método 2: Usando Método Otimizado (Simplificado)
```javascript
const jobUrl = await scanner.ScanJobs({ Resolution: 300 });
const jobId = jobUrl.split('/').pop();

// Aguarda automaticamente o documento estar pronto
const doc = await scanner.GetNextDocumentOptimized(jobId);
```

### Método 3: NextDocument com Auto-Retry (Padrão)
```javascript
// NextDocument já faz retry automático no 503
const doc = await scanner.NextDocument(jobId);
```

---

## ⚡ Comparação de Performance

| Método | Vantagens | Desvantagens | Tempo Médio |
|--------|-----------|--------------|-------------|
| **ScanImageInfo Polling** | Mais rápido, não bloqueia thread | Requer lógica de polling | ~0.5-2s |
| **NextDocument Auto-Retry** | Simples, funciona sempre | Mais lento (retry 2s) | ~2-4s |
| **GetNextDocumentOptimized** | Melhor dos dois mundos | - | ~0.5-2s |

---

## 🏗️ Arquitetura

- **Porta 5000**: API REST para gerenciar scanners
- **Portas 9880+**: Servidores eSCL (um por scanner)
  - 9880: Primeiro scanner (Canon DR-C240)
  - 9881: Segundo scanner (Canon DR-M160)
  - 9882: Terceiro scanner (KODAK S2000)

Todos os scanners TWAIN são descobertos na inicialização e servidos simultaneamente em portas separadas.

