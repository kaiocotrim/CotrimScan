import { Button } from '@/components/panelui/button';
import { RefreshCWIcon } from '@/components/ui/refresh-cw';
import { PlusIcon } from '@/components/ui/plus';
import { ArrowLeftIcon } from '@/components/ui/arrow-left';
import { Input } from '@/components/panelui/input';
import { Alert, type AlertTone } from '@/components/panelui/alert';
import { useEffect, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import type { ScannerState } from '@cotrimscan/shared';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

interface Props {
  busy: boolean;
  setStatus(text: string): void;
  onModeChange(manual: boolean): void;
  onClose(): void;
}

const field = 'scanner-control';
const quietButton = 'scanner-action';
const primaryButton = 'scanner-action scanner-action-primary';
const label = 'scanner-manual-field';

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function ScannerSelector({ busy, setStatus, onModeChange, onClose }: Props) {
  const reduceMotion = useReducedMotion();
  const [notice, setNotice] = useState<{ title: string; description: string; tone: AlertTone } | null>(null);
  const [state, setState] = useState<ScannerState | null>(null);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [draftSelected, setDraftSelected] = useState('');
  const [draft, setDraft] = useState({ name: '', host: '', port: '9880' });
  const manualReady = draft.name.trim().length > 0
    && /^[A-Za-z0-9.-]{1,253}$/.test(draft.host.trim())
    && Number.isInteger(Number(draft.port))
    && Number(draft.port) >= 1024
    && Number(draft.port) <= 65535;

  useEffect(() => {
    window.scanner.list().then(next => { setState(next); setDraftSelected(next.selected ?? ''); }).catch(item => setNotice({ title: 'Não foi possível buscar os scanners', description: message(item), tone: 'destructive' })).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (state?.selected && !state.devices.some(device => device.id === state.selected)) {
      setNotice({ title: 'Scanner indisponível', description: 'Verifique a conexão e atualize a lista.', tone: 'warning' });
    }
    if (state?.forkError) setNotice({ title: 'Erro no scanner', description: state.forkError, tone: 'destructive' });
  }, [state?.selected, state?.forkError, state?.devices]);

  async function change(action: () => Promise<ScannerState>, done: string) {
    try {
      setState(await action());
      setNotice(null);
      setStatus(done);
    } catch (item) {
      setNotice({ title: 'Não foi possível atualizar o scanner', description: message(item), tone: 'destructive' });
    }
  }

  function submitManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void change(async () => {
      const next = await window.scanner.addManual({ name: draft.name.trim(), host: draft.host.trim(), port: Number(draft.port) });
      setAdding(false);
      onModeChange(false);
      setDraft({ name: '', host: '', port: '9880' });
      return next;
    }, 'Scanner manual adicionado.');
  }

  const selectedDevice = state?.devices.find(device => device.id === state.selected);
  const selectedIsManual = selectedDevice?.driver === 'escl-manual';
  async function confirmSelection(value = draftSelected) {
    if (!state || busy || (!value && !state.selected)) return;
    try {
      const next = await window.scanner.select(value || null);
      setState(next);
      setStatus(value ? 'Scanner selecionado.' : 'Seleção de scanner removida.');
      onClose();
    } catch (item) {
      setNotice({ title: 'Não foi possível selecionar o scanner', description: message(item), tone: 'destructive' });
    }
  }

  return <section className="scanner-selector" aria-label="Seleção de scanner">
    <div className="scanner-picker-heading">
      <span className="scanner-picker-label" id="scanner-list-label">{adding ? 'Configurar scanner manual' : 'Selecione o driver do scanner'}</span>
      <div className="scanner-picker-actions">
        <Button variant="ghost" className={quietButton} type="button" disabled={busy} onClick={() => { setAdding(value => !value); onModeChange(!adding); }}>{adding ? <ArrowLeftIcon size={14} aria-hidden="true" /> : <PlusIcon size={14} aria-hidden="true" />}{adding ? 'Voltar' : 'Adicionar manualmente'}</Button>
      {!adding && <Button variant="ghost" className={quietButton} type="button" disabled={busy} aria-label="Atualizar lista de scanners" title="Atualizar lista de scanners" onClick={() => void change(() => window.scanner.refresh(), 'Lista de scanners atualizada.')}><RefreshCWIcon size={16} aria-hidden="true" /></Button>}
      </div>
    </div>
    <AnimatePresence mode="wait" initial={false}>
      {adding ? <motion.div key="manual" className="scanner-manual-reveal" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: reduceMotion ? 0 : 0.24, ease: 'easeInOut' }}>
        <form className="scanner-manual-form" onSubmit={submitManual}>
      <label className={label}>Nome<Input className={field} required maxLength={120} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
      <label className={label}>Endereço<Input className={field} required pattern="[A-Za-z0-9.\-]{1,253}" placeholder="192.168.0.50" value={draft.host} onChange={event => setDraft({ ...draft, host: event.target.value })} /></label>
      <label className={label}>Porta<Input className={field} required type="number" min={1024} max={65535} value={draft.port} onChange={event => setDraft({ ...draft, port: event.target.value })} /></label>
      <Button variant="ghost" className={primaryButton} type="submit" disabled={busy || !manualReady}>Salvar scanner</Button>
    </form>
      </motion.div> : <motion.div key="devices" className="scanner-list-view" initial={{ opacity: 0, x: -18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 18 }} transition={{ duration: reduceMotion ? 0 : 0.24, ease: 'easeInOut' }}>
    <div className="scanner-device-list" role="listbox" aria-labelledby="scanner-list-label" aria-busy={loading}>
      {state?.devices.length ? state.devices.map(device => <Button key={device.id} variant="ghost" type="button" role="option" aria-selected={draftSelected === device.id} className="scanner-device-option" onClick={() => setDraftSelected(device.id)} onDoubleClick={() => void confirmSelection(device.id)} disabled={busy}>{device.name}{device.driver === 'escl-manual' ? ' (manual)' : ''}</Button>) : <p className="scanner-list-empty">{loading ? 'Buscando scanners...' : 'Nenhum scanner encontrado'}</p>}
    </div>
    <div className="scanner-secondary-actions">
      {state?.selected && <Button variant="ghost" className={quietButton} type="button" disabled={busy} onClick={() => setDraftSelected('')}>Limpar seleção</Button>}
      {selectedIsManual && <Button variant="ghost" className={quietButton} type="button" disabled={busy} onClick={() => void change(() => window.scanner.removeManual(selectedDevice!.id), 'Scanner manual removido.')}>Remover scanner</Button>}
    </div>
    <div className="scanner-picker-footer">
      <Button type="button" className="scanner-picker-confirm" disabled={busy || !state || (!draftSelected && !state.selected)} onClick={() => void confirmSelection()}>OK</Button>
      <Button variant="outline" type="button" className="scanner-picker-cancel" onClick={onClose}>Cancelar</Button>
    </div>
      </motion.div>}
    </AnimatePresence>
    {createPortal(<AnimatePresence>{notice && <motion.div key={notice.title + notice.description} className="scanner-alert-position" initial={{ opacity: 0, y: -12, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.98 }} transition={{ duration: reduceMotion ? 0 : 0.22, ease: 'easeOut' }}><Alert variant="plain" tone={notice.tone} open onOpenChange={open => { if (!open) setNotice(null); }} className="scanner-alert"><Alert.Icon /><Alert.Title>{notice.title}</Alert.Title><Alert.Description>{notice.description}</Alert.Description><Alert.Close aria-label="Fechar aviso" /></Alert></motion.div>}</AnimatePresence>, document.body)}
  </section>;
}
