import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AnimatePresence, animate, motion, useReducedMotion } from 'framer-motion';
import { Sheet } from '@/components/panelui/sheet';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MobileState, Project } from '@cotrimscan/shared';

interface Props { project: Project; onClose(): void }
const buttonClass = 'm-0 flex min-h-11 w-full min-w-0 items-center justify-center rounded-xl border-0 bg-[#303438] px-4 py-3 text-xs font-medium text-[#eee] transition-colors hover:bg-[#3a4045] disabled:cursor-default disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[#ddd]';
const inputClass = 'mt-2 block w-full rounded-sm border border-[#444] bg-[#181818] p-2.5 text-[11px] text-[#ddd] focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[#ddd]';
const spring = { type: 'spring' as const, stiffness: 260, damping: 28 };

export function MobileDialog({ project, onClose }: Props) {
  const reducedMotion = useReducedMotion();
  const panel = useCallback((element: HTMLDivElement | null) => {
    if (!element || reducedMotion) return;
    const distance = element.getBoundingClientRect().height + 24;
    const animation = animate(
      element,
      { translate: [`0px ${distance}px`, '0px 0px'] },
      { duration: 0.72, ease: [0.35, 0, 0.15, 1] },
    );
    return () => animation.stop();
  }, [reducedMotion]);
  const [address, setAddress] = useState('');
  const [state, setState] = useState<MobileState>({ active: false });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const body = useRef<HTMLDivElement>(null);
  const pendingKey = state.pending?.map(peer => peer.id).join('|') ?? '';
  function mergeState(next: MobileState) { setState(previous => next.active && next.sessionId === previous.sessionId ? { ...previous, ...next, qr: next.qr || previous.qr } : next); }
  useEffect(() => {
    void Promise.all([window.mobile.addresses(), window.mobile.status()]).then(([rows, current]) => { setAddress(rows[0]?.address || ''); mergeState(current); }).catch(reason => setError(String(reason)));
    const unsubscribe = window.mobile.onState(mergeState);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { window.clearInterval(timer); unsubscribe?.(); };
  }, []);
  useEffect(() => {
    if (!pendingKey) return;
    const viewport = body.current?.parentElement;
    viewport?.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [pendingKey, reducedMotion]);
  async function action(callback: () => Promise<MobileState | void>) {
    setBusy(true); setError('');
    try { const result = await callback(); if (result) mergeState(result); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  }
  const seconds = Math.max(0, Math.ceil(((state.qrExpiresAt || 0) - now) / 1000));
  const enter = reducedMotion ? false : { opacity: 0, y: 10, scale: 0.98 };
  const present = { opacity: 1, y: 0, scale: 1 };
  const leave = reducedMotion ? undefined : { opacity: 0, y: -8, scale: 0.985 };
  const transition = reducedMotion ? { duration: 0 } : spring;
  const connectionStatus = error || state.lastError || (state.receiving ? ({ uploading: 'Recebendo foto…', processing: 'Melhorando foto…', saving: 'Salvando foto…', exporting: 'Exportando documento…' }[state.receivingStage || ''] || 'Recebendo foto…') : state.connected ? 'Pronto para receber fotos.' : '');

  return <Sheet side="bottom" defaultOpen onOpenChangeComplete={open => { if (!open) onClose(); }}>
    <Sheet.Content ref={panel} showClose={false} className="mobile-connect-sheet !w-[min(480px,calc(100vw-16px))] [color-scheme:dark]">
      <Sheet.Close render={<motion.button type="button" whileHover={reducedMotion ? undefined : { scale: 1.08 }} whileTap={reducedMotion ? undefined : { scale: 0.9 }} transition={transition} />} aria-label="Fechar painel" className="mobile-connect-close absolute end-4 top-4 z-10 grid size-8 place-items-center rounded-full border-0 bg-transparent text-[#ddd] transition-colors hover:bg-white/10">
        <motion.svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" initial={reducedMotion ? false : { opacity: 0, rotate: -70, scale: 0.7 }} animate={{ opacity: 1, rotate: 0, scale: 1 }} transition={transition}><path d="M6 6l12 12M18 6L6 18" /></motion.svg>
      </Sheet.Close>
      <Sheet.Header title="Conectar celular" description={project.name} />
      <Sheet.Body ref={body} className="mobile-connect-body flex flex-col gap-3 px-5 pb-5 text-xs text-[#eee]">
      <AnimatePresence initial={false}>{state.pending?.map(peer => <motion.div layout={!reducedMotion} initial={enter} animate={present} exit={leave} transition={transition} className="my-2 rounded-2xl border-0 bg-[#262b30] p-4" key={peer.id}>
        <h3 className="m-0 text-[13px] font-normal break-words">{peer.name}</h3>
        <p className="my-2.5 text-[10px] leading-[1.7] text-[#aaa]">Confira este código no celular:</p>
        <strong className="my-4 block text-[27px] font-normal tracking-[6px]">{peer.code}</strong>
        <div className="flex flex-wrap gap-2">{[false, true].map(allow => <motion.div key={String(allow)} whileHover={reducedMotion ? undefined : { y: -1 }} whileTap={reducedMotion ? undefined : { scale: 0.97 }} transition={transition}><Button variant="ghost" className={buttonClass} disabled={busy} onClick={() => void action(() => window.mobile.decide(peer.id, allow))}>{allow ? 'Permitir conexão' : 'Recusar'}</Button></motion.div>)}</div>
      </motion.div>)}</AnimatePresence>
      <AnimatePresence initial={false}>{state.connected && <motion.div key={`connected-${state.connected.name}`} layout={!reducedMotion} initial={enter} animate={present} exit={leave} transition={transition} className="my-1 flex items-center gap-3 rounded-2xl bg-[#252b30] p-4" role="status" aria-live="polite">
        <div className="flex shrink-0 items-center gap-2">
          <motion.svg viewBox="0 0 24 24" className="size-8 text-[#aebbc5]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" animate={reducedMotion ? undefined : { y: [0, -2, 0] }} transition={reducedMotion ? undefined : { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10 18.5h4"/></motion.svg>
          <motion.svg viewBox="0 0 24 24" className="size-6 text-[#7ed6a2]" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" initial={reducedMotion ? false : { opacity: 0, scale: 0.65 }} animate={{ opacity: 1, scale: 1 }} transition={transition}><circle cx="12" cy="12" r="9"/><motion.path d="m8 12 2.5 2.5L16.5 9" initial={reducedMotion ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ ...transition, delay: reducedMotion ? 0 : 0.12 }}/></motion.svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="m-0 truncate text-sm font-medium text-[#e9f4ee]">Celular conectado</p>
          <p className="my-1 truncate text-[11px] text-[#b5c0c8]">{state.connected.name}</p>
          <AnimatePresence mode="wait" initial={false}><motion.p key={connectionStatus} className="m-0 text-[10px] text-[#91d9ac]" initial={enter} animate={present} exit={leave} transition={transition}>{connectionStatus}</motion.p></AnimatePresence>
        </div>
      </motion.div>}</AnimatePresence>
      <AnimatePresence initial={false}>{!state.connected && connectionStatus && <motion.p key={connectionStatus} className="m-0 rounded-xl bg-[#252b30] px-3.5 py-3 text-[11px] text-[#ddd]" role="status" aria-live="polite" initial={enter} animate={present} exit={leave} transition={transition}>{connectionStatus}</motion.p>}</AnimatePresence>
      <motion.p className="my-3 leading-relaxed text-[#ccc]" initial={enter} animate={present} transition={transition}>Conecte o computador e o celular à mesma rede Wi-Fi.</motion.p>
      <motion.div layout={!reducedMotion} className="mobile-connect-qr my-5 grid min-h-[260px] place-items-center border border-[#383838] bg-[#191919] p-2.5 max-[900px]:min-h-[225px]" transition={transition}>
        <AnimatePresence mode="wait" initial={false}>
          {state.qr && state.url
            ? <motion.img key={state.qr} className="size-60 max-w-full bg-white object-contain max-[900px]:size-[210px]" src={state.qr} alt="QR Code para conectar o celular" initial={enter} animate={present} exit={leave} transition={transition} />
            : <motion.p key={state.connected ? 'connected' : 'empty'} className="m-0 text-center leading-[1.8] text-[#aaa]" initial={enter} animate={present} exit={leave} transition={transition}>{state.connected ? 'Celular conectado. Você já pode enviar imagens.' : 'Gere um QR Code e leia com a câmera do celular.'}</motion.p>}
        </AnimatePresence>
      </motion.div>
      <AnimatePresence initial={false}>{state.url && <motion.label key="connection-link" className="my-4 block text-[11px] font-normal text-[#bbb]" initial={enter} animate={present} exit={leave} transition={transition}>Link de conexão<Input className={inputClass} value={state.url} readOnly /></motion.label>}</AnimatePresence>
      <AnimatePresence mode="wait" initial={false}><motion.p key={state.url ? seconds ? 'valid' : 'expired' : 'no-qr'} className="my-3 leading-relaxed text-[#ccc]" initial={enter} animate={present} exit={leave} transition={transition}>{state.url ? seconds ? `QR Code válido por ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : 'QR Code expirado. Gere uma nova conexão.' : ''}</motion.p></AnimatePresence>
      <div className={`mx-auto my-4 grid w-full max-w-[450px] items-stretch justify-center gap-2.5 ${state.url ? 'grid-cols-3' : state.active ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <motion.div layout={!reducedMotion} whileHover={reducedMotion || busy ? undefined : { y: -1 }} whileTap={reducedMotion || busy ? undefined : { scale: 0.98 }} transition={transition}><Button variant="ghost" className={`${buttonClass} !bg-[#2f7048] !text-white hover:!bg-[#3b8959]`} disabled={busy || !address} onClick={() => void action(() => window.mobile.start(address))}><AnimatePresence mode="wait" initial={false}><motion.span key={state.active ? 'regenerate' : 'generate'} initial={enter} animate={present} exit={leave} transition={transition}>{state.active ? 'Gerar nova conexão' : 'Gerar QR Code'}</motion.span></AnimatePresence></Button></motion.div>
        <AnimatePresence initial={false}>{state.active && <motion.div key="stop-action" layout={!reducedMotion} initial={enter} animate={present} exit={leave} whileHover={reducedMotion || busy ? undefined : { y: -1 }} whileTap={reducedMotion || busy ? undefined : { scale: 0.98 }} transition={transition}><Button variant="ghost" className={`${buttonClass} !bg-[#843841] !text-white hover:!bg-[#a34853]`} disabled={busy} onClick={() => void action(() => window.mobile.stop())}>Encerrar conexão</Button></motion.div>}</AnimatePresence>
        <AnimatePresence initial={false}>{state.url && <motion.div key="copy-action" layout={!reducedMotion} initial={enter} animate={present} exit={leave} whileHover={reducedMotion || busy ? undefined : { y: -1 }} whileTap={reducedMotion || busy ? undefined : { scale: 0.98 }} transition={transition}><Button variant="ghost" className={`${buttonClass} !bg-[#806522] !text-white hover:!bg-[#a8842f]`} disabled={busy} onClick={() => void action(async () => { await window.mobile.copyLink(); setError('Link copiado.'); })}>Copiar link</Button></motion.div>}</AnimatePresence>
      </div>
      </Sheet.Body>
    </Sheet.Content>
  </Sheet>;
}
