const BASE = 'http://127.0.0.1';
function endpoint(port) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Porta inválida.');
  return `${BASE}:${port}/eSCL/`;
}
function settings(dpi, source, colorMode='RGB24',duplex=false) {
  if (![150, 300, 600].includes(dpi) || !['Platen','Feeder'].includes(source) || !['RGB24','Grayscale8','BlackAndWhite1'].includes(colorMode)) throw Error('Configuração inválida.');
  if(typeof duplex!=='boolean')throw Error('Modo simplex/duplex inválido.');
  if(duplex&&source!=='Feeder')throw Error('Duplex requer o alimentador automático.');
  return `<?xml version="1.0"?><scan:ScanSettings xmlns:scan="http://schemas.hp.com/imaging/escl/2011/05/03" xmlns:pwg="http://www.pwg.org/schemas/2010/12/sm"><pwg:Version>2.0</pwg:Version><pwg:InputSource>${source}</pwg:InputSource><scan:ColorMode>${colorMode}</scan:ColorMode><scan:Duplex>${duplex}</scan:Duplex><pwg:DocumentFormat>image/jpeg</pwg:DocumentFormat><scan:XResolution>${dpi}</scan:XResolution><scan:YResolution>${dpi}</scan:YResolution></scan:ScanSettings>`;
}
async function request(url, init = {}) {
  try { return await fetch(url, {...init, redirect:'error', signal:AbortSignal.timeout(120000)}); }
  catch { throw Error('Não foi possível acessar o serviço local. Verifique se ele está ativo e se a porta está correta.'); }
}
async function connect(port) {
  const r = await request(endpoint(port)+'ScannerCapabilities');
  if (!r.ok) throw Error(`Serviço respondeu com erro ${r.status}.`);
  const xml = await r.text();
  if (!xml.includes('ScannerCapabilities')) throw Error('O serviço não retornou capacidades eSCL.');
  return true;
}
async function scan(port, dpi, source, onPage, colorMode='RGB24',duplex=false,maxPages=200) {
  if(!Number.isInteger(maxPages)||maxPages<1||maxPages>200)throw Error('Limite de páginas inválido.');
  const base = endpoint(port);
  const r = await request(base+'ScanJobs', {method:'POST',headers:{'Content-Type':'text/xml'},body:settings(dpi,source,colorMode,duplex)});
  if (!r.ok) throw Error(`Não foi possível iniciar: erro ${r.status}. Confira papel e configurações suportadas.`);
  const location = r.headers.get('location');
  if (!location) throw Error('Serviço não informou o trabalho de digitalização.');
  const job = new URL(location, base);
  if (job.origin !== new URL(base).origin || !job.pathname.startsWith('/eSCL/ScanJobs/')) throw Error('Endereço de trabalho inválido.');
  job.pathname = job.pathname.replace(/\/$/,'');
  const deadline = Date.now()+300000;
  let count = 0;
  try {
    while (Date.now()<deadline && count<200) {
      const page = await request(job.href+'/NextDocument');
      if (page.status===404) { if (!count) throw Error('Nenhuma página foi recebida.'); return count; }
      if (page.status===503) { await new Promise(r=>setTimeout(r,1000)); continue; }
      if (!page.ok) throw Error(`Erro ao receber página: ${page.status}.`);
      if (!(page.headers.get('content-type')||'').toLowerCase().startsWith('image/jpeg')) throw Error('O scanner retornou um formato diferente de JPEG.');
      const data = Buffer.from(await page.arrayBuffer());
      if (data.length>30*1024*1024) throw Error('Página excede o limite de 30 MB.');
      await onPage(data); count++;
      if (source==='Platen'||(maxPages<200&&count>=maxPages)) return count;
    }
    throw Error('Limite de tempo ou de 200 páginas atingido. As páginas recebidas foram preservadas.');
  } finally { await request(job.href,{method:'DELETE'}).catch(()=>{}); }
}
module.exports={endpoint,settings,connect,scan};
