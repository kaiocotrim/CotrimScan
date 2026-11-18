const {safeCodeName} = require('./document-naming.cjs');

const kinds = new Set(['project','batch','documentId','documentNumber','page','counter','date','time','year','month','day','text','ocr','qr','barcode']);

function validateTemplate(value) {
  if (value == null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) throw Error('Configuração de nomes inválida.');
  const normalize = items => {
    if (!Array.isArray(items) || items.length > 30) throw Error('Configure até 30 campos por nome.');
    return items.map(item => {
      if (!item || !kinds.has(item.kind)) throw Error('Campo de nome inválido.');
      const text = typeof item.text === 'string' ? item.text.slice(0,100) : '';
      const fieldId = typeof item.fieldId === 'string' ? item.fieldId.slice(0,100) : '';
      const digits = Number(item.digits ?? 4);
      const start = Number(item.start ?? 1);
      const increment = Number(item.increment ?? 1);
      if (!Number.isInteger(digits) || digits < 1 || digits > 12 || !Number.isSafeInteger(start) || start < 0 || !Number.isSafeInteger(increment) || increment < 1) throw Error('Configuração do contador inválida.');
      if (item.kind === 'ocr' && !fieldId) throw Error('Selecione um campo OCR.');
      return {kind:item.kind,text,fieldId,digits,start,increment,dateFormat:['DD-MM-AAAA','AAAAMMDD','AAAA-MM-DD'].includes(item.dateFormat) ? item.dateFormat : 'AAAAMMDD'};
    });
  };
  return {file:normalize(value.file || []),folder:normalize(value.folder || [])};
}

function renderTemplate(items, context) {
  const date = context.date || new Date();
  const pad = n => String(n).padStart(2,'0');
  const yyyy = String(date.getFullYear()), mm = pad(date.getMonth()+1), dd = pad(date.getDate());
  const values = {
    project:context.project, batch:context.batch || context.project,
    documentId:context.documentId, documentNumber:context.documentNumber,
    page:context.page, year:yyyy, month:mm, day:dd,
    time:pad(date.getHours())+pad(date.getMinutes())+pad(date.getSeconds())
  };
  const parts = items.map(item => {
    if (item.kind === 'text') return item.text;
    if (item.kind === 'date') return item.dateFormat === 'DD-MM-AAAA' ? `${dd}-${mm}-${yyyy}` : item.dateFormat === 'AAAA-MM-DD' ? `${yyyy}-${mm}-${dd}` : `${yyyy}${mm}${dd}`;
    if (item.kind === 'counter') return String(item.start + (context.sequence-1)*item.increment).padStart(item.digits,'0');
    if (item.kind === 'ocr') {
      const field = context.fields?.find(field => field.id === item.fieldId);
      if (!field?.value?.trim() || field.error) throw Error('Campo OCR obrigatório para o nome está vazio ou inválido. Revise a captura antes de exportar.');
      return field.value;
    }
    if (item.kind === 'qr' || item.kind === 'barcode') {
      const value = context.codes?.[item.kind];
      if (!value) throw Error(`Nenhum ${item.kind === 'qr' ? 'QR Code' : 'código de barras'} válido foi encontrado para o nome.`);
      return value;
    }
    return String(values[item.kind] ?? '');
  });
  const result = safeCodeName(parts.join(''));
  if (!result) throw Error('O modelo gerou um nome vazio.');
  return result;
}

module.exports = {validateTemplate,renderTemplate};
