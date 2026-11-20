import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import type { IndexedDocument, Page, Project } from '@cotrimscan/shared';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const button = '!m-0 !min-h-10 !rounded-xl !border-0 !bg-[#343b42] !px-4 !text-xs !text-[#eee] hover:!bg-[#46515c] disabled:!opacity-40';
const input = '!mt-1 !h-10 !rounded-xl !border-0 !bg-[#191e22] !text-xs !text-[#eee]';
interface Props {
 project: Project; pageCount: number; busy: boolean;
 onPages(pages: Page[]): void;
 run(action: () => Promise<void>): Promise<void>;
}
export function ManualIndexing({ project, pageCount, busy, onPages, run }: Props) {
 const [queue,setQueue]=useState<IndexedDocument[]>([]);
 const [values,setValues]=useState<Record<string,string>>({});
 const [open,setOpen]=useState(false);
 const [working,setWorking]=useState(false);
 const [error,setError]=useState('');
 const [selected,setSelected]=useState<string>('');
 const [preview,setPreview]=useState(0);
 const [viewMode,setViewMode]=useState<'page'|'thumbnails'|'duplex'>('page');
 const [edits,setEdits]=useState<Record<string,string>>({});
 const [expanded,setExpanded]=useState(false);
 const reduced=useReducedMotion();
 const fields=project.indexing?.fields||[];
 const doc=queue.find(d=>d.id===selected);
 const valid=(v:Record<string,string>)=>fields.length>0&&fields.every(f=>v[f.id]?.trim());
 const changed=!!doc&&fields.some(f=>(edits[f.id]||'')!==(doc.values[f.id]||''));
 const locked=busy||working;
 useEffect(()=>{
  let cancelled=false;
  window.projects.indexingQueue(project.id,'list').then(result=>{if(!cancelled)setQueue(result.documents);}).catch(e=>{if(!cancelled)setError(String(e));});
  return ()=>{cancelled=true;};
 },[project.id]);
 async function action(command:string, payload?:{id?:string;values?:Record<string,string>}) {
  if(locked)return;
  setWorking(true);setError('');
  try{await run(async()=>{
   try {
    const result=await window.projects.indexingQueue(project.id,command,payload);
    setQueue(result.documents);
    if(command==='add'||command==='remove')onPages(result.pages);
    if(command==='add')setValues({});
    if(command==='remove'){const next=result.documents[0];setSelected(next?.id||'');setEdits(next?.values||{});setPreview(0);}
    if(command==='edit'){const updated=result.documents.find(d=>d.id===selected);if(updated)setEdits(updated.values);}
   }catch(e){
    setError(e instanceof Error?e.message:String(e));
    // Successful batches remain processed if a later destination failed.
    if(command==='process')try{setQueue((await window.projects.indexingQueue(project.id,'list')).documents);}catch{}
   }
  });}finally{setWorking(false);}
 }
 function select(next:IndexedDocument){
  if(changed&&!window.confirm('Descartar as alterações não salvas deste lote?'))return;
  setSelected(next.id);setPreview(0);setEdits({...next.values});
 }
 function close(){if(!locked&&(!changed||window.confirm('Descartar as alterações não salvas?')))setOpen(false);}
 function showQueue(){const first=queue.find(d=>!d.processed)||queue[0];if(first)select(first);setOpen(true);}
 const pending=queue.filter(d=>!d.processed).length;
 return <>
 <motion.section initial={{opacity:0,y:reduced?0:10}} animate={{opacity:1,y:0}} className="manual-indexing !m-0 !rounded-xl !border-0 !bg-[#252a2f] !p-0">
  <button type="button" aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)} className="scanner-tool-section-trigger">
   <span>Indexação manual</span>
   <motion.span animate={{rotate:expanded?90:0}} transition={{duration:.18}} aria-hidden="true" >›</motion.span>
  </button>
  <motion.div initial={false} animate={{height:expanded?'auto':0,opacity:expanded?1:0}} transition={{duration:reduced?0:.22}} className="overflow-hidden" inert={!expanded}>
   <div className="px-1 pb-4 pt-2">
    <p className="my-2 text-[10px] text-[#aeb8c2]">Documento atual · {pageCount} página(s)</p>
    {fields.map(f=><label key={f.id} className="!my-2 !block !text-[11px] !text-[#8fc5ff]">{f.name}<Input disabled={!expanded||locked} type={f.type==='date'?'date':'text'} inputMode={f.type==='number'?'numeric':undefined} className={input} value={values[f.id]||''} onChange={e=>setValues({...values,[f.id]:e.target.value})}/></label>)}
    <Button className={`${button} !w-full`} disabled={!expanded||locked||!pageCount||!valid(values)} onClick={()=>void action('add',{values})}>✓ Finalizar documento</Button>
    <p className="my-3 text-[10px] text-[#aaa]">Fila de documentos · {pending} pendentes</p>
    <Button className={`${button} !w-full`} disabled={!expanded||locked} onClick={showQueue}>Visualizar fila</Button>
    {error&&!open&&<p role="alert" className="text-xs text-[#f0a4ac]">{error}</p>}
   </div>
  </motion.div>
 </motion.section>
 {open&&createPortal(<motion.div initial={{opacity:0,y:reduced?0:18}} animate={{opacity:1,y:0}} transition={{duration:.3}} role="dialog" aria-modal="true" aria-label="Fila de documentos" className="document-queue-screen fixed inset-0 z-[1200] flex flex-col gap-3 overflow-hidden bg-[#171819] p-4 text-[#eee] max-[700px]:p-3" onKeyDown={e=>{if(e.key==='Escape')close();}}>
  <header className="flex shrink-0 items-center justify-between gap-4 rounded-xl bg-[#242526] px-4 py-3"><div><h2 className="m-0 text-lg font-semibold">Fila de documentos</h2><p className="my-1 text-xs text-[#abb5bf]">{queue.length} lotes · {queue.reduce((n,d)=>n+d.pageCount,0)} páginas</p></div><div className="flex items-center gap-3"><span className="rounded-full bg-[#173a2c] px-3 py-1 text-[11px] text-[#72d79e]">{queue.filter(d=>d.processed).length} processados</span><Button autoFocus className={button} disabled={locked} onClick={close}>Voltar à digitalização</Button></div></header>
  <div className="queue-layout grid min-h-0 flex-1 grid-cols-[minmax(190px,240px)_minmax(0,1fr)_minmax(220px,280px)] gap-3 max-[850px]:grid-cols-[170px_minmax(0,1fr)] max-[600px]:grid-cols-1 max-[600px]:grid-rows-[auto_minmax(220px,1fr)_auto]">
   <nav aria-label="Lotes" className="queue-scroll flex min-h-0 flex-col gap-2 overflow-auto rounded-xl bg-[#222324] p-3">
    <h3 className="m-0 mb-1 text-[11px] font-medium uppercase tracking-wide text-[#aeb3b8]">Lotes · {queue.length}</h3>
    {!queue.length&&<p className="text-sm text-[#aaa]">Nenhum lote finalizado. Digitalize páginas e clique em Finalizar documento.</p>}
    {queue.map((item,index)=><button key={item.id} disabled={locked} aria-pressed={item.id===selected} onClick={()=>select(item)} className={`!m-0 flex !w-full flex-col items-stretch !rounded-lg !border-0 !p-3 text-left transition-colors ${item.id===selected?'!bg-[#38424a]':'!bg-[#292a2b] hover:!bg-[#343637]'}`}><span className="text-xs font-medium">Lote {String(index+1).padStart(3,'0')}</span><span className="mt-1 truncate text-[10px] text-[#adb3b8]">{Object.values(item.values).join(' · ')}</span><span className={`mt-2 w-fit rounded-full px-2 py-0.5 text-[10px] ${item.missingPages?.length?'bg-[#502c2b] text-[#f0aaa3]':item.processed?'bg-[#173a2c] text-[#72d79e]':'bg-[#15392d] text-[#72d79e]'}`}>{item.missingPages?.length?'Imagens ausentes':item.processed?'Processado':`${item.pageCount} página(s)`}</span></button>)}
   </nav>
   <section aria-label="Páginas do lote" className="flex min-h-0 flex-col gap-2 rounded-xl bg-[#222324] p-3">
    {doc?<>
     <div className="queue-preview-toolbar">
      <span>{viewMode==='duplex'?`Folha ${Math.floor(preview/2)+1} de ${Math.ceil(doc.pageCount/2)}`:`Página ${preview+1} de ${doc.pageCount}`}</span>
      <div className="queue-view-modes" role="group" aria-label="Modo de visualização">
       {([['page','Página'],['thumbnails','Miniaturas'],['duplex','Frente e verso']] as const).map(([mode,label])=><button key={mode} type="button" aria-pressed={viewMode===mode} onClick={()=>{setViewMode(mode);if(mode==='duplex')setPreview(p=>p-p%2);}}>{label}</button>)}
      </div>
      <div className="queue-navigation">
       <button type="button" aria-label="Página anterior" disabled={preview===0||viewMode==='thumbnails'} onClick={()=>setPreview(p=>Math.max(0,p-(viewMode==='duplex'?2:1)))}>‹</button>
       <button type="button" aria-label="Próxima página" disabled={preview+(viewMode==='duplex'?2:1)>=doc.pageCount||viewMode==='thumbnails'} onClick={()=>setPreview(p=>Math.min(doc.pageCount-1,p+(viewMode==='duplex'?2:1)))}>›</button>
      </div>
     </div>
     {viewMode==='thumbnails'?<div className="queue-page-grid queue-scroll">{doc.previews.map((url,i)=><button key={i} type="button" onClick={()=>{setPreview(i);setViewMode('page');}}>{url?<img src={url} alt={`Página ${i+1}`} loading="lazy"/>:<span>Imagem indisponível</span>}<span>Página {i+1}</span></button>)}</div>:<div className={`queue-document-pages ${viewMode==='duplex'?'is-duplex':''}`}>
      {(viewMode==='duplex'?[preview-preview%2,preview-preview%2+1]:[preview]).map(i=><figure key={i}>
       {viewMode==='duplex'&&<figcaption>{i%2===0?'Frente':'Verso'} · {i<doc.pageCount?`Página ${i+1}`:'Sem página'}</figcaption>}
       {doc.previews[i]?<img src={doc.previews[i]} alt={`Página ${i+1} do lote selecionado`}/>:<p>{i>=doc.pageCount?'Este lote não tem verso para esta folha.':'Imagem indisponível.'}</p>}
      </figure>)}
     </div>}
     {viewMode!=='thumbnails'&&<div className="queue-thumbnail-strip queue-scroll">{doc.previews.map((url,i)=><button key={i} type="button" aria-label={`Ver página ${i+1}`} aria-pressed={viewMode==='duplex'?Math.floor(i/2)===Math.floor(preview/2):i===preview} onClick={()=>setPreview(viewMode==='duplex'?i-i%2:i)}>{url?<img src={url} alt="" loading="lazy"/>:<span>Ausente</span>}<span>{i+1}</span></button>)}</div>}
    </>:<p className="m-auto text-sm text-[#aab4bd]">Selecione um lote para visualizar suas páginas.</p>}

   </section>
   <aside className="queue-scroll flex min-h-0 flex-col overflow-auto rounded-xl bg-[#222324] p-4 max-[850px]:col-span-2 max-[850px]:max-h-52 max-[600px]:col-span-1">
    {doc&&<><h3 className="mt-0 text-sm">Identificação do lote</h3>{!!doc.missingPages?.length&&<p role="alert" className="text-xs text-[#f0b9ac]">{doc.missingPages.length} imagem(ns) não encontrada(s). Remova o lote da fila, importe novamente as fotos ausentes e finalize o documento. As páginas disponíveis serão preservadas.</p>}{fields.map(f=><label key={f.id} className="my-3 block text-xs">{f.name}<Input className={input} disabled={locked||doc.processed} type={f.type==='date'?'date':'text'} inputMode={f.type==='number'?'numeric':undefined} value={edits[f.id]||''} onChange={e=>setEdits({...edits,[f.id]:e.target.value})}/></label>)}<Button className={`${button} !w-full`} disabled={locked||doc.processed||!changed||!valid(edits)} onClick={()=>void action('edit',{id:doc.id,values:edits})}>Salvar identificação</Button><p className="break-all text-[11px] text-[#aab4bd]">Pasta de saída: {doc.folder}/documento.pdf</p><Button className={`${button} !w-full !bg-[#623238]`} disabled={locked} onClick={()=>{if(window.confirm(doc.processed?'Remover este lote processado da fila? As páginas disponíveis voltarão à digitalização. Os arquivos exportados serão mantidos.':doc.missingPages?.length?'Remover este lote incompleto? Apenas as páginas disponíveis voltarão à digitalização. Depois importe novamente as fotos ausentes.':'Remover este lote da fila e devolver suas páginas à digitalização?'))void action('remove',{id:doc.id});}}>Remover lote da fila</Button><p className="text-[11px] text-[#aab4bd]">As páginas disponíveis voltam à digitalização. Os arquivos exportados são mantidos.</p></>}
   </aside>
  </div>
  <footer className="flex shrink-0 items-center justify-between gap-3 rounded-xl bg-[#242526] px-4 py-2"><p role={error?'alert':'status'} className={`m-0 min-w-0 truncate text-xs ${error?'text-[#f0a4ac]':'text-[#c4c8cb]'}`}>{error||(working?'Processando lotes…':changed?'Salve a identificação antes de processar.':`${pending} lote(s) pronto(s) para exportar`)}</p><Button className={`${button} !min-w-28 !bg-[#173a2c] !text-[#72d79e]`} disabled={locked||!pending||changed} onClick={()=>void action('process')}>{working?'Processando…':'Processar fila'}</Button></footer>
 </motion.div>,document.body)}
 </>;
}
