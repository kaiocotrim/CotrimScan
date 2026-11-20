import { Printer, Wrench } from 'lucide-react';
import { ManualIndexing } from './ManualIndexing';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/panelui/spinner';
import { CloseButton } from './CloseButton';
import { useEffect, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { SmartphoneNfcIcon } from '@/components/ui/smartphone-nfc';
import { GitCompareArrowsIcon } from '@/components/ui/git-compare-arrows';
import { MaximizeIcon } from '@/components/ui/maximize';
import { SparklesIcon } from '@/components/ui/sparkles';
import { FileTextIcon } from '@/components/ui/file-text';
import { ClipboardCheckIcon } from '@/components/ui/clipboard-check';
import { DownloadIcon } from '@/components/ui/download';
import { FolderOutputIcon } from '@/components/ui/folder-output';
import { ScanTextIcon } from '@/components/ui/scan-text';
import type { Page, Project, Region } from '@cotrimscan/shared';
import { CapturePanel } from './CapturePanel';
import { CropEditor } from './CropEditor';
import { PreviewZoom } from './PreviewZoom';
import { ModalBackdrop } from './ModalBackdrop';
import { useCertificate } from './CertificateDialogs';

interface Props {
  page?: Page;
  pageIndex: number;
  pageCount: number;
  project: Project;
  busy: boolean;
  scanning: boolean;
  indexingBusy: boolean;
  onIndexingPages(pages: Page[]): void;
  onConnectMobile(): void;
  onExport(): void;
  onScan(): void;
  onBack(): void;
  run(action: () => Promise<void>): Promise<void>;
  setStatus(text: string): void;
  updatePage(page: Page): void;
  onDirtyChange?(dirty: boolean): void;
}
const actionButton = 'm-0 flex items-center gap-2 w-auto rounded-sm border border-[#444] bg-[#262626] px-3 py-2 text-[11px] text-[#ccc] hover:border-[#777] hover:bg-[#333] disabled:cursor-default disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ddd]';
export function PreviewPanel({ page, pageIndex, pageCount, project, busy, indexingBusy, scanning, onIndexingPages, onConnectMobile, onExport, onScan, onBack, run, setStatus, updatePage, onDirtyChange }: Props) {
  const [openToolSections, setOpenToolSections] = useState<Record<string, boolean>>({ capture: false, image: false, recognition: false, export: false });
  const reducedMotion = useReducedMotion();
  function toolSection(id: string, title: string, children: ReactNode) {
    const expanded = openToolSections[id] ?? true;
    return <section className="scanner-tool-section" key={id}>
      <button type="button" className="scanner-tool-section-trigger" aria-expanded={expanded} onClick={() => setOpenToolSections(current => ({ ...current, [id]: !expanded }))}>
        <span>{title}</span><motion.span aria-hidden="true" animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: reducedMotion ? 0 : .18 }}>›</motion.span>
      </button>
      <motion.div className="scanner-tool-section-content" initial={false} animate={{ height: expanded ? 'auto' : 0, opacity: expanded ? 1 : 0 }} transition={{ duration: reducedMotion ? 0 : .2 }} inert={!expanded}><div className="scanner-tool-section-inner">{children}</div></motion.div>
    </section>;
  }
  const certificate = useCertificate();
  const [original, setOriginal] = useState('');
  const [comparison, setComparison] = useState(false);
  const [ocrOpen, setOcrOpen] = useState(false);
  const [ocrText, setOcrText] = useState('');
  const [ocrSaved, setOcrSaved] = useState('');
  const [ocrRevision, setOcrRevision] = useState('');
  const mode = project.processingMode || 'auto';
  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureDirty, setCaptureDirty] = useState(false);
  const [highlight, setHighlight] = useState<Region | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropImage, setCropImage] = useState('');
  const [manualNameMode, setManualNameMode] = useState(false);
  const [manualName, setManualName] = useState('');
  const ocrDirty = ocrOpen && ocrText !== ocrSaved;
  function canReplaceImage() {
    return (!ocrDirty && !captureDirty) || window.confirm('Alterações de texto ou campos não salvas serão descartadas. Continuar?');
  }
  useEffect(() => { setOcrOpen(false); setOcrText(''); setOcrSaved(''); setCaptureOpen(false); setCaptureDirty(false); setHighlight(null); setManualNameMode(false); setManualName(''); }, [page?.id]);
  useEffect(() => { onDirtyChange?.(ocrDirty || captureDirty); }, [ocrDirty, captureDirty, onDirtyChange]);
  async function loadOcr() {
    if (!page) return;
    const result = await window.scanner.readOcr(page.id, project.id);
    setOcrText(result.text); setOcrSaved(result.text); setOcrRevision(result.revision);
    setCaptureOpen(false); setOcrOpen(true);
  }
  async function saveOcr() {
    if (!page) return;
    const result = await window.scanner.saveOcr(page.id, ocrText, ocrRevision, project.id);
    setOcrText(result.text); setOcrSaved(result.text); setOcrRevision(result.revision);
    setStatus('Correções salvas no projeto.');
  }
  async function compare() {
    if (!page) return;
    setOriginal(await window.scanner.original(page.id));
    setComparison(true);
  }
  async function enhance(corners?: { x: number; y: number }[]) {
    if (!page || !canReplaceImage()) return;
    setStatus('Melhorando documento…');
    const result = await window.scanner.enhance(page.id, corners, mode);
    updatePage(result);
    setOcrOpen(false); setCaptureOpen(false);
    setCropOpen(false);
    await compare();
    setStatus('Documento melhorado e salvo no projeto.');
  }
  return <div className="grid min-h-0 min-w-0 grid-cols-[minmax(0,1fr)_270px] gap-4 max-[850px]:grid-cols-1 max-[850px]:overflow-y-auto">
    <Card className="scan-preview-card flex min-h-0 min-w-0 flex-col overflow-hidden rounded-sm border border-[#393939] bg-[#202020] p-0" aria-label="Prévia do documento">
    <div className="shrink-0 border-b border-[#363636] px-[18px] py-[13px] text-[13px] font-medium text-[#eee]">Prévia do documento</div>
    <PreviewZoom page={page} pageIndex={pageIndex} locked={busy} scanning={scanning} highlight={highlight} contentClassName={ocrOpen ? 'grid-cols-[minmax(0,1fr)_minmax(360px,1fr)] max-[1000px]:grid-cols-[minmax(0,1fr)] max-[1000px]:grid-rows-[minmax(220px,35vh)_minmax(380px,1fr)] max-[1000px]:overflow-auto' : captureOpen ? 'grid-cols-[minmax(0,1fr)_minmax(280px,.65fr)] max-[1000px]:grid-cols-[minmax(0,1fr)] max-[1000px]:grid-rows-[minmax(250px,1fr)_minmax(250px,1fr)] max-[1000px]:overflow-auto' : ''}>
      {captureOpen && page && <CapturePanel page={page} project={project} onUpdate={updatePage} setStatus={setStatus} onDirtyChange={setCaptureDirty} onHighlight={setHighlight} />}
      {ocrOpen && <aside className="flex min-h-0 min-w-0 flex-col gap-3.5 overflow-auto border-l border-[#444] bg-[#252525] p-[22px] max-[1000px]:border-l-0 max-[1000px]:border-t max-[1000px]:p-5" aria-label="Texto reconhecido">
        <div className="flex items-center justify-between gap-3"><h2 className="m-0 flex-1 text-[22px] font-semibold text-[#eee]">Texto reconhecido</h2><CloseButton label="Ocultar texto" onClick={() => { if (!ocrDirty || window.confirm('Há texto não salvo. Fechar e descartar as alterações?')) setOcrOpen(false); }} /></div>
        <p className="m-0 text-sm leading-[1.6] text-[#bbb]" role="status">{ocrDirty ? 'Alterações ainda não salvas.' : 'Texto salvo no projeto.'}</p>
        <label className="m-0 text-sm leading-[1.6] text-[#bbb]" htmlFor="ocr-text">Revise e edite o texto desta página</label>
        <textarea id="ocr-text" className="m-0 block min-h-[max(260px,45vh)] w-full flex-1 resize-y whitespace-pre-wrap rounded border border-[#555] bg-[#fafafa] p-4 font-[Segoe_UI,Arial,sans-serif] text-base leading-[1.65] text-[#202020] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#66aaff] max-[1000px]:min-h-[300px]" value={ocrText} onChange={event => setOcrText(event.target.value)} spellCheck lang="pt-BR" />
        <p className="m-0 text-sm leading-[1.6] text-[#bbb]">As correções atualizam o texto pesquisável do PDF. A imagem permanece igual.</p>
        <div className="flex flex-wrap justify-end gap-2.5">
          <Button variant="ghost" className={actionButton} type="button" disabled={!ocrDirty} onClick={() => setOcrText(ocrSaved)}>Desfazer edições</Button>
          <Button variant="ghost" className={actionButton} type="button" disabled={!ocrDirty || busy} onClick={() => void run(saveOcr)}>Salvar correções</Button>
        </div>
      </aside>}
    </PreviewZoom>
    <div className="flex shrink-0 justify-between gap-3 border-t border-[#363636] px-[18px] py-3 text-[9px] text-[#888] max-[600px]:p-2.5 [&>span:last-child]:max-[900px]:hidden"><span>{page ? `${pageIndex + 1} de ${pageCount} página(s)` : 'Nenhum documento'}</span><span>Clique para selecionar · Delete para excluir</span></div>
    </Card>
    <Card className="scan-tools-card flex min-h-0 min-w-0 flex-col overflow-hidden rounded-sm border border-[#393939] bg-[#202020]" aria-label="Ferramentas">
    <div className="scanner-tools-scroll flex min-h-0 flex-1 flex-col overflow-y-auto">
      <h2 className="scanner-tools-title"><Wrench size={16} strokeWidth={1.7} aria-hidden="true" /><span>Ferramentas</span></h2>
      <div className="scanner-tools-content flex flex-col items-stretch gap-2.5 px-4 py-4">
        {project.indexing?.enabled && <ManualIndexing project={project} pageCount={pageCount} busy={indexingBusy} run={run} onPages={onIndexingPages}/>}
        {toolSection('capture','Captura',<Button variant="ghost" className={`${actionButton} w-full text-left`} type="button" onClick={onConnectMobile} disabled={busy}><SmartphoneNfcIcon size={14} aria-hidden="true" />Conectar celular</Button>)}
        {toolSection('image', 'Imagem', <>
        <Button variant="ghost" className={`${actionButton} w-full text-left`} disabled={!page || busy} onClick={() => void run(compare)}><GitCompareArrowsIcon size={14} aria-hidden="true" />Comparar original</Button>
        <Button variant="ghost" className={`${actionButton} w-full text-left`} disabled={!page || busy} onClick={() => void run(async () => { if (!page || !canReplaceImage()) return; setCropImage(await window.scanner.original(page.id)); setCropOpen(true); })}><MaximizeIcon size={14} aria-hidden="true" />Ajustar recorte</Button>
        <Button variant="ghost" className={`${actionButton} w-full text-left`} disabled={!page || busy} onClick={() => void run(() => enhance())}><SparklesIcon size={14} aria-hidden="true" />Melhorar PDF</Button>
        </>)}
        {toolSection('recognition', 'Reconhecimento', <>
        <Button variant="ghost" className={`${actionButton} w-full text-left`} type="button" disabled={!page || busy} onClick={() => void run(async () => {
          if (!page) return;
          setStatus('Lendo QR Code e código de barras…');
          const result = await window.scanner.readCode(page.id, project.id);
          setStatus(result.status === 'found' ? `${result.format}: ${result.text}` : result.status === 'ambiguous' ? 'Mais de um código encontrado. Não foi possível determinar qual valor usar.' : 'Não foi possível ler um QR Code ou código de barras neste documento.');
        })}><ScanTextIcon size={14} aria-hidden="true" />Ler código de barras / QR Code</Button>
        <Button variant="ghost" className={`${actionButton} w-full text-left`} disabled={!page || busy} onClick={() => void run(async () => {
          if (!page || !canReplaceImage()) return;
          if (page.hasOcr) await loadOcr();
          else { setStatus('Reconhecendo texto em português…'); const result = await window.scanner.ocr(page.id); updatePage(result); await loadOcr(); }
        })}><FileTextIcon size={14} aria-hidden="true" />{page?.hasOcr ? 'Revisar texto (OCR)' : 'Reconhecer texto (OCR)'}</Button>
        <Button variant="ghost" className={`${actionButton} w-full text-left`} disabled={!page || busy} onClick={() => { if (captureOpen && captureDirty && !window.confirm('Há campos não salvos. Fechar e descartar as alterações?')) return; if (ocrDirty && !window.confirm('Há texto não salvo. Continuar e descartar as alterações?')) return; setCaptureOpen(!captureOpen); setOcrOpen(false); }}><ClipboardCheckIcon size={14} aria-hidden="true" />Campos extraídos</Button>
        </>)}
        {toolSection('export', 'Exportação', <>
        <Button variant="ghost" className={`${actionButton} w-full text-left`} disabled={!page || busy} onClick={() => void run(async () => {
          if (!page) return;
          if (manualNameMode) {
            const output = await window.scanner.name(page.id, manualName, project.id);
            setStatus(`Nome definido: ${output.filename}. Use Enviar para saídas para exportar.`);
            return;
          }
          if (captureDirty) { setStatus('Salve a revisão dos campos antes de exportar.'); return; }
          if (ocrDirty) await saveOcr();
          await certificate.ensure();
          const result = await window.scanner.save(page.id);
          setStatus(`Documento salvo${result.filename ? ': ' + result.filename : '.'} ${result.warning || ''}`);
        })}><DownloadIcon size={14} aria-hidden="true" />Salvar documento</Button>
        {project.namingMode === 'qr' || project.namingMode === 'barcode' ? <><label className="block text-[10px] leading-5 text-[#aaa]"><input type="checkbox" className="mr-2 align-middle" checked={manualNameMode} onChange={event => setManualNameMode(event.target.checked)} />Informar nome manualmente</label>{manualNameMode && <label className="block text-[10px] leading-5 text-[#aaa]">Nome do arquivo<input className="mt-1 block w-full rounded-sm border border-[#444] bg-[#191919] px-2.5 py-2 text-[11px] text-[#eee] placeholder:text-[#777] focus-visible:outline-2 focus-visible:outline-[#ddd]" value={manualName} onChange={event => setManualName(event.target.value)} placeholder="Digite o nome desejado" maxLength={180} /></label>}</> : null}
        <Button variant="ghost" className={`${actionButton} w-full text-left`} type="button" disabled={busy || !pageCount || !project.outputs.length} onClick={onExport}><FolderOutputIcon size={14} aria-hidden="true" />Enviar para saídas</Button>
        </>)}
      </div>
    </div>
    <div className="flex shrink-0 flex-col gap-2.5 border-t border-[#363636] p-4"><Button variant="ghost" className="scanner-start-button m-0 inline-flex w-full items-center justify-center gap-2 rounded-sm border border-[#ddd] bg-[#eee] px-4 py-3 text-xs font-medium text-[#222] hover:bg-white disabled:cursor-default disabled:opacity-40" type="button" disabled={busy} onClick={onScan}>{scanning ? <Spinner variant="ring" size="sm" label="Digitalizando" className="text-white" /> : <Printer size={18} strokeWidth={1.7} aria-hidden="true" />}{scanning ? 'Digitalizando…' : 'Digitalizar'}</Button><Button variant="ghost" className={`${actionButton} w-full justify-center border-[#a84249] bg-[#722a31] text-white hover:border-[#df6871] hover:bg-[#973943]`} type="button" disabled={busy} onClick={onBack}>← Voltar</Button></div>
    </Card>
    {comparison && page && <ModalBackdrop onClose={() => setComparison(false)}><div className="relative m-0 max-h-[calc(100dvh-32px)] w-[1240px] max-w-[94vw] overflow-auto border border-[#555] bg-[#202020] p-5 text-[13px] text-[#eee]" role="dialog" aria-modal="true" aria-label="Original e resultado"><div className="flex items-center justify-between gap-3"><h2 className="m-0 text-xl">Original e resultado</h2><Button variant="ghost" className="m-0 w-auto rounded-sm border-0 bg-[#eee] px-[15px] py-[9px] text-[#222]" onClick={() => setComparison(false)}>Fechar</Button></div><div className="mt-5 grid grid-cols-2 gap-4 max-[650px]:grid-cols-1"><figure className="m-0 min-w-0 p-0"><figcaption className="mb-2.5 text-center text-[#ccc]">Original preservado</figcaption><img className="block h-[65vh] w-full bg-[#111] object-contain max-[650px]:h-[55vh]" src={original} alt="Foto original preservada" /></figure><figure className="m-0 min-w-0 p-0"><figcaption className="mb-2.5 text-center text-[#ccc]">Resultado atual</figcaption><img className="block h-[65vh] w-full bg-[#111] object-contain max-[650px]:h-[55vh]" src={page.url} alt="Documento processado" /></figure></div></div></ModalBackdrop>}
    {cropOpen && page && <CropEditor image={cropImage} onClose={() => setCropOpen(false)} onApply={corners => enhance(corners)} />}
  </div>;
}
