import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type WheelEvent, type ReactNode } from 'react';
import type { Page, Region } from './types';

const GUTTER = 24;
const MIN = .1;
const MAX = 4;
const LENS = 190;
const MAGNIFICATION = 3;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

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

  useEffect(() => {
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
    <div className="zoom-toolbar" role="group" aria-label="Zoom do documento">
      <span>Zoom</span>
      <button type="button" aria-label="Diminuir zoom" title="Diminuir zoom" disabled={disabled || actual <= MIN} onClick={() => zoom(actual / 1.25)}>−</button>
      <select aria-label="Nível de zoom" disabled={disabled} value={fit ? 'fit' : String(scale)} onChange={event => event.target.value === 'fit' ? fitToScreen() : zoom(Number(event.target.value))}>
        <option value="fit">Ajustar ({Math.round(fitScale * 100)}%)</option>
        {[.25, .5, .75, 1, 1.5, 2, 3, 4].map(value => <option key={value} value={String(value)}>{value * 100}%</option>)}
        {!fit && ![.25, .5, .75, 1, 1.5, 2, 3, 4].includes(scale) && <option value={String(scale)}>{Math.round(scale * 100)}%</option>}
      </select>
      <button type="button" aria-label="Aumentar zoom" title="Aumentar zoom" disabled={disabled || actual >= MAX} onClick={() => zoom(actual * 1.25)}>+</button>
      <button type="button" disabled={disabled} onClick={fitToScreen}>Ajustar à tela</button>
      <button type="button" disabled={disabled} aria-pressed={loupe} onClick={() => { setLoupe(!loupe); setLens(null); }}>Lupa 3×</button>
      <span className="zoom-hint">Arraste para mover · Ctrl + rolagem para ampliar</span>
      <span className="visually-hidden" role="status" aria-live="polite">{fit ? `Documento ajustado à tela, ${Math.round(actual * 100)}%.` : `Zoom de ${Math.round(actual * 100)}%.`}</span>
    </div>
    <div className={`preview-content ${contentClassName}`}><div ref={viewport} className={`preview-canvas ${canPan ? 'can-pan' : ''} ${panning ? 'is-panning' : ''} ${loupe ? 'has-loupe' : ''}`} tabIndex={0} aria-label="Prévia do documento com zoom. Use mais, menos ou zero para ajustar." onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onLostPointerCapture={pointerUp} onPointerLeave={() => setLens(null)} onScroll={() => setLens(null)} onWheel={wheel} onDoubleClick={event => { if (event.target === image.current && !disabled) { if (fit) zoom(1, { x: event.clientX, y: event.clientY }); else fitToScreen(); } }} onKeyDown={keydown}>
      {page ? <div className="zoom-stage" style={{ width: stageWidth, height: stageHeight, position: 'relative' }}><img ref={image} src={page.url} alt={`Prévia da página ${pageIndex + 1}`} draggable={false} style={{ width, height }} onLoad={event => setNatural({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} onError={() => setNatural({ width: 0, height: 0 })} />{highlight && loaded && <div className="capture-highlight" style={{ left: (stageWidth - width) / 2 + highlight.x * width, top: (stageHeight - height) / 2 + highlight.y * height, width: highlight.width * width, height: highlight.height * height }} />}</div> : <div className="preview-empty"><h3>Seus documentos, em detalhe</h3><p>Digitalize ou escolha uma página ao lado para visualizar.</p></div>}
    </div>{children}</div>
    {lens && page && <div className="document-loupe" role="img" aria-label="Detalhe ampliado do documento" style={{ position: 'fixed', left: lens.left, top: lens.top, backgroundImage: `url("${page.url}")`, backgroundSize: `${width * MAGNIFICATION}px ${height * MAGNIFICATION}px`, backgroundPosition: lens.backgroundPosition }} />}
  </>;
}
