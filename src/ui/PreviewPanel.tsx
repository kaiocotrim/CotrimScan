import { useEffect, useState } from 'react';
import PhoneAndroidOutlined from '@mui/icons-material/PhoneAndroidOutlined';
import CompareOutlined from '@mui/icons-material/CompareOutlined';
import CropOutlined from '@mui/icons-material/CropOutlined';
import AutoFixHighOutlined from '@mui/icons-material/AutoFixHighOutlined';
import TextSnippetOutlined from '@mui/icons-material/TextSnippetOutlined';
import FactCheckOutlined from '@mui/icons-material/FactCheckOutlined';
import SaveAltOutlined from '@mui/icons-material/SaveAltOutlined';
import DriveFolderUploadOutlined from '@mui/icons-material/DriveFolderUploadOutlined';
import type { Page, Project, Region } from './types';
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
  onConnectMobile(): void;
  onExport(): void;
  onScan(): void;
  run(action: () => Promise<void>): Promise<void>;
  setStatus(text: string): void;
  updatePage(page: Page): void;
  onDirtyChange?(dirty: boolean): void;
}
const actionButton = 'm-0 flex items-center gap-2 w-auto rounded-sm border border-[#444] bg-[#262626] px-3 py-2 text-[11px] text-[#ccc] hover:border-[#777] hover:bg-[#333] disabled:cursor-default disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ddd]';
export function PreviewPanel({ page, pageIndex, pageCount, project, busy, onConnectMobile, onExport, onScan, run, setStatus, updatePage, onDirtyChange }: Props) {
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
  const ocrDirty = ocrOpen && ocrText !== ocrSaved;
  function canReplaceImage() {
    return (!ocrDirty && !captureDirty) || window.confirm('Alterações de texto ou campos não salvas serão descartadas. Continuar?');
  }
  useEffect(() => { setOcrOpen(false); setOcrText(''); setOcrSaved(''); setCaptureOpen(false); setCaptureDirty(false); setHighlight(null); }, [page?.id]);
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
    <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-sm border border-[#393939] bg-[#202020] p-0" aria-label="Prévia do documento">
    <div className="shrink-0 border-b border-[#363636] px-[18px] py-[13px] text-[13px] font-medium text-[#eee]">Prévia do documento</div>
    <PreviewZoom page={page} pageIndex={pageIndex} locked={busy} highlight={highlight} contentClassName={ocrOpen ? 'grid-cols-[minmax(0,1fr)_minmax(360px,1fr)] max-[1000px]:grid-cols-[minmax(0,1fr)] max-[1000px]:grid-rows-[minmax(220px,35vh)_minmax(380px,1fr)] max-[1000px]:overflow-auto' : captureOpen ? 'grid-cols-[minmax(0,1fr)_minmax(280px,.65fr)] max-[1000px]:grid-cols-[minmax(0,1fr)] max-[1000px]:grid-rows-[minmax(250px,1fr)_minmax(250px,1fr)] max-[1000px]:overflow-auto' : ''}>
      {captureOpen && page && <CapturePanel page={page} project={project} onUpdate={updatePage} setStatus={setStatus} onDirtyChange={setCaptureDirty} onHighlight={setHighlight} />}
      {ocrOpen && <aside className="flex min-h-0 min-w-0 flex-col gap-3.5 overflow-auto border-l border-[#444] bg-[#252525] p-[22px] max-[1000px]:border-l-0 max-[1000px]:border-t max-[1000px]:p-5" aria-label="Texto reconhecido">
        <div className="flex items-center justify-between gap-3"><h2 className="m-0 flex-1 text-[22px] font-semibold text-[#eee]">Texto reconhecido</h2><button type="button" className={actionButton} aria-label="Ocultar texto" onClick={() => { if (!ocrDirty || window.confirm('Há texto não salvo. Fechar e descartar as alterações?')) setOcrOpen(false); }}>×</button></div>
        <p className="m-0 text-sm leading-[1.6] text-[#bbb]" role="status">{ocrDirty ? 'Alterações ainda não salvas.' : 'Texto salvo no projeto.'}</p>
        <label className="m-0 text-sm leading-[1.6] text-[#bbb]" htmlFor="ocr-text">Revise e edite o texto desta página</label>
        <textarea id="ocr-text" className="m-0 block min-h-[max(260px,45vh)] w-full flex-1 resize-y whitespace-pre-wrap rounded border border-[#555] bg-[#fafafa] p-4 font-[Segoe_UI,Arial,sans-serif] text-base leading-[1.65] text-[#202020] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#66aaff] max-[1000px]:min-h-[300px]" value={ocrText} onChange={event => setOcrText(event.target.value)} spellCheck lang="pt-BR" />
        <p className="m-0 text-sm leading-[1.6] text-[#bbb]">As correções atualizam o texto pesquisável do PDF. A imagem permanece igual.</p>
        <div className="flex flex-wrap justify-end gap-2.5">
          <button className={actionButton} type="button" disabled={!ocrDirty} onClick={() => setOcrText(ocrSaved)}>Desfazer edições</button>
          <button className={actionButton} type="button" disabled={!ocrDirty || busy} onClick={() => void run(saveOcr)}>Salvar correções</button>
        </div>
      </aside>}
    </PreviewZoom>
    <div className="flex shrink-0 justify-between gap-3 border-t border-[#363636] px-[18px] py-3 text-[9px] text-[#888] max-[600px]:p-2.5 [&>span:last-child]:max-[900px]:hidden"><span>{page ? `${pageIndex + 1} de ${pageCount} página(s)` : 'Nenhum documento'}</span><span>Clique para selecionar · Delete para excluir</span></div>
    </section>
    <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-sm border border-[#393939] bg-[#202020]" aria-label="Ferramentas">
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <h2 className="m-0 border-b border-[#363636] px-4 py-[13px] text-[13px] font-medium text-[#eee]">Ferramentas</h2>
      <div className="flex flex-col items-stretch gap-2.5 px-4 py-4">
        <div className="text-[9px] tracking-[1.5px] text-[#aaa]">CAPTURA</div>
        <button className={`${actionButton} w-full text-left`} type="button" onClick={onConnectMobile} disabled={busy}><PhoneAndroidOutlined sx={{ fontSize: '14px', width: '14px', height: '14px', color: 'inherit' }} aria-hidden="true" />Conectar celular</button>
        <div className="mt-3 border-t border-[#ffffff16] pt-4 text-[9px] tracking-[1.5px] text-[#aaa]">IMAGEM</div>
        <button className={`${actionButton} w-full text-left`} disabled={!page || busy} onClick={() => void run(compare)}><CompareOutlined sx={{ fontSize: '14px', width: '14px', height: '14px', color: 'inherit' }} aria-hidden="true" />Comparar original</button>
        <button className={`${actionButton} w-full text-left`} disabled={!page || busy} onClick={() => void run(async () => { if (!page || !canReplaceImage()) return; setCropImage(await window.scanner.original(page.id)); setCropOpen(true); })}><CropOutlined sx={{ fontSize: '14px', width: '14px', height: '14px', color: 'inherit' }} aria-hidden="true" />Ajustar recorte</button>
        <button className={`${actionButton} w-full text-left`} disabled={!page || busy} onClick={() => void run(() => enhance())}><AutoFixHighOutlined sx={{ fontSize: '14px', width: '14px', height: '14px', color: 'inherit' }} aria-hidden="true" />Melhorar PDF</button>
        <div className="mt-3 border-t border-[#ffffff16] pt-4 text-[9px] tracking-[1.5px] text-[#aaa]">RECONHECIMENTO</div>
        <button className={`${actionButton} w-full text-left`} disabled={!page || busy} onClick={() => void run(async () => {
          if (!page || !canReplaceImage()) return;
          if (page.hasOcr) await loadOcr();
          else { setStatus('Reconhecendo texto em português…'); const result = await window.scanner.ocr(page.id); updatePage(result); await loadOcr(); }
        })}><TextSnippetOutlined sx={{ fontSize: '14px', width: '14px', height: '14px', color: 'inherit' }} aria-hidden="true" />{page?.hasOcr ? 'Revisar texto (OCR)' : 'Reconhecer texto (OCR)'}</button>
        <button className={`${actionButton} w-full text-left`} disabled={!page || busy} onClick={() => { if (captureOpen && captureDirty && !window.confirm('Há campos não salvos. Fechar e descartar as alterações?')) return; if (ocrDirty && !window.confirm('Há texto não salvo. Continuar e descartar as alterações?')) return; setCaptureOpen(!captureOpen); setOcrOpen(false); }}><FactCheckOutlined sx={{ fontSize: '14px', width: '14px', height: '14px', color: 'inherit' }} aria-hidden="true" />Campos extraídos</button>
        <div className="mt-3 border-t border-[#ffffff16] pt-4 text-[9px] tracking-[1.5px] text-[#aaa]">EXPORTAÇÃO</div>
        <button className={`${actionButton} w-full text-left`} disabled={!page || busy} onClick={() => void run(async () => {
          if (!page) return;
          if (captureDirty) { setStatus('Salve a revisão dos campos antes de exportar.'); return; }
          if (ocrDirty) await saveOcr();
          await certificate.ensure();
          const result = await window.scanner.save(page.id);
          setStatus(`Documento salvo${result.filename ? ': ' + result.filename : '.'} ${result.warning || ''}`);
        })}><SaveAltOutlined sx={{ fontSize: '14px', width: '14px', height: '14px', color: 'inherit' }} aria-hidden="true" />Salvar documento</button>
        <button className={`${actionButton} w-full text-left`} type="button" disabled={busy || !pageCount || !project.outputs.length} onClick={onExport}><DriveFolderUploadOutlined sx={{ fontSize: '14px', width: '14px', height: '14px', color: 'inherit' }} aria-hidden="true" />Enviar para saídas</button>
      </div>
    </div>
    <div className="shrink-0 border-t border-[#363636] p-4"><button className="m-0 w-full rounded-sm border border-[#ddd] bg-[#eee] px-4 py-3 text-xs font-medium text-[#222] hover:bg-white disabled:cursor-default disabled:opacity-40" type="button" disabled={busy} onClick={onScan}>＋ Digitalizar</button></div>
    </aside>
    {comparison && page && <ModalBackdrop onClose={() => setComparison(false)}><div className="relative m-0 max-h-[calc(100dvh-32px)] w-[1240px] max-w-[94vw] overflow-auto border border-[#555] bg-[#202020] p-5 text-[13px] text-[#eee]" role="dialog" aria-modal="true" aria-label="Original e resultado"><div className="flex items-center justify-between gap-3"><h2 className="m-0 text-xl">Original e resultado</h2><button className="m-0 w-auto rounded-sm border-0 bg-[#eee] px-[15px] py-[9px] text-[#222]" onClick={() => setComparison(false)}>Fechar</button></div><div className="mt-5 grid grid-cols-2 gap-4 max-[650px]:grid-cols-1"><figure className="m-0 min-w-0 p-0"><figcaption className="mb-2.5 text-[#ccc]">Original preservado</figcaption><img className="block h-[65vh] w-full bg-[#111] object-contain max-[650px]:h-[55vh]" src={original} alt="Foto original preservada" /></figure><figure className="m-0 min-w-0 p-0"><figcaption className="mb-2.5 text-[#ccc]">Resultado atual</figcaption><img className="block h-[65vh] w-full bg-[#111] object-contain max-[650px]:h-[55vh]" src={page.url} alt="Documento processado" /></figure></div></div></ModalBackdrop>}
    {cropOpen && page && <CropEditor image={cropImage} onClose={() => setCropOpen(false)} onApply={corners => enhance(corners)} />}
  </div>;
}
