'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Check, ChevronLeft, ChevronRight, CircleHelp, Copy, LogOut, Plus, Ticket, Users, X } from 'lucide-react';

type Status = 'green' | 'yellow' | 'red';
type User = { id: string; username: string };
type Room = { id: string; name: string; ownerId: string; inviteToken: string; status: string };
type Member = { id: string; name: string; budget: number | null };
type Availability = { userId: string; day: string; status: Status };
type Person = Member & { reason: string; interest: number };
type Trip = { id: string; creatorId: string; title: string; description: string; startDay: string; endDay: string; flightCost: number; spendCost: number; eligibleCount: number; interestTotal: number; greenCount: number; people: Person[] };
type RoomState = { user: User; room: Room; window: { start: string; end: string }; members: Member[]; availability: Availability[]; trips: Trip[]; ratings: { tripId: string; userId: string; score: number }[]; pending: { id: string; name: string }[] };

const statusLabels: Record<Status, string> = { green: 'Uygunum', yellow: 'Ayarlayabilirim', red: 'Gelemem' };
const reasonLabels: Record<string, string> = { available: 'Uygun', conditional: 'Koşullu uygun', notInterested: 'İlgilenmiyor', red: 'Uygun değil', unknown: 'Takvim eksik', budgetMissing: 'Bütçe eksik', overBudget: 'Bütçeyi aşıyor' };
const weekdays = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pa'];
const moneyText = (value: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(value);
const dateText = (value: string) => new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
const monthText = (value: string) => new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
const emptyTrip = { title: '', description: '', startDay: '', endDay: '', flightCost: '', spendCost: '' };

async function api(action: string, fields: Record<string, unknown> = {}) {
  const response = await fetch('/api/action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, ...fields }) });
  const result = await response.json() as any;
  if (!response.ok) throw new Error(result.error || 'İşlem tamamlanamadı.');
  return result;
}

function monthsBetween(start: string, end: string) {
  const months: string[] = [];
  const cursor = new Date(`${start.slice(0, 7)}-01T00:00:00Z`);
  while (cursor.toISOString().slice(0, 7) <= end.slice(0, 7)) {
    months.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

function calendarDays(month: string) {
  const first = new Date(`${month}T00:00:00Z`);
  const offset = (first.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return [...Array(offset).fill(null), ...Array.from({ length: count }, (_, index) => `${month.slice(0, 7)}-${String(index + 1).padStart(2, '0')}`)] as (string | null)[];
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [state, setState] = useState<RoomState | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [newRoom, setNewRoom] = useState('');
  const [invite, setInvite] = useState('');
  const [monthIndex, setMonthIndex] = useState(0);
  const [selectedDay, setSelectedDay] = useState('');
  const [brush, setBrush] = useState<Status>('green');
  const [painting, setPainting] = useState(false);
  const drag = useRef<{ start: string; end: string } | null>(null);
  const ignoreClick = useRef(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [budget, setBudget] = useState('');
  const [tab, setTab] = useState<'calendar' | 'trips' | 'members'>('calendar');
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [tripForm, setTripForm] = useState(emptyTrip);
  const [showTripForm, setShowTripForm] = useState(false);

  const load = useCallback(async (target: string | null = roomId) => {
    const response = await fetch(`/api/state${target ? `?room=${encodeURIComponent(target)}` : ''}`, { cache: 'no-store' });
    const result = await response.json() as any;
    if (response.status === 401) { setUser(null); setState(null); setRooms([]); setLoading(false); return; }
    if (!response.ok) throw new Error(result.error || 'Veriler alınamadı.');
    setUser(result.user);
    if (target) {
      setState(result);
      setBudget(result.members.find((member: Member) => member.id === result.user.id)?.budget?.toString() ?? '');
    } else setRooms(result.rooms);
    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    setInvite(new URLSearchParams(window.location.search).get('invite') ?? '');
    load(null).catch(error => { setMessage(error.message); setLoading(false); });
  }, [load]);

  async function run(action: string, fields: Record<string, unknown>, after?: (result: any) => void) {
    setBusy(true); setMessage('');
    try {
      const result = await api(action, fields);
      if (after) after(result);
      await load(action === 'login' || action === 'register' || action === 'logout' || action === 'createRoom' || action === 'joinRoom' ? null : roomId);
      if (action !== 'login' && action !== 'register' && action !== 'logout') setMessage('Kaydedildi.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'İşlem tamamlanamadı.'); }
    finally { setBusy(false); }
  }

  const months = useMemo(() => state ? monthsBetween(state.window.start, state.window.end) : [], [state]);
  const currentMonth = months[Math.min(monthIndex, months.length - 1)];
  const ownStatuses = useMemo(() => new Map(state?.availability.filter(item => item.userId === user?.id).map(item => [item.day, item.status])), [state, user]);
  const selectedPeople = state?.members.map(member => ({ ...member, status: state.availability.find(item => item.userId === member.id && item.day === selectedDay)?.status })) ?? [];
  const ownBudget = state?.members.find(member => member.id === user?.id)?.budget;

  function pickDay(day: string) {
    setSelectedDay(day);
    if (!from || to || day < from) { setFrom(day); setTo(''); }
    else setTo(day);
  }

  function dragDay(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const day = (document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null)?.closest<HTMLButtonElement>('[data-day]')?.dataset.day;
    if (!day || day === drag.current.end) return;
    drag.current.end = day;
    setFrom(day < drag.current.start ? day : drag.current.start);
    setTo(day < drag.current.start ? drag.current.start : day);
    setSelectedDay(day);
  }

  function finishDrag() {
    const selection = drag.current;
    drag.current = null;
    if (!selection) return;
    ignoreClick.current = true;
    window.setTimeout(() => { ignoreClick.current = false; }, 0);
    run('setAvailability', { roomId, from: selection.start < selection.end ? selection.start : selection.end, to: selection.start < selection.end ? selection.end : selection.start, status: brush }).finally(() => setPainting(false));
  }

  function selectRoom(id: string) {
    setRoomId(id); setState(null); setMonthIndex(0); setTab('calendar'); setMessage(''); setLoading(true);
    load(id).catch(error => { setMessage(error.message); setLoading(false); });
  }

  if (loading && !user) return <main className="loading-screen"><img className="brand-mark" src="/favicon.svg" width="50" height="50" alt="" /><p>Takvim açılıyor…</p></main>;

  return <div className="app-shell">
    
    <header className="site-header">
      <button className="brand" onClick={() => { setRoomId(null); setState(null); load(null); }} aria-label="Ophedule ana sayfa"><img className="brand-mark" src="/favicon.svg" width="38" height="38" alt="" /><span>ophedule<span className="brand-dot">.</span></span></button>
      <div className="header-right">{user && <><span className="greeting">Merhaba, <strong>{user.username}</strong></span><button className="icon-button" onClick={() => run('logout', {}, () => { setRoomId(null); setState(null); setUser(null); })} aria-label="Çıkış yap" title="Çıkış yap"><LogOut size={18} /></button></>}</div>
    </header>
    <main id="main" className="main-wrap">
      {message && <div className={`notice ${message === 'Kaydedildi.' ? 'notice-ok' : ''}`} role="status"><span>{message}</span><button onClick={() => setMessage('')} aria-label="Bildirimi kapat"><X size={16} /></button></div>}
      {!user ? <section className="auth-layout">
        <div className="auth-intro"><h1>Herkese uyan bir<br/><em>gün bulalım.</em></h1><p>Arkadaşlarınla uygun günleri aynı takvimde gör. Gezi fikirlerini de birlikte karşılaştır.</p><div className="hero-scene" aria-hidden="true"><span className="scene-sun"/><img src="/illustrations/friends-map.webp" width="1000" height="833" alt="" decoding="async" /></div></div>
        <form className="auth-card" onSubmit={event => { event.preventDefault(); run(authMode, { username, password }, () => setPassword('')); }}><h2>{authMode === 'login' ? 'Tekrar hoş geldin' : 'Aramıza katıl'}</h2><p>{authMode === 'login' ? 'Takvimine kaldığın yerden devam et.' : 'Bir kullanıcı adı ve şifre belirle.'}</p><label>Kullanıcı adı<input value={username} onChange={event => setUsername(event.target.value)} minLength={3} maxLength={30} autoComplete="username" required placeholder="Kullanıcı adın" /></label><label>Şifre<input type="password" value={password} onChange={event => setPassword(event.target.value)} minLength={authMode === 'register' ? 10 : 1} maxLength={128} autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} required placeholder={authMode === 'register' ? 'En az 10 karakter' : 'Şifren'} /></label><button className="primary-button full" disabled={busy}>{authMode === 'login' ? 'Giriş yap' : 'Hesap oluştur'} <ChevronRight size={18}/></button><button type="button" className="text-button" onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setMessage(''); }}>{authMode === 'login' ? 'Hesabın yok mu? Kayıt ol' : 'Zaten hesabın var mı? Giriş yap'}</button></form>
      </section> : !state ? <section className="dashboard">
        <div className="section-heading"><div><h1>Odaların </h1><p>Arkadaş grupların, ortak takvimleriniz ve gezi fikirleriniz burada.</p></div><img className="dashboard-art" src="/illustrations/friends-trip.webp" width="1000" height="667" alt="" aria-hidden="true" decoding="async" /></div>
        {invite && <div className="invite-card"><div><h2>Bir odaya davetlisin</h2><p>Katılım isteğin oda yöneticisine gönderilecek.</p></div><button className="primary-button" disabled={busy} onClick={() => run('joinRoom', { inviteToken: invite }, () => { setInvite(''); history.replaceState(null, '', '/'); })}>Katılma isteği gönder <ChevronRight size={18}/></button></div>}
        <div className="dashboard-grid"><div className="room-list"><h2>Odalarım <span>{rooms.length}</span></h2>{rooms.length === 0 ? <div className="empty-state"><img className="empty-art" src="/illustrations/friends-map.webp" width="1000" height="833" alt="" aria-hidden="true" loading="lazy" decoding="async" /><h3>Henüz odan yok</h3><p>Bir oda açıp arkadaşlarınla uygun günleri işaretleyebilirsin.</p></div> : rooms.map(room => <button key={room.id} className="room-card" disabled={room.status !== 'approved'} onClick={() => selectRoom(room.id)}><span className="room-avatar"><Users size={24}/></span><span><strong>{room.name}</strong><small>{room.status === 'approved' ? 'Takvimi aç' : 'Yönetici onayı bekleniyor'}</small></span><ChevronRight size={19}/></button>)}</div><form className="create-card" onSubmit={event => { event.preventDefault(); run('createRoom', { name: newRoom }, result => { setNewRoom(''); setTimeout(() => selectRoom(result.roomId), 150); }); }}><h2>Yeni bir oda aç</h2><p>Birlikte plan yapacağın gruba isim ver.</p><label>Oda adı<input value={newRoom} onChange={event => setNewRoom(event.target.value)} maxLength={60} required placeholder="Grubunun adı" /></label><button className="primary-button full" disabled={busy}>Oda oluştur <Plus size={18}/></button></form></div>
      </section> : <section className="workspace">
        <div className="workspace-top"><img className="workspace-art" src="/illustrations/friends-map.webp" width="1000" height="833" alt="" aria-hidden="true" decoding="async" /><button className="back-button" onClick={() => { setRoomId(null); setState(null); load(null); }}><ChevronLeft size={17}/> Odalarım</button><div className="room-title-row"><div><h1>{state.room.name}</h1><p>Takvim ve gezi fikirleri</p></div><div className="room-badge"><Users size={20}/><strong>{state.members.length}</strong><span>üye</span></div></div><div className="tabs" role="tablist" aria-label="Oda bölümleri"><button role="tab" aria-selected={tab === 'calendar'} className={tab === 'calendar' ? 'active' : ''} onClick={() => setTab('calendar')}><CalendarDays size={18}/> Takvim</button><button role="tab" aria-selected={tab === 'trips'} className={tab === 'trips' ? 'active' : ''} onClick={() => setTab('trips')}><Ticket size={18}/> Geziler <span className="tab-count">{state.trips.length}</span></button><button role="tab" aria-selected={tab === 'members'} className={tab === 'members' ? 'active' : ''} onClick={() => setTab('members')}><Users size={18}/> Üyeler</button></div></div>

        {tab === 'calendar' && <div className="workspace-grid"><div className="calendar-panel"><div className="panel-header"><div><h2>{currentMonth && monthText(currentMonth)}</h2><p className="calendar-window">Takvim: {dateText(state.window.start)} – {dateText(state.window.end)}</p></div><div className="month-nav"><button aria-label="Önceki ay" disabled={monthIndex === 0} onClick={() => setMonthIndex(monthIndex - 1)}><ChevronLeft size={20}/></button><button aria-label="Sonraki ay" disabled={monthIndex >= months.length - 1} onClick={() => setMonthIndex(monthIndex + 1)}><ChevronRight size={20}/></button></div></div><div className="legend"><span><i className="dot green"/> Uygunum</span><span><i className="dot yellow"/> Ayarlayabilirim</span><span><i className="dot red"/> Gelemem</span><span><i className="dot unknown"/> Boş</span></div><div className={`calendar-grid range-${brush} ${painting ? 'painting' : ''}`} onPointerMove={dragDay} onPointerUp={finishDrag} onPointerCancel={() => { drag.current = null; setPainting(false); }}>{weekdays.map(day => <div key={day} className="weekday">{day}</div>)}{currentMonth && calendarDays(currentMonth).map((day, index) => day ? <button key={day} disabled={day < state.window.start || day > state.window.end} data-day={day} className={`day-cell ${ownStatuses.get(day) ?? 'unknown'} ${selectedDay === day ? 'selected' : ''} ${day >= from && day <= (to || from) ? 'in-range' : ''}`} onPointerDown={event => { if (event.pointerType !== 'mouse' || event.button !== 0 || busy) return; drag.current = { start: day, end: day }; setFrom(day); setTo(''); setSelectedDay(day); setPainting(true); event.currentTarget.parentElement?.setPointerCapture(event.pointerId); }} onClick={() => { if (ignoreClick.current) { ignoreClick.current = false; return; } pickDay(day); }} aria-label={`${dateText(day)}, ${ownStatuses.get(day) ? statusLabels[ownStatuses.get(day)!] : 'İşaretlenmedi'}`} aria-pressed={selectedDay === day}><strong>{Number(day.slice(-2))}</strong><span className="day-marker"/></button> : <span key={`blank-${index}`} className="day-empty" />)}</div><p className="calendar-hint"><CircleHelp size={15}/> Bir renk seç; tek güne tıkla veya günlerin üzerinde sürükle. Klavyeyle tarih seçip sağdan kaydedebilirsin.</p></div><div className="side-stack"><div className="side-card"><h2>Tarihleri işaretle</h2><p>Renk seçimi kayıtlı günleri değiştirmez. Takvimde tıkla veya sürükle; tarih alanlarıyla seçtiğin aralığı aşağıdan kaydet.</p><div className="date-pair"><label>Başlangıç<input type="date" lang="tr-TR" min={state.window.start} max={state.window.end} value={from} onChange={event => { setFrom(event.target.value); setTo(''); }} /></label><label>Bitiş<input type="date" lang="tr-TR" min={from || state.window.start} max={state.window.end} value={to} onChange={event => setTo(event.target.value)} /></label></div><div className="status-actions">{(['green', 'yellow', 'red'] as Status[]).map(status => <button key={status} disabled={busy} className={`status-button ${status} ${brush === status ? 'brush-active' : ''}`} aria-pressed={brush === status} onClick={() => setBrush(status)}><i className={`dot ${status}`}/>{statusLabels[status]}</button>)}<button disabled={busy || !from} className="primary-button full" onClick={() => run('setAvailability', { roomId, from, to: to || from, status: brush })}>Seçili tarihleri işaretle <Check size={16}/></button><button disabled={busy || !from} className="status-button clear" onClick={() => run('setAvailability', { roomId, from, to: to || from, status: null })}>İşareti kaldır</button></div></div><div className="side-card day-detail">{selectedDay && <span className="eyebrow">{dateText(selectedDay)}</span>}<h2>O gün kim uygun?</h2>{selectedDay ? <div className="person-list">{selectedPeople.map(person => <div key={person.id}><span className="mini-avatar">{person.name[0].toLocaleUpperCase('tr-TR')}</span><strong>{person.name}</strong><span className={`person-status ${person.status ?? 'unknown'}`}>{person.status ? statusLabels[person.status] : 'Bilinmiyor'}</span></div>)}</div> : <p>Bir gün seçtiğinde herkesin durumunu burada göreceksin.</p>}</div></div></div>}

        {tab === 'trips' && <div className="trips-layout"><div className="trips-main"><div className="list-heading"><div><h2>Gezi fikirleri</h2><p>En çok kişinin katılabildiği gezi üstte.</p></div><button className="primary-button" onClick={() => { setEditingTripId(null); setTripForm(emptyTrip); setShowTripForm(!showTripForm); }}>{showTripForm ? 'Formu kapat' : 'Gezi ekle'} {showTripForm ? <X size={18}/> : <Plus size={18}/>}</button></div>{showTripForm && <form className="trip-form" onSubmit={event => { event.preventDefault(); run(editingTripId ? 'updateTrip' : 'createTrip', { roomId, tripId: editingTripId, title: tripForm.title, description: tripForm.description, startDay: tripForm.startDay, endDay: tripForm.endDay, flightCost: Number(tripForm.flightCost), spendCost: Number(tripForm.spendCost) }, () => { setShowTripForm(false); setEditingTripId(null); setTripForm(emptyTrip); }); }}><h3>{editingTripId ? 'Geziyi düzenle' : 'Yeni bir fikir ekle'}</h3><label>Gezi adı<input value={tripForm.title} onChange={event => setTripForm({ ...tripForm, title: event.target.value })} maxLength={80} required placeholder="Geziye bir ad ver" /></label><label>Kısa açıklama<textarea value={tripForm.description} onChange={event => setTripForm({ ...tripForm, description: event.target.value })} maxLength={500} placeholder="Planın ayrıntıları…" /></label><div className="form-grid"><label>Gidiş tarihi<input type="date" lang="tr-TR" min={state.window.start} max={state.window.end} value={tripForm.startDay} onChange={event => setTripForm({ ...tripForm, startDay: event.target.value })} required /></label><label>Dönüş tarihi<input type="date" lang="tr-TR" min={tripForm.startDay || state.window.start} max={state.window.end} value={tripForm.endDay} onChange={event => setTripForm({ ...tripForm, endDay: event.target.value })} required /></label><label>Gidiş dönüş bileti · TL<input type="number" min="0" max="10000000" step="1" value={tripForm.flightCost} onChange={event => setTripForm({ ...tripForm, flightCost: event.target.value })} required /></label><label>Kişi başı harcama · TL<input type="number" min="0" max="10000000" step="1" value={tripForm.spendCost} onChange={event => setTripForm({ ...tripForm, spendCost: event.target.value })} required /></label></div><button className="primary-button" disabled={busy}>Geziyi kaydet <Check size={18}/></button></form>}{state.trips.length === 0 ? <div className="empty-state"><img className="empty-art" src="/illustrations/friends-trip.webp" width="1000" height="667" alt="" aria-hidden="true" loading="lazy" decoding="async" /><h3>Henüz gezi fikri yok</h3><p>Aklında bir gezi varsa tarihlerini ve tahmini masrafını ekle.</p></div> : <div className="trip-list">{state.trips.map((trip, index) => { const myRating = state.ratings.find(rating => rating.tripId === trip.id && rating.userId === user.id)?.score; return <article className="trip-card" key={trip.id}><div className="trip-card-top"><span className={`rank-badge ${index === 0 ? 'best' : ''}`}>{index + 1}. öneri</span><span className="trip-dates">{dateText(trip.startDay)} – {dateText(trip.endDay)}</span></div><h3>{trip.title}</h3>{trip.description && <p className="trip-description">{trip.description}</p>}<div className="trip-metrics"><div><strong>{trip.eligibleCount}<small>/{state.members.length}</small></strong><span>katılabilir</span></div><div><strong>{trip.greenCount}</strong><span>kesin uygun</span></div><div><strong>{moneyText(trip.flightCost + trip.spendCost)}</strong><span>kişi başı tahmin</span></div></div><div className="cost-breakdown">Bilet {moneyText(trip.flightCost)} · Harcama {moneyText(trip.spendCost)}</div><div className="rating-row"><span>Bu geziye ilgin</span><div className="rating-buttons" aria-label={`${trip.title} ilgi puanı`}>{[0, 1, 2, 3, 4, 5].map(score => <button key={score} aria-label={`${score} puan`} aria-pressed={myRating === score} className={myRating === score ? 'selected' : ''} disabled={busy} onClick={() => run('rateTrip', { roomId, tripId: trip.id, score })}>{score}</button>)}</div><small>{myRating === undefined ? 'Puan yok: nötr (3)' : myRating === 0 ? 'Bu geziye katılmak istemiyorsun' : `${myRating}/5 puan`}</small></div><details className="trip-people"><summary>Kişi bazında sonucu gör <ChevronRight size={16}/></summary><div>{trip.people.map(person => <div key={person.id}><span className="mini-avatar">{person.name[0].toLocaleUpperCase('tr-TR')}</span><strong>{person.name}</strong><span className={`reason ${person.reason}`}>{reasonLabels[person.reason]}</span></div>)}</div></details>{(trip.creatorId === user.id || state.room.ownerId === user.id) && <div className="trip-tools"><button onClick={() => { setEditingTripId(trip.id); setTripForm({ title: trip.title, description: trip.description, startDay: trip.startDay, endDay: trip.endDay, flightCost: String(trip.flightCost), spendCost: String(trip.spendCost) }); setShowTripForm(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Düzenle</button><button onClick={() => { if (confirm('Bu geziyi silmek istiyor musun?')) run('deleteTrip', { roomId, tripId: trip.id }); }}>Sil</button></div>}</article>; })}</div>}</div><aside className="trips-aside"><div className="side-card info-card"><h3>Nasıl sıralanıyor?</h3><p>Önce kaç kişinin katılabildiğine bakıyoruz. Eşitlikte ilgi puanı, kesin uygun kişi sayısı ve daha düşük maliyet sıralamayı belirliyor.</p><p>Sarı işaretli günlerde katılım mümkün sayılır; sonuç koşullu görünür.</p></div></aside></div>}

        {tab === 'members' && <div className="members-layout"><div className="members-main"><div className="list-heading"><div><h2>Üyeler ve bütçeler</h2><p>Odadaki herkes birbirinin bütçesini görebilir.</p></div></div><div className="member-cards">{state.members.map(member => <div className="member-card" key={member.id}><span className="member-avatar">{member.name[0].toLocaleUpperCase('tr-TR')}</span><div><strong>{member.name}{member.id === state.room.ownerId && <small> · Yönetici</small>}</strong><span>{member.budget === null ? 'Bütçe girilmedi' : `Bütçe sınırı ${moneyText(member.budget)}`}</span></div>{member.id === user.id && <span className="you-badge">Sen</span>}{state.room.ownerId === user.id && member.id !== user.id && <button className="remove-button" onClick={() => { if (confirm(`${member.name} adlı üyeyi odadan çıkarmak istiyor musun?`)) run('removeMember', { roomId, userId: member.id }); }}>Çıkar</button>}</div>)}</div>{state.room.ownerId === user.id && state.pending.length > 0 && <div className="pending-card"><h3>Onay bekleyenler</h3>{state.pending.map(person => <div key={person.id}><strong>{person.name}</strong><button className="small-button" onClick={() => run('approveMember', { roomId, userId: person.id })}>Onayla</button><button className="remove-button" onClick={() => run('removeMember', { roomId, userId: person.id })}>Reddet</button></div>)}</div>}</div><aside className="side-stack"><form className="side-card" onSubmit={event => { event.preventDefault(); run('setBudget', { roomId, budget: Number(budget) }); }}><h2>Üst sınırın</h2><p>Bir gezi için kendine ayırabileceğin toplam tutar.</p><label>Türk lirası<input type="number" min="0" max="10000000" step="1" required value={budget} onChange={event => setBudget(event.target.value)} placeholder="Bütçe tutarı" /></label><button className="primary-button full" disabled={busy}>Bütçeyi kaydet <Check size={17}/></button>{ownBudget !== null && <small>Şu anki sınırın: {moneyText(ownBudget ?? 0)}</small>}</form><div className="side-card"><h2>Arkadaşlarını çağır</h2><p>Bağlantıyı açan arkadaşların katılma isteği gönderebilir. Oda yöneticisi isteği onaylar.</p><button className="secondary-button full" onClick={async () => { await navigator.clipboard.writeText(`${location.origin}/?invite=${state.room.inviteToken}`); setMessage('Davet bağlantısı kopyalandı.'); }}>Bağlantıyı kopyala <Copy size={17}/></button></div></aside></div>}
      </section>}
    </main><footer className="site-footer"><span className="footer-brand"><img src="/favicon.svg" width="25" height="25" alt="" /><span>ophedule<span className="brand-dot">.</span></span></span></footer>
  </div>;
}
