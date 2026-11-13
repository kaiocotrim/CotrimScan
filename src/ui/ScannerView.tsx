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
export function ScannerView({ username, project, pages, status, busy, setStatus, setPages, run, onBack, onLogout }: Props) {
  const certificate = useCertificate();
  const [active, setActive] = useState<number | null>(pages[0]?.id ?? null);
  const [selected, setSelected] = useState<number[]>([]);
  const [mobile, setMobile] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [rotation, setRotation] = useState<{ id: number; x: number; y: number } | null>(null);
  useEffect(() => window.mobile.onState(state => { if (state.pending?.length) setMobile(true); }), []);
  useEffect(() => { if (pages.length && active === null) setActive(pages[0].id); }, [pages, active]);
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
  return <div id="scanner-view" className="workspace" onKeyDown={keydown}>
    <header className="workspace-header">
      <div className="workspace-brand"><img className="brand-logo" src="assets/icones_3d/download.png" width={110} height={26} alt="CotrimScan" /><button className="quiet-button" onClick={() => { if (canLeave()) onBack(); }} disabled={busy}>← Projetos</button><span>{project.name}</span></div>
      <div className="workspace-account"><span>{username}</span><button className="quiet-button" onClick={() => { if (canLeave()) onLogout(); }} disabled={busy}>Sair</button></div>
    </header>
    <main className="review-main">
      <div className="review-heading"><div><span className="eyebrow">REVISÃO DE DOCUMENTOS</span><h1>Documentos do projeto</h1><p role="status" aria-live="polite">{status}</p></div>
        <div className="review-actions">
          <button className="secondary" onClick={() => setMobile(true)}>Conectar celular</button>
          <button className="secondary" disabled={busy || !pages.length || !project.outputs.length} onClick={() => {
            if (dirty) { setStatus('Salve as correções de OCR ou campos antes de exportar.'); return; }
            void run(async () => { await certificate.ensure(); setStatus('Enviando documentos para as saídas…'); const result = await window.projects.export(); setStatus(`${result.pages} documento(s) salvos em ${result.outputs} pasta(s) de saída. ${[...new Set(result.warnings || [])].join(' ')}`); });
          }}>Enviar para saídas</button>
          <button disabled={busy} onClick={() => { if (canLeave()) void run(async () => { await certificate.ensure(); setStatus('Digitalizando… aguarde.'); const result = await window.scanner.scan(); setStatus(`${typeof result === 'number' ? result : result.pages} página(s) adicionada(s) ao projeto. ${typeof result === 'number' ? '' : [...new Set(result.warnings || [])].join(' ')}`); }); }}>＋ Digitalizar</button>
        </div>
      </div>
      <div className="review-layout">
        <aside className="page-sidebar" aria-label="Páginas digitalizadas">
          <div className="sidebar-heading"><h2>Páginas</h2><span>{pages.length} página(s)</span></div>
          <button className="quiet-button" disabled={!pages.length || busy} onClick={() => setSelected(selected.length === pages.length ? [] : pages.map(item => item.id))}>{selected.length === pages.length && pages.length ? 'Desmarcar todas' : 'Selecionar todas'}</button>
          <div id="pages">{pages.length ? pages.map((item, index) => <article className={`page-thumbnail ${active === item.id ? 'is-active' : ''} ${selected.includes(item.id) ? 'is-selected' : ''}`} key={item.id} onContextMenu={event => { event.preventDefault(); if (canLeave()) { setActive(item.id); setRotation({ id: item.id, x: event.clientX, y: event.clientY }); } }}>
            <label className="thumbnail-select"><input type="checkbox" checked={selected.includes(item.id)} onChange={event => setSelected(previous => event.target.checked ? [...previous, item.id] : previous.filter(id => id !== item.id))} aria-label={`Selecionar página ${index + 1}`} /><span>Página {String(index + 1).padStart(2, '0')}</span></label>
            <button className="thumbnail-open" type="button" aria-current={active === item.id ? 'page' : undefined} onClick={event => choosePage(item.id, event.ctrlKey || event.metaKey)} onKeyDown={event => { if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); const next = pages[index + (event.key === 'ArrowDown' ? 1 : -1)]; if (next) choosePage(next.id); } }}><img src={item.url} alt="" loading="lazy" draggable={false} /></button>
          </article>) : <p>Suas páginas aparecerão aqui.</p>}</div>
          <div className="selection-actions"><span aria-live="polite">{selected.length ? `${selected.length} selecionada(s)` : 'Nenhuma selecionada'}</span><button className="quiet-button" disabled={busy || !selected.length} onClick={() => void remove()}>Excluir selecionadas</button></div>
        </aside>
        <PreviewPanel page={page} pageIndex={pages.findIndex(item => item.id === active)} pageCount={pages.length} project={project} busy={busy} setStatus={setStatus} run={run} onDirtyChange={setDirty} updatePage={updated => setPages(previous => previous.map(item => item.id === updated.id ? updated : item))} />
      </div>
    </main>
    {rotation && <div className="page-context-menu" role="menu" style={{ position: 'fixed', left: rotation.x, top: rotation.y }} onKeyDown={event => { if (event.key === 'Escape') setRotation(null); }}><button role="menuitem" onClick={() => void rotate(rotation.id, 270)}>Girar 90° à esquerda</button><button role="menuitem" onClick={() => void rotate(rotation.id, 90)}>Girar 90° à direita</button><button role="menuitem" onClick={() => void rotate(rotation.id, 180)}>Girar 180°</button></div>}
    {mobile && <MobileDialog project={project} onClose={() => setMobile(false)} />}
  </div>;
}
