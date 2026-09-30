// A little original 90s-rave loop, made live in the browser with the Web Audio API.
// No music files: kick, claps, hats, bassline and piano-style stabs are all synthesised.
let ctx = null
let master = null
let noise = null
let timer = null
let nextTime = 0
let step = 0
let level = 0.35

const BPM = 136
const SIXTEENTH = 60 / BPM / 4

// 4 chords, 2 bars each: A minor, F, C, G
const CHORDS = [
  { root: 110.0, notes: [440.0, 523.25, 659.25] },
  { root: 87.31, notes: [349.23, 440.0, 523.25] },
  { root: 130.81, notes: [392.0, 523.25, 659.25] },
  { root: 98.0, notes: [392.0, 493.88, 587.33] },
]
const STABS = [0, 3, 6, 10, 13]

function out(t, peak, decay) {
  const g = ctx.createGain()
  g.gain.setValueAtTime(peak, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + decay)
  g.connect(master)
  return g
}

function kick(t) {
  const o = ctx.createOscillator()
  o.frequency.setValueAtTime(150, t)
  o.frequency.exponentialRampToValueAtTime(42, t + 0.14)
  o.connect(out(t, 1.0, 0.35))
  o.start(t); o.stop(t + 0.4)
}

function noiseHit(t, type, freq, peak, decay) {
  const src = ctx.createBufferSource()
  src.buffer = noise
  const f = ctx.createBiquadFilter()
  f.type = type; f.frequency.value = freq
  src.connect(f); f.connect(out(t, peak, decay))
  src.start(t); src.stop(t + decay + 0.05)
}

function bass(t, freq) {
  const o = ctx.createOscillator()
  o.type = 'sawtooth'; o.frequency.value = freq
  const f = ctx.createBiquadFilter()
  f.type = 'lowpass'; f.Q.value = 8
  f.frequency.setValueAtTime(900, t)
  f.frequency.exponentialRampToValueAtTime(180, t + 0.18)
  o.connect(f); f.connect(out(t, 0.35, 0.22))
  o.start(t); o.stop(t + 0.25)
}

function stab(t, notes) {
  const f = ctx.createBiquadFilter()
  f.type = 'lowpass'; f.Q.value = 4
  f.frequency.setValueAtTime(5000, t)
  f.frequency.exponentialRampToValueAtTime(700, t + 0.25)
  f.connect(out(t, 0.12, 0.3))
  notes.forEach((n) => {
    ;[-9, 9].forEach((cents) => {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'; o.frequency.value = n; o.detune.value = cents
      o.connect(f); o.start(t); o.stop(t + 0.32)
    })
  })
}

function playStep(s, t) {
  const st = s % 16
  const bar = Math.floor(s / 16) % 8
  const chord = CHORDS[Math.floor(bar / 2)]
  const intro = s < 32 // first 2 bars: stabs and hats only, then the drop

  if (!intro && st % 4 === 0) kick(t)
  if (!intro && (st === 4 || st === 12)) noiseHit(t, 'bandpass', 1500, 0.5, 0.18)
  if (st % 4 === 2) noiseHit(t, 'highpass', 7000, 0.25, 0.05)
  else noiseHit(t, 'highpass', 9000, 0.06, 0.03)
  if (!intro && st % 4 === 2) bass(t, chord.root)
  if (STABS.includes(st)) stab(t, chord.notes)
}

function schedule() {
  while (nextTime < ctx.currentTime + 0.12) {
    playStep(step, nextTime)
    nextTime += SIXTEENTH
    step += 1
  }
}

// Call this inside a tap so phones allow sound later
// iPhones mute web audio when the silent switch is on. Telling Safari this is media playback,
// and keeping a silent <audio> element running, lets the music play anyway.
let keepAlive = null
let stopTimer = null
function unlockPhoneAudio() {
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback' } catch { /* older phones */ }
  try {
    if (!keepAlive) {
      const rate = 8000, n = rate // one second of silence as a tiny WAV
      const buf = new ArrayBuffer(44 + n)
      const v = new DataView(buf)
      const w = (o, str) => { for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)) }
      w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt ')
      v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
      v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true)
      w(36, 'data'); v.setUint32(40, n, true)
      for (let i = 0; i < n; i++) v.setUint8(44 + i, 128)
      keepAlive = new Audio(URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })))
      keepAlive.loop = true
      keepAlive.setAttribute('playsinline', '')
    }
    keepAlive.play().catch(() => {})
  } catch { /* no audio element support */ }
}

export function primeRave() {
  unlockPhoneAudio()
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)()
      master = ctx.createGain()
      master.gain.value = 0
      master.connect(ctx.destination)
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
      const d = noise.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    }
    ctx.resume()
  } catch { /* no sound available */ }
}

export function startRave() {
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)()
      master = ctx.createGain()
      master.gain.value = 0
      master.connect(ctx.destination)
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
      const d = noise.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    }
    ctx.resume()
    clearTimeout(stopTimer) // a fade-out in progress must not cut the restarted beat
    if (!timer) {
      nextTime = ctx.currentTime + 0.05
      timer = setInterval(schedule, 25)
    }
    master.gain.cancelScheduledValues(ctx.currentTime)
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime)
    master.gain.linearRampToValueAtTime(level, ctx.currentTime + 1.5)
  } catch { /* no sound available, the card still works */ }
}

export function stopRave() {
  if (!ctx) return
  master.gain.cancelScheduledValues(ctx.currentTime)
  master.gain.setValueAtTime(master.gain.value, ctx.currentTime)
  master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6)
  // stay 'awake' (no suspend): phones won't let it wake up again without another tap
  clearTimeout(stopTimer)
  stopTimer = setTimeout(() => { clearInterval(timer); timer = null }, 700)
}

export function setRaveVolume(v) {
  level = 0.5 * v
  if (ctx && timer) {
    master.gain.cancelScheduledValues(ctx.currentTime)
    master.gain.setTargetAtTime(level, ctx.currentTime, 0.05)
  }
}

// One deep bass thud, like the club door opening
export function bassThud() {
  primeRave()
  try {
    const t0 = ctx.currentTime + 0.02
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.setValueAtTime(90, t0)
    o.frequency.exponentialRampToValueAtTime(35, t0 + 0.6)
    g.gain.setValueAtTime(0.9, t0)
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.9)
    o.connect(g); g.connect(ctx.destination)
    o.start(t0); o.stop(t0 + 1)
  } catch { /* no sound available */ }
}
