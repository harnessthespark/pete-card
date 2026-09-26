import { useEffect, useState } from 'react'
import './App.css'

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

  if (!isPeteView && !unlocked) {
    return (
        <main className="page gate">
          <img className="cover" src="/cover.jpg"
               alt="All-In Revival Rave poster for Pete's 50th, 1st October" />
        <header className="hero">
            <p className="fifty">50</p>
            <h1>Happy 50th, Pete!</h1>
            <p className="sub">Enter the invite code you were sent</p>
          </header>
          <form className="form" onSubmit={handleUnlock}>
            <input placeholder="Invite code" value={code} autoFocus
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
        <img className="cover" src="/cover.jpg"
             alt="All-In Revival Rave poster for Pete's 50th, 1st October" />
        <header className="hero">
          <p className="fifty">50</p>
          <h1>Happy 50th, Pete!</h1>
          <p className="sub">Leave a message, a photo or a video</p>
        </header>

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