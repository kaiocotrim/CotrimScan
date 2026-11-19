import type { CaptureModel, Project } from '@cotrimscan/shared';

export const capturePreviewSample = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="850" height="1100" viewBox="0 0 850 1100"><rect width="850" height="1100" fill="#fff"/><rect x="55" y="55" width="740" height="990" fill="none" stroke="#cbd5e1" stroke-width="2"/><text x="90" y="130" font-family="Arial" font-size="32" font-weight="bold" fill="#192434">DOCUMENTO DE EXEMPLO</text><text x="90" y="180" font-family="Arial" font-size="16" fill="#64748b">Prévia visual do editor de modelos</text><path d="M90 215h670" stroke="#cbd5e1"/><text x="90" y="290" font-family="Arial" font-size="20" fill="#334155">Nome: Maria da Silva</text><text x="90" y="355" font-family="Arial" font-size="20" fill="#334155">Matrícula: 00123456</text><text x="90" y="420" font-family="Arial" font-size="20" fill="#334155">Data: 19/11/2026</text><rect x="575" y="245" width="170" height="170" fill="#192434"/><path d="M590 260h42v42h-42zm98 0h42v42h-42zm-98 98h42v42h-42zm56-56h28v28h-28zm42 42h14v14h-14zm-28 28h28v28h-28z" fill="#fff"/><text x="575" y="440" font-family="Arial" font-size="13" fill="#64748b">QR Code de exemplo</text><path d="M90 500h670" stroke="#cbd5e1"/><text x="90" y="550" font-family="Arial" font-size="17" fill="#64748b">Selecione ou mova as áreas azuis para testar a interface.</text></svg>`)}`;

export const capturePreviewModel: CaptureModel = { id: 'preview-capture-model', name: 'Documento de exemplo', version: 1, fields: [] };
let captureModels: CaptureModel[] = [capturePreviewModel];

// Design preview for Vite. Electron supplies these APIs through preload.cjs.
let projects: Project[] = [{
  id: 'preview-project', name: 'Projeto de exemplo', pageCount: 0,
  port: 9880, dpi: 300, source: 'Feeder', colorMode: 'RGB24',
  processingMode: 'auto', documentType: 'document', duplex: false,
  outputs: [], namingMode: 'default', signature: { type: 'none' },
  signatureStamp: false,
}];
let signedIn = true;
const previewCertificate = (input: Partial<Project>) => input.signature?.type === 'a1' ? { subject: 'Certificado de exemplo', expiresAt: new Date(Date.now() + 180 * 86400000).toISOString() } : null;
const unavailable = async (): Promise<never> => {
  throw new Error('Esta função está disponível no aplicativo desktop.');
};

if (import.meta.env.DEV && !window.localAuth) Object.assign(window, {
  localAuth: {
    status: async () => ({ authenticated: signedIn, hasAccount: true, username: 'Kaio' }),
    login: async (username: string) => { signedIn = true; return { username }; },
    register: async (username: string) => { signedIn = true; return { username }; },
    logout: async () => { signedIn = false; },
  },
  projects: {
    list: async () => [...projects],
    open: async (id: string) => ({ project: projects.find(item => item.id === id), pages: [] }),
    close: async () => {},
    create: async (input: Partial<Project>) => {
      const project = { ...projects[0], ...input, certificateInfo: previewCertificate(input), id: crypto.randomUUID(), pageCount: 0 } as Project;
      projects = [...projects, project];
      return project;
    },
    update: async (id: string, input: Partial<Project>) => {
      const current = projects.find(item => item.id === id);
      if (!current) throw new Error('Projeto não encontrado.');
      const project = { ...current, ...input, certificateInfo: input.signature ? previewCertificate(input) : current.certificateInfo };
      projects = projects.map(item => item.id === id ? project : item);
      return project;
    },
    pickOutputs: async () => [], export: unavailable,
  },
  certificates: {
    platform: async () => ({ a3: false }), list: async () => [],
    pickFile: async () => window.prompt('Caminho do certificado para a prévia visual:') || null,
    status: async () => ({ ready: true, type: 'none' }), prepare: async () => {},
  },
  scanner: {
    onPage: () => () => {}, connect: unavailable, scan: unavailable,
    list: async () => ({ devices: [], selected: null, manual: [], forkError: null }),
    select: unavailable, refresh: unavailable, addManual: unavailable, removeManual: unavailable,
    remove: unavailable, rotate: unavailable, enhance: unavailable,
    original: unavailable, readCode: unavailable, ocr: unavailable, readOcr: unavailable,
    saveOcr: unavailable, save: unavailable, clear: unavailable,
  },
  mobile: {
    onState: () => () => {}, onReceived: () => () => {},
    addresses: async () => [], status: async () => ({ active: false }),
    start: unavailable, decide: unavailable, stop: async () => {},
    copyLink: unavailable,
  },
  capture: {
    models: async () => [...captureModels],
    saveModel: async (model: CaptureModel) => { const saved = { ...model, id: model.id || crypto.randomUUID(), version: (model.version || 0) + 1 }; captureModels = [...captureModels.filter(item => item.id !== saved.id), saved]; return saved; },
    assign: unavailable,
    read: unavailable, extract: unavailable, save: unavailable,
    sample: async () => ({ url: capturePreviewSample }),
    calibrate: async () => ({ reference: { preview: true } }),
    preview: async (_url: string, field: { type: string }) => field.type === 'barcode'
      ? { value: '', confidence: 100, error: 'Nenhum código encontrado na área.' }
      : { value: field.type === 'qr' ? 'QR-EXEMPLO-12345' : 'Maria da Silva', confidence: field.type === 'qr' ? 98 : 94 },
  },
});
