import { Route, Routes } from 'react-router-dom';
import { Chat } from './pages/Chat';
import { Admin } from './pages/Admin';
import { I18nProvider } from './i18n';

export function App() {
  return (
    <I18nProvider>
      <Routes>
        <Route path="/" element={<Chat />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </I18nProvider>
  );
}
