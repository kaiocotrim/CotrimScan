import { createRoot } from 'react-dom/client';
import './tailwind.css';
import './style.css';
import { App } from './ui/App';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Missing #root mount point');
createRoot(rootElement).render(<App />);
