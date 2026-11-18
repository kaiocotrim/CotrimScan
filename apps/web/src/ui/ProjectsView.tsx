import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { Project } from '@cotrimscan/shared';
import { ScannerSelector } from './ScannerSelector';

interface Props { onRefresh(): Promise<void>; username: string; projects: Project[]; status: string; setStatus(text: string): void; busy: boolean; onLogout(): void; onNew(): void; onOpen(project: Project): void; onEdit(project: Project): void }

const primaryButton = 'm-0 w-auto shrink-0 rounded-md border border-[#61acfa70] bg-[#3287dc] px-[18px] py-3 text-xs text-white hover:bg-[#4397ea] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#75baff]';

export function ProjectsView({ onRefresh, username, projects, status, setStatus, busy, onLogout, onNew, onOpen, onEdit }: Props) {
  const [menu,setMenu]=useState<{project:Project;x:number;y:number}|null>(null);
  const [renaming,setRenaming]=useState<Project|null>(null),[name,setName]=useState(''),[error,setError]=useState('');
  const reduceMotion=useReducedMotion();
  useEffect(()=>{const close=()=>setMenu(null);window.addEventListener('click',close);window.addEventListener('blur',close);return()=>{window.removeEventListener('click',close);window.removeEventListener('blur',close);};},[]);
  async function action(task:()=>Promise<unknown>){try{setError('');await task();await onRefresh();}catch(e){setError(String(e));}}
  const [selected, setSelected] = useState<string | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  return <div id="projects-view" className="min-h-dvh bg-[#181818] font-[Arial,Helvetica,sans-serif] text-[#e8e8e8]">
    <header className="flex items-center justify-between gap-6 border-b border-[#ffffff0d] bg-[#181818] px-10 py-[22px] max-[900px]:px-6 max-[900px]:py-[18px] max-[600px]:gap-3">
      <img className="block h-auto w-32 shrink-0 object-contain" src="assets/icones_3d/download.png" width={128} height={30} alt="CotrimScan" />
      <div className="relative"><button type="button" className="m-0 flex w-auto items-center gap-2 rounded-full border-0 bg-transparent px-2 py-1 text-[#dce7f3] hover:bg-[#ffffff08]" aria-haspopup="menu" aria-expanded={userMenuOpen} onClick={() => setUserMenuOpen(value => !value)}><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#ffffff12] text-xs font-semibold uppercase">{username.charAt(0)}</span><span className="max-w-36 truncate text-xs">{username}</span></button>{userMenuOpen && <div className="absolute right-0 top-full z-20 mt-2 min-w-36 rounded-md border border-[#ffffff20] bg-[#252525] p-1 shadow-xl" role="menu"><button type="button" role="menuitem" className="account-logout m-0 w-full rounded px-3 py-2 text-left text-xs" onClick={onLogout} disabled={busy}>Sair da conta</button></div>}</div>
    </header>
    <main className="mx-auto block max-w-[1600px] px-14 py-[50px] max-[900px]:px-6 max-[900px]:py-8">
      <div className="flex items-center justify-between gap-7 max-[600px]:flex-col max-[600px]:items-start">
        <div><span className="text-[9px] tracking-[2px] text-[#73a8d9]">SEU ESPAÇO DE TRABALHO</span><h1 className="my-3 text-[28px] font-medium tracking-[-.6px]">Meus projetos</h1><p className="m-0 text-xs leading-[1.7] text-[#89929f]">Organize suas digitalizações. Dê dois cliques em uma pasta para começar.</p></div>
        <button className={primaryButton} onClick={onNew} disabled={busy}>+ Novo projeto</button>
      </div>
      <div className="mt-8"><ScannerSelector busy={busy} setStatus={setStatus} /></div>
      {status && <p className="mt-4 text-xs leading-[1.6] text-[#e4acb6] wrap-anywhere" role="status" aria-live="polite">{status}</p>}
      <div className="mt-[42px] grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-6 max-[900px]:grid-cols-[repeat(auto-fill,minmax(170px,1fr))] max-[900px]:gap-3 max-[600px]:grid-cols-2 max-[600px]:gap-1.5" aria-label="Projetos">
        {projects.map(project => <article className={`relative min-w-0 rounded-xl border px-3 pb-[18px] pt-4 transition-colors hover:bg-[#ffffff03] ${selected === project.id ? 'border-[#65adf638] bg-[#2472bd0b]' : 'border-transparent'}`} key={project.id} onContextMenu={event=>{event.preventDefault();if(busy)return;setSelected(project.id);setMenu({project,x:Math.min(event.clientX,window.innerWidth-190),y:Math.min(event.clientY,window.innerHeight-160)});}}>
          <h2 className="m-0 min-h-[42px] py-0 pl-1.5 pr-[30px] text-sm leading-normal font-normal text-[#dce7f3] wrap-anywhere">{project.name}</h2>
          <button className="group m-0 flex w-full select-none flex-col items-center gap-3 border-0 bg-transparent px-1 pb-1 pt-[18px]" type="button" aria-label={`Abrir projeto ${project.name}. Dê dois cliques ou pressione Enter.`} onClick={event => { setSelected(project.id); if (event.detail === 0) onOpen(project); }} onDoubleClick={() => onOpen(project)} disabled={busy}>
            <img className="h-[117px] w-[146px] object-contain drop-shadow-[0_10px_14px_#0002] transition-transform duration-200 group-hover:-translate-y-1 max-[600px]:h-24 max-[600px]:w-[120px]" src="assets/folder.svg" alt="" /><span className="text-[10px] text-[#7d91a7]">{project.pageCount} página(s) · {project.dpi} dpi</span>
          </button>
          <button className="absolute right-3.5 top-3.5 m-0 w-auto bg-transparent p-1.5 leading-none text-[#7b97b5] hover:bg-[#ffffff08] hover:text-[#91c9ff]" type="button" aria-label={`Editar projeto ${project.name}`} title="Editar projeto" onClick={() => onEdit(project)} disabled={busy}>✎</button>
        </article>)}
      </div>
      {projects.length === 0 && <div className="flex min-h-[400px] flex-col items-center justify-center text-center max-[600px]:min-h-80"><img src="assets/folder.svg" width={100} height={80} alt="" /><h2 className="mb-2.5 mt-5 text-lg font-normal">Seu primeiro projeto começa aqui</h2><p className="mb-6 mt-0 text-xs leading-[1.7] text-[#7f8b9a]">Crie uma pasta, configure o scanner e organize seus documentos.</p><button className={primaryButton} onClick={onNew}>Criar meu primeiro projeto</button></div>}
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <AnimatePresence>{menu && <motion.div role="menu" className="fixed z-50 w-[180px] rounded-lg border border-[#555] bg-[#252525] p-1.5 shadow-xl" style={{left:menu.x,top:menu.y}} initial={{opacity:0,scale:.95,y:-4}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:.95}} transition={{duration:reduceMotion?0:.15}} onKeyDown={event=>{if(event.key==='Escape')setMenu(null);}}>
        {['Renomear','Copiar','Excluir'].map(label=><button key={label} role="menuitem" className="m-0 block w-full rounded bg-transparent px-3 py-2.5 text-left text-xs text-[#eee] hover:bg-[#3287dc33]" onClick={()=>{const project=menu.project;setMenu(null);if(label==='Renomear'){setName(project.name);setRenaming(project);}else if(label==='Copiar')void action(()=>window.projects.duplicate(project.id));else if(window.confirm(`Excluir o projeto "${project.name}" e suas páginas locais?`))void action(()=>window.projects.delete(project.id));}}>{label}</button>)}
      </motion.div>}</AnimatePresence>
      <AnimatePresence>{renaming && <motion.div className="fixed inset-0 z-50 grid place-items-center bg-black/60" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:reduceMotion?0:.15}}><form className="w-[min(400px,90vw)] rounded-lg border border-[#555] bg-[#252525] p-5" onSubmit={event=>{event.preventDefault();void action(()=>window.projects.rename(renaming.id,name)).then(()=>setRenaming(null));}}><h2 className="text-lg">Renomear projeto</h2><input className="project-rename-input" autoFocus aria-label="Nome do projeto" maxLength={80} value={name} onChange={event=>setName(event.target.value)} /><div className="mt-4 flex justify-end gap-2"><button type="button" className="m-0 w-auto bg-[#444] px-3 py-2" onClick={()=>setRenaming(null)}>Cancelar</button><button className="m-0 w-auto bg-[#3287dc] px-3 py-2" disabled={!name.trim()}>Salvar</button></div></form></motion.div>}</AnimatePresence>
    </main>
  </div>;
}
