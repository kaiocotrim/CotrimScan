import { useEffect, useState } from 'react';
import type { Page, Project } from './types';
import { PreviewPanel } from './PreviewPanel';
import { MobileDialog } from './MobileDialog';
import { useCertificate } from './CertificateDialogs';

interface Props {
  username: string;
  project: Project;
  pages: Page[];
  status: string;
  busy: boolean;
  setStatus(text: string): void;
  setPages(value: Page[] | ((previous: Page[]) => Page[])): void;
  run(action: () => Promise<void>): Promise<void>;
  onBack(): void;
  onLogout(): void;
}
const buttonBase = 'm-0 w-auto rounded-sm border border-[#444] bg-[#262626] px-4 py-2.5 text-xs text-[#ccc] hover:border-[#777] hover:bg-[#333] disabled:cursor-default disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#ddd]';
const quietButton = `${buttonBase} bg-transparent`;
const menuButton = 'm-0 block w-full rounded-sm border-0 bg-transparent px-3.5 py-3 text-left text-xs text-[#eee] hover:bg-[#444] focus-visible:bg-[#444]';
export function ScannerView({ username, project, pages, status, busy, setStatus, setPages, run, onBack, onLogout }: Props) {
  const certificate = useCertificate();
  const [active, setActive] = useState<number | null>(pages[0]?.id ?? null);
  const [selected, setSelected] = useState<number[]>([]);
  const [mobile, setMobile] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [rotation, setRotation] = useState<{ id: number; x: number; y: number } | null>(null);
  useEffect(() => window.mobile.onState(state => { if (state.pending?.length) setMobile(true); }), []);
  useEffect(() => { if (pages.length && !pages.some(item => item.id === active)) { setActive(pages[0].id); setSelected([]); } }, [pages, active]);
  const page = pages.find(item => item.id === active);

  function canLeave() {
    return !dirty || window.confirm('Existem alterações de texto ou campos não salvas. Continuar e descartá-las?');
  }
  function choosePage(id: number, additive = false) {
    if (busy || id !== active && !canLeave()) return;
    setActive(id); setSelected(previous => additive ? previous.includes(id) ? previous.filter(item => item !== id) : [...previous, id] : [id]);
  }
  async function remove() {
    if (!selected.length || !canLeave()) return;
    if (!window.confirm(`Excluir ${selected.length} página(s) selecionada(s) deste projeto? As cópias já enviadas às saídas serão mantidas.`)) return;
    await run(async () => {
      const data = await window.scanner.remove([...selected].sort((a, b) => a - b));
      setPages(data.pages); setSelected([]); setActive(data.pages[0]?.id ?? null);
      setStatus(`${data.removed} página(s) excluída(s) do projeto.`);
    });
  }
  function keydown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Delete' || !selected.length || busy || mobile || rotation) return;
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement || (event.target instanceof Element && event.target.closest('[role="dialog"]'))) return;
    event.preventDefault(); void remove();
  }
  async function rotate(id: number, angle: number) {
    setRotation(null);
    if (!canLeave()) return;
    await run(async () => {
      setStatus('Girando imagem…');
      const updated = await window.scanner.rotate(id, angle);
      setPages(previous => previous.map(item => item.id === id ? updated : item));
      setStatus('Imagem girada e salva no projeto. Use Enviar para saídas para exportar a nova versão.');
    });
  }
  return <div id="scanner-view" className="flex h-dvh min-h-0 flex-col bg-[#191919] font-[Arial,Helvetica,sans-serif] text-[#eee]" onKeyDown={keydown}>
    <header className="flex shrink-0 items-center justify-between gap-6 border-b border-[#333] bg-[#191919] px-7 py-[18px] max-[600px]:gap-3">
      <div className="flex min-w-0 items-center gap-4 max-[600px]:gap-2"><img className="block h-auto w-[110px] shrink-0 object-contain" src="assets/icones_3d/download.png" width={110} height={26} alt="CotrimScan" /><button className={quietButton} onClick={() => { if (canLeave()) onBack(); }} disabled={busy}>← Projetos</button><span className="text-[15px] text-[#ccc] wrap-anywhere">{project.name}</span></div>
      <div className="flex min-w-0 items-center gap-4 max-[600px]:gap-2"><span className="text-xs text-[#ccc]">{username}</span><button className={quietButton} onClick={() => { if (canLeave()) onLogout(); }} disabled={busy}>Sair</button></div>
    </header>
    <main className="flex min-h-0 flex-1 flex-col gap-[22px] p-7 max-[900px]:gap-[18px] max-[900px]:p-5 max-[600px]:p-3.5">
      <div className="flex shrink-0 items-center justify-between gap-6 max-[900px]:flex-wrap max-[600px]:flex-col max-[600px]:items-start max-[600px]:gap-4"><div><span className="text-[9px] tracking-[2px] text-[#999]">REVISÃO DE DOCUMENTOS</span><h1 className="mb-2.5 mt-2 text-[23px] font-normal tracking-[-.4px] max-[900px]:text-xl">Documentos do projeto</h1><p className="m-0 max-w-[900px] text-[11px] leading-[1.6] text-[#aaa] wrap-anywhere" role="status" aria-live="polite">{status}</p></div>
        <div className="flex shrink-0 gap-2.5 max-[900px]:flex-wrap max-[900px]:gap-2">
          <button className={buttonBase} onClick={() => setMobile(true)}>Conectar celular</button>
          <button className={buttonBase} disabled={busy || !pages.length || !project.outputs.length} onClick={() => {
            if (dirty) { setStatus('Salve as correções de OCR ou campos antes de exportar.'); return; }
            void run(async () => { await certificate.ensure(); setStatus('Enviando documentos para as saídas…'); const result = await window.projects.export(); setStatus(`${result.pages} documento(s) salvos em ${result.outputs} pasta(s) de saída. ${[...new Set(result.warnings || [])].join(' ')}`); });
          }}>Enviar para saídas</button>
          <button className="m-0 w-auto rounded-sm border border-[#ddd] bg-[#eee] px-5 py-[11px] text-xs text-[#222] hover:bg-white disabled:cursor-default disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#ddd]" disabled={busy} onClick={() => { if (canLeave()) void run(async () => { await certificate.ensure(); setStatus('Digitalizando… aguarde.'); const result = await window.scanner.scan(); setStatus(`${typeof result === 'number' ? result : result.pages} página(s) adicionada(s) ao projeto. ${typeof result === 'number' ? '' : [...new Set(result.warnings || [])].join(' ')}`); }); }}>＋ Digitalizar</button>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[205px_minmax(0,1fr)] gap-5 max-[900px]:grid-cols-[170px_minmax(0,1fr)] max-[900px]:gap-4 max-[600px]:grid-cols-[135px_minmax(0,1fr)] max-[600px]:gap-2.5">
        <aside className="flex min-h-0 min-w-0 flex-col rounded-sm border border-[#393939] bg-[#202020] px-3 py-4 max-[600px]:px-1.5 max-[600px]:py-3" aria-label="Páginas digitalizadas">
          <div className="mb-3 flex items-center justify-between gap-1.5 px-[3px] max-[600px]:flex-col max-[600px]:items-start"><h2 className="m-0 text-[13px] font-normal text-[#ddd]">Páginas</h2><span className="whitespace-nowrap text-[10px] text-[#999]">{pages.length} página(s)</span></div>
          <button className={`${quietButton} mb-3 w-full px-2 py-2 text-[10px]`} disabled={!pages.length || busy} onClick={() => setSelected(selected.length === pages.length ? [] : pages.map(item => item.id))}>{selected.length === pages.length && pages.length ? 'Desmarcar todas' : 'Selecionar todas'}</button>
          <div id="pages" className="m-0 flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-1">{pages.length ? pages.map((item, index) => <article className={`shrink-0 rounded-sm border bg-[#252525] p-2 transition-colors ${active === item.id ? 'border-[#d0d0d0]' : 'border-[#444]'} ${selected.includes(item.id) ? 'bg-[#333]' : ''}`} key={item.id} onContextMenu={event => { event.preventDefault(); if (canLeave()) { setActive(item.id); setRotation({ id: item.id, x: event.clientX, y: event.clientY }); } }}>
            <label className="mb-[9px] mt-0 flex cursor-pointer items-center gap-2 text-[10px] font-normal text-[#ccc]"><input className="m-0 size-[13px] shrink-0 cursor-pointer p-0 accent-[#ddd]" type="checkbox" checked={selected.includes(item.id)} onChange={event => setSelected(previous => event.target.checked ? [...previous, item.id] : previous.filter(id => id !== item.id))} aria-label={`Selecionar página ${index + 1}`} /><span>Página {String(index + 1).padStart(2, '0')}{item.previewPending ? ' \u00b7 salvando\u2026' : ''}</span></label>
            <button className="m-0 block h-[175px] w-full cursor-pointer overflow-hidden rounded-none border-0 bg-[#151515] p-[7px] hover:bg-[#181818] max-[900px]:h-[145px] max-[600px]:h-[115px]" type="button" aria-current={active === item.id ? 'page' : undefined} onClick={event => choosePage(item.id, event.ctrlKey || event.metaKey)} onKeyDown={event => { if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); const next = pages[index + (event.key === 'ArrowDown' ? 1 : -1)]; if (next) choosePage(next.id); } }}><img className="block size-full object-contain" src={item.url} alt="" loading="lazy" draggable={false} /></button>
          </article>) : <p className="m-0 px-1 py-8 text-center text-[11px] leading-[1.8] text-[#888]">Suas páginas aparecerão aqui.</p>}</div>
          <div className="mt-3.5 flex shrink-0 flex-col gap-2.5 border-t border-[#393939] pt-3.5"><span className="text-center text-[10px] text-[#aaa]" aria-live="polite">{selected.length ? `${selected.length} selecionada(s)` : 'Nenhuma selecionada'}</span><button className={`${quietButton} w-full px-1 py-2.5 text-[10px]`} disabled={busy || !selected.length} onClick={() => void remove()}>Excluir selecionadas</button></div>
        </aside>
        <PreviewPanel page={page} pageIndex={pages.findIndex(item => item.id === active)} pageCount={pages.length} project={project} busy={busy} setStatus={setStatus} run={run} onDirtyChange={setDirty} updatePage={updated => setPages(previous => previous.map(item => item.id === updated.id ? updated : item))} />
      </div>
    </main>
    {rotation && <div className="fixed z-[1000] min-w-[200px] rounded border border-[#555] bg-[#292929] p-[5px] shadow-[0_8px_24px_#0008]" role="menu" style={{ left: rotation.x, top: rotation.y }} onKeyDown={event => { if (event.key === 'Escape') setRotation(null); }}><button className={menuButton} role="menuitem" onClick={() => void rotate(rotation.id, 270)}>Girar 90° à esquerda</button><button className={menuButton} role="menuitem" onClick={() => void rotate(rotation.id, 90)}>Girar 90° à direita</button><button className={menuButton} role="menuitem" onClick={() => void rotate(rotation.id, 180)}>Girar 180°</button></div>}
    {mobile && <MobileDialog project={project} onClose={() => setMobile(false)} />}
  </div>;
}
