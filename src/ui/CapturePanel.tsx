import { useEffect, useState } from 'react';
import type { CaptureData, Page, Project, Region } from './types';

interface Props { page: Page; project: Project; onUpdate(page: Page): void; setStatus(text: string): void; onDirtyChange?(dirty: boolean): void; onHighlight?(region: Region | null): void }
const buttonClass = 'm-0 w-full rounded border border-[#555] bg-[#303030] px-3 py-2 text-xs text-[#eee] hover:bg-[#3b3b3b] disabled:cursor-not-allowed disabled:opacity-50';

export function CapturePanel({ page, project, onUpdate, setStatus, onDirtyChange, onHighlight }: Props) {
  const [data, setData] = useState<CaptureData | null>(page.captureData || null);
  const [values, setValues] = useState<{ id: string; value: string; reviewed: boolean }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dirty = !!data && JSON.stringify(values) !== JSON.stringify(data.fields.map(field => ({ id: field.id, value: field.value, reviewed: field.reviewed })));
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false); }, [dirty, onDirtyChange]);
  useEffect(() => () => onHighlight?.(null), [onHighlight]);
  useEffect(() => {
    let live = true;
    setData(page.captureData || null);
    void window.capture.read(page.id, project.id).then(result => {
      if (live) { setData(result); if (result) setValues(result.fields.map(field => ({ id: field.id, value: field.value, reviewed: field.reviewed }))); }
    }).catch(reason => { if (live) setError(String(reason)); });
    return () => { live = false; };
  }, [page.id, project.id]);
  async function action(callback: () => Promise<void>) { setBusy(true); setError(''); try { await callback(); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } finally { setBusy(false); } }
  function update(id: string, change: Partial<{ value: string; reviewed: boolean }>) { setValues(previous => previous.map(item => item.id === id ? { ...item, ...change } : item)); }

  return <aside className="min-w-0 overflow-auto border-l border-[#555] bg-[#252525] p-[18px] text-[#eee] max-[1000px]:border-l-0 max-[1000px]:border-t" aria-labelledby="capture-panel-title">
    <h2 id="capture-panel-title" className="m-0 text-base font-normal">Campos do documento</h2>
    <p className="my-3 text-xs leading-normal">{data?.template.name || project.captureTemplate?.name}</p>
    <div>{data?.fields.map(field => {
      const draft = values.find(item => item.id === field.id) || field;
      return <section className="border-0 border-b border-[#555] bg-transparent px-0 py-3" key={field.id}>
        <label className="m-0 block text-[13px] font-normal">{field.name}<input className="mt-1.5 block w-full rounded border border-[#888] bg-[#fafafa] p-2.5 text-base text-[#222]" type="text" value={draft.value} maxLength={2000} onFocus={() => onHighlight?.(field.resolvedRegion || field.region)} onBlur={() => onHighlight?.(null)} onChange={event => update(field.id, { value: event.target.value, reviewed: false })} /></label>
        <p className="my-2 text-xs leading-normal">OCR: {field.recognized || '(vazio)'} · confiança {Math.round(field.confidence || 0)}%</p>
        <p className="my-2 text-xs leading-normal text-[#ffd58a]">{field.error || ((field.confidence || 0) < 70 ? 'Baixa confiança: confira na imagem.' : 'Confira com o documento.')}</p>
        <label className="m-0 flex items-center gap-2 text-[13px] font-normal"><input className="m-0 size-4 w-auto" type="checkbox" checked={draft.reviewed} onChange={event => update(field.id, { reviewed: event.target.checked })} /> Conferido com o documento</label>
      </section>;
    })}</div>
    <p className="my-3 text-xs leading-normal" role="status" aria-live="polite">{error || (dirty ? 'Alterações ainda não salvas.' : data ? 'Confira os campos antes de exportar.' : 'Clique em Extrair campos para aplicar o modelo.')}</p>
    <div className="flex flex-col gap-2">
      <button className={buttonClass} type="button" disabled={busy} onClick={() => void action(async () => { const result = await window.capture.extract(page.id, project.id); setData(result); setValues(result.fields.map(field => ({ id: field.id, value: field.value, reviewed: field.reviewed }))); onUpdate({ ...page, captureData: result }); setStatus('Captura concluída. Confira os campos.'); })}>Extrair campos</button>
      <button className={buttonClass} type="button" disabled={busy || !data || !dirty} onClick={() => void action(async () => { if (!data) return; const result = await window.capture.save(page.id, values, data.revision, project.id); setData(result); setValues(result.fields.map(field => ({ id: field.id, value: field.value, reviewed: field.reviewed }))); onUpdate({ ...page, captureData: result }); setStatus('Dados de indexação salvos no projeto.'); })}>Salvar revisão</button>
    </div>
  </aside>;
}
