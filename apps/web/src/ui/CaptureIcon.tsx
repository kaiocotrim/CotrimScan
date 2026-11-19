export function CaptureIcon({ type, size = 20 }: { type: string; size?: number }) {
  const paths: Record<string, string> = {
    qr: 'M3 3h6v6H3z M15 3h6v6h-6z M3 15h6v6H3z M15 15h2v2h-2z M21 13v4h-2 M13 21h4v-2 M21 21v-2 M13 13h2 M13 3v6 M3 12h6',
    barcode: 'M3 4v16 M6 4v16 M10 4v16 M12 4v16 M16 4v16 M19 4v16 M21 4v16',
    scan: 'M3 8V4h4 M17 4h4v4 M21 16v4h-4 M7 20H3v-4 M7 12h10',
    calibrate: 'M12 2v4 M12 18v4 M2 12h4 M18 12h4 M18 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0',
    fit: 'M3 9V3h6 M15 3h6v6 M21 15v6h-6 M9 21H3v-6',
    text: 'M4 5h16 M12 5v15 M8 20h8',
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[type] || paths.text} /></svg>;
}
