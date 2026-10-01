// Pete's music: one YouTube player, one set.
// Dancing Queen (club remix) kicks things off when the card opens, then the set plays on and loops.
// Computers start it by themselves after his tap. Phones only allow YouTube to start from a tap on
// YouTube's own play button, so on phones the player pops up with "Tap ▶ for the music".
const SET = [
  { id: 'hr9nbe_bcg8', title: 'ABBA – Dancing Queen (club remix) · No.1 the week Pete was born' },
  { id: 'wKduhUXa0rg', title: 'Messiah – Temple of Dreams (1992)' },
  { id: 'bhSB8EEnCAM', title: 'Faithless – God Is a DJ' },
  { id: '1mb3cXHH6QQ', title: 'Like a Prayer (Infernum dark techno remix)' },
  { id: '6WekPJIx2YU', title: "DC Project – Mary's Prayer (Club Mix)" },
  { id: 'yJu7smlJNYU', title: 'Moguai – Viola' },
]
// Shuffle: Dancing Queen always opens, then the rest play in a random order, reshuffled each time round
let order = [0]
let pos = 0
function shuffledRest() {
  const rest = SET.map((_, i) => i).slice(1)
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]] }
  return rest
}
order = [0, ...shuffledRest()]
let index = 0
function nextTrack() {
  pos += 1
  if (pos >= order.length) { order = shuffledRest(); pos = 0 } // a fresh shuffle for the next time round
  index = order[pos]
  yt.loadVideoById(SET[index].id)
}
let volume = 0.7
let started = false
let muted = false
let yt = null
let ytReady = false
let waiting = null
let hintEl = null

function el() { return document.getElementById('yt-chapel') }
function playing() { return !!(yt && ytReady && yt.getPlayerState && yt.getPlayerState() === 1) }

function showPlayer() {
  const f = el()
  if (!f || playing()) return
  f.classList.add('player-visible')
  if (!hintEl) {
    hintEl = document.createElement('div')
    hintEl.className = 'player-hint'
    hintEl.dataset.for = 'yt'
    const label = document.createElement('span')
    label.textContent = 'Tap ▶ for the music 🎶'
    const close = document.createElement('button')
    close.type = 'button'
    close.textContent = '✕'
    close.setAttribute('aria-label', 'Hide the player')
    close.onclick = hidePlayer
    hintEl.append(label, close)
    document.body.appendChild(hintEl)
  }
  hintEl.style.display = 'flex'
}
function hidePlayer() {
  const f = el()
  if (f) f.classList.remove('player-visible')
  if (hintEl) hintEl.style.display = 'none'
}

function loadScript(src) {
  const s = document.createElement('script')
  s.src = src
  document.head.appendChild(s)
}

// Load the player early (quietly) so it's ready the moment the card opens
export function preloadMusic() {
  if (yt) return
  const holder = document.createElement('div')
  holder.id = 'yt-chapel'
  document.body.appendChild(holder)
  const make = () => {
    yt = new window.YT.Player('yt-chapel', {
      videoId: SET[0].id,
      playerVars: { autoplay: 0, controls: 1, playsinline: 1 },
      events: {
        onReady: () => {
          ytReady = true
          yt.setVolume(Math.round(volume * 100))
          if (waiting) { const w = waiting; waiting = null; w() }
        },
        onError: () => nextTrack(), // video blocked or removed: skip to the next track
        onStateChange: (e) => {
          if (e.data === 1) setTimeout(() => { if (playing()) hidePlayer() }, 800)
          if (e.data === 0) nextTrack() // track finished: next one
        },
      },
    })
  }
  if (window.YT && window.YT.Player) { make(); return }
  const prev = window.onYouTubeIframeAPIReady
  window.onYouTubeIframeAPIReady = () => { if (prev) prev(); make() }
  loadScript('https://www.youtube.com/iframe_api')
}

export function startMusic() {
  started = true
  muted = false
  preloadMusic()
  const go = () => {
    yt.playVideo()
    // blocked (phones): show YouTube's own player so one tap on ▶ starts it
    setTimeout(() => { if (started && !muted && !playing()) showPlayer() }, 1500)
  }
  if (ytReady) go(); else waiting = go
}

// The chapel and the club share the same set: the music just carries on
export function enterChapel() {}
export function enterClub() {}

export function stopMusic() {
  muted = true
  hidePlayer()
  if (yt && ytReady) yt.pauseVideo()
}

export function setMusicVolume(v) {
  volume = v
  if (yt && ytReady) yt.setVolume(Math.round(v * 100))
}

export function getMusicVolume() { return volume }
export function nowPlaying() {
  const t = SET[index]
  return { title: t.title, link: 'https://www.youtube.com/watch?v=' + t.id }
}
