import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type WheelEvent, type ReactNode } from 'react';
import type { Page, Region } from './types';

const GUTTER = 24;
const MIN = .1;
const MAX = 4;
const LENS = 190;
const MAGNIFICATION = 3;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const zoomButton = 'm-0 w-auto rounded-sm border border-[#555] bg-[#292929] px-2.5 py-1.5 text-[11px] text-[#ddd] hover:bg-[#333] disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ddd]';

interface Props { page?: Page; pageIndex: number; locked?: boolean; children?: ReactNode; contentClassName?: string; highlight?: Region | null }
export function PreviewZoom({ page, pageIndex, locked = false, children, contentClassName = '', highlight }: Props) {
  const viewport = useRef<HTMLDivElement>(null), image = useRef<HTMLImageElement>(null);
  const pan = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1), [fit, setFit] = useState(true), [loupe, setLoupe] = useState(false), [panning, setPanning] = useState(false);
  const [lens, setLens] = useState<{ left: number; top: number; backgroundPosition: string } | null>(null);
  const loaded = !!page && natural.width > 0 && natural.height > 0;
  const fitScale = loaded && viewportSize.width && viewportSize.height
    ? Math.max(.001, Math.min((viewportSize.width - GUTTER * 2) / natural.width, (viewportSize.height - GUTTER * 2) / natural.height, 1))
    : 1;
  const actual = fit ? fitScale : scale;
  const width = natural.width * actual, height = natural.height * actual;
  const stageWidth = Math.max(viewportSize.width, width + GUTTER * 2);
  const stageHeight = Math.max(viewportSize.height, height + GUTTER * 2);
  const canPan = stageWidth > viewportSize.width + 1 || stageHeight > viewportSize.height + 1;
  const disabled = !loaded || locked;

  useLayoutEffect(() => {
    setNatural({ width: 0, height: 0 }); setScale(1); setFit(true); setLoupe(false); setLens(null);
    pan.current = null; setPanning(false);
    if (viewport.current) { viewport.current.scrollLeft = 0; viewport.current.scrollTop = 0; }
  }, [page?.url]);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const measure = () => setViewportSize({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure); observer.observe(element); return () => observer.disconnect();
  }, []);
  useEffect(() => { if (fit && viewport.current) { viewport.current.scrollLeft = 0; viewport.current.scrollTop = 0; } }, [fit, fitScale]);
  useEffect(() => { if (disabled) setLens(null); }, [disabled]);

  function anchor(point?: { x: number; y: number }) {
    const img = image.current, view = viewport.current;
    if (!img || !view) return null;
    const r = img.getBoundingClientRect(), v = view.getBoundingClientRect();
    const x = point?.x ?? v.left + view.clientWidth / 2, y = point?.y ?? v.top + view.clientHeight / 2;
    return { u: clamp((x - r.left) / Math.max(1, r.width), 0, 1), v: clamp((y - r.top) / Math.max(1, r.height), 0, 1), x: x - v.left, y: y - v.top };
  }
  const zoom = useCallback((value: number, point?: { x: number; y: number }) => {
    if (disabled || !Number.isFinite(value)) return;
    const focus = anchor(point), next = clamp(value, MIN, MAX);
    setFit(false); setScale(next); setLens(null);
    if (focus) requestAnimationFrame(() => {
      const view = viewport.current;
      if (!view) return;
      const nextWidth = natural.width * next, nextHeight = natural.height * next;
      const totalWidth = Math.max(view.clientWidth, nextWidth + GUTTER * 2), totalHeight = Math.max(view.clientHeight, nextHeight + GUTTER * 2);
      view.scrollLeft = clamp((totalWidth - nextWidth) / 2 + focus.u * nextWidth - focus.x, 0, Math.max(0, totalWidth - view.clientWidth));
      view.scrollTop = clamp((totalHeight - nextHeight) / 2 + focus.v * nextHeight - focus.y, 0, Math.max(0, totalHeight - view.clientHeight));
    });
  }, [disabled, natural]);
  function fitToScreen() { if (!disabled) { setFit(true); setLens(null); } }
  function moveLens(event: PointerEvent<HTMLDivElement>) {
    if (!loupe || disabled || pan.current || !image.current || !viewport.current) { setLens(null); return; }
    const r = image.current.getBoundingClientRect(), v = viewport.current.getBoundingClientRect();
    const { clientX: x, clientY: y } = event;
    if (x < r.left || x > r.right || y < r.top || y > r.bottom || x < v.left || x > v.right || y < v.top || y > v.bottom) { setLens(null); return; }
    setLens({ left: clamp(x + LENS + 24 > window.innerWidth ? x - LENS - 20 : x + 20, 8, Math.max(8, window.innerWidth - LENS - 8)), top: clamp(y + 20, 8, Math.max(8, window.innerHeight - LENS - 8)), backgroundPosition: `${(LENS - 4) / 2 - (x - r.left) * MAGNIFICATION}px ${(LENS - 4) / 2 - (y - r.top) * MAGNIFICATION}px` });
  }
  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || disabled) return;
    event.currentTarget.focus({ preventScroll: true });
    if (loupe) { moveLens(event); return; }
    if (!canPan) return;
    event.preventDefault(); pan.current = { x: event.clientX, y: event.clientY, left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop };
    event.currentTarget.setPointerCapture(event.pointerId); setPanning(true);
  }
  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    if (pan.current) {
      event.currentTarget.scrollLeft = pan.current.left - (event.clientX - pan.current.x);
      event.currentTarget.scrollTop = pan.current.top - (event.clientY - pan.current.y);
      setLens(null);
    } else moveLens(event);
  }
  function pointerUp(event: PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    pan.current = null; setPanning(false); setLens(null);
  }
  function wheel(event: WheelEvent<HTMLDivElement>) {
    if (!(event.ctrlKey || event.metaKey) || disabled) return;
    event.preventDefault(); zoom(actual * Math.exp(-event.deltaY * .002), { x: event.clientX, y: event.clientY });
  }
  function keydown(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    if (['+', '=', '-', '0'].includes(event.key)) {
      event.preventDefault();
      if (event.key === '0') fitToScreen(); else zoom(event.key === '-' ? actual / 1.25 : actual * 1.25);
    }
  }
  return <>
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[#363636] px-[18px] py-[9px] text-[11px] text-[#bbb] max-[700px]:gap-1.5 max-[700px]:p-2" role="group" aria-label="Zoom do documento">
      <span>Zoom</span>
      <button id="zoom-out" className={`${zoomButton} min-w-[30px] text-[17px] leading-[17px]`} type="button" aria-label="Diminuir zoom" title="Diminuir zoom" disabled={disabled || actual <= MIN} onClick={() => zoom(actual / 1.25)}>−</button>
      <select className="m-0 w-auto max-w-[220px] rounded-sm border border-[#555] bg-[#202020] px-2 py-1.5 text-[11px] text-[#eee]" aria-label="Nível de zoom" disabled={disabled} value={fit ? 'fit' : String(scale)} onChange={event => event.target.value === 'fit' ? fitToScreen() : zoom(Number(event.target.value))}>
        <option value="fit">Ajustar ({Math.round(fitScale * 100)}%)</option>
        {[.25, .5, .75, 1, 1.5, 2, 3, 4].map(value => <option key={value} value={String(value)}>{value * 100}%</option>)}
        {!fit && ![.25, .5, .75, 1, 1.5, 2, 3, 4].includes(scale) && <option value={String(scale)}>{Math.round(scale * 100)}%</option>}
      </select>
      <button id="zoom-in" className={`${zoomButton} min-w-[30px] text-[17px] leading-[17px]`} type="button" aria-label="Aumentar zoom" title="Aumentar zoom" disabled={disabled || actual >= MAX} onClick={() => zoom(actual * 1.25)}>+</button>
      <button className={zoomButton} type="button" disabled={disabled} onClick={fitToScreen}>Ajustar à tela</button>
      <button id="zoom-loupe" className={`${zoomButton} ${loupe ? 'border-[#72b9ed] bg-[#234968] text-white' : ''}`} type="button" disabled={disabled} aria-pressed={loupe} onClick={() => { setLoupe(value => !value); setLens(null); }}>Lupa 3×</button>
      <span className="ml-auto text-[#999] max-[700px]:hidden">Arraste para mover · Ctrl + rolagem para ampliar</span>
      <span className="visually-hidden" role="status" aria-live="polite">{fit ? `Documento ajustado à tela, ${Math.round(actual * 100)}%.` : `Zoom de ${Math.round(actual * 100)}%.`}</span>
    </div>
    <div className={`grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)] overflow-hidden ${contentClassName}`}><div id="document-viewport" ref={viewport} className={`relative block min-h-0 min-w-0 flex-1 overflow-auto bg-[#161616] p-0 [overscroll-behavior:contain] [touch-action:pan-x_pan-y] ${canPan ? 'can-pan' : ''} ${panning ? 'is-panning' : ''} ${loupe ? 'has-loupe' : ''}`} tabIndex={0} aria-label="Prévia do documento com zoom. Use mais, menos ou zero para ajustar." onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onLostPointerCapture={pointerUp} onPointerLeave={() => setLens(null)} onScroll={() => setLens(null)} onWheel={wheel} onDoubleClick={event => { if (event.target === image.current && !disabled) { if (fit) zoom(1, { x: event.clientX, y: event.clientY }); else fitToScreen(); } }} onKeyDown={keydown}>
      {page ? <div className="relative grid min-h-0 min-w-0 place-items-center" style={{ width: stageWidth, height: stageHeight }}><img id="document-preview" ref={image} src={page.url} alt={`Prévia da página ${pageIndex + 1}`} draggable={false} style={{ width, height }} onLoad={event => setNatural({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} onError={() => setNatural({ width: 0, height: 0 })} />{highlight && loaded && <div className="capture-highlight" style={{ left: (stageWidth - width) / 2 + highlight.x * width, top: (stageHeight - height) / 2 + highlight.y * height, width: highlight.width * width, height: highlight.height * height }} />}</div> : <div className="flex h-full min-h-[180px] flex-col items-center justify-center p-6 text-center text-[#888]"><h3 className="mb-2.5 mt-[22px] text-[15px] font-normal text-[#ccc]">Seus documentos, em detalhe</h3><p className="m-0 text-[11px] leading-[1.8]">Digitalize ou escolha uma página ao lado para visualizar.</p></div>}
    </div>{children}</div>
    {lens && page && <div className="pointer-events-none fixed z-[10000] size-[190px] rounded-full border-2 border-[#78bfff] bg-white bg-no-repeat shadow-[0_5px_28px_#000b]" role="img" aria-label="Detalhe ampliado do documento" style={{ left: lens.left, top: lens.top, backgroundImage: `url("${page.url}")`, backgroundSize: `${width * MAGNIFICATION}px ${height * MAGNIFICATION}px`, backgroundPosition: lens.backgroundPosition }} />}
  </>;
}
