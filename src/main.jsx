import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { SpecLangProvider } from './hooks/useSpecLang';
import App from './App';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <SpecLangProvider>
          <App />
        </SpecLangProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
