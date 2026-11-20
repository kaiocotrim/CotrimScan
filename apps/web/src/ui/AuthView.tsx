import { Canvas } from '@/components/panelui/canvas';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/panelui/button';
import { Input } from '@/components/panelui/input';
import { useEffect, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';

interface Props { loading: boolean; error: string; onSubmit(): Promise<void> }
export function AuthView({ loading, error, onSubmit }: Props) {
  const [busy, setBusy] = useState(false);
  const [lightTheme, setLightTheme] = useState(() => localStorage.getItem('cotrimscan-login-theme') === 'light');
  const [themeMotion, setThemeMotion] = useState(0);
  useEffect(() => {
    function handleThemeShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 't') {
        event.preventDefault();
        setThemeMotion(value => value + 1);
        setLightTheme(value => {
          const next = !value;
          localStorage.setItem('cotrimscan-login-theme', next ? 'light' : 'dark');
          document.documentElement.classList.toggle('app-light', next);
          return next;
        });
      }
    }
    window.addEventListener('keydown', handleThemeShortcut);
    return () => window.removeEventListener('keydown', handleThemeShortcut);
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try { await onSubmit(); } finally { setBusy(false); }
  }
  const field = 'm-0 block h-[30px] w-full rounded-xl border-0 bg-[#222222] px-2.5 py-2 text-[11px] text-[#eee] placeholder:text-[#858585] focus-visible:ring-1 focus-visible:ring-[#589fe8] min-[1450px]:h-10 min-[1450px]:text-[13px] max-[650px]:h-[42px] max-[650px]:text-[13px]';
  const button = 'mt-1 h-[30px] w-full rounded-[5px] px-2.5 py-0 text-xs font-normal transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#75baff] min-[1450px]:h-10 min-[1450px]:text-[13px] max-[650px]:h-[42px] max-[650px]:text-[13px]';
  return <div id="auth-view" className={`${lightTheme ? 'auth-light ' : 'dark '}auth-view flex min-h-dvh items-stretch bg-[#181818] p-0 font-sans text-[#e8e8e8]`}><div className="grid min-h-dvh w-full grid-cols-[30.5%_69.5%] bg-[#181818] p-0 max-[1000px]:grid-cols-[36%_64%] max-[650px]:block"><section className="flex min-w-0 items-center justify-center rounded-none border-0 bg-transparent p-[46px] min-[1450px]:p-14 max-[1000px]:p-6 max-[650px]:min-h-dvh max-[650px]:px-8 max-[650px]:py-[42px]" aria-labelledby="auth-title"><div className="w-full max-w-[218px] max-[650px]:max-w-[300px]">
    <img className="mb-6 block h-auto w-[180px] object-contain" src="assets/icones_3d/download.png" alt="CotrimScan" width={180} height={43} />
    <h1 id="auth-title" className="mb-2.5 mt-0 text-[14px] leading-[1.4] font-medium tracking-[-.15px] min-[1450px]:text-base max-[650px]:text-base">Bem-vindo ao CotrimScan</h1>
    <p className="mb-6 min-h-0 text-[11px] leading-[1.7] text-[#898989] min-[1450px]:text-xs max-[650px]:text-[11px]">{loading ? 'Carregando…' : 'Acesse seus projetos e comece a digitalizar.'}</p>
    {!loading && <form onSubmit={submit}>
      <label className="mb-2.5 mt-0 block"><span className="sr-only">Usuário (opcional)</span><Input className={field} autoComplete="username" placeholder="Seu usuário (opcional)" disabled={busy} /></label>
      <label className="mb-2.5 mt-0 block"><span className="sr-only">Senha (opcional)</span><Input className={field} type="password" autoComplete="off" placeholder="Sua senha (opcional)" disabled={busy} /></label>
      <Button id="auth-submit" className={`${button} border border-[#3287dc] bg-[#3287dc] text-white shadow-[0_1px_2px_#0003] hover:bg-[#4397ea] active:translate-y-px`} type="submit" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</Button></form>}
    <p className="mt-3 text-[11px] leading-[1.7] text-[#e6a9b3] wrap-anywhere" role="status" aria-live="polite">{error}</p><div className="auth-divider my-[18px] flex items-center gap-[9px] text-[9px] text-[#777]"><span>OU</span></div>
    <Accordion type="single" collapsible defaultValue="" className="auth-about-accordion mt-1 w-full max-w-full overflow-hidden">
      <AccordionItem value="scan" className="border-b border-[#ffffff12]"><AccordionTrigger className="min-h-7 rounded-none border-0 bg-transparent px-0 py-1.5 text-left text-[10px] text-[#b9c5d2] hover:bg-transparent hover:no-underline [&_svg]:size-3.5">O que posso digitalizar?</AccordionTrigger><AccordionContent className="px-1 pb-3 text-[9px] leading-relaxed text-[#929ba5]">Digitalize documentos usando um scanner conectado ao computador e organize as p&aacute;ginas em projetos.</AccordionContent></AccordionItem>
      <AccordionItem value="mobile" className="border-b border-[#ffffff12]"><AccordionTrigger className="min-h-7 rounded-none border-0 bg-transparent px-0 py-1.5 text-left text-[10px] text-[#b9c5d2] hover:bg-transparent hover:no-underline [&_svg]:size-3.5">Posso usar o celular?</AccordionTrigger><AccordionContent className="px-1 pb-3 text-[9px] leading-relaxed text-[#929ba5]">Sim. Na tela de digitaliza&ccedil;&atilde;o, escolha Conectar celular para enviar fotos ao projeto.</AccordionContent></AccordionItem>
      <AccordionItem value="files" className="border-0"><AccordionTrigger className="min-h-7 rounded-none border-0 bg-transparent px-0 py-1.5 text-left text-[10px] text-[#b9c5d2] hover:bg-transparent hover:no-underline [&_svg]:size-3.5">Onde ficam meus arquivos?</AccordionTrigger><AccordionContent className="px-1 pb-3 text-[9px] leading-relaxed text-[#929ba5]">Seus projetos e documentos ficam neste computador. Voc&ecirc; escolhe as pastas de sa&iacute;da ao configurar cada projeto.</AccordionContent></AccordionItem>
    </Accordion>
    <p className="mt-5 text-[9px] leading-[1.7] text-[#777]">Seu espa&ccedil;o de digitaliza&ccedil;&atilde;o, neste computador.</p>
  </div></section><AuthIllustration lightTheme={lightTheme} /></div>{themeMotion > 0 && createPortal(<motion.div key={themeMotion} aria-hidden="true" className="auth-theme-transition" style={{ background: lightTheme ? "radial-gradient(ellipse at 28% 48%, #5ba9ff55, transparent 68%)" : "radial-gradient(ellipse at 28% 48%, #18396355, transparent 68%)" }} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: [0, 0.9, 0], scale: [0.96, 1, 1.04] }} transition={{ duration: 0.65, ease: "easeInOut" }} />, document.body)}</div>;
}
function AuthIllustration({ lightTheme }: { lightTheme: boolean }) {
  const features = ['Digitalização', 'Seus projetos', 'Fotos do celular', 'PDF pesquisável', 'Assinatura digital', 'Arquivos organizados'];
  return <Canvas className={`${lightTheme ? '' : 'dark'} auth-visual auth-orbit`} aria-hidden="true">
    <Canvas.Pattern variant="dots" gap={28} size={1} strength="12%" fade="edges" />
    <Canvas.Spotlight radius={220} className="text-[#4da3ff]" />
    <Canvas.Content className="auth-canvas-content"><div className="orbit-scene"><div className="orbit-glow" /><img className="orbit-scanner" src="assets/icones_3d/01_impressora_3d.png" alt="" draggable={false} /><img className="orbit-document" src="assets/icones_3d/02_pagina_digitalizada_3d.png" alt="" draggable={false} />{features.map((label, index) => <div key={label} className={`orbit-feature orbit-feature-${index}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="5" y="3" width="14" height="18" rx="3"/><path d={index % 2 ? 'm8 12 3 3 5-6' : 'M9 8h6M9 12h6M9 16h4'}/></svg><span>{label}</span></div>)}</div><div className="orbit-caption"><p>Seus documentos organizados,<br/><span>mais tempo para você.</span></p><span>Digitalize, confira e salve. Tudo no mesmo lugar.</span><div className="orbit-marker" /></div></Canvas.Content>
  </Canvas>;
}


