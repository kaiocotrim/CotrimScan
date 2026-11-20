import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChoiceCard } from '@/components/panelui/choice-cards';
import { ModalBackdrop } from './ModalBackdrop';
import { useEffect, useState } from 'react';
import type { Page, Project } from '@cotrimscan/shared';
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
export function ScannerView({ project, pages, status, busy, setStatus, setPages, run, onBack }: Props) {
  const [blankReview,setBlankReview]=useState<number[]>([]);
  const [blankSelected,setBlankSelected]=useState<number[]>([]);
  const certificate = useCertificate();
  const [active, setActive] = useState<number | null>(pages[0]?.id ?? null);
  const [selected, setSelected] = useState<number[]>([]);
  const [mobile, setMobile] = useState(false);
  const [scanning, setScanning] = useState(false);
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
    setActive(id); setSelected(previous => additive ? previous.includes(id) ? previous.filter(item => item !== id) : [...previous, id] : previous);
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
  function exportAll() {
    if (dirty) { setStatus('Salve as correções de OCR ou campos antes de exportar.'); return; }
    void run(async () => { await certificate.ensure(); setStatus('Enviando documentos para as saídas…'); const result = await window.projects.export(); setStatus(`${result.pages} documento(s) salvos em ${result.outputs} pasta(s) de saída. ${[...new Set(result.warnings || [])].join(' ')}`); });
  }
  function importPhotos() {
    if (!canLeave()) return;
    void run(async () => {
      setStatus('Selecione as fotos que deseja importar…');
      const result = await window.scanner.importPhotos(project.id);
      setStatus(result.imported || result.warnings.length ? `${result.imported} foto(s) importada(s). ${result.warnings.join(' ')}` : 'Importação cancelada.');
    });
  }
  function scan() {
    if (!canLeave()) return;
    void run(async () => {
      await certificate.ensure();
      setScanning(true);
      setStatus('Digitalizando… aguarde.');
      try {
        const result = await window.scanner.scan();
        if (typeof result !== 'number') {
          if (result.refreshed) setPages(result.refreshed);
          if (result.blankCandidates?.length) { setBlankReview(result.blankCandidates); setBlankSelected(result.blankCandidates); }
        }
        setStatus(`${typeof result === 'number' ? result : result.pages} página(s) adicionada(s) ao projeto. ${typeof result === 'number' ? '' : [...new Set(result.warnings || [])].join(' ')}`);
      } finally {
        setScanning(false);
      }
    });
  }
  return <div id="scanner-view" className="flex h-dvh min-h-0 flex-col bg-[#191919] font-[Arial,Helvetica,sans-serif] text-[#eee]" onKeyDown={keydown}>
    <main className="flex min-h-0 flex-1 flex-col gap-[22px] p-7 max-[900px]:gap-[18px] max-[900px]:p-5 max-[600px]:p-3.5">
      {status !== 'Pronto para digitalizar.' && <p className="m-0 max-w-[900px] text-[11px] leading-[1.6] text-[#aaa] wrap-anywhere" role="status" aria-live="polite">{status}</p>}
      <div className="grid min-h-0 flex-1 grid-cols-[250px_minmax(0,1fr)] gap-5 max-[900px]:grid-cols-[180px_minmax(0,1fr)] max-[900px]:gap-4 max-[600px]:grid-cols-[135px_minmax(0,1fr)] max-[600px]:gap-2.5">
        <Card className="scanner-pages-card flex min-h-0 min-w-0 flex-col rounded-sm border border-[#393939] bg-[#202020] px-3 py-4 max-[600px]:px-1.5 max-[600px]:py-3" aria-label="Páginas digitalizadas">
          <div className="mb-3 flex items-center justify-between gap-1.5 px-[3px] max-[600px]:flex-col max-[600px]:items-start"><h2 className="m-0 text-[13px] font-normal text-[#ddd]">Páginas</h2><span className="whitespace-nowrap text-[10px] text-[#999]">{pages.length} página(s)</span></div>
          <div id="pages" className="m-0 flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-1">{pages.length ? pages.map((item, index) => <ChoiceCard key={item.id} selected={active === item.id} checked={selected.includes(item.id)} disabled={busy} selectionLabel={`Selecionar página ${index+1}`} onToggleChecked={()=>setSelected(previous=>previous.includes(item.id)?previous.filter(id=>id!==item.id):[...previous,item.id])} onSelect={event => choosePage(item.id, event.ctrlKey || event.metaKey)} onContextMenu={event => { event.preventDefault(); if (canLeave()) { setActive(item.id); setRotation({ id: item.id, x: event.clientX, y: event.clientY }); } }} header={<span className="text-[10px] text-[#ccc]">Página {String(index + 1).padStart(2, '0')}{item.previewPending ? ' · salvando…' : ''}</span>} onKeyDown={event => { if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); const next = pages[index + (event.key === 'ArrowDown' ? 1 : -1)]; if (next) choosePage(next.id); } }}><img className="block size-full object-contain" src={item.url} alt={`Prévia da página ${index + 1}`} loading="lazy" draggable={false} /></ChoiceCard>) : <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-2 text-center text-[#aaa]"><svg viewBox="0 0 48 48" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true"><path d="M13 7h17l7 7v27H13zM30 7v8h7M18 23h14M18 29h14M18 35h10"/><path d="M8 13H6v29h24"/></svg><span className="text-[11px]">Nenhuma página digitalizada</span></div>}</div>
          <div className="mt-3.5 flex shrink-0 flex-col gap-2.5 border-t border-[#393939] pt-3.5"><Button variant="ghost" className={`${quietButton} w-full px-2 py-2 text-[11px]`} disabled={busy} onClick={importPhotos}>＋ Importar fotos</Button><Button variant="ghost" className={`${quietButton} w-full px-2 py-2 text-[10px]`} disabled={!pages.length || busy} onClick={() => setSelected(selected.length === pages.length ? [] : pages.map(item => item.id))}>{selected.length === pages.length && pages.length ? 'Desmarcar todas' : 'Selecionar todas'}</Button><span className="text-center text-[10px] text-[#aaa]" aria-live="polite">{selected.length ? `${selected.length} selecionada(s)` : 'Clique no círculo para selecionar'}</span><Button variant="ghost" className={`${quietButton} w-full px-1 py-2.5 text-[10px]`} disabled={busy || !selected.length} onClick={() => void remove()}>Excluir selecionadas</Button></div>
        </Card>
        <PreviewPanel onIndexingPages={next=>{setPages(next);setSelected([]);setActive(next[0]?.id??null);}} onScan={scan} onBack={() => { if (canLeave()) onBack(); }} onExport={exportAll} onConnectMobile={() => setMobile(true)} page={page} pageIndex={pages.findIndex(item => item.id === active)} pageCount={pages.length} project={project} busy={busy} indexingBusy={busy||dirty} scanning={scanning} setStatus={setStatus} run={run} onDirtyChange={setDirty} updatePage={updated => setPages(previous => previous.map(item => item.id === updated.id ? updated : item))} />
      </div>
    </main>
    {rotation && <div className="fixed z-[1000] min-w-[200px] rounded border border-[#555] bg-[#292929] p-[5px] shadow-[0_8px_24px_#0008]" role="menu" style={{ left: rotation.x, top: rotation.y }} onKeyDown={event => { if (event.key === 'Escape') setRotation(null); }}><Button variant="ghost" className={menuButton} role="menuitem" onClick={() => void rotate(rotation.id, 270)}>Girar 90° à esquerda</Button><Button variant="ghost" className={menuButton} role="menuitem" onClick={() => void rotate(rotation.id, 90)}>Girar 90° à direita</Button><Button variant="ghost" className={menuButton} role="menuitem" onClick={() => void rotate(rotation.id, 180)}>Girar 180°</Button></div>}
    {!!blankReview.length && <ModalBackdrop onClose={()=>setBlankReview([])}><div className="w-[860px] max-w-[95vw] max-h-[88vh] overflow-y-auto rounded-lg border border-[#444] bg-[#222] p-8 text-[#eee] max-[600px]:p-5" role="dialog" aria-modal="true" aria-label="Revisar páginas em branco"><h2 className="m-0 text-xl">Páginas possivelmente em branco</h2><p className="mb-6 mt-2 text-xs leading-relaxed text-[#aaa]">Selecione as páginas que deseja excluir. As outras serão mantidas. Use Enviar para saídas após a revisão.</p><div className="grid max-h-[52vh] grid-cols-3 gap-5 overflow-auto pr-2 max-[700px]:grid-cols-2 max-[440px]:grid-cols-1">{blankReview.map(id=><label key={id} className="m-0 flex flex-col gap-3 rounded-md border border-[#444] bg-[#191919] p-4"><img className="h-52 w-full rounded bg-[#151515] object-contain" src={pages.find(p=>p.id===id)?.url} alt={`Página ${id+1}`}/><span className="flex items-center gap-2 text-xs"><input style={{width:16,margin:0}} type="checkbox" checked={blankSelected.includes(id)} onChange={e=>setBlankSelected(old=>e.target.checked?[...old,id]:old.filter(i=>i!==id))}/>Página {id+1}</span></label>)}</div><div className="mt-7 flex flex-wrap justify-end gap-3 border-t border-[#3a3a3a] pt-6"><Button variant="ghost" className={`${quietButton} px-5 py-3`} onClick={()=>setBlankReview([])}>Manter todas</Button><Button variant="ghost" className={`${quietButton} px-5 py-3`} disabled={busy||!blankSelected.length} onClick={()=>void run(async()=>{const result=await window.scanner.remove(blankSelected);setPages(result.pages);setBlankReview([]);setSelected([]);setStatus(`${result.removed} página(s) em branco excluída(s).`);})}>Excluir selecionadas</Button></div></div></ModalBackdrop>}
    {mobile && <MobileDialog project={project} onClose={() => setMobile(false)} />}
  </div>;
}
