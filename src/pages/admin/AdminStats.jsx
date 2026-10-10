import { useEffect, useMemo, useState } from 'react';
import Layout from '../../components/Layout';
import Button from '../../components/ui/Button';
import { readAllEvents, logFolderPath } from '../../lib/activityLog';

const RANGES = [
  { days: 7, label: '최근 7일' },
  { days: 30, label: '최근 30일' },
  { days: 90, label: '최근 90일' },
];

const ROLE_LABEL = {
  admin: '관리자',
  'staff-a': '본사A',
  'staff-b': '본사B',
  sales: '영업',
};

const pad = (n) => String(n).padStart(2, '0');
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtTime = (iso) => {
  const d = new Date(iso);
  return `${dayKey(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const downloadLabel = (e) =>
  `${e.k === 'excel' ? 'Excel' : 'PDF'} · ${e.s === 'compare' ? '비교' : '사양 상세'}`;

function Kpi({ label, value, sub }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-barlow text-3xl font-semibold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function AdminStats() {
  const [events, setEvents] = useState([]);
  const [folderMissing, setFolderMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(30);
  const [tab, setTab] = useState('daily'); // daily | users | downloads

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await readAllEvents();
      setEvents(r.events);
      setFolderMissing(r.folderMissing);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));
    const inRange = events.filter((e) => new Date(e.t) >= start);

    // 일자별 — 접속 사용자 수(고유)·접속 건수·다운로드 건수
    const byDay = new Map();
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      byDay.set(dayKey(d), { date: dayKey(d), users: new Set(), logins: 0, downloads: 0 });
    }
    inRange.forEach((e) => {
      const row = byDay.get(dayKey(new Date(e.t)));
      if (!row) return;
      row.users.add(e.email);
      if (e.a === 'login') row.logins += 1;
      if (e.a === 'download') row.downloads += 1;
    });
    const daily = [...byDay.values()].reverse().map((r) => ({ ...r, userCount: r.users.size }));

    // 사용자별
    const byUser = new Map();
    inRange.forEach((e) => {
      const u = byUser.get(e.email) || {
        email: e.email, name: e.n, role: e.r, last: e.t, days: new Set(), logins: 0, downloads: 0,
      };
      u.days.add(dayKey(new Date(e.t)));
      if (e.a === 'login') u.logins += 1;
      if (e.a === 'download') u.downloads += 1;
      if (e.t >= u.last) { u.last = e.t; u.name = e.n || u.name; u.role = e.r || u.role; }
      byUser.set(e.email, u);
    });
    const users = [...byUser.values()].sort((a, b) => (a.last < b.last ? 1 : -1));

    const downloads = inRange
      .filter((e) => e.a === 'download')
      .sort((a, b) => (a.t < b.t ? 1 : -1));

    const today = daily[0];
    const avg = daily.reduce((s, r) => s + r.userCount, 0) / days;
    return { daily, users, downloads, today, avg, maxUsers: Math.max(1, ...daily.map((r) => r.userCount)) };
  }, [events, days]);

  const tabCls = (k) =>
    `px-3 py-1.5 rounded text-sm font-medium transition-colors ${
      tab === k ? 'bg-mb-blue text-white' : 'text-gray-600 hover:bg-gray-100'
    }`;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h1 className="font-barlow text-2xl font-semibold text-gray-900">사용 통계</h1>
          <div className="flex items-center gap-2">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white"
            >
              {RANGES.map((r) => <option key={r.days} value={r.days}>{r.label}</option>)}
            </select>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              {loading ? '불러오는 중…' : '새로고침'}
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded border border-red-200 bg-red-50 text-sm text-red-700">
            통계를 불러오지 못했습니다: {error}
          </div>
        )}
        {folderMissing && !error && (
          <div className="mb-4 p-3 rounded border border-amber-200 bg-amber-50 text-sm text-amber-800">
            아직 기록이 없습니다. 사용자가 접속하면 SharePoint <b>{logFolderPath()}</b> 폴더에 기록이 쌓입니다.
            (모든 앱 사용자에게 이 폴더 <b>편집</b> 권한이 있어야 기록됩니다.)
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <Kpi label="오늘 접속자" value={stats.today?.userCount ?? 0} sub="고유 사용자 수" />
          <Kpi label="일평균 접속자" value={stats.avg.toFixed(1)} sub={`최근 ${days}일`} />
          <Kpi label="기간 내 접속 사용자" value={stats.users.length} sub="고유 사용자 수" />
          <Kpi label="다운로드" value={stats.downloads.length} sub="Excel + PDF" />
        </div>

        <div className="flex gap-1 mb-3">
          <button className={tabCls('daily')} onClick={() => setTab('daily')}>일자별 접속</button>
          <button className={tabCls('users')} onClick={() => setTab('users')}>사용자별</button>
          <button className={tabCls('downloads')} onClick={() => setTab('downloads')}>다운로드 내역</button>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          {tab === 'daily' && (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">날짜</th>
                  <th className="text-left px-3 py-2 font-medium w-1/2">접속 사용자</th>
                  <th className="text-right px-3 py-2 font-medium">접속 횟수</th>
                  <th className="text-right px-3 py-2 font-medium">다운로드</th>
                </tr>
              </thead>
              <tbody>
                {stats.daily.map((r) => (
                  <tr key={r.date} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-mono text-xs text-gray-700">{r.date}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 rounded">
                          <div
                            className="h-2 bg-mb-blue rounded"
                            style={{ width: `${(r.userCount / stats.maxUsers) * 100}%` }}
                          />
                        </div>
                        <span className="w-8 text-right tabular-nums">{r.userCount}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-600">{r.logins}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-600">{r.downloads}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'users' && (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">이름</th>
                  <th className="text-left px-3 py-2 font-medium">계정</th>
                  <th className="text-left px-3 py-2 font-medium">권한</th>
                  <th className="text-left px-3 py-2 font-medium">마지막 접속</th>
                  <th className="text-right px-3 py-2 font-medium">접속 일수</th>
                  <th className="text-right px-3 py-2 font-medium">접속 횟수</th>
                  <th className="text-right px-3 py-2 font-medium">다운로드</th>
                </tr>
              </thead>
              <tbody>
                {stats.users.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">기록이 없습니다.</td></tr>
                )}
                {stats.users.map((u) => (
                  <tr key={u.email} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-gray-900">{u.name || '-'}</td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-600">{u.email}</td>
                    <td className="px-3 py-2 text-gray-600">{ROLE_LABEL[u.role] || u.role || '-'}</td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-600">{fmtTime(u.last)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{u.days.size}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{u.logins}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{u.downloads}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'downloads' && (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">일시</th>
                  <th className="text-left px-3 py-2 font-medium">사용자</th>
                  <th className="text-left px-3 py-2 font-medium">종류</th>
                  <th className="text-left px-3 py-2 font-medium">대상 모델</th>
                </tr>
              </thead>
              <tbody>
                {stats.downloads.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-8 text-center text-gray-400">다운로드 기록이 없습니다.</td></tr>
                )}
                {stats.downloads.map((e, i) => (
                  <tr key={`${e.email}-${e.t}-${i}`} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-mono text-xs text-gray-600 whitespace-nowrap">{fmtTime(e.t)}</td>
                    <td className="px-3 py-2">
                      <span className="text-gray-900">{e.n || '-'}</span>
                      <span className="block font-mono text-xs text-gray-400">{e.email}</span>
                    </td>
                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{downloadLabel(e)}</td>
                    <td className="px-3 py-2 text-gray-700">{e.m || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p className="text-xs text-gray-400 mt-3">
          기록 위치: SharePoint {logFolderPath()} (사용자별 JSON, 최근 120일 보관). 접속 횟수는 탭(세션)·일자 기준입니다.
        </p>
      </div>
    </Layout>
  );
}
