import { useEffect, useState, type FormEvent } from 'react';
import type { ScannerState } from '@cotrimscan/shared';

interface Props {
  busy: boolean;
  setStatus(text: string): void;
}

const field = 'm-0 w-full min-w-0 rounded-md border border-[#ffffff20] bg-[#252525] px-3 py-2.5 text-xs text-[#dce7f3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#75baff] disabled:cursor-default disabled:opacity-40';
const quietButton = 'm-0 w-auto shrink-0 rounded-md border border-[#ffffff20] bg-transparent px-4 py-2.5 text-xs text-[#dce7f3] hover:bg-[#ffffff08] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#75baff] disabled:cursor-default disabled:opacity-40';
const primaryButton = 'm-0 w-auto shrink-0 rounded-md border border-[#61acfa70] bg-[#3287dc] px-[18px] py-2.5 text-xs text-white hover:bg-[#4397ea] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#75baff] disabled:cursor-default disabled:opacity-40';
const label = 'flex min-w-0 flex-col gap-1.5 text-[11px] text-[#89929f]';

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function ScannerSelector({ busy, setStatus }: Props) {
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

  return <section className="flex flex-col gap-3 rounded-xl border border-[#ffffff14] bg-[#1f1f1f] p-4 max-[600px]:p-3" aria-label="Seleção de scanner">
    <div className="flex flex-wrap items-end gap-2.5 max-[600px]:flex-col max-[600px]:items-stretch">
      <div className="flex min-w-0 flex-1 basis-64 flex-col gap-1.5">
        <label className="text-[11px] text-[#89929f]" htmlFor="scanner-select">Scanner</label>
        <select id="scanner-select" className={field} value={state?.selected ?? ''} disabled={busy || !state} onChange={event => void change(() => window.scanner.select(event.target.value || null), 'Scanner selecionado.')}>
          <option value="">{state?.devices.length ? 'Selecione um scanner' : 'Nenhum scanner encontrado'}</option>
          {state?.devices.map(device => <option key={device.id} value={device.id}>{device.name}{device.driver === 'escl-manual' ? ' (manual)' : ''}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap gap-2.5 max-[600px]:[&>button]:flex-1">
        <button className={quietButton} type="button" disabled={busy} onClick={() => void change(() => window.scanner.refresh(), 'Lista de scanners atualizada.')}>Atualizar</button>
        <button className={quietButton} type="button" disabled={busy} onClick={() => setAdding(value => !value)}>{adding ? 'Cancelar' : 'Adicionar manual'}</button>
        {selectedIsManual && <button className={quietButton} type="button" disabled={busy} onClick={() => void change(() => window.scanner.removeManual(selectedDevice!.id), 'Scanner manual removido.')}>Remover</button>}
      </div>
    </div>
    {state?.selected && !selectedDevice && <p className="m-0 text-[11px] leading-[1.6] text-[#e0b070] wrap-anywhere" role="status">O scanner selecionado não está disponível. Verifique a conexão e clique em Atualizar.</p>}
    {state?.forkError && <p className="m-0 text-[11px] leading-[1.6] text-[#89929f] wrap-anywhere">Serviço NAPS2 WebScan indisponível: {state.forkError}</p>}
    {error && <p className="m-0 text-[11px] leading-[1.6] text-[#e4acb6] wrap-anywhere" role="alert">{error}</p>}
    {adding && <form className="grid grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1fr)_auto] items-end gap-2.5 max-[900px]:grid-cols-2 max-[600px]:grid-cols-1" onSubmit={submitManual}>
      <label className={label}>Nome<input className={field} required maxLength={120} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
      <label className={label}>Endereço<input className={field} required pattern="[A-Za-z0-9.\-]{1,253}" placeholder="192.168.0.50" value={draft.host} onChange={event => setDraft({ ...draft, host: event.target.value })} /></label>
      <label className={label}>Porta<input className={field} required type="number" min={1024} max={65535} value={draft.port} onChange={event => setDraft({ ...draft, port: event.target.value })} /></label>
      <button className={primaryButton} type="submit" disabled={busy}>Salvar scanner</button>
    </form>}
  </section>;
}
