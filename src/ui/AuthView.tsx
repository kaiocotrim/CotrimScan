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
  return <div id="auth-view" className="auth-view"><div className="auth-shell"><section className="auth-card" aria-labelledby="auth-title"><div className="auth-content">
    <img className="auth-mark" src="assets/icones_3d/download.png" alt="CotrimScan" width={180} height={43} />
    <h1 id="auth-title">{creating ? 'Comece com o CotrimScan' : 'Bem-vindo ao CotrimScan'}</h1>
    <p>{loading ? 'Carregando sua conta local…' : creating ? 'Crie sua conta local para começar. Escolha um usuário e uma senha com pelo menos 8 caracteres.' : 'Entre com seu usuário e senha para acessar seus documentos e começar a digitalizar.'}</p>
    {!loading && <form onSubmit={submit}><label className="auth-field"><span className="visually-hidden">Usuário</span><input autoComplete="username" placeholder="Seu usuário" minLength={3} maxLength={40} required value={username} onChange={event => setUsername(event.target.value)} disabled={busy} /></label>
      <label className="auth-field"><span className="visually-hidden">Senha</span><input type="password" autoComplete={creating ? 'new-password' : 'current-password'} placeholder="Sua senha" minLength={creating ? 8 : 1} maxLength={256} required value={password} onChange={event => setPassword(event.target.value)} disabled={busy} /></label>
      {creating && <label className="auth-field"><span className="visually-hidden">Confirmar senha</span><input type="password" autoComplete="new-password" placeholder="Confirme sua senha" required value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} /></label>}
      <button id="auth-submit" type="submit" disabled={busy}>{busy ? 'Validando…' : creating ? 'Criar conta e entrar' : 'Entrar'}</button></form>}
    <p role="status" aria-live="polite">{validation || error}</p><div className="auth-divider"><span>OU</span></div>
    <button className="auth-about" type="button" aria-expanded={about} onClick={() => setAbout(!about)}><span className="play-icon" aria-hidden="true">▷</span> Conheça o aplicativo</button>
    {about && <p className="auth-help">Digitalize documentos pelo serviço NAPS2 WebScan, visualize suas páginas e salve em JPEG. Entre com sua conta local para começar.</p>}
    <p className="auth-footer">Seu espaço de digitalização, neste computador.<br />Conta local · Sem recuperação automática de senha.</p>
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
