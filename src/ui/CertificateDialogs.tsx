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
    {open && <ModalBackdrop onClose={cancel}><div className="certificate-dialog" role="dialog" aria-modal="true" aria-labelledby="unlock-title"><h2 id="unlock-title">Liberar certificado A1</h2><p>Informe a senha do certificado para assinar os documentos nesta sessão.</p><form onSubmit={submit}><label>Senha do certificado<input type="password" autoComplete="off" value={password} onChange={event => setPassword(event.target.value)} autoFocus required disabled={busy} /></label><p role="status" aria-live="polite">{error}</p><div className="certificate-actions"><button type="button" onClick={cancel} disabled={busy}>Cancelar</button><button type="submit" disabled={busy}>{busy ? 'Conferindo…' : 'Liberar certificado'}</button></div></form></div></ModalBackdrop>}
  </CertificateContext.Provider>;
}
