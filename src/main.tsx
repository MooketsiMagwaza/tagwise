import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initAppearance } from './theme';
import { App } from './App';

initAppearance();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
