import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './_layout'; // We will reuse the root layout for now
import '../global.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
); 