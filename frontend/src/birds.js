// Dawn chorus, synthesised so there is no audio file to host: short rising/falling chirps in random bursts.
// Browsers only allow sound after a tap, so start it from a gesture. Returns stop() which fades out.
export function startBirds({ volume = 0.05 } = {}) {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return () => {}
  const ctx = new Ctx()
  const master = ctx.createGain()
  master.gain.value = volume
  master.connect(ctx.destination)
  let alive = true
  const voices = [2600, 3400, 4300, 5200] // a few birds, each with its own pitch

  function chirp(base, when) {
    const o = ctx.createOscillator(), g = ctx.createGain()
    const dur = 0.05 + Math.random() * 0.1
    const up = Math.random() < 0.6
    o.type = 'sine'
    o.frequency.setValueAtTime(base * (up ? 0.8 : 1.2), when)
    o.frequency.exponentialRampToValueAtTime(base * (up ? 1.25 : 0.8), when + dur)
    g.gain.setValueAtTime(0.0001, when)
    g.gain.exponentialRampToValueAtTime(0.9, when + dur * 0.2)
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
    o.connect(g); g.connect(master)
    o.start(when); o.stop(when + dur + 0.02)
  }
  function burst() {
    if (!alive) return
    const base = voices[Math.floor(Math.random() * voices.length)] * (0.95 + Math.random() * 0.1)
    const n = 2 + Math.floor(Math.random() * 5)
    let t = ctx.currentTime + 0.02
    for (let i = 0; i < n; i++) { chirp(base * (1 + (Math.random() - 0.5) * 0.15), t); t += 0.09 + Math.random() * 0.12 }
    setTimeout(burst, 350 + Math.random() * 1400)
  }
  ctx.resume().then(burst, burst)
  setTimeout(burst, 500) // a second bird

  return function stop(fadeSeconds = 3) {
    alive = false
    const now = ctx.currentTime
    master.gain.cancelScheduledValues(now)
    master.gain.setValueAtTime(master.gain.value, now)
    master.gain.linearRampToValueAtTime(0, now + fadeSeconds)
    setTimeout(() => ctx.close().catch(() => {}), fadeSeconds * 1000 + 200)
  }
}
