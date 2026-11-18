import { useEffect, useState, type FormEvent } from 'react';
import type { ScannerState } from '@cotrimscan/shared';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

interface Props {
  busy: boolean;
  setStatus(text: string): void;
}

const field = 'scanner-control';
const quietButton = 'scanner-action';
const primaryButton = 'scanner-action scanner-action-primary';
const label = 'scanner-manual-field';

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function ScannerSelector({ busy, setStatus }: Props) {
  const reduceMotion = useReducedMotion();
  const [state, setState] = useState<ScannerState | null>(null);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: '', host: '', port: '9880' });

  useEffect(() => {
    window.scanner.list().then(setState).catch(item => setError(message(item)));
  }, []);

  async function change(action: () => Promise<ScannerState>, done: string) {
    try {
      setState(await action());
      setError('');
      setStatus(done);
    } catch (item) {
      setError(message(item));
    }
  }

  function submitManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void change(async () => {
      const next = await window.scanner.addManual({ name: draft.name.trim(), host: draft.host.trim(), port: Number(draft.port) });
      setAdding(false);
      setDraft({ name: '', host: '', port: '9880' });
      return next;
    }, 'Scanner manual adicionado.');
  }

  const selectedDevice = state?.devices.find(device => device.id === state.selected);
  const selectedIsManual = selectedDevice?.driver === 'escl-manual';

  return <section className="scanner-selector" aria-label="Seleção de scanner">
    <label className="scanner-picker-label" htmlFor="scanner-select">Scanner disponível</label>
    <div className="scanner-picker-row">
      <select id="scanner-select" className={field} value={state?.selected ?? ''} disabled={busy || !state} onChange={event => void change(() => window.scanner.select(event.target.value || null), 'Scanner selecionado.')}>
        <option value="">{state?.devices.length ? 'Selecione um scanner' : 'Nenhum scanner encontrado'}</option>
        {state?.devices.map(device => <option key={device.id} value={device.id}>{device.name}{device.driver === 'escl-manual' ? ' (manual)' : ''}</option>)}
      </select>
      <button className={quietButton} type="button" disabled={busy} onClick={() => void change(() => window.scanner.refresh(), 'Lista de scanners atualizada.')}>Atualizar</button>
    </div>
    <div className="scanner-secondary-actions">
      <button className={quietButton} type="button" disabled={busy} onClick={() => setAdding(value => !value)}>{adding ? 'Cancelar' : '+ Adicionar manualmente'}</button>
      {selectedIsManual && <button className={quietButton} type="button" disabled={busy} onClick={() => void change(() => window.scanner.removeManual(selectedDevice!.id), 'Scanner manual removido.')}>Remover scanner</button>}
    </div>
    {state?.selected && !selectedDevice && <p className="scanner-message scanner-warning" role="status">O scanner selecionado não está disponível. Verifique a conexão e clique em Atualizar.</p>}
    {state?.forkError && <p className="scanner-message">Serviço NAPS2 WebScan indisponível. Verifique se ele está em execução.</p>}
    {error && <p className="scanner-message scanner-error" role="alert">{error}</p>}
    <AnimatePresence initial={false}>{adding && <motion.div className="scanner-manual-reveal" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.24, ease: 'easeInOut' }}><form className="scanner-manual-form" onSubmit={submitManual}>
      <label className={label}>Nome<input className={field} required maxLength={120} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
      <label className={label}>Endereço<input className={field} required pattern="[A-Za-z0-9.\-]{1,253}" placeholder="192.168.0.50" value={draft.host} onChange={event => setDraft({ ...draft, host: event.target.value })} /></label>
      <label className={label}>Porta<input className={field} required type="number" min={1024} max={65535} value={draft.port} onChange={event => setDraft({ ...draft, port: event.target.value })} /></label>
      <button className={primaryButton} type="submit" disabled={busy}>Salvar scanner</button>
    </form></motion.div>}</AnimatePresence>
  </section>;
}
