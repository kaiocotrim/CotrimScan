import type { Project } from './ui/types';

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
    remove: unavailable, rotate: unavailable, enhance: unavailable,
    original: unavailable, ocr: unavailable, readOcr: unavailable,
    saveOcr: unavailable, save: unavailable, clear: unavailable,
  },
  mobile: {
    onState: () => () => {}, onReceived: () => () => {},
    addresses: async () => [], status: async () => ({ active: false }),
    start: unavailable, decide: unavailable, stop: async () => {},
    copyLink: unavailable,
  },
  capture: {
    models: async () => [], saveModel: unavailable, assign: unavailable,
    read: unavailable, extract: unavailable, save: unavailable,
    sample: unavailable, calibrate: unavailable, preview: unavailable,
  },
});
