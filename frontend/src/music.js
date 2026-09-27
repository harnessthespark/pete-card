// Pete's music, in two "rooms":
//  - the club (ticket, card, lasers): Together - Hardcore Uproar (1990), via SoundCloud's player
//  - the chapel (St Petermas window): Moguai - Viola, via YouTube's player
// Scrolling to the window cross-fades between them. If a player is blocked, the
// other keeps going, and if SoundCloud fails at the start the home-made loop in rave.js plays.
import { primeRave, startRave, stopRave, setRaveVolume } from './rave.js'

const CLUB = { title: 'Together – Hardcore Uproar (1990)', link: 'https://soundcloud.com/suddi-raval/hardcore-uproar-by-together' }
const CHAPEL = { title: 'Moguai – Viola', link: 'https://www.youtube.com/watch?v=yJu7smlJNYU' }
const SC_TRACK = 'https://api.soundcloud.com/tracks/20039560'
const YT_ID = 'yJu7smlJNYU'

let volume = 0.7
let started = false
let muted = false
let room = 'club'

// SoundCloud (club)
let frame = null
let widget = null
let scPlaying = false
let scLevel = 1 // 0..1 multiplier used for fading

// YouTube (chapel)
let yt = null
let ytReady = false
let ytLevel = 0
let ytWaiting = null

let fadeTimer = null
let hintEl = null

// Phones often block music that isn't started by a tap inside the player itself.
// If a track hasn't started, show that player so he can tap its play button.
function showPlayer(el, text) {
  if (!el) return
  el.classList.add('player-visible')
  if (!hintEl) {
    hintEl = document.createElement('p')
    hintEl.className = 'player-hint'
    document.body.appendChild(hintEl)
  }
  hintEl.textContent = text
  hintEl.style.display = 'block'
}
function hidePlayers() {
  document.querySelectorAll('.player-visible').forEach((e) => e.classList.remove('player-visible'))
  if (hintEl) hintEl.style.display = 'none'
}

function applyLevels() {
  if (widget) widget.setVolume(Math.round(volume * scLevel * 100))
  if (yt && ytReady) yt.setVolume(Math.round(volume * ytLevel * 100))
}

function fade(to, ms = 2000, done) {
  // to = 'chapel' or 'club'
  clearInterval(fadeTimer)
  const steps = 20
  let i = 0
  fadeTimer = setInterval(() => {
    i += 1
    const t = i / steps
    if (to === 'chapel') { ytLevel = Math.max(ytLevel, t); scLevel = Math.min(scLevel, 1 - t) } else { scLevel = Math.max(scLevel, t); ytLevel = Math.min(ytLevel, 1 - t) }
    applyLevels()
    if (i >= steps) { clearInterval(fadeTimer); if (done) done() }
  }, ms / steps)
}

function loadScript(src, check) {
  return new Promise((resolve, reject) => {
    if (check()) return resolve()
    const s = document.createElement('script')
    s.src = src; s.onload = resolve; s.onerror = reject
    document.head.appendChild(s)
  })
}

function loadYouTube() {
  if (yt) return
  const holder = document.createElement('div')
  holder.id = 'yt-chapel'
  document.body.appendChild(holder)
  const make = () => {
    yt = new window.YT.Player('yt-chapel', {
      videoId: YT_ID,
      playerVars: { autoplay: 0, controls: 1, loop: 1, playlist: YT_ID, playsinline: 1 },
      events: {
        onReady: () => {
          ytReady = true
          const f = document.getElementById('yt-chapel')
          if (f) f.classList.add('sc-player')
          applyLevels()
          if (ytWaiting) { const w = ytWaiting; ytWaiting = null; w() }
        },
        onStateChange: (e) => {
          if (e.data === 1) setTimeout(hidePlayers, 1200)
          if (e.data === 1 && room === 'chapel') { // playing
            stopRave()
            fade('chapel', 2000, () => { if (widget) widget.pause() })
          }
        },
      },
    })
  }
  if (window.YT && window.YT.Player) { make(); return }
  const prev = window.onYouTubeIframeAPIReady
  window.onYouTubeIframeAPIReady = () => { if (prev) prev(); make() }
  loadScript('https://www.youtube.com/iframe_api', () => false).catch(() => {})
}

export function startMusic() {
  primeRave()
  started = true
  muted = false
  if (room === 'chapel') { enterChapel(); return }
  if (frame) {
    if (widget) { scLevel = 1; applyLevels(); widget.play() } else startRave()
    return
  }
  frame = document.createElement('iframe')
  frame.className = 'sc-player'
  frame.title = 'Hardcore Uproar by Together (1990) on SoundCloud'
  frame.allow = 'autoplay; encrypted-media'
  frame.src = 'https://w.soundcloud.com/player/?url=' + encodeURIComponent(SC_TRACK) +
    '&auto_play=true&visual=false&hide_related=true&show_comments=false' +
    '&show_user=true&show_reposts=false&show_teaser=false&color=%23ff2bd6'
  document.body.appendChild(frame)

  setTimeout(() => {
    if (!scPlaying && room === 'club' && !muted) {
      showPlayer(frame, 'Tap ▶ on the player to start the music')
      startRave()
    }
  }, 3000)

  loadScript('https://w.soundcloud.com/player/api.js', () => !!(window.SC && window.SC.Widget)).then(() => {
    const E = window.SC.Widget.Events
    widget = window.SC.Widget(frame)
    widget.bind(E.READY, () => { applyLevels(); if (room === 'club' && !muted) widget.play() })
    widget.bind(E.PLAY, () => { scPlaying = true; stopRave(); setTimeout(hidePlayers, 1200) })
    widget.bind(E.PAUSE, () => { scPlaying = false })
    widget.bind(E.FINISH, () => { widget.seekTo(0); widget.play() }) // loop
  }).catch(() => startRave())

  loadYouTube() // get the chapel track ready in the background
}

// Called when the St Petermas window scrolls into view
export function enterChapel() {
  room = 'chapel'
  if (!started || muted) return
  loadYouTube()
  const go = () => {
    yt.playVideo() // fade happens when YouTube reports it is playing
    setTimeout(() => {
      if (room === 'chapel' && !muted && yt.getPlayerState && yt.getPlayerState() !== 1) {
        showPlayer(document.getElementById('yt-chapel'), 'Tap ▶ for Viola, the chapel track')
      }
    }, 3000)
  }
  if (ytReady) go(); else ytWaiting = go
}

// Called when he scrolls back up to the club
export function enterClub() {
  if (room === 'club') return
  room = 'club'
  hidePlayers()
  if (!started || muted) return
  if (widget) { widget.play(); fade('club', 1500, () => { if (yt && ytReady) yt.pauseVideo() }) }
}

export function stopMusic() {
  muted = true
  hidePlayers()
  clearInterval(fadeTimer)
  if (widget) widget.pause()
  if (yt && ytReady) yt.pauseVideo()
  stopRave()
}

export function setMusicVolume(v) {
  volume = v
  applyLevels()
  setRaveVolume(v)
}

export function getMusicVolume() { return volume }
export function nowPlaying() { return room === 'chapel' ? CHAPEL : CLUB }
