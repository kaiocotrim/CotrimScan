import { useEffect, useRef, useState } from 'react';
import { AuthView } from './AuthView';
import { ProjectsView } from './ProjectsView';
import { ProjectEditor } from './ProjectEditor';
import { ScannerView } from './ScannerView';
import type { Project, Page } from './types';
import { CertificateDialogs } from './CertificateDialogs';

function errorText(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '');
}

function AppContent() {
  const [view, setView] = useState<'auth' | 'projects' | 'scanner'>('auth');
  const [account, setAccount] = useState('');
  const [creating, setCreating] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const projectsRef = useRef<Project[]>([]);
  projectsRef.current = projects;
  const [project, setProject] = useState<Project | null>(null);
  const projectRef = useRef<Project | null>(null);
  projectRef.current = project;
  const [editing, setEditing] = useState<Project | null | undefined>(undefined);
  const [pages, setPages] = useState<Page[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Pronto para digitalizar.');

  async function refreshProjects() { setProjects(await window.projects.list()); }
  async function showProjects(username: string) {
    setAccount(username); setView('projects'); setAuthError('');
    try { await refreshProjects(); } catch (error) { setStatus(errorText(error)); }
  }
  useEffect(() => {
    let active = true;
    window.localAuth.status().then(session => {
      if (!active) return;
      if (session.authenticated) void showProjects(session.username);
      else { setCreating(!session.hasAccount); setAuthLoading(false); }
    }).catch(error => { if (active) { setAuthError(errorText(error)); setAuthLoading(false); } });
    const unsubscribePage = window.scanner.onPage(page => {
      if (page.projectId && page.projectId !== projectRef.current?.id) return;
      setPages(previous => page.discardPreview ? previous.filter(item => item.id !== page.id || !item.previewPending) : previous.some(item => item.id === page.id) ? previous.map(item => item.id === page.id ? page : item) : [...previous, page]);
    });
    const unsubscribeMobile = window.mobile.onReceived(data => {
      if (data.projectId === projectRef.current?.id) setStatus(data.warning ? `Foto recebida e preservada no projeto. ${data.warning}` : `Página ${data.pageNumber} recebida do celular.`);
    });
    return () => { active = false; unsubscribePage?.(); unsubscribeMobile?.(); };
  }, []);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try { await action(); } catch (error) { setStatus(errorText(error)); } finally { setBusy(false); }
  }
  async function logout() {
    await run(async () => { await window.localAuth.logout(); setProject(null); setPages([]); setView('auth'); setAuthLoading(false); setCreating(false); });
  }
  async function openProject(selected: Project) {
    await run(async () => {
      const data = await window.projects.open(selected.id);
      setProject(data.project); setPages(data.pages); setView('scanner');
      setStatus(data.pages.length ? 'Escolha uma página para revisar ou digitalize novos documentos.' : 'Pronto para digitalizar.');
    });
  }
  async function back() {
    await run(async () => { await window.projects.close(); setProject(null); setPages([]); await refreshProjects(); setView('projects'); });
  }
  return <>
    {view === 'auth' && <AuthView creating={creating} loading={authLoading} error={authError} onSubmit={async (username, password) => {
      setAuthError('Validando…');
      try { const session = creating ? await window.localAuth.register(username, password) : await window.localAuth.login(username, password); await showProjects(session.username); }
      catch (error) { setAuthError(errorText(error)); }
    }} />}
    {view === 'projects' && <ProjectsView username={account} projects={projects} status={status} busy={busy} onLogout={logout} onNew={() => setEditing(null)} onOpen={openProject} onEdit={setEditing} />}
    {view === 'scanner' && project && <ScannerView username={account} project={project} pages={pages} status={status} busy={busy} setStatus={setStatus} setPages={setPages} run={run} onBack={back} onLogout={logout} />}
    {editing !== undefined && <ProjectEditor project={editing} onClose={() => setEditing(undefined)} onSaved={async saved => { setEditing(undefined); await refreshProjects(); if (project?.id === saved.id) setProject(saved); }} />}
  </>;
}
export function App() { return <CertificateDialogs><AppContent /></CertificateDialogs>; }
