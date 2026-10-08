import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/lexend-deca/300.css';
import '@fontsource/lexend-deca/400.css';
import '@fontsource/lexend-deca/500.css';
import '@fontsource/lexend-deca/600.css';
import '@fontsource/lexend-deca/700.css';
import '@fontsource/lexend-deca/800.css';
import '../style.css';
import './app.css';
import { App } from './App';

const favicon = document.createElement('link');
favicon.rel = 'icon';
favicon.type = 'image/png';
favicon.href = `${import.meta.env.BASE_URL}favicon.png`;
document.head.appendChild(favicon);

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
