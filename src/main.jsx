import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { DataProvider } from './contexts/DataContext';
import { SpecLangProvider } from './hooks/useSpecLang';
import { initMsal } from './lib/msal';
import App from './App';
import './styles/index.css';

function render() {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <DataProvider>
            <SpecLangProvider>
              <App />
            </SpecLangProvider>
          </DataProvider>
        </AuthProvider>
      </BrowserRouter>
    </React.StrictMode>
  );
}

// 모바일 리다이렉트 로그인에서 돌아오면 URL 에 `#code=...` 가 붙어 있다.
// 라우터가 `/` → `/models` 로 이동하며 해시를 지우기 전에 MSAL 이 먼저 처리하도록
// 렌더 전에 초기화(handleRedirectPromise)를 끝낸다.
initMsal()
  .catch((err) => console.warn('[msal] init:', err?.errorCode || err?.message))
  .finally(render);
