import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress ResizeObserver loop errors (benign error from ReactFlow/Recharts)
const showError = window.console.error;
window.console.error = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('ResizeObserver loop')) return;
  showError(...args);
};
window.addEventListener('error', e => {
  if (e.message.includes('ResizeObserver loop')) {
    e.stopImmediatePropagation();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
