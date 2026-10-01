import { useEffect, useRef, useState } from 'react'
import { enterChapel, enterClub } from './music.js'

// The Feast of St Petermas: a stained-glass advent calendar for October.
// One pane opens each day (UK time) with a blessing, and the window slowly lights up.
// Friends' messages are all shown in full underneath (see App.jsx).

const START = new Date('2026-10-01T00:00:00+01:00') // 1 October, UK time
const EVE = new Date('2026-09-30T19:00:00+01:00') // Petermas Eve: window 1 opens early, Wednesday 7pm UK
const DAY_MS = 24 * 60 * 60 * 1000
const LEAD_BLANKS = 3 // October 2026 starts on a Thursday (Mon-first week)

// One blessing per day of the feast
const BLESSINGS = [
  'Day one of the feast. Fifty years young, and the night has only just started.',
  'Blessed are the ravers, for they shall inherit the dance floor.',
  'And on the seventh day he did not rest. He found an after-party.',
  'Thou shalt not leave before the last record.',
  'Hands in the air, like it’s 1990.',
  'Let there be bass. And there was bass. And it was good.',
  'Go forth and dance. The lasers are with you.',
  'Whistles, glowsticks and a month of cake. Amen.',
  'Patron saint of the all-nighter, and the 6am bacon sandwich.',
  'Keep the faith. Keep the beat. Keep the receipts for the birthday drinks.',
  'Ten days in and still celebrating. Truly a miracle.',
  'Blessed be the DJ who plays one more tune.',
  'Thirteen: lucky for some, compulsory for St Pete.',
  'Two weeks of Petermas. Most people manage one day.',
  'The congregation is reminded that the bar is still open.',
  'Halfway through the feast. Hydrate, then dance.',
  'He who dances all month shall be forgiven all month.',
  'A strobe is just a halo that can’t sit still.',
  'Nineteen days in. The saint remains undefeated.',
  'Twenty down. Sacred rule: the birthday isn’t over till he says so.',
  'Behold, a man who treats a birthday like a festival season.',
  'Peace, love, unity, respect, and cake.',
  'Every day a feast day. It’s in the scriptures, look it up.',
  'The saint is spotted by the speakers again. Pilgrims, gather.',
  'Blessed are the ones who knew the words to every hardcore anthem.',
  'Five days left. The halo is getting brighter.',
  'Glory be to the 12-inch remix.',
  'Three days to canonisation. Practise the saintly wave.',
  'Almost there. The glass is nearly all lit.',
  'Tomorrow the window blazes. Tonight, one more dance.',
  'The feast is complete. St Petermas, patron saint of the all-nighter. Amen, and rave on.',
]


export function daysOpenNow() {
  // Preview any day with #pete-day-12 (for Lisa to test)
  if (window.location.hash.startsWith('#pete-eve')) return 1
  const m = window.location.hash.match(/^#pete-day-(\d+)/)
  if (m) return Math.min(31, Math.max(0, Number(m[1])))
  if (Date.now() >= EVE.getTime() && Date.now() < START.getTime()) return 1
  const n = Math.floor((Date.now() - START.getTime()) / DAY_MS) + 1
  return Math.min(31, Math.max(0, n))
}

function loadOpened() {
  try { return JSON.parse(localStorage.getItem('petermasOpened') || '[]') } catch { return [] }
}


// Day photos live in frontend/public/advent/1.jpg ... 31.jpg (any missing day just shows the blessing)
// Lisa's photos: advent/2.jpg ... advent/16.jpg are windows 1-15, and advent/1.jpg is saved for the last window (31).
// Friends' relics fill windows 16-30, in the order they are approved.
const FOLDER_PHOTOS = 16
const LAST_DAY = 31

// Relics beyond the 15 relic windows: the first spare takes window 13 (it had a duplicate photo),
// any others join the 'Unveiled' gallery as bonus relics.
const SPARE_WINDOW = 13

// Special windows: Lisa and Pete, young, open the month on window 1
const SPECIAL = { 1: '/advent/young.jpg' }
// Folder photos bumped by the special ones: they still show in the 'Unveiled' gallery
const BONUS_PHOTOS = ['/advent/2.jpg']

// Who goes behind which window.
// Relics Lisa has pinned to a window (from #admin) take that window.
// Other relics fill windows 16-30 in the order approved, then the spare window 13; any left over are bonus relics.
function allocate(relics) {
  const pinned = {}
  relics.forEach((r) => { if (r.window) pinned[r.window] = r })
  const slots = []
  for (let w = FOLDER_PHOTOS; w < LAST_DAY; w++) if (!pinned[w]) slots.push(w)
  if (!pinned[SPARE_WINDOW]) slots.push(SPARE_WINDOW)
  const assigned = {}
  const overflow = []
  relics.filter((r) => !r.window).forEach((r) => {
    const w = slots.shift()
    if (w) assigned[w] = r; else overflow.push(r)
  })
  return { pinned, assigned, overflow }
}

function basePhoto(day) {
  if (SPECIAL[day]) return SPECIAL[day]
  if (day === LAST_DAY) return '/advent/1.jpg'
  if (day < FOLDER_PHOTOS) return `/advent/${day + 1}.jpg`
  return null
}

function photoFor(day, relics) {
  const { pinned, assigned } = allocate(relics)
  const relic = pinned[day] || (!SPECIAL[day] && day !== LAST_DAY && assigned[day])
  if (relic) return { src: `/media/${relic.media}`, relic }
  // no photo for this window: it shows just the blessing
  return { src: basePhoto(day) || `/advent/extra-${day}.jpg`, relic: null }
}

// Everything that lost its window: spare relics, plus folder photos bumped by special or pinned windows
function bonusItems(relics) {
  const { pinned, assigned, overflow } = allocate(relics)
  const photos = [...BONUS_PHOTOS]
  Object.keys(pinned).map(Number).forEach((w) => {
    const bumped = w === SPARE_WINDOW ? null : basePhoto(w)
    if (bumped && !photos.includes(bumped)) photos.push(bumped)
  })
  // the spare window's own folder photo is already covered by a relic when one is assigned there
  return { photos, relics: overflow, assigned }
}

// The St Petermas smiley over a cheeky photo: tap to peek
function Sticker({ relic, children }) {
  const [peek, setPeek] = useState(false)
  if (!relic || !relic.sticker) return children
  return (
      <div className={`sticker-photo ${peek ? 'peeking' : ''}`} onClick={() => setPeek(!peek)} role="button" tabIndex={0}>
        {children}
        <div className="sticker" aria-hidden="true" style={{ left: `${relic.sticker_x}%`, top: `${relic.sticker_y}%` }}>
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

function isPreview() {
  return /^#pete-(eve|day-|closed)/.test(window.location.hash)
}

function loadScratched() {
  try { return JSON.parse(localStorage.getItem('petermasScratched') || '[]') } catch { return [] }
}

// A gold scratch-card layer over the day's photo. Scratch with a finger or the mouse.
function ScratchReveal({ src, done, onDone, relic }) {
  const canvasRef = useRef(null)
  const [missing, setMissing] = useState(false)
  const [cleared, setCleared] = useState(done)

  function paint(img) {
    const c = canvasRef.current
    if (!c || cleared) return
    const w = c.offsetWidth || img.clientWidth || img.naturalWidth, h = c.offsetHeight || img.clientHeight || img.naturalHeight
    if (!w || !h) { requestAnimationFrame(() => paint(img)); return } // modal still opening: try again next frame
    c.width = w; c.height = h
    const ctx = c.getContext('2d', { willReadFrequently: true })
    const g = ctx.createLinearGradient(0, 0, w, h)
    g.addColorStop(0, '#b8862a'); g.addColorStop(.5, '#ffe28a'); g.addColorStop(1, '#a8741c')
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(80,50,0,.8)'
    ctx.font = '600 20px "Instrument Sans", sans-serif'; ctx.textAlign = 'center'
    ctx.fillText('Scratch the glass ✦', w / 2, h / 2)
  }

  const last = useRef(null)
  const moves = useRef(0)

  // Scratch with a finger or the mouse: draw a thick line from the last point so fast swipes leave no gaps
  function scratchAt(e) {
    const c = canvasRef.current
    if (!c || cleared) return
    const r = c.getBoundingClientRect()
    const x = (e.clientX - r.left) * (c.width / r.width), y = (e.clientY - r.top) * (c.height / r.height)
    const ctx = c.getContext('2d', { willReadFrequently: true })
    ctx.globalCompositeOperation = 'destination-out'
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.lineWidth = e.pointerType === 'touch' ? 64 : 48
    ctx.beginPath()
    const from = last.current || { x, y }
    ctx.moveTo(from.x, from.y); ctx.lineTo(x + 0.1, y + 0.1); ctx.stroke()
    last.current = { x, y }
    if (++moves.current % 8 === 0) check() // reveal as soon as enough is scratched, no need to lift the finger
  }

  function end() { last.current = null; check() }

  function check() {
    const c = canvasRef.current
    if (!c || cleared || !c.width) return
    const data = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data
    let clear = 0, total = 0
    for (let i = 3; i < data.length; i += 4 * 40) { total++; if (data[i] === 0) clear++ }
    if (clear / total > 0.45) { setCleared(true); onDone() }
  }

  if (missing) return null
  return (
      <div className="scratch">
        {cleared
            ? <Sticker relic={relic}><img src={src} alt="A photo for today" onError={() => { setMissing(true); onDone() }} /></Sticker>
            : <img src={src} alt="A photo for today" onLoad={(e) => paint(e.currentTarget)}
                   onError={() => { setMissing(true); onDone() }} />}
        {!cleared && (
            <canvas ref={canvasRef} className="scratch-foil"
                    onPointerDown={(e) => { e.preventDefault(); try { e.currentTarget.setPointerCapture(e.pointerId) } catch {} last.current = null; scratchAt(e) }}
                    onPointerMove={(e) => { if (e.buttons || e.pointerType === 'touch') scratchAt(e) }}
                    onPointerUp={end} onPointerCancel={end} onPointerLeave={end}
                    onTouchMove={(e) => e.preventDefault()} />
        )}
        {!cleared && <button type="button" className="scratch-skip" onClick={() => { setCleared(true); onDone() }}>just open it</button>}
      </div>
  )
}

export default function PetermasCalendar() {
  const daysOpen = daysOpenNow()
  const [opened, setOpened] = useState(loadOpened)
  const [showDay, setShowDay] = useState(null)
  const [scratched, setScratched] = useState(loadScratched)
  const [relics, setRelics] = useState([])

  // Friends' donated old photos: relic 1 fills window 1, relic 2 window 2, and so on
  useEffect(() => {
    fetch('/relics').then((r) => (r.ok ? r.json() : [])).then(setRelics).catch(() => {})
  }, [])
  const canonised = daysOpen >= 31
  const sectionRef = useRef(null)

  // Two rooms: when the window is on screen, the music moves to the chapel track
  useEffect(() => {
    const el = sectionRef.current
    if (!el || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(([entry]) => {
      // In view, or scrolled past it down to the messages: chapel. Scrolled back up above it: club.
      if (entry.isIntersecting || entry.boundingClientRect.top < 0) enterChapel(); else enterClub()
    }, { threshold: 0.35 })
    io.observe(el)
    return () => io.disconnect()
  }, [])


  function markScratched(day) {
    setScratched((prev) => {
      const next = prev.includes(day) ? prev : [...prev, day]
      try { localStorage.setItem('petermasScratched', JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
    // Pete's real link (not Lisa's #pete-eve / #pete-day-N previews): the photo joins his card for everyone
    if (!isPreview()) fetch(`/revealed/${day}`, { method: 'POST' }).catch(() => {})
  }

  function openPane(day) {
    if (day > daysOpen) return
    const next = opened.includes(day) ? opened : [...opened, day]
    setOpened(next)
    try { localStorage.setItem('petermasOpened', JSON.stringify(next)) } catch { /* ignore */ }
    setShowDay(day)
  }

  const cells = []
  for (let i = 0; i < LEAD_BLANKS; i++) cells.push(<span key={`b${i}`} className="pane pane-blank" aria-hidden="true" />)
  for (let d = 1; d <= 31; d++) {
    const lit = opened.includes(d) || canonised
    const state = d > daysOpen ? 'locked' : lit ? 'lit' : d === daysOpen ? 'today' : 'ready'
    cells.push(
        <button key={d} type="button" className={`pane pane-${state}`} onClick={() => openPane(d)}
                disabled={state === 'locked'}
                aria-label={state === 'locked' ? `Day ${d}, not yet` : `Open day ${d}`}>
          <span>{d}</span>
        </button>,
    )
  }
  while (cells.length % 7 !== 0) cells.push(<span key={`e${cells.length}`} className="pane pane-blank" aria-hidden="true" />)


  return (
      <section id="st-petermas" ref={sectionRef} className={`petermas ${canonised ? 'canonised' : ''}`}>
        <h2 className="petermas-title">The Feast of St Petermas</h2>
        <p className="petermas-sub">
          {daysOpen === 0 ? 'The feast begins on St Petermas Eve, Wednesday 30th September at 7pm.'
              : daysOpen === 1 && Date.now() < new Date('2026-10-01T00:00:00+01:00').getTime() ? 'St Petermas Eve · open the first window'
              : canonised ? 'St Petermas, canonised 1 November 2026'
                  : `Day ${daysOpen} of 31 · open a window each day`}
        </p>

        <div className="stained">
          <div className="halo" aria-hidden="true" />
          <div className="panes">{cells}</div>
        </div>
        <p className="petermas-caption">Patron saint of the all-nighter,<br />50 years devout</p>

        {showDay && (
            <div className="pane-modal" role="dialog" aria-modal="true" onClick={() => setShowDay(null)}>
              <div className="pane-card" onClick={(e) => e.stopPropagation()}>
                <p className="pane-day">Day {showDay} of 31</p>
                <ScratchReveal key={showDay}
                               src={photoFor(showDay, relics).src} relic={photoFor(showDay, relics).relic}
                               done={scratched.includes(showDay)} onDone={() => markScratched(showDay)} />
                {photoFor(showDay, relics).relic && (
                    <p className="relic-credit">
                      A relic from {photoFor(showDay, relics).relic.name}
                      {photoFor(showDay, relics).relic.text ? ` · ${photoFor(showDay, relics).relic.text}` : ''}
                    </p>
                )}
                <p className="blessing">{BLESSINGS[showDay - 1]}</p>
                <button type="button" className="enter-btn pane-close" onClick={() => setShowDay(null)}>Close the window</button>
              </div>
            </div>
        )}

      </section>
  )
}


// The photos Pete has scratched so far, shown in his card (and to friends)
export function RevealedGallery({ title = 'Unveiled in St Petermas' }) {
  const [days, setDays] = useState([])
  const [relics, setRelics] = useState([])
  const [missing, setMissing] = useState([])
  useEffect(() => {
    fetch('/revealed').then((r) => (r.ok ? r.json() : [])).then(setDays).catch(() => {})
    fetch('/relics').then((r) => (r.ok ? r.json() : [])).then(setRelics).catch(() => {})
  }, [])
  const shown = days.filter((d) => !missing.includes(d))
  const extras = bonusItems(relics)
  const bonus = extras.relics // relics with no window left
  if (!shown.length) return null
  return (
      <section className="revealed">
        <h2 className="petermas-title offerings-h">{title}</h2>
        <div className="revealed-grid">
          {shown.map((d) => {
            const p = photoFor(d, relics)
            return (
                <figure className="revealed-tile" key={d}>
                  <Sticker relic={p.relic}>
                    <img src={p.src} alt={`St Petermas window ${d}`} loading="lazy"
                         onError={() => setMissing((m) => [...m, d])} />
                  </Sticker>
                  <figcaption>
                    <span className="revealed-day">Day {d}</span>
                    {p.relic && <span className="revealed-from"> · a relic from {p.relic.name}</span>}
                  </figcaption>
                </figure>
            )
          })}
          {extras.photos.map((src) => (
              <figure className="revealed-tile" key={src}>
                <img src={src} alt="A bonus St Petermas photo" loading="lazy" />
                <figcaption><span className="revealed-day">Bonus</span></figcaption>
              </figure>
          ))}
          {bonus.map((r) => (
              <figure className="revealed-tile" key={`bonus-${r.id}`}>
                <Sticker relic={r}><img src={`/media/${r.media}`} alt={`A relic from ${r.name}`} loading="lazy" /></Sticker>
                <figcaption>
                  <span className="revealed-day">Bonus relic</span>
                  <span className="revealed-from"> · from {r.name}</span>
                </figcaption>
              </figure>
          ))}
        </div>
      </section>
  )
}
