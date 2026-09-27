import { useState } from 'react'

// The Feast of St Petermas: a stained-glass advent calendar for October.
// One pane opens each day (UK time). Pane N shows the Nth message on the card
// (oldest first), so new messages naturally fill the later days.

const START = new Date('2026-10-01T00:00:00+01:00') // 1 October, UK time
const DAY_MS = 24 * 60 * 60 * 1000
const LEAD_BLANKS = 3 // October 2026 starts on a Thursday (Mon-first week)

const BLESSINGS = [
  'Blessed are the ravers, for they shall inherit the dance floor.',
  'And on the seventh day, he did not rest. He went to an all-nighter.',
  'Thou shalt not leave before the last record.',
  'Hands in the air, like it’s 1990.',
  'Go forth and dance. The lasers are with you.',
  'Let there be bass.',
  'Whistles, glowsticks and a month of cake. Amen.',
  'The feast continues. Keep the faith, keep the beat.',
]

function isVideo(fileName) {
  return /\.(mp4|mov)$/i.test(fileName)
}

function daysOpenNow() {
  // Preview any day with #pete-day-12 (for Lisa to test)
  const m = window.location.hash.match(/^#pete-day-(\d+)/)
  if (m) return Math.min(31, Math.max(0, Number(m[1])))
  const n = Math.floor((Date.now() - START.getTime()) / DAY_MS) + 1
  return Math.min(31, Math.max(0, n))
}

function loadOpened() {
  try { return JSON.parse(localStorage.getItem('petermasOpened') || '[]') } catch { return [] }
}

export default function PetermasCalendar({ messages }) {
  const daysOpen = daysOpenNow()
  const [opened, setOpened] = useState(loadOpened)
  const [showDay, setShowDay] = useState(null)
  const canonised = daysOpen >= 31

  function messagesFor(day) {
    return messages.filter((_, i) => (i % 31) + 1 === day)
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

  const dayMsgs = showDay ? messagesFor(showDay) : []

  return (
      <section className={`petermas ${canonised ? 'canonised' : ''}`}>
        <h2 className="petermas-title">The Feast of St Petermas</h2>
        <p className="petermas-sub">
          {daysOpen === 0 ? 'The feast begins on 1st October.'
              : canonised ? 'St Petermas, canonised 1 November 2026 · patron saint of the all-nighter'
                  : `Day ${daysOpen} of 31 · open a window each day`}
        </p>

        <div className="stained">
          <div className="halo" aria-hidden="true" />
          <div className="panes">{cells}</div>
        </div>

        {showDay && (
            <div className="pane-modal" role="dialog" aria-modal="true" onClick={() => setShowDay(null)}>
              <div className="pane-card" onClick={(e) => e.stopPropagation()}>
                <p className="pane-day">Day {showDay} of 31</p>
                {dayMsgs.length === 0
                    ? <p className="blessing">{BLESSINGS[(showDay - 1) % BLESSINGS.length]}</p>
                    : dayMsgs.map((m) => (
                        <article className="note" key={m.id}>
                          {m.media && (isVideo(m.media)
                              ? <video src={`/media/${m.media}`} controls playsInline />
                              : <img src={`/media/${m.media}`} alt={`From ${m.name}`} />)}
                          <p>{m.text}</p>
                          <p className="from">— {m.name}</p>
                        </article>
                    ))}
                <button type="button" className="enter-btn pane-close" onClick={() => setShowDay(null)}>Close the window</button>
              </div>
            </div>
        )}

        {canonised && (
            <>
              <h2 className="petermas-title">Every offering</h2>
              <div className="wall">
                {messages.map((m) => (
                    <article className="note" key={m.id}>
                      {m.media && (isVideo(m.media)
                          ? <video src={`/media/${m.media}`} controls playsInline />
                          : <img src={`/media/${m.media}`} alt={`From ${m.name}`} />)}
                      <p>{m.text}</p>
                      <p className="from">— {m.name}</p>
                    </article>
                ))}
              </div>
            </>
        )}
      </section>
  )
}
