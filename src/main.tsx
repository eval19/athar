import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './fonts.css';
import './index.css';
import App from './App';
import { HadithReaderWindow } from './components/HadithReaderWindow';
import { isReaderView } from './services/desktopBridge';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isReaderView() ? <HadithReaderWindow /> : <App />}
  </StrictMode>,
);
