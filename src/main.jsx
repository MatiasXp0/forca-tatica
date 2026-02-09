import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Clear cache force
if ('caches' in window) {
  caches.keys().then(function (names) {
    for (let name of names) caches.delete(name);
  });
}

console.log('🔥 FORÇA TÁTICA - Sistema carregado');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
