import { useEffect, useState } from 'react';
import type { Page, Project, Region } from './types';
import { CaptureEditor } from './CaptureEditor';
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
  run(action: () => Promise<void>): Promise<void>;
  setStatus(text: string): void;
  updatePage(page: Page): void;
  onDirtyChange?(dirty: boolean): void;
}
export function PreviewPanel({ page, pageIndex, pageCount, project, busy, run, setStatus, updatePage, onDirtyChange }: Props) {
  const certificate = useCertificate();
  const [original, setOriginal] = useState('');
  const [comparison, setComparison] = useState(false);
  const [ocrOpen, setOcrOpen] = useState(false);
  const [ocrText, setOcrText] = useState('');
  const [ocrSaved, setOcrSaved] = useState('');
  const [ocrRevision, setOcrRevision] = useState('');
  const [mode, setMode] = useState(project.processingMode || 'auto');
  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureEditor, setCaptureEditor] = useState(false);
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
  return <section className="preview-panel" aria-label="Prévia do documento">
    <div className="preview-toolbar">
      <h2>{page ? `Página ${String(pageIndex + 1).padStart(2, '0')}` : 'Prévia do documento'}</h2>
      <div className="preview-actions">
        <label className="processing-mode-label">Modo
          <select value={mode} onChange={event => setMode(event.target.value)} disabled={!page || busy}>
            <option value="auto">Automático profissional</option><option value="color">Documento colorido</option><option value="gray">Escala de cinza</option><option value="bw">Preto e branco</option>
          </select>
        </label>
        <button className="quiet-button" onClick={() => setCaptureEditor(true)} disabled={busy}>Modelos de captura</button>
        <button className="quiet-button" disabled={!page || busy} onClick={() => { if (captureOpen && captureDirty && !window.confirm('Há campos não salvos. Fechar e descartar as alterações?')) return; if (ocrDirty && !window.confirm('Há texto não salvo. Continuar e descartar as alterações?')) return; setCaptureOpen(!captureOpen); setOcrOpen(false); }}>Campos extraídos</button>
        <button className="quiet-button" disabled={!page || busy} onClick={() => void run(compare)}>Comparar original</button>
        <button className="quiet-button" disabled={!page || busy} onClick={() => void run(async () => {
          if (!page || !canReplaceImage()) return;
          if (page.hasOcr) await loadOcr();
          else { setStatus('Reconhecendo texto em português…'); const result = await window.scanner.ocr(page.id); updatePage(result); await loadOcr(); }
        })}>{page?.hasOcr ? 'Revisar texto (OCR)' : 'Reconhecer texto (OCR)'}</button>
        <button className="quiet-button" disabled={!page || busy} onClick={() => void run(async () => { if (!page || !canReplaceImage()) return; setCropImage(await window.scanner.original(page.id)); setCropOpen(true); })}>Ajustar recorte</button>
        <button className="quiet-button" disabled={!page || busy} onClick={() => void run(() => enhance())}>Melhorar PDF</button>
        <button className="quiet-button" disabled={!page || busy} onClick={() => void run(async () => {
          if (!page) return;
          if (captureDirty) { setStatus('Salve a revisão dos campos antes de exportar.'); return; }
          if (ocrDirty) await saveOcr();
          await certificate.ensure();
          const result = await window.scanner.save(page.id);
          setStatus(`Documento salvo${result.filename ? ': ' + result.filename : '.'} ${result.warning || ''}`);
        })}>Salvar documento</button>
      </div>
    </div>
    <PreviewZoom page={page} pageIndex={pageIndex} locked={busy} highlight={highlight} contentClassName={`${ocrOpen ? 'has-ocr' : ''} ${captureOpen ? 'has-capture' : ''}`}>
      {captureOpen && page && <CapturePanel page={page} project={project} onUpdate={updatePage} setStatus={setStatus} onDirtyChange={setCaptureDirty} onHighlight={setHighlight} />}
      {ocrOpen && <aside className="ocr-editor" aria-label="Texto reconhecido">
        <div className="ocr-editor-heading"><h2>Texto reconhecido</h2><button type="button" className="quiet-button" aria-label="Ocultar texto" onClick={() => { if (!ocrDirty || window.confirm('Há texto não salvo. Fechar e descartar as alterações?')) setOcrOpen(false); }}>×</button></div>
        <p role="status">{ocrDirty ? 'Alterações ainda não salvas.' : 'Texto salvo no projeto.'}</p>
        <label htmlFor="ocr-text">Revise e edite o texto desta página</label>
        <textarea id="ocr-text" value={ocrText} onChange={event => setOcrText(event.target.value)} spellCheck lang="pt-BR" />
        <p>As correções atualizam o texto pesquisável do PDF. A imagem permanece igual.</p>
        <div className="ocr-editor-actions">
          <button type="button" disabled={!ocrDirty} onClick={() => setOcrText(ocrSaved)}>Desfazer edições</button>
          <button type="button" disabled={!ocrDirty || busy} onClick={() => void run(saveOcr)}>Salvar correções</button>
        </div>
      </aside>}
    </PreviewZoom>
    <div className="preview-footer"><span>{page ? `${pageIndex + 1} de ${pageCount} página(s)` : 'Nenhum documento'}</span><span>Clique para selecionar · Delete para excluir</span></div>
    {comparison && page && <ModalBackdrop onClose={() => setComparison(false)}><div className="comparison-dialog" role="dialog" aria-modal="true" aria-label="Original e resultado"><div className="comparison-heading"><h2>Original e resultado</h2><button onClick={() => setComparison(false)}>Fechar</button></div><div className="comparison-images"><figure><figcaption>Original preservado</figcaption><img src={original} alt="Foto original preservada" /></figure><figure><figcaption>Resultado atual</figcaption><img src={page.url} alt="Documento processado" /></figure></div></div></ModalBackdrop>}
    {cropOpen && page && <CropEditor image={cropImage} onClose={() => setCropOpen(false)} onApply={corners => enhance(corners)} />}
    {captureEditor && <CaptureEditor settings={project} selected={project.captureTemplate || null} sampleUrl={page?.url} onClose={() => setCaptureEditor(false)} onSave={async model => { await window.capture.assign(model); setCaptureEditor(false); setStatus('Modelo de captura ativado no projeto.'); }} />}
  </section>;
}
