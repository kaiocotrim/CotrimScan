import { useEffect, useState } from 'react';
import type { MobileState, Project } from './types';
import { ModalBackdrop } from './ModalBackdrop';

interface Props { project: Project; onClose(): void }
const buttonClass = 'm-0 w-auto rounded-sm border border-[#555] bg-[#292929] px-3.5 py-[11px] text-[11px] text-[#ddd] hover:bg-[#363636] disabled:cursor-default disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[#ddd]';
const inputClass = 'mt-2 block w-full rounded-sm border border-[#444] bg-[#181818] p-2.5 text-[11px] text-[#ddd] focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[#ddd]';

export function MobileDialog({ project, onClose }: Props) {
  const [addresses, setAddresses] = useState<{ name: string; address: string }[]>([]);
  const [address, setAddress] = useState('');
  const [state, setState] = useState<MobileState>({ active: false });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  function mergeState(next: MobileState) { setState(previous => next.active && next.sessionId === previous.sessionId ? { ...previous, ...next, qr: next.qr || previous.qr } : next); }
  useEffect(() => {
    void Promise.all([window.mobile.addresses(), window.mobile.status()]).then(([rows, current]) => { setAddresses(rows); setAddress(rows[0]?.address || ''); mergeState(current); }).catch(reason => setError(String(reason)));
    const unsubscribe = window.mobile.onState(mergeState);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { window.clearInterval(timer); unsubscribe?.(); };
  }, []);
  async function action(callback: () => Promise<MobileState | void>) {
    setBusy(true); setError('');
    try { const result = await callback(); if (result) mergeState(result); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  }
  const seconds = Math.max(0, Math.ceil(((state.qrExpiresAt || 0) - now) / 1000));

  return <ModalBackdrop onClose={onClose}>
    <div className="relative m-0 max-h-[calc(100dvh-32px)] w-[min(820px,calc(100vw-32px))] overflow-auto rounded-sm border border-[#444] bg-[#202020] p-[26px] font-[Arial,Helvetica,sans-serif] text-xs text-[#eee] shadow-[0_24px_100px_#0008] [color-scheme:dark] max-[600px]:p-5" role="dialog" aria-modal="true" aria-labelledby="mobile-title">
      <div className="-mx-[26px] -mt-[26px] mb-5 flex items-start justify-between gap-4 border-b border-[#333] px-7 py-6 max-[600px]:-mx-5 max-[600px]:-mt-5 max-[600px]:px-5 max-[600px]:py-5">
        <div><h2 id="mobile-title" className="m-0 mb-2 text-2xl font-normal max-[600px]:text-[21px]">Conectar celular</h2><p className="m-0 [overflow-wrap:anywhere] text-[#aaa]">{project.name}</p></div>
        <button className={buttonClass} type="button" onClick={onClose} aria-label="Fechar">×</button>
      </div>
      <p className="my-3 leading-relaxed text-[#ccc]">Conecte o computador e o celular à mesma rede Wi-Fi.</p>
      <label className="my-4 block text-[11px] font-normal text-[#bbb]">Rede local
        <select className={inputClass} value={address} onChange={event => setAddress(event.target.value)} disabled={busy}>{addresses.map(row => <option value={row.address} key={row.address}>{row.name} · {row.address}</option>)}</select>
      </label>
      <div className="my-5 grid min-h-[260px] place-items-center border border-[#383838] bg-[#191919] p-2.5 max-[900px]:min-h-[225px]">
        {state.qr && state.url ? <img className="size-60 max-w-full bg-white object-contain max-[900px]:size-[210px]" src={state.qr} alt="QR Code para conectar o celular" /> : <p className="m-0 text-center leading-[1.8] text-[#aaa]">{state.connected ? 'Celular conectado. Você já pode enviar imagens.' : 'Gere um QR Code e leia com a câmera do celular.'}</p>}
      </div>
      {state.url && <label className="my-4 block text-[11px] font-normal text-[#bbb]">Link de conexão<input className={inputClass} value={state.url} readOnly /></label>}
      <p className="my-3 leading-relaxed text-[#ccc]">{state.url ? seconds ? `QR Code válido por ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : 'QR Code expirado. Gere uma nova conexão.' : ''}</p>
      <div className="my-4 flex flex-wrap gap-2.5">
        <button className={buttonClass} disabled={busy || !address} onClick={() => void action(() => window.mobile.start(address))}>{state.active ? 'Gerar nova conexão' : 'Gerar QR Code'}</button>
        {state.active && <button className={buttonClass} disabled={busy} onClick={() => void action(() => window.mobile.stop())}>Encerrar conexão</button>}
        {state.url && <button className={buttonClass} disabled={busy} onClick={() => void action(async () => { await window.mobile.copyLink(); setError('Link copiado.'); })}>Copiar link</button>}
      </div>
      {state.connected && <p className="my-3 leading-relaxed text-[#ccc]">Conectado: {state.connected.name}</p>}
      {state.pending?.map(peer => <div className="my-6 border border-[#777] bg-[#262626] p-4" key={peer.id}>
        <h3 className="m-0 text-[13px] font-normal break-words">{peer.name}</h3>
        <p className="my-2.5 text-[10px] leading-[1.7] text-[#aaa]">Confira este código no celular:</p>
        <strong className="my-4 block text-[27px] font-normal tracking-[6px]">{peer.code}</strong>
        <div className="flex flex-wrap gap-2"><button className={buttonClass} disabled={busy} onClick={() => void action(() => window.mobile.decide(peer.id, false))}>Recusar</button><button className={buttonClass} disabled={busy} onClick={() => void action(() => window.mobile.decide(peer.id, true))}>Permitir conexão</button></div>
      </div>)}
      <p className="my-0 py-2.5 leading-relaxed text-[#ddd]" role="status" aria-live="polite">{error || state.lastError || (state.receiving ? ({ uploading: 'Recebendo foto…', processing: 'Melhorando foto…', saving: 'Salvando foto…', exporting: 'Exportando documento…' }[state.receivingStage || ''] || 'Recebendo foto…') : state.connected ? 'Pronto para receber fotos.' : '')}</p>
    </div>
  </ModalBackdrop>;
}
