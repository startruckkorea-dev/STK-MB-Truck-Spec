import { useSpecLang } from '../../hooks/useSpecLang';

export default function LangToggle() {
  const [lang, setLang] = useSpecLang();
  return (
    <div className="inline-flex bg-gray-100 rounded-lg p-0.5 text-xs">
      <button
        onClick={() => setLang('ko')}
        className={`px-2.5 py-1 rounded-md transition-all ${
          lang === 'ko'
            ? 'bg-white shadow-sm text-gray-900 font-medium'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        한국어
      </button>
      <button
        onClick={() => setLang('en')}
        className={`px-2.5 py-1 rounded-md transition-all ${
          lang === 'en'
            ? 'bg-white shadow-sm text-gray-900 font-medium'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        English
      </button>
    </div>
  );
}
