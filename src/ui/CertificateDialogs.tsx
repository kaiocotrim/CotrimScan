import { createContext, useContext, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ModalBackdrop } from './ModalBackdrop';

type Pending = { resolve(): void; reject(reason: Error): void };
interface CertificateContextValue { ensure(): Promise<void> }
const CertificateContext = createContext<CertificateContextValue | null>(null);
export function useCertificate(): CertificateContextValue {
  const value = useContext(CertificateContext);
  if (!value) throw new Error('CertificateDialogs não está disponível.');
  return value;
}
export function CertificateDialogs({ children }: { children: ReactNode }) {
  const pending = useRef<Pending | null>(null);
  const [open, setOpen] = useState(false), [password, setPassword] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  async function ensure(): Promise<void> {
    const certificate = await window.certificates.status();
    if (certificate.ready) return;
    if (certificate.type === 'a3') { await window.certificates.prepare(''); return; }
    if (certificate.type !== 'a1') return;
    if (pending.current) throw new Error('A liberação do certificado já está em andamento.');
    setPassword(''); setError(''); setOpen(true);
    return new Promise<void>((resolve, reject) => { pending.current = { resolve, reject }; });
  }
  function cancel() {
    if (busy) return;
    setPassword(''); setOpen(false);
    pending.current?.reject(new Error('Operação cancelada. O certificado não foi liberado.'));
    pending.current = null;
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('Conferindo certificado…');
    try {
      await window.certificates.prepare(password);
      setPassword(''); setOpen(false); setError('');
      pending.current?.resolve(); pending.current = null;
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  }
  return <CertificateContext.Provider value={{ ensure }}>{children}
    {open && <ModalBackdrop onClose={cancel}>
      <div className="relative m-0 w-[430px] max-w-[calc(100vw-32px)] rounded border border-[#444] bg-[#222] p-7 font-[Arial,Helvetica,sans-serif] text-xs text-[#eee] shadow-[0_24px_100px_#0008] [color-scheme:dark]" role="dialog" aria-modal="true" aria-labelledby="unlock-title">
        <h2 id="unlock-title" className="my-3.5 text-[22px] font-normal">Liberar certificado A1</h2>
        <p className="my-3 text-[11px] leading-[1.8] text-[#aaa]">Informe a senha do certificado para assinar os documentos nesta sessão.</p>
        <form onSubmit={submit}>
          <label className="block text-[11px] font-normal text-[#ccc]">Senha do certificado
            <input className="mt-2 block w-full rounded-sm border border-[#454545] bg-[#191919] p-2.5 font-[Arial] text-[13px] text-[#eee] focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[#ddd]" type="password" autoComplete="off" value={password} onChange={event => setPassword(event.target.value)} autoFocus required disabled={busy} />
          </label>
          <p className="my-3 text-[11px] leading-[1.8] text-[#eee] [overflow-wrap:anywhere]" role="status" aria-live="polite">{error}</p>
          <div className="mt-[22px] flex justify-end gap-2.5">
            <button className="m-0 w-auto rounded-sm border border-[#444] bg-transparent px-3.5 py-2.5 font-[Arial] text-xs text-[#ccc] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[#ddd]" type="button" onClick={cancel} disabled={busy}>Cancelar</button>
            <button className="m-0 w-auto rounded-sm border border-[#ededed] bg-[#ededed] px-3.5 py-2.5 font-[Arial] text-xs text-[#222] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[#ddd]" type="submit" disabled={busy}>{busy ? 'Conferindo…' : 'Liberar certificado'}</button>
          </div>
        </form>
      </div>
    </ModalBackdrop>}
  </CertificateContext.Provider>;
}
