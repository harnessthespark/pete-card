import { useEffect, useState } from 'react'
import './App.css'
import { bassThud } from './rave.js'
import { startMusic, stopMusic, setMusicVolume, getMusicVolume, nowPlaying, enterChapel } from './music.js'
import PetermasCalendar, { daysOpenNow } from './Calendar.jsx'


// A cheeky photo, covered by a St Petermas sticker. Tap to peek, tap again to cover up.
function StickerPhoto({ src, name }) {
  const [peek, setPeek] = useState(false)
  return (
      <div className={`sticker-photo ${peek ? 'peeking' : ''}`} onClick={() => setPeek(!peek)} role="button" tabIndex={0}
           aria-label={peek ? 'Cover the photo again' : 'Peel the sticker to peek'}
           onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setPeek(!peek) }}>
        <img src={src} alt={`From ${name}`} />
        <div className="sticker" aria-hidden="true">
          <svg viewBox="0 0 100 100" className="smiley">
            <circle cx="50" cy="50" r="47" fill="#ffd400" stroke="#111" strokeWidth="4" />
            <ellipse cx="36" cy="38" rx="5.5" ry="10" fill="#111" />
            <ellipse cx="64" cy="38" rx="5.5" ry="10" fill="#111" />
            <path d="M24 58 Q50 86 76 58" fill="none" stroke="#111" strokeWidth="5" strokeLinecap="round" />
          </svg>
          <span className="sticker-bottom">tap to peek</span>
        </div>
      </div>
  )
}

function AdminPage() {
  const [adminCode, setAdminCode] = useState(() => {
    try { return sessionStorage.getItem('peteAdmin') || '' } catch { return '' }
  })
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const q = (c) => `admin_code=${encodeURIComponent(c)}`

  async function load(codeToUse) {
    setError('')
    const res = await fetch(`/admin/messages?${q(codeToUse)}`)
    if (!res.ok) {
      setItems(null)
      setError("That admin code isn't right.")
      return
    }
    setItems(await res.json())
    try { sessionStorage.setItem('peteAdmin', codeToUse) } catch { /* ignore */ }
  }

  useEffect(() => {
    if (adminCode) load(adminCode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function toggleSticker(id) {
    setBusy(true)
    await fetch(`/admin/sticker/${id}?${q(adminCode)}`, { method: 'POST' })
    await load(adminCode)
    setBusy(false)
  }

  async function approve(id) {
    setBusy(true)
    await fetch(`/admin/approve/${id}?${q(adminCode)}`, { method: 'POST' })
    await load(adminCode)
    setBusy(false)
  }

  async function remove(id) {
    if (!window.confirm('Delete this message (and its photo/video) for good?')) return
    setBusy(true)
    await fetch(`/admin/messages/${id}?${q(adminCode)}`, { method: 'DELETE' })
    await load(adminCode)
    setBusy(false)
  }

  const isVideo = (f) => /\.(mp4|mov)$/i.test(f)

  if (items === null) {
    return (
        <main className="page">
          <header className="hero">
            <p className="fifty">Card admin</p>
          </header>
          <form className="form" onSubmit={(e) => { e.preventDefault(); load(adminCode.trim()) }}>
            <input placeholder="Admin code" value={adminCode} type="password"
                   onChange={(e) => setAdminCode(e.target.value)} required />
            <button>See messages</button>
            {error && <p className="status">{error}</p>}
          </form>
        </main>
    )
  }

  const waiting = items.filter((m) => !m.approved)
  const live = items.filter((m) => m.approved)

  function Row({ m }) {
    return (
        <article className="note admin-note">
          <p className={m.approved ? 'chip chip-live' : 'chip chip-wait'}>
            {m.approved ? 'On the card' : 'Waiting for you'}
          </p>
          {m.kind === 'relic' && <p className="chip chip-relic">📿 Relic for the advent windows</p>}
          {m.media && (isVideo(m.media)
              ? <video src={`/media/${m.media}`} controls playsInline />
              : <img src={`/media/${m.media}`} alt={`From ${m.name}`} />)}
          <p>{m.text}</p>
          <p className="from">— {m.name}</p>
          <div className="admin-actions">
            {!m.approved && <button disabled={busy} onClick={() => approve(m.id)}>Approve</button>}
            {m.media && !isVideo(m.media) && (
                <button disabled={busy} onClick={() => toggleSticker(m.id)}>
                  {m.sticker ? 'Remove sticker' : '✦ Add sticker'}
                </button>
            )}
            <button disabled={busy} className="danger" onClick={() => remove(m.id)}>Delete</button>
          </div>
        </article>
    )
  }

  return (
      <main className="page">
        <header className="hero">
          <p className="fifty">Card admin</p>
          <p className="sub">{waiting.length} waiting · {live.length} on the card</p>
          <button className="refresh" onClick={() => load(adminCode)}>Refresh</button>
        </header>
        <h2 className="admin-h">Waiting for you</h2>
        {waiting.length === 0 && <p className="sub">Nothing waiting. All caught up.</p>}
        <section className="wall">{waiting.map((m) => <Row key={m.id} m={m} />)}</section>
        <h2 className="admin-h">On the card</h2>
        <section className="wall">{live.map((m) => <Row key={m.id} m={m} />)}</section>
      </main>
  )
}

// Pete's opening moment: flyer on the front, tap to open, club lasers
const BEAMS = [
  { c: '#39ff14', x: '8%',  from: '-40deg', to: '25deg', d: '1.6s', delay: '0s' },
  { c: '#ff2bd6', x: '22%', from: '30deg',  to: '-30deg', d: '2.1s', delay: '.2s' },
  { c: '#00e5ff', x: '50%', from: '-25deg', to: '25deg', d: '1.3s', delay: '.1s' },
  { c: '#39ff14', x: '78%', from: '30deg',  to: '-35deg', d: '1.9s', delay: '.3s' },
  { c: '#ff3131', x: '92%', from: '40deg',  to: '-20deg', d: '1.5s', delay: '0s' },
  { c: '#ffd400', x: '35%', from: '-15deg', to: '35deg', d: '2.4s', delay: '.5s' },
  { c: '#00e5ff', x: '65%', from: '20deg',  to: '-40deg', d: '1.7s', delay: '.4s' },
]

// Music control: a DJ-decks icon. Tap it for play/pause, volume and the track credit.
function DecksIcon() {
  return (
      <svg viewBox="0 0 64 40" width="56" height="35" aria-hidden="true">
        <rect x="1" y="4" width="62" height="32" rx="6" fill="#161616" stroke="#ff2bd6" strokeWidth="1.5" />
        {[16, 48].map((cx) => (
            <g key={cx} className="platter">
              <circle cx={cx} cy="20" r="11" fill="#050505" stroke="#444" />
              <circle cx={cx} cy="20" r="7.5" fill="none" stroke="#2a2a2a" />
              <circle cx={cx} cy="20" r="3.2" fill={cx === 16 ? '#00e5ff' : '#39ff14'} />
              <rect x={cx - 0.6} y="9.5" width="1.2" height="4" fill="#fff" />
            </g>
        ))}
        <rect x="28.5" y="9" width="7" height="22" rx="1.5" fill="#2b2b2b" />
        <rect x="29.5" y="13" width="5" height="2" fill="#ff2bd6" />
        <rect x="29.5" y="24" width="5" height="2" fill="#ffd400" />
      </svg>
  )
}

function SoundControls() {
  const [on, setOn] = useState(true)
  const [open, setOpen] = useState(false)
  const [vol, setVol] = useState(getMusicVolume())
  return (
      <div className={`dj ${on ? 'dj-on' : ''}`}>
        {open && (
            <div className="dj-panel">
              <button type="button" className="dj-play"
                      onClick={() => { if (on) { stopMusic() } else { startMusic() } setOn(!on) }}>
                {on ? '❚❚ Pause' : '▶ Play'}
              </button>
              <label className="dj-vol">
                <span>Volume</span>
                <input type="range" min="0" max="1" step="0.05" value={vol}
                       onChange={(e) => { const v = Number(e.target.value); setVol(v); setMusicVolume(v) }} />
              </label>
              <a href={nowPlaying().link} target="_blank" rel="noopener noreferrer">♪ {nowPlaying().title}</a>
            </div>
        )}
        <button type="button" className="dj-btn" aria-expanded={open}
                aria-label="Music controls" onClick={() => setOpen(!open)}>
          <DecksIcon />
        </button>
      </div>
  )
}

// The club entrance behind the ticket: neon wall, velvet rope, and a queue round the block.
// Drawn in code (no stock photo), so there are no image rights to worry about.
function QueueScene() {
  // On a phone held upright, zoom in on the rope and the queue
  const portrait = typeof window !== 'undefined' && window.innerWidth < window.innerHeight
  const people = [
    [980, 1.0], [1030, .95], [1075, 1.05], [1120, .9], [1160, 1.0], [1200, .92],
    [1238, .98], [1272, .88], [1305, .95], [1335, .85], [1362, .9], [1388, .82],
  ]
  const bokeh = [
    [1180, 180, 26, '#ff2bd6'], [1320, 140, 18, '#00e5ff'], [1450, 230, 22, '#ffd400'],
    [1260, 260, 14, '#39ff14'], [1520, 120, 16, '#ff2bd6'], [1100, 110, 12, '#ffffff'],
    [1400, 330, 12, '#ff6ad5'], [1540, 300, 20, '#00e5ff'], [1010, 220, 10, '#ffffff'],
  ]
  return (
      <svg className="queue-scene" viewBox={portrait ? '560 120 860 780' : '0 0 1600 900'} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id="qs-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#12020f" /><stop offset=".6" stopColor="#2a0624" /><stop offset="1" stopColor="#4a0a3c" />
          </linearGradient>
          <linearGradient id="qs-floor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#7a1463" /><stop offset="1" stopColor="#2b0724" />
          </linearGradient>
          <linearGradient id="qs-chrome" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#6d6d78" /><stop offset=".45" stopColor="#f2e9ff" /><stop offset="1" stopColor="#4b4452" />
          </linearGradient>
          <filter id="qs-blur8" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="8" /></filter>
          <filter id="qs-blur3"><feGaussianBlur stdDeviation="3" /></filter>
          <filter id="qs-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14" /></filter>
        </defs>
        <rect width="1600" height="900" fill="url(#qs-sky)" />
        {/* neon wall on the left */}
        <rect x="0" y="0" width="560" height="620" fill="#5c0a4f" />
        {[70, 190, 310, 430].map((x) => (
            <g key={x}>
              <rect x={x} y="40" width="46" height="560" rx="23" fill="#ff2bd6" filter="url(#qs-glow)" opacity=".9" />
              <rect x={x + 12} y="60" width="22" height="520" rx="11" fill="#ffe6fb" />
            </g>
        ))}
        {/* club sign */}
        <rect x="1030" y="330" width="300" height="64" rx="10" fill="#00e5ff" filter="url(#qs-glow)" opacity=".7" />
        <text x="1180" y="376" textAnchor="middle" fontFamily="Impact, 'Arial Black', sans-serif" fontSize="44" fill="#e9ffff">ALL-IN CLUB</text>
        {/* street lights in the distance */}
        {bokeh.map(([x, y, r, c], i) => <circle key={i} cx={x} cy={y} r={r} fill={c} opacity=".75" filter="url(#qs-blur8)" />)}
        {/* the floor */}
        <rect x="0" y="600" width="1600" height="300" fill="url(#qs-floor)" />
        <ellipse cx="300" cy="640" rx="420" ry="60" fill="#ff2bd6" opacity=".25" filter="url(#qs-glow)" />
        {/* the queue, round the block */}
        <g filter="url(#qs-blur3)" opacity=".85">
          {people.map(([x, sc], i) => (
              <g key={i} transform={`translate(${x} ${600 - 150 * sc}) scale(${sc * 0.9})`} fill="#14030f">
                <circle cx="0" cy="18" r="16" />
                <rect x="-20" y="36" width="40" height="120" rx="16" />
              </g>
          ))}
        </g>
        {/* velvet rope and chrome posts */}
        <path d="M 230 690 Q 420 790 610 700 Q 780 770 930 690 Q 1060 740 1170 670"
              fill="none" stroke="#8a0f2e" strokeWidth="18" strokeLinecap="round" />
        <path d="M 230 684 Q 420 784 610 694 Q 780 764 930 684 Q 1060 734 1170 664"
              fill="none" stroke="#e0476b" strokeWidth="4" strokeLinecap="round" opacity=".7" />
        {[[230, 690, 1], [610, 700, .9], [930, 690, .8], [1170, 670, .7]].map(([x, y, sc], i) => (
            <g key={i} transform={`translate(${x} ${y}) scale(${sc})`}>
              <rect x="-11" y="0" width="22" height="200" fill="url(#qs-chrome)" />
              <circle cx="0" cy="-4" r="18" fill="url(#qs-chrome)" />
              <ellipse cx="0" cy="202" rx="48" ry="12" fill="url(#qs-chrome)" />
            </g>
        ))}
      </svg>
  )
}

// Pete's opening, in the style of Lisa's Elisa card:
// a VIP ticket waits, tap it, the flyer card drops in, tap the card and it opens like a book,
// then the lasers and the music kick in.
function PeteIntro({ onOpen, onDone }) {
  // ticket -> arriving -> standing -> displayed -> open -> leaving
  const [stage, setStage] = useState('arrive')

  function tapArrive() {
    if (stage !== 'arrive') return
    bassThud()
    setStage('entering')
    setTimeout(() => setStage('ticket'), 1100)
  }

  function tapTicket() {
    if (stage !== 'ticket') return
    setStage('arriving')
    setTimeout(() => setStage('standing'), 1500)
    setTimeout(() => setStage('displayed'), 2900)
  }

  function tapCard() {
    if (stage !== 'displayed') return
    setStage('open')
    startMusic()
    onOpen()
  }

  function enter(e, where) {
    e.stopPropagation()
    setStage('leaving')
    setTimeout(() => onDone(where), 800)
  }


  const hint = stage === 'ticket' ? 'tap to show your ticket at the door'
      : stage === 'displayed' ? 'Skip the queue, access the club 🔊' : ''

  return (
      <div className={`club club-${stage}`}>
        {(stage === 'arrive' || stage === 'entering') && (
            <div className="arrival" onClick={tapArrive} role="button" tabIndex={0}
                 aria-label="Rave Revival, tonight, 1st October. Tap to arrive"
                 onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') tapArrive() }}>
              <div className="neon-sign">
                <h1 className="neon neon-title">Rave Revival</h1>
                <p className="neon neon-date">Tonight · 1st October<br />50 years in the making</p>
              </div>
              <p className="arrival-tap">Tap to arrive</p>
            </div>
        )}
        <div className="club-bg" aria-hidden="true" />
        <div className="queue-msg" aria-hidden={stage === 'open' || stage === 'leaving'}>
          <p className="queue-line1">The queue’s round the block…</p>
          <p className="queue-line2">…but the DJs don’t queue.</p>
        </div>
        <div className="haze" aria-hidden="true" />
        <div className="lasers" aria-hidden="true">
          {BEAMS.map((b, i) => (
              <span key={i} className="beam" style={{
                '--c': b.c, '--x': b.x, '--from': b.from, '--to': b.to, '--d': b.d, '--delay': b.delay,
              }} />
          ))}
        </div>
        <div className="strobe" aria-hidden="true" />

        <button type="button" className="ticket" onClick={tapTicket} aria-label="Open your VIP ticket">
          <span className="ticket-top">ADMIT ONE · VIP</span>
          <span className="ticket-name">Pete</span>
          <span className="ticket-date">All-In Revival Rave · 01.10</span>
        </button>

        <div className="book-area">
          <div className="book" onClick={tapCard} role="button" tabIndex={0}
               aria-label="Skip the queue, access the club"
               onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') tapCard() }}>
            <div className="book-inside">
              <h1>Happy 50th, Pete!</h1>
              <p>Love from everyone on the dance floor</p>
              <button type="button" className="enter-btn" onClick={(e) => enter(e, 'messages')}>Read your messages →</button>
              <button type="button" className="enter-btn chapel-btn" onClick={(e) => enter(e, 'chapel')}>✦ Visit St Petermas</button>
            </div>
            <div className="book-cover">
              <div className="cover-face cover-front">
                <img src="/cover.jpg" alt="Rave Revival flyer for Pete's 50th, 1st October" />
              </div>
              <div className="cover-face cover-back">
                <img src="/vip-flyer.png" alt="The same flyer, stamped VIP"
                     onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/cover.jpg' }} />
              </div>
            </div>
          </div>
        </div>

        {hint && <p className="hint" aria-live="polite">{hint}</p>}
      </div>
  )
}



// Take Pete straight to the St Petermas window
function goToChapel() {
  const el = document.getElementById('st-petermas')
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// Small glowing stained-glass badge: "Day 3 · a new window is ready"
function ChapelBadge() {
  const day = daysOpenNow()
  const [opened, setOpened] = useState(false)
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    const check = () => {
      let list = []
      try { list = JSON.parse(localStorage.getItem('petermasOpened') || '[]') } catch { list = [] }
      setOpened(list.includes(day))
      const el = document.getElementById('st-petermas')
      if (el) { const r = el.getBoundingClientRect(); setHidden(r.top < window.innerHeight * 0.6 && r.bottom > 0) }
    }
    check()
    const t = setInterval(check, 1000)
    window.addEventListener('scroll', check, { passive: true })
    return () => { clearInterval(t); window.removeEventListener('scroll', check) }
  }, [day])
  if (day < 1 || hidden) return null
  return (
      <button type="button" className={`chapel-badge ${opened ? '' : 'chapel-badge-new'}`} onClick={goToChapel}>
        ✦ Day {day} · {opened ? 'visit St Petermas' : 'a new window is ready'}
      </button>
  )
}

// ---- Timing: what Pete can see, and when (UK time) ----
// Before Wednesday 7pm: doors closed.
// Wednesday 7pm to midnight: Petermas Eve, the St Petermas window only (pane 1).
// From Thursday 1 October: the full card.
// Previews for Lisa: #pete-closed, #pete-eve, #pete-day-N (full card on day N).
const EVE_AT = new Date('2026-09-30T19:00:00+01:00').getTime()
const CARD_AT = new Date('2026-10-01T00:00:00+01:00').getTime()

function peteMode() {
  const h = window.location.hash
  if (h.startsWith('#pete-closed')) return 'closed'
  if (h.startsWith('#pete-eve')) return 'eve'
  if (h.startsWith('#pete-day-')) return 'open'
  const now = Date.now()
  if (now < EVE_AT) return 'closed'
  if (now < CARD_AT) return 'eve'
  return 'open'
}

function DoorsClosed() {
  return (
      <div className="club club-arrive">
        <div className="arrival" style={{ cursor: 'default' }}>
          <div className="neon-sign">
            <h1 className="neon neon-title">Doors Closed</h1>
            <p className="neon neon-date">St Petermas awaits<br />Wednesday · 7pm</p>
          </div>
        </div>
      </div>
  )
}

function PetermasEve() {
  const [inside, setInside] = useState(false)
  if (!inside) {
    return (
        <div className="club club-arrive">
          <div className="arrival" role="button" tabIndex={0} aria-label="St Petermas Eve. Tap to enter the chapel"
               onClick={() => { startMusic(); enterChapel(); setInside(true) }}
               onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { startMusic(); enterChapel(); setInside(true) } }}>
            <div className="neon-sign">
              <h1 className="neon neon-title">Tonight, Pete is the DJ</h1>
              <p className="neon neon-date">The first window is open<br />The congregation gathers at midnight</p>
            </div>
            <p className="arrival-tap">Tap to enter the chapel</p>
          </div>
        </div>
    )
  }
  return (
      <main className="page pete-page eve-page">
        <PetermasCalendar />
        <p className="eve-note">The club doors open at midnight. Come back tomorrow for your card ✦</p>
        <SoundControls />
      </main>
  )
}

function App() {
  const [messages, setMessages] = useState([])
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState('')
  const [sending, setSending] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [codeError, setCodeError] = useState('')
  const [introDone, setIntroDone] = useState(false)
  const [musicStarted, setMusicStarted] = useState(false)
  const [mode, setMode] = useState('message') // 'message' or 'relic'

  async function loadMessages() {
    const res = await fetch('/messages')
    setMessages(await res.json())
  }

  async function checkCode(tryCode) {
    const res = await fetch('/check-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: tryCode }),
    })
    return res.ok
  }

  useEffect(() => {
    loadMessages()
    let saved = ''
    try { saved = localStorage.getItem('peteCode') || '' } catch { saved = '' }
    if (saved) {
      checkCode(saved).then((ok) => {
        if (ok) { setCode(saved); setUnlocked(true) }
      })
    }
  }, [])

  async function handleUnlock(e) {
    e.preventDefault()
    setCodeError('')
    const tryCode = code.trim()
    if (await checkCode(tryCode)) {
      setCode(tryCode)
      setUnlocked(true)
      try { localStorage.setItem('peteCode', tryCode) } catch { /* ignore */ }
    } else {
      setCodeError("That code isn't right. Check the message you were sent.")
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSending(true)
    setStatus('Sending…')
    try {
      let media = null
      if (file) {
        const form = new FormData()
        form.append('code', code)
        form.append('file', file)
        const up = await fetch('/upload', { method: 'POST', body: form })
        if (!up.ok) throw new Error((await up.json()).detail)
        media = (await up.json()).file
      }
      const res = await fetch('/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name, text, media, kind: mode }),
      })
      if (!res.ok) throw new Error((await res.json()).detail)
      setName('')
      setText('')
      setFile(null)
      e.target.reset()
      setStatus(mode === 'relic'
          ? 'Relic received! Once it’s blessed (checked), it will be hidden in one of St Petermas’s windows for Pete to scratch open.'
          : 'Thanks! Your message will appear once it has been checked.')
      loadMessages()
    } catch (err) {
      setStatus(err.message || 'Something went wrong')
    } finally {
      setSending(false)
    }
  }

  function isVideo(fileName) {
    return /\.(mp4|mov)$/i.test(fileName)
  }

  const isPeteView = window.location.hash.startsWith('#pete')

  if (window.location.hash === '#admin') {
    return <AdminPage />
  }

  if (isPeteView && peteMode() === 'closed') return <DoorsClosed />
  if (isPeteView && peteMode() === 'eve') return <PetermasEve />

  if (isPeteView && !introDone) {
    return (
        <>
          <PeteIntro onOpen={() => setMusicStarted(true)} onDone={(where) => { setIntroDone(true); if (where === 'chapel') setTimeout(goToChapel, 150) }} />
          {musicStarted && <SoundControls />}
        </>
    )
  }

  if (!isPeteView && !unlocked) {
    return (
        <main className="page gate">
          <header className="hero">
            <p className="fifty">Pete's 50th · VIP Guest List</p>
          </header>
          <img className="cover" src="/cover.jpg"
               alt="All-In Revival Rave poster for Pete's 50th, 1st October" />
          <form className="form" onSubmit={handleUnlock}>
            <p className="stub-note">Enter the invite code you were sent</p>
            <input placeholder="Door code" value={code} autoFocus
                   autoCapitalize="none" autoCorrect="off"
                   onChange={(e) => setCode(e.target.value)} required />
            <button>Open the card</button>
            {codeError && <p className="status">{codeError}</p>}
          </form>
        </main>
    )
  }

  return (
      <main className={isPeteView ? 'page pete-page' : 'page'}>
        <header className="hero">
          <p className="fifty">Pete's 50th · VIP Guest List</p>
        </header>
        <img className="cover" src={isPeteView ? '/cover.jpg' : '/vip-flyer.png'}
             onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/cover.jpg' }}
             alt="All-In Revival Rave poster for Pete's 50th, 1st October" />
        <p className="sub under-cover">{isPeteView ? 'From all of us. Scroll down to the window' : 'Leave a message, a photo or a video'}</p>

        {!isPeteView && (
            <div className="compose">
              <form className="form" onSubmit={handleSubmit}>
                <div className="mode-tabs" role="tablist">
                  <button type="button" role="tab" aria-selected={mode === 'message'}
                          className={mode === 'message' ? 'on' : ''}
                          onClick={() => { setMode('message'); setStatus('') }}>Leave a message</button>
                  <button type="button" role="tab" aria-selected={mode === 'relic'}
                          className={mode === 'relic' ? 'on' : ''}
                          onClick={() => { setMode('relic'); setStatus('') }}>Donate a relic 📿</button>
                </div>
                {mode === 'relic' && (
                    <p className="relic-intro">
                      <strong>Relics for the Chapel of St Petermas.</strong> Send an old photo of Pete, the more
                      90s the better. It will be hidden behind one of the 31 stained-glass windows for him to
                      scratch open during October. It won’t appear on the card before then.
                    </p>
                )}
                <input placeholder="Your name" value={name} maxLength={60}
                       onChange={(e) => setName(e.target.value)} required />
                {mode === 'message'
                    ? <textarea placeholder="Your message to Pete" value={text} maxLength={2000}
                                onChange={(e) => setText(e.target.value)} required />
                    : <input placeholder="Where and when? e.g. Ibiza, 1998 (optional)" value={text} maxLength={120}
                             onChange={(e) => setText(e.target.value)} />}
                <input type="file" accept={mode === 'relic' ? 'image/*' : 'image/*,video/*'}
                       required={mode === 'relic'}
                       onChange={(e) => setFile(e.target.files[0])} />
                <button disabled={sending}>
                  {sending ? 'Sending…' : mode === 'relic' ? 'Donate this relic' : 'Add to the card'}
                </button>
                {status && <p className="status">{status}</p>}
              </form>

              <aside className="spec">
                <h2>What you can add</h2>
                <dl>
                  <dt>Name</dt><dd>up to 60 characters</dd>
                  <dt>Message</dt><dd>up to 2,000 characters</dd>
                  <dt>Photo</dt><dd>JPG, PNG or HEIC, up to 15 MB</dd>
                  <dt>Video</dt><dd>MP4 or MOV, up to 200 MB (about 2–3 min)</dd>
                </dl>
                <p>Longer video? Upload it to YouTube or Google Drive and paste the link in your message.</p>
              </aside>
            </div>
        )}

        {isPeteView && musicStarted && <SoundControls />}
        {isPeteView && <ChapelBadge />}

        {isPeteView && <PetermasCalendar />}
        {isPeteView && <h2 className="petermas-title offerings-h">Offerings from the congregation</h2>}
        <section className="wall">
      {messages.map((m) => (
          <article className="note" key={m.id}>
            {m.media && (isVideo(m.media)
                ? <video src={`/media/${m.media}`} controls playsInline />
                : (m.sticker ? <StickerPhoto src={`/media/${m.media}`} name={m.name} /> : <img src={`/media/${m.media}`} alt={`From ${m.name}`} />))}
            <p>{m.text}</p>
            <p className="from">— {m.name}</p>
          </article>
      ))}
    </section>
      </main>
  )
}

export default App