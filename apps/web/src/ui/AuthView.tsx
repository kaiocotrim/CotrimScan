import { useState, type FormEvent } from 'react';

interface Props { creating: boolean; loading: boolean; error: string; onSubmit(username: string, password: string): Promise<void> }
export function AuthView({ creating, loading, error, onSubmit }: Props) {
  const [username, setUsername] = useState(''), [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState(''), [showPassword, setShowPassword] = useState(false), [showConfirmation, setShowConfirmation] = useState(false), [about, setAbout] = useState(false), [busy, setBusy] = useState(false);
  const [validation, setValidation] = useState('');
  const [lightTheme, setLightTheme] = useState(() => localStorage.getItem('cotrimscan-login-theme') === 'light');
  function toggleTheme() { setLightTheme(value => { const next = !value; localStorage.setItem('cotrimscan-login-theme', next ? 'light' : 'dark'); document.documentElement.classList.toggle('app-light', next); return next; }); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (creating && password !== confirmation) { setValidation('As senhas não coincidem.'); return; }
    setBusy(true); setValidation('');
    try { await onSubmit(username, password); } finally { setBusy(false); setPassword(''); setConfirmation(''); }
  }
  const field = 'm-0 block h-[30px] w-full rounded border border-[#262626] bg-[#181818] px-2.5 py-2 text-[11px] text-[#eee] placeholder:text-[#858585] transition-colors focus:border-[#589fe8] focus:bg-[#182331] focus:outline-2 focus:outline-offset-1 focus:outline-[#509cff2b] min-[1450px]:h-10 min-[1450px]:text-[13px] max-[650px]:h-[42px] max-[650px]:text-[13px]';
  const eye = (visible: boolean) => <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{!visible && <path d="M3 21 21 3"/>}</svg>;
  const button = 'mt-1 h-[30px] w-full rounded-[5px] px-2.5 py-0 text-xs font-normal transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#75baff] min-[1450px]:h-10 min-[1450px]:text-[13px] max-[650px]:h-[42px] max-[650px]:text-[13px]';
  return <div id="auth-view" className={`${lightTheme ? 'auth-light ' : ''}auth-view flex min-h-dvh items-stretch bg-[#181818] p-0 font-[Arial,Helvetica,sans-serif] text-[#e8e8e8]`}><div className="grid min-h-dvh w-full grid-cols-[30.5%_69.5%] bg-[#181818] p-0 max-[1000px]:grid-cols-[36%_64%] max-[650px]:block"><section className="flex min-w-0 items-center justify-center rounded-none border-0 bg-transparent p-[46px] min-[1450px]:p-14 max-[1000px]:p-6 max-[650px]:min-h-dvh max-[650px]:px-8 max-[650px]:py-[42px]" aria-labelledby="auth-title"><button type="button" className="auth-theme-toggle" onClick={toggleTheme} aria-label={lightTheme ? 'Ativar tema escuro' : 'Ativar tema claro'} title={lightTheme ? 'Ativar tema escuro' : 'Ativar tema claro'}>{lightTheme ? '☾' : '☀'}<span>{lightTheme ? 'Escuro' : 'Claro'}</span></button><div className="w-full max-w-[218px] max-[650px]:max-w-[300px]">
    <img className="mb-6 block h-auto w-[180px] object-contain" src="assets/icones_3d/download.png" alt="CotrimScan" width={180} height={43} />
    <h1 id="auth-title" className="mb-2.5 mt-0 text-[15px] leading-[1.4] font-medium tracking-[-.15px] min-[1450px]:text-lg max-[650px]:text-[19px]">{creating ? 'Comece com o CotrimScan' : 'Bem-vindo ao CotrimScan'}</h1>
    <p className="mb-6 min-h-0 text-[11px] leading-[1.7] text-[#898989] min-[1450px]:text-[13px] max-[650px]:text-xs">{loading ? 'Carregando sua conta local…' : creating ? 'Crie sua conta local para começar. Escolha um usuário e uma senha com pelo menos 8 caracteres.' : 'Entre com seu usuário e senha para acessar seus documentos e começar a digitalizar.'}</p>
    {!loading && <form onSubmit={submit}><label className="mb-2.5 mt-0 block font-normal"><span className="sr-only">Usuário</span><input className={field} autoComplete="username" placeholder="Seu usuário" minLength={3} maxLength={40} required value={username} onChange={event => setUsername(event.target.value)} disabled={busy} /></label>
      <div className="relative mb-2.5"><label htmlFor="auth-password" className="sr-only">Senha</label><input id="auth-password" className={`${field} pr-10`} type={showPassword ? 'text' : 'password'} autoComplete={creating ? 'new-password' : 'current-password'} placeholder="Sua senha" minLength={creating ? 8 : 1} maxLength={256} required value={password} onChange={event => setPassword(event.target.value)} disabled={busy} /><button type="button" className="absolute inset-y-0 right-0 m-0 flex w-9 items-center justify-center border-0 bg-transparent p-0 text-[#999] hover:text-white" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{eye(showPassword)}</button></div>
      {creating && <div className="relative mb-2.5"><label htmlFor="auth-confirmation" className="sr-only">Confirmar senha</label><input id="auth-confirmation" className={`${field} pr-10`} type={showConfirmation ? 'text' : 'password'} autoComplete="new-password" placeholder="Confirme sua senha" required value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} /><button type="button" className="absolute inset-y-0 right-0 m-0 flex w-9 items-center justify-center border-0 bg-transparent p-0 text-[#999] hover:text-white" aria-label={showConfirmation ? 'Ocultar confirmação de senha' : 'Mostrar confirmação de senha'} aria-pressed={showConfirmation} onClick={() => setShowConfirmation(value => !value)}>{eye(showConfirmation)}</button></div>}
      <button id="auth-submit" className={`${button} border border-[#d5d5d5] bg-[#ededed] text-[#242424] shadow-[0_1px_2px_#0003] hover:bg-white active:translate-y-px`} type="submit" disabled={busy}>{busy ? 'Validando…' : creating ? 'Criar conta e entrar' : 'Entrar'}</button></form>}
    <p className="mt-3 text-[11px] leading-[1.7] text-[#e6a9b3] wrap-anywhere" role="status" aria-live="polite">{validation || error}</p><div className="auth-divider my-[18px] flex items-center gap-[9px] text-[9px] text-[#777]"><span>OU</span></div>
    <button className={`${button} mt-0 flex items-center justify-center gap-[7px] border border-[#272727] bg-transparent text-[11px] text-[#a6a6a6] hover:border-[#304b66] hover:bg-[#222]`} type="button" aria-expanded={about} onClick={() => setAbout(!about)}><span className="inline-flex size-[13px] items-center justify-center rounded-full border border-[#888] text-[9px]" aria-hidden="true">▷</span> Conheça o aplicativo</button>
    {about && <p className="mt-3.5 text-[11px] leading-[1.7] text-[#898989]">Digitalize documentos pelo serviço NAPS2 WebScan, visualize suas páginas e salve em JPEG. Entre com sua conta local para começar.</p>}
    <p className="mt-[34px] text-[9px] leading-[1.7] text-[#777]">Seu espaço de digitalização, neste computador.<br />Conta local · Sem recuperação automática de senha.</p>
  </div></section><AuthIllustration /></div></div>;
}
function AuthIllustration() {
  const features = ['Digitalização', 'Seus projetos', 'Fotos do celular', 'PDF pesquisável', 'Assinatura digital', 'Arquivos organizados'];
  return <div className="auth-visual auth-orbit" aria-hidden="true">
    <div className="orbit-scene">
      <div className="orbit-glow" />
      <img className="orbit-scanner" src="assets/icones_3d/01_impressora_3d.png" alt="" draggable={false} />
      <img className="orbit-document" src="assets/icones_3d/02_pagina_digitalizada_3d.png" alt="" draggable={false} />
      {features.map((label, index) => <div key={label} className={`orbit-feature orbit-feature-${index}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="5" y="3" width="14" height="18" rx="3"/><path d={index % 2 ? 'm8 12 3 3 5-6' : 'M9 8h6M9 12h6M9 16h4'}/></svg><span>{label}</span></div>)}
    </div>
    <div className="orbit-caption"><p>Seus documentos organizados,<br/><span>mais tempo para você.</span></p><span>Digitalize, confira e salve. Tudo no mesmo lugar.</span><div className="orbit-marker" /></div>
  </div>;
}
