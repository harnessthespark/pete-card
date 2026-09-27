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


function daysOpenNow() {
  // Preview any day with #pete-day-12 (for Lisa to test)
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
// Lisa's own photos are advent/1.jpg to advent/FOLDER_PHOTOS.jpg.
// Friends' relics fill the windows after those, in the order they are approved.
const FOLDER_PHOTOS = 17

function photoFor(day, relics) {
  if (day <= FOLDER_PHOTOS) return { src: `/advent/${day}.jpg`, relic: null }
  const relic = relics[day - FOLDER_PHOTOS - 1]
  return relic ? { src: `/media/${relic.media}`, relic } : { src: `/advent/${day}.jpg`, relic: null }
}

function loadScratched() {
  try { return JSON.parse(localStorage.getItem('petermasScratched') || '[]') } catch { return [] }
}

// A gold scratch-card layer over the day's photo. Scratch with a finger or the mouse.
function ScratchReveal({ src, done, onDone }) {
  const canvasRef = useRef(null)
  const [missing, setMissing] = useState(false)
  const [cleared, setCleared] = useState(done)

  function paint(img) {
    const c = canvasRef.current
    if (!c || cleared) return
    const w = img.clientWidth, h = img.clientHeight
    c.width = w; c.height = h
    const ctx = c.getContext('2d')
    const g = ctx.createLinearGradient(0, 0, w, h)
    g.addColorStop(0, '#b8862a'); g.addColorStop(.5, '#ffe28a'); g.addColorStop(1, '#a8741c')
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(80,50,0,.8)'
    ctx.font = '600 20px "Instrument Sans", sans-serif'; ctx.textAlign = 'center'
    ctx.fillText('Scratch the glass ✦', w / 2, h / 2)
  }

  function scratchAt(e) {
    const c = canvasRef.current
    if (!c || cleared) return
    const r = c.getBoundingClientRect()
    const p = e.touches ? e.touches[0] : e
    const ctx = c.getContext('2d')
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath(); ctx.arc(p.clientX - r.left, p.clientY - r.top, 24, 0, Math.PI * 2); ctx.fill()
  }

  function check() {
    const c = canvasRef.current
    if (!c || cleared) return
    const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
    let clear = 0, total = 0
    for (let i = 3; i < data.length; i += 4 * 40) { total++; if (data[i] === 0) clear++ }
    if (clear / total > 0.5) { setCleared(true); onDone() }
  }

  if (missing) return null
  return (
      <div className="scratch">
        <img src={src} alt="A photo for today" onLoad={(e) => paint(e.currentTarget)}
             onError={() => { setMissing(true); onDone() }} />
        {!cleared && (
            <canvas ref={canvasRef} className="scratch-foil"
                    onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); scratchAt(e) }}
                    onPointerMove={(e) => { if (e.buttons || e.pointerType === 'touch') scratchAt(e) }}
                    onPointerUp={check} onPointerLeave={check} />
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
      <section ref={sectionRef} className={`petermas ${canonised ? 'canonised' : ''}`}>
        <h2 className="petermas-title">The Feast of St Petermas</h2>
        <p className="petermas-sub">
          {daysOpen === 0 ? 'The feast begins on Petermas Eve, Wednesday 30th September at 7pm.'
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
                               src={photoFor(showDay, relics).src}
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
