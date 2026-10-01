// The 4am Confessional: a private word for Pete. A shared memory, or one of those
// deep-and-meaningfuls from the chill-out room. Never shown on the card; only Pete's
// secret word (PETE_CODE in Coolify) opens them.
import { useEffect, useState } from 'react'

// Friends' page: leave a confession
export function ConfessionalForm({ code }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [contact, setContact] = useState('')
  const [state, setState] = useState('write')

  async function send(e) {
    e.preventDefault()
    setState('sending')
    const res = await fetch('/confessions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, name: name.trim(), text: text.trim(), contact: contact.trim() || null }),
    })
    setState(res.ok ? 'sent' : 'error')
  }

  if (!open) {
    return (
        <button type="button" className="confess-open" onClick={() => setOpen(true)}>
          <span className="confess-candle" aria-hidden="true">🕯️</span>
          <span><strong>The 4am Confessional</strong><br />
            A private word for Pete's eyes only. A memory, or a deep-and-meaningful from the chill-out room.</span>
        </button>
    )
  }
  if (state === 'sent') {
    return (
        <div className="confess-box">
          <p className="confess-title">🕯️ Your confession is with St Petermas</p>
          <p>Only Pete will read it. Go in peace, and rave on.</p>
        </div>
    )
  }
  return (
      <form className="confess-box" onSubmit={send}>
        <p className="confess-title">🕯️ The 4am Confessional</p>
        <p className="confess-sub">Not shown on the card. Only Pete can open it.</p>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={60} required />
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} maxLength={4000} required
                  placeholder="Forgive me Pete, for I have…" />
        <input value={contact} onChange={(e) => setContact(e.target.value)} maxLength={200}
               placeholder="Your number or email, if you'd like him to get in touch (optional)" />
        <div className="confess-actions">
          <button disabled={state === 'sending'}>Confess to Pete</button>
          <button type="button" className="confess-cancel" onClick={() => setOpen(false)}>Not now</button>
        </div>
        {state === 'error' && <p className="status">Something went wrong. Try again in a moment.</p>}
      </form>
  )
}

// a number or email in the contact box becomes a tap-to-text / tap-to-email link
function ContactLink({ value }) {
  if (!value) return null
  const v = value.trim()
  if (/@/.test(v)) return <a href={`mailto:${v}`}>✉️ {v}</a>
  const digits = v.replace(/[^\d+]/g, '')
  if (digits.length >= 7) return <a href={`sms:${digits}`}>📱 {v}</a>
  return <span>{v}</span>
}

// Pete's chapel: the Confessional door, opened with his secret word
export function ConfessionalDoor() {
  const [count, setCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [word, setWord] = useState(() => { try { return sessionStorage.getItem('peteWord') || '' } catch { return '' } })
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/confessions/count').then((r) => (r.ok ? r.json() : { count: 0 })).then((d) => setCount(d.count || 0)).catch(() => {})
  }, [])

  async function enter(e) {
    if (e) e.preventDefault()
    setError('')
    const res = await fetch('/confessions/open', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pete_code: word }),
    })
    if (!res.ok) { setError("That's not the word. Ask Lisa."); return }
    setItems(await res.json())
    try { sessionStorage.setItem('peteWord', word) } catch { /* ignore */ }
  }

  if (!count) return null
  return (
      <section className="confess-door-wrap">
        <button type="button" className="confess-door" onClick={() => setOpen(true)}>
          🕯️ The 4am Confessional<br />
          <small>{count === 1 ? '1 confession awaits' : `${count} confessions await`}</small>
        </button>
        {open && (
            <div className="pane-modal" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
              <div className="pane-card confess-card" onClick={(e) => e.stopPropagation()}>
                <p className="pane-day">The 4am Confessional</p>
                {!items ? (
                    <form onSubmit={enter} className="confess-word">
                      <p>Speak the word to enter.</p>
                      <input type="password" value={word} onChange={(e) => setWord(e.target.value)} placeholder="Your secret word" autoFocus required />
                      <button className="enter-btn">Enter</button>
                      {error && <p className="status">{error}</p>}
                    </form>
                ) : (
                    <div className="confess-list">
                      {items.map((c) => (
                          <article key={c.id} className="confess-item">
                            <p className="confess-text">{c.text}</p>
                            <p className="from">— {c.name}</p>
                            {c.contact && <p className="confess-contact"><ContactLink value={c.contact} /></p>}
                          </article>
                      ))}
                    </div>
                )}
                <button type="button" className="enter-btn pane-close" onClick={() => setOpen(false)}>Leave the booth</button>
              </div>
            </div>
        )}
      </section>
  )
}
