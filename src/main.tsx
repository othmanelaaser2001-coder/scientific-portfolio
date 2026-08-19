import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { registerServiceWorker } from './pwa/register';

createRoot(document.getElementById('root')!).render(<App />);

registerServiceWorker();
