// Pete's song: Together - Hardcore Uproar (1990), played through SoundCloud's own player.
// If SoundCloud can't play (blocked, offline), the home-made rave loop in rave.js plays instead.
import { primeRave, startRave, stopRave } from './rave.js'

const TRACK = 'https://api.soundcloud.com/tracks/20039560'
let frame = null
let widget = null
let playing = false

function loadApi() {
  return new Promise((resolve, reject) => {
    if (window.SC && window.SC.Widget) return resolve()
    const s = document.createElement('script')
    s.src = 'https://w.soundcloud.com/player/api.js'
    s.onload = resolve
    s.onerror = reject
    document.head.appendChild(s)
  })
}

export function startMusic() {
  primeRave()
  if (frame) {
    if (widget) widget.play(); else startRave()
    return
  }
  frame = document.createElement('iframe')
  frame.className = 'sc-player'
  frame.title = 'Hardcore Uproar by Together (1990) on SoundCloud'
  frame.allow = 'autoplay; encrypted-media'
  frame.src = 'https://w.soundcloud.com/player/?url=' + encodeURIComponent(TRACK) +
    '&auto_play=true&visual=false&hide_related=true&show_comments=false' +
    '&show_user=true&show_reposts=false&show_teaser=false&color=%23ff2bd6'
  document.body.appendChild(frame)

  // If the song hasn't started after 6 seconds, play the home-made loop instead
  setTimeout(() => { if (!playing) startRave() }, 6000)

  loadApi().then(() => {
    const E = window.SC.Widget.Events
    widget = window.SC.Widget(frame)
    widget.bind(E.READY, () => widget.play())
    widget.bind(E.PLAY, () => { playing = true; stopRave() })
    widget.bind(E.PAUSE, () => { playing = false })
    widget.bind(E.FINISH, () => { widget.seekTo(0); widget.play() }) // loop
  }).catch(() => startRave())
}

export function stopMusic() {
  if (widget) widget.pause()
  stopRave()
}
