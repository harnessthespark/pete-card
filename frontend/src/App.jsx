import { useEffect, useState } from 'react'
import './App.css'

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
          {m.media && (isVideo(m.media)
              ? <video src={`/media/${m.media}`} controls playsInline />
              : <img src={`/media/${m.media}`} alt={`From ${m.name}`} />)}
          <p>{m.text}</p>
          <p className="from">— {m.name}</p>
          <div className="admin-actions">
            {!m.approved && <button disabled={busy} onClick={() => approve(m.id)}>Approve</button>}
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

function PeteIntro({ onDone }) {
  const [stage, setStage] = useState('closed')

  function start() {
    if (stage !== 'closed') return
    setStage('party')
    setTimeout(() => setStage('leaving'), 5500)
    setTimeout(onDone, 6300)
  }

  return (
      <div className={`club club-${stage}`} onClick={start} role="button" tabIndex={0}
           aria-label="Open Pete's birthday card"
           onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') start() }}>
        <div className="haze" aria-hidden="true" />
        <div className="lasers" aria-hidden="true">
          {BEAMS.map((b, i) => (
              <span key={i} className="beam" style={{
                '--c': b.c, '--x': b.x, '--from': b.from, '--to': b.to, '--d': b.d, '--delay': b.delay,
              }} />
          ))}
        </div>
        <div className="strobe" aria-hidden="true" />
        <div className="card-stage">
          <img className="card-front" src="/cover.jpg"
               alt="All-In Revival Rave poster for Pete's 50th, 1st October" />
        </div>
        <p className="tap">Tap to open your card</p>
        <h1 className="club-title">Happy 50th, Pete!</h1>
      </div>
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
        body: JSON.stringify({ code, name, text, media }),
      })
      if (!res.ok) throw new Error((await res.json()).detail)
      setName('')
      setText('')
      setFile(null)
      e.target.reset()
      setStatus('Thanks! Your message will appear once it has been checked.')
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

  const isPeteView = window.location.hash === '#pete'

  if (window.location.hash === '#admin') {
    return <AdminPage />
  }

  if (isPeteView && !introDone) {
    return <PeteIntro onDone={() => setIntroDone(true)} />
  }

  if (!isPeteView && !unlocked) {
    return (
        <main className="page gate">
          <header className="hero">
            <p className="fifty">Pete's 50th Birthday Online-Card</p>
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
      <main className="page">
        <header className="hero">
          <p className="fifty">Pete's 50th Birthday Online-Card</p>
        </header>
        <img className="cover" src={isPeteView ? '/cover.jpg' : '/vip-flyer.png'}
             onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/cover.jpg' }}
             alt="All-In Revival Rave poster for Pete's 50th, 1st October" />
        <p className="sub under-cover">{isPeteView ? 'From all of us. Scroll down for your messages' : 'Leave a message, a photo or a video'}</p>

        {!isPeteView && (
            <div className="compose">
              <form className="form" onSubmit={handleSubmit}>
                <input placeholder="Your name" value={name} maxLength={60}
                       onChange={(e) => setName(e.target.value)} required />
                <textarea placeholder="Your message to Pete" value={text} maxLength={2000}
                          onChange={(e) => setText(e.target.value)} required />
                <input type="file" accept="image/*,video/*"
                       onChange={(e) => setFile(e.target.files[0])} />
                <button disabled={sending}>
                  {sending ? 'Sending…' : 'Add to the card'}
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

        <section className="wall">
          {messages.map((m) => (
              <article className="note" key={m.id}>
                {m.media && (isVideo(m.media)
                    ? <video src={`/media/${m.media}`} controls playsInline />
                    : <img src={`/media/${m.media}`} alt={`From ${m.name}`} />)}
                <p>{m.text}</p>
                <p className="from">— {m.name}</p>
              </article>
          ))}
        </section>
      </main>
  )
}

export default App