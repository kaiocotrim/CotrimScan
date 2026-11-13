import { useState, type FormEvent } from 'react';

interface Props { creating: boolean; loading: boolean; error: string; onSubmit(username: string, password: string): Promise<void> }
export function AuthView({ creating, loading, error, onSubmit }: Props) {
  const [username, setUsername] = useState(''), [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState(''), [about, setAbout] = useState(false), [busy, setBusy] = useState(false);
  const [validation, setValidation] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (creating && password !== confirmation) { setValidation('As senhas não coincidem.'); return; }
    setBusy(true); setValidation('');
    try { await onSubmit(username, password); } finally { setBusy(false); setPassword(''); setConfirmation(''); }
  }
  const field = 'block h-[30px] w-full rounded border border-[#262626] bg-[#181818] px-2.5 py-2 text-[11px] text-[#eee] placeholder:text-[#858585] transition-colors focus:border-[#589fe8] focus:bg-[#182331] focus:outline-2 focus:outline-offset-1 focus:outline-[#509cff2b] min-[1450px]:h-10 min-[1450px]:text-[13px] max-[650px]:h-[42px] max-[650px]:text-[13px]';
  const button = 'mt-1 h-[30px] w-full rounded-[5px] px-2.5 py-0 text-xs font-normal transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#75baff] min-[1450px]:h-10 min-[1450px]:text-[13px] max-[650px]:h-[42px] max-[650px]:text-[13px]';
  return <div id="auth-view" className="auth-view flex min-h-dvh items-stretch bg-[#181818] p-0 font-[Arial,Helvetica,sans-serif] text-[#e8e8e8]"><div className="grid min-h-dvh w-full grid-cols-[30.5%_69.5%] bg-[#181818] p-0 max-[1000px]:grid-cols-[36%_64%] max-[650px]:block"><section className="flex min-w-0 items-center justify-center rounded-none border-0 bg-transparent p-[46px] min-[1450px]:p-14 max-[1000px]:p-6 max-[650px]:min-h-dvh max-[650px]:px-8 max-[650px]:py-[42px]" aria-labelledby="auth-title"><div className="w-full max-w-[218px] max-[650px]:max-w-[300px]">
    <img className="mb-6 block h-auto w-[180px] object-contain" src="assets/icones_3d/download.png" alt="CotrimScan" width={180} height={43} />
    <h1 id="auth-title" className="mb-2.5 mt-0 text-[15px] leading-[1.4] font-medium tracking-[-.15px] min-[1450px]:text-lg max-[650px]:text-[19px]">{creating ? 'Comece com o CotrimScan' : 'Bem-vindo ao CotrimScan'}</h1>
    <p className="mb-6 min-h-0 text-[11px] leading-[1.7] text-[#898989] min-[1450px]:text-[13px] max-[650px]:text-xs">{loading ? 'Carregando sua conta local…' : creating ? 'Crie sua conta local para começar. Escolha um usuário e uma senha com pelo menos 8 caracteres.' : 'Entre com seu usuário e senha para acessar seus documentos e começar a digitalizar.'}</p>
    {!loading && <form onSubmit={submit}><label className="mb-2.5 mt-0 block font-normal"><span className="sr-only">Usuário</span><input className={field} autoComplete="username" placeholder="Seu usuário" minLength={3} maxLength={40} required value={username} onChange={event => setUsername(event.target.value)} disabled={busy} /></label>
      <label className="mb-2.5 mt-0 block font-normal"><span className="sr-only">Senha</span><input className={field} type="password" autoComplete={creating ? 'new-password' : 'current-password'} placeholder="Sua senha" minLength={creating ? 8 : 1} maxLength={256} required value={password} onChange={event => setPassword(event.target.value)} disabled={busy} /></label>
      {creating && <label className="mb-2.5 mt-0 block font-normal"><span className="sr-only">Confirmar senha</span><input className={field} type="password" autoComplete="new-password" placeholder="Confirme sua senha" required value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} /></label>}
      <button id="auth-submit" className={`${button} border border-[#d5d5d5] bg-[#ededed] text-[#242424] shadow-[0_1px_2px_#0003] hover:bg-white active:translate-y-px`} type="submit" disabled={busy}>{busy ? 'Validando…' : creating ? 'Criar conta e entrar' : 'Entrar'}</button></form>}
    <p className="mt-3 text-[11px] leading-[1.7] text-[#e6a9b3] wrap-anywhere" role="status" aria-live="polite">{validation || error}</p><div className="auth-divider my-[18px] flex items-center gap-[9px] text-[9px] text-[#777]"><span>OU</span></div>
    <button className={`${button} mt-0 flex items-center justify-center gap-[7px] border border-[#272727] bg-transparent text-[11px] text-[#a6a6a6] hover:border-[#304b66] hover:bg-[#222]`} type="button" aria-expanded={about} onClick={() => setAbout(!about)}><span className="inline-flex size-[13px] items-center justify-center rounded-full border border-[#888] text-[9px]" aria-hidden="true">▷</span> Conheça o aplicativo</button>
    {about && <p className="mt-3.5 text-[11px] leading-[1.7] text-[#898989]">Digitalize documentos pelo serviço NAPS2 WebScan, visualize suas páginas e salve em JPEG. Entre com sua conta local para começar.</p>}
    <p className="mt-[34px] text-[9px] leading-[1.7] text-[#777]">Seu espaço de digitalização, neste computador.<br />Conta local · Sem recuperação automática de senha.</p>
  </div></section><AuthIllustration /></div></div>;
}
function AuthIllustration() {
  return <div className="auth-visual" aria-hidden="true">
    <div className="visual-grid" />
    <div className="integration-map">
      <svg className="connection-lines" viewBox="0 0 600 440" fill="none"><g stroke="currentColor" strokeDasharray="2 6"><path d="M300 220V68M300 220 154 145M300 220 446 145M300 220 154 295M300 220 446 295M300 220V368" /></g></svg>
      <div className="hub-halo" />
      <div className="integration-hub"><img className="scanner-3d" src="assets/icones_3d/01_impressora_3d.png" alt="" width={1254} height={1254} decoding="sync" draggable={false} /></div>
      <div className="integration-node node-document"><img src="assets/icones_3d/02_pagina_digitalizada_3d.png" alt="" width={1145} height={1374} decoding="sync" draggable={false} /></div>
      <div className="integration-node node-pages"><img src="assets/icones_3d/03_documentos_3d.png" alt="" width={1216} height={1293} decoding="sync" draggable={false} /></div>
      <div className="integration-node node-cloud"><img src="assets/icones_3d/04_upload_nuvem_3d.png" alt="" width={1536} height={1024} decoding="sync" draggable={false} /></div>
      <div className="integration-node node-folder"><img src="assets/icones_3d/05_arquivo_salvo_3d.png" alt="" width={1368} height={1149} decoding="sync" draggable={false} /></div>
      <div className="integration-node node-shield"><img src="assets/icones_3d/06_seguranca_3d.png" alt="" width={1254} height={1254} decoding="sync" draggable={false} /></div>
      <div className="integration-node node-seal"><img src="assets/icones_3d/07_tudo_organizado_3d.png" alt="" width={1254} height={1254} decoding="sync" draggable={false} /></div>
      <span className="flow-dot dot-one" /><span className="flow-dot dot-two" /><span className="flow-dot dot-three" /><span className="flow-dot dot-four" /><span className="flow-dot dot-five" /><span className="flow-dot dot-six" />
      <div className="event-chip chip-scanned"><i />Página digitalizada</div>
      <div className="event-chip chip-checked"><i />Documento conferido</div>
      <div className="event-chip chip-saved"><i />Arquivo salvo</div>
      <div className="event-chip chip-organized"><i />Tudo organizado</div>
    </div>
    <div className="visual-caption"><p>Do papel ao digital, com tudo organizado.</p><span>Digitalize, confira e salve seus documentos com o CotrimScan.</span><div className="visual-pagination"><i /><i /><i /><i /><i /></div></div>
  </div>;
}
