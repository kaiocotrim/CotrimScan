import { Canvas } from '@/components/panelui/canvas';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/panelui/button';
import { Input } from '@/components/panelui/input';
import { EyeIcon } from '@/components/ui/eye';
import { EyeOffIcon } from '@/components/ui/eye-off';
import { useEffect, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';

interface Props { creating: boolean; loading: boolean; error: string; onSubmit(username: string, password: string): Promise<void> }
export function AuthView({ creating, loading, error, onSubmit }: Props) {
  const [username, setUsername] = useState(''), [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState(''), [showPassword, setShowPassword] = useState(false), [showConfirmation, setShowConfirmation] = useState(false), [busy, setBusy] = useState(false);
  const [validation, setValidation] = useState('');
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
    if (creating && password !== confirmation) { setValidation('As senhas não coincidem.'); return; }
    setBusy(true); setValidation('');
    try { await onSubmit(username, password); } finally { setBusy(false); setPassword(''); setConfirmation(''); }
  }
  const field = 'm-0 block h-[30px] w-full rounded border-0 bg-[#222222] px-2.5 py-2 text-[11px] text-[#eee] placeholder:text-[#858585] transition-colors focus:bg-[#182331] focus:outline-2 focus:outline-offset-1 focus:outline-[#509cff2b] focus-visible:ring-1 focus-visible:ring-[#589fe8] min-[1450px]:h-10 min-[1450px]:text-[13px] max-[650px]:h-[42px] max-[650px]:text-[13px]';
  const button = 'mt-1 h-[30px] w-full rounded-[5px] px-2.5 py-0 text-xs font-normal transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#75baff] min-[1450px]:h-10 min-[1450px]:text-[13px] max-[650px]:h-[42px] max-[650px]:text-[13px]';
  return <div id="auth-view" className={`${lightTheme ? 'auth-light ' : 'dark '}auth-view flex min-h-dvh items-stretch bg-[#181818] p-0 font-sans text-[#e8e8e8]`}><div className="grid min-h-dvh w-full grid-cols-[30.5%_69.5%] bg-[#181818] p-0 max-[1000px]:grid-cols-[36%_64%] max-[650px]:block"><section className="flex min-w-0 items-center justify-center rounded-none border-0 bg-transparent p-[46px] min-[1450px]:p-14 max-[1000px]:p-6 max-[650px]:min-h-dvh max-[650px]:px-8 max-[650px]:py-[42px]" aria-labelledby="auth-title"><div className="w-full max-w-[218px] max-[650px]:max-w-[300px]">
    <img className="mb-6 block h-auto w-[180px] object-contain" src="assets/icones_3d/download.png" alt="CotrimScan" width={180} height={43} />
    <h1 id="auth-title" className="mb-2.5 mt-0 text-[14px] leading-[1.4] font-medium tracking-[-.15px] min-[1450px]:text-base max-[650px]:text-base">{creating ? 'Comece com o CotrimScan' : 'Bem-vindo ao CotrimScan'}</h1>
    <p className="mb-6 min-h-0 text-[11px] leading-[1.7] text-[#898989] min-[1450px]:text-xs max-[650px]:text-[11px]">{loading ? 'Carregando sua conta local…' : creating ? 'Crie sua conta local para começar. Escolha um usuário e uma senha com pelo menos 8 caracteres.' : 'Entre com seu usuário e senha para acessar seus documentos e começar a digitalizar.'}</p>
    {!loading && <form onSubmit={submit}><label className="mb-2.5 mt-0 block font-normal"><span className="sr-only">Usuário</span><Input className={field} autoComplete="username" placeholder="Seu usuário" minLength={3} maxLength={40} required value={username} onChange={event => setUsername(event.target.value)} disabled={busy} /></label>
      <div className="relative mb-2.5"><label htmlFor="auth-password" className="sr-only">Senha</label><Input id="auth-password" className={`${field} pr-10`} type={showPassword ? 'text' : 'password'} autoComplete={creating ? 'new-password' : 'current-password'} placeholder="Sua senha" minLength={creating ? 8 : 1} maxLength={256} required value={password} onChange={event => setPassword(event.target.value)} disabled={busy} /><motion.button type="button" whileTap={{ scale: 0.88 }} transition={{ type: 'spring', stiffness: 500, damping: 22 }} className="absolute inset-y-0 right-0 m-0 flex w-9 items-center justify-center border-0 bg-transparent p-0 text-[#999] hover:text-white" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}><motion.span key={String(showPassword)} initial={{ scale: 0.7, opacity: 0, rotate: -20 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 22 }}>{showPassword ? <EyeIcon size={17} className="size-[17px]" /> : <EyeOffIcon size={17} className="size-[17px]" />}</motion.span></motion.button></div>
      {creating && <div className="relative mb-2.5"><label htmlFor="auth-confirmation" className="sr-only">Confirmar senha</label><Input id="auth-confirmation" className={`${field} pr-10`} type={showConfirmation ? 'text' : 'password'} autoComplete="new-password" placeholder="Confirme sua senha" required value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} /><motion.button type="button" whileTap={{ scale: 0.88 }} transition={{ type: 'spring', stiffness: 500, damping: 22 }} className="absolute inset-y-0 right-0 m-0 flex w-9 items-center justify-center border-0 bg-transparent p-0 text-[#999] hover:text-white" aria-label={showConfirmation ? 'Ocultar confirmação de senha' : 'Mostrar confirmação de senha'} aria-pressed={showConfirmation} onClick={() => setShowConfirmation(value => !value)}><motion.span key={String(showConfirmation)} initial={{ scale: 0.7, opacity: 0, rotate: -20 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 22 }}>{showConfirmation ? <EyeIcon size={17} className="size-[17px]" /> : <EyeOffIcon size={17} className="size-[17px]" />}</motion.span></motion.button></div>}
      <Button id="auth-submit" className={`${button} border border-[#3287dc] bg-[#3287dc] text-white shadow-[0_1px_2px_#0003] hover:bg-[#4397ea] active:translate-y-px`} type="submit" disabled={busy}>{busy ? 'Validando…' : creating ? 'Criar conta e entrar' : 'Entrar'}</Button></form>}
    <p className="mt-3 text-[11px] leading-[1.7] text-[#e6a9b3] wrap-anywhere" role="status" aria-live="polite">{validation || error}</p><div className="auth-divider my-[18px] flex items-center gap-[9px] text-[9px] text-[#777]"><span>OU</span></div>
    <Accordion type="single" collapsible defaultValue="" className="auth-about-accordion mt-1 w-full max-w-full overflow-hidden">
      <AccordionItem value="scan" className="border-b border-[#ffffff12]"><AccordionTrigger className="min-h-7 rounded-none border-0 bg-transparent px-0 py-1.5 text-left text-[10px] text-[#b9c5d2] hover:bg-transparent hover:no-underline [&_svg]:size-3.5">O que posso digitalizar?</AccordionTrigger><AccordionContent className="px-1 pb-3 text-[9px] leading-relaxed text-[#929ba5]">Digitalize documentos usando um scanner conectado ao computador e organize as p&aacute;ginas em projetos.</AccordionContent></AccordionItem>
      <AccordionItem value="mobile" className="border-b border-[#ffffff12]"><AccordionTrigger className="min-h-7 rounded-none border-0 bg-transparent px-0 py-1.5 text-left text-[10px] text-[#b9c5d2] hover:bg-transparent hover:no-underline [&_svg]:size-3.5">Posso usar o celular?</AccordionTrigger><AccordionContent className="px-1 pb-3 text-[9px] leading-relaxed text-[#929ba5]">Sim. Na tela de digitaliza&ccedil;&atilde;o, escolha Conectar celular para enviar fotos ao projeto.</AccordionContent></AccordionItem>
      <AccordionItem value="files" className="border-0"><AccordionTrigger className="min-h-7 rounded-none border-0 bg-transparent px-0 py-1.5 text-left text-[10px] text-[#b9c5d2] hover:bg-transparent hover:no-underline [&_svg]:size-3.5">Onde ficam meus arquivos?</AccordionTrigger><AccordionContent className="px-1 pb-3 text-[9px] leading-relaxed text-[#929ba5]">Seus projetos e documentos ficam neste computador. Voc&ecirc; escolhe as pastas de sa&iacute;da ao configurar cada projeto.</AccordionContent></AccordionItem>
    </Accordion>
    <p className="mt-5 text-[9px] leading-[1.7] text-[#777]">Seu espa&ccedil;o de digitaliza&ccedil;&atilde;o, neste computador.<br />Conta local &middot; Sem recupera&ccedil;&atilde;o autom&aacute;tica de senha.</p>
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


