import './style.css'
import { Drive, type Input, type TickEvent } from './drive'
import { createWorld } from './world'
import { makePedestrians, makeTraffic, start, stops } from './route'
import { SoundEngine } from './audio'

const drive = new Drive(stops, makeTraffic(), makePedestrians())
const sound = new SoundEngine()

const el = <E extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id)! as E
const overlay = el('overlay')
const title = el('title')
const description = el('description')
const details = el('details')
const primary = el<HTMLButtonElement>('primary')
const help = el('help')
const speed = el('speed')
const next = el('next')
const fare = el('fare')
const bonus = el('bonus')
const progress = el<HTMLProgressElement>('progress')
const notice = el('notice')
const pause = el<HTMLButtonElement>('pause')
const muteBtn = el<HTMLButtonElement>('mute')
const mapToggle = el<HTMLButtonElement>('mapToggle')
const musicBtn = el<HTMLButtonElement>('musicBtn')
const radioEl = el('radio')
const radioTrackEl = el('radioTrack')
const radioHintEl = el('radioHint')
const radioFrameWrap = el('radioFrameWrap')
const radioPlay = el<HTMLButtonElement>('radioPlay')
const radioNext = el<HTMLButtonElement>('radioNext')
const radioMin = el<HTMLButtonElement>('radioMin')
const radioStop = el<HTMLButtonElement>('radioStop')
const routemapEl = el('routemap')

// Verified 1980s Myanmar classic stereo tracks & albums on YouTube (playableInEmbed: true)
const songs1980s = [
  { id: 'a8KtIByKC54', title: 'စိုင်းထီးဆိုင် · လူကြမ်းမင်းသား (1981)' },
  { id: 'QtgqqGsTP7g', title: 'ခင်မောင်တိုး · မဟာဆန်သူ' },
  { id: '2ptLG72a_Dg', title: 'ထူးအိမ်သင် · နာရီပေါ်ကမျက်ရည်စက်များ' },
  { id: 'VSaDN8ByOE8', title: 'ကော်နီ · ကိုကိုချစ် (1986)' },
  { id: 'i9L_Db94aC0', title: 'ကိုင်ဇာ · လက်ရွေးစင်သီချင်းများ' },
  { id: 'Ssyn53WCcmc', title: 'နှလုံးသားဟစ်ကြွေးသံများ (1988)' },
  { id: 'suOJjYp12vE', title: 'စိုင်းထီးဆိုင် · လက်ရွေးစင်သီချင်းများ' },
] as const

interface YTPlayer {
  loadVideoById(videoId: string): void
  playVideo(): void
  pauseVideo(): void
  stopVideo(): void
  unMute(): void
  getPlayerState(): number
  getIframe(): HTMLIFrameElement
}
interface YTGlobal {
  Player: new (
    el: string | HTMLElement,
    opts: {
      videoId: string
      playerVars: Record<string, string | number>
      events: {
        onReady?: (e: { target: YTPlayer }) => void
        onStateChange?: (e: { data: number; target: YTPlayer }) => void
        onError?: () => void
      }
    }
  ) => YTPlayer
}
declare global {
  interface Window {
    YT?: YTGlobal
    onYouTubeIframeAPIReady?: () => void
  }
}

let radioIndex = 0
let radioOpen = false
let radioMini = false
let ytApiRequested = false
let ytPlayer: YTPlayer | undefined
let ytReady = false
let pendingPlay = false
let autoplayCheckTimer: number | undefined

function setRadioHint(songId: string, msg: string) {
  radioHintEl.textContent = msg
  if (msg) {
    const link = document.createElement('a')
    link.href = 'https://www.youtube.com/watch?v=' + songId
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.textContent = 'YouTube ↗'
    radioHintEl.append(link)
  }
}

function ensureYouTubeApi(onReady: () => void) {
  if (window.YT?.Player) {
    onReady()
    return
  }
  const prev = window.onYouTubeIframeAPIReady
  window.onYouTubeIframeAPIReady = () => {
    prev?.()
    onReady()
  }
  if (ytApiRequested) return
  ytApiRequested = true
  const script = document.createElement('script')
  script.src = 'https://www.youtube.com/iframe_api'
  script.async = true
  document.head.append(script)
}

function createEmbedIframe(song: (typeof songs1980s)[number]) {
  const iframe = document.createElement('iframe')
  iframe.id = 'ytPlayer'
  iframe.referrerPolicy = 'strict-origin-when-cross-origin'
  const originParam = location.origin.startsWith('http') ? '&origin=' + encodeURIComponent(location.origin) : ''
  iframe.src = `https://www.youtube.com/embed/${song.id}?enablejsapi=1&autoplay=1&playsinline=1&rel=0&controls=1&modestbranding=1${originParam}`
  iframe.title = song.title
  iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'
  return iframe
}

function scheduleAutoplayCheck(songId: string) {
  window.clearTimeout(autoplayCheckTimer)
  autoplayCheckTimer = window.setTimeout(() => {
    if (!radioOpen || !ytPlayer || !ytReady) return
    const state = ytPlayer.getPlayerState()
    if (state !== 1 && state !== 3) {
      setRadioHint(songId, 'ဖွင့်ရန် ဗီဒီယို ▶ ကိုတစ်ချက်နှိပ်ပါ ·')
      radioPlay.textContent = '▶'
    }
  }, 1800)
}

function loadRadioTrack(index: number) {
  radioIndex = (index + songs1980s.length) % songs1980s.length
  const song = songs1980s[radioIndex]
  radioTrackEl.textContent = '📻 ' + song.title
  radioOpen = true
  radioEl.hidden = false
  radioEl.classList.toggle('mini', radioMini)
  musicBtn.classList.add('active', 'playing')
  setRadioHint(song.id, 'ဖွင့်ရန် ဗီဒီယို ▶ ကိုနှိပ်ပါ ·')
  pendingPlay = true

  // If YT Player already exists and is ready, switch video cleanly inside user gesture
  if (ytPlayer && ytReady) {
    ytPlayer.loadVideoById(song.id)
    ytPlayer.unMute()
    ytPlayer.playVideo()
    scheduleAutoplayCheck(song.id)
    return
  }

  // Mount iframe immediately with strict-origin-when-cross-origin so YouTube never throws Error 153
  const iframe = createEmbedIframe(song)
  radioFrameWrap.replaceChildren(iframe)

  ensureYouTubeApi(() => {
    if (!radioOpen || !window.YT?.Player || ytPlayer) return
    ytPlayer = new window.YT.Player(iframe, {
      videoId: song.id,
      playerVars: {},
      events: {
        onReady: e => {
          ytReady = true
          if (pendingPlay && radioOpen) {
            e.target.unMute()
            e.target.playVideo()
            scheduleAutoplayCheck(songs1980s[radioIndex].id)
          }
        },
        onStateChange: e => {
          if (e.data === 1) {
            radioPlay.textContent = '⏸'
            musicBtn.classList.add('playing')
            radioHintEl.textContent = ''
          } else if (e.data === 2) {
            radioPlay.textContent = '▶'
            musicBtn.classList.remove('playing')
          } else if (e.data === 0) {
            loadRadioTrack(radioIndex + 1)
          }
        },
        onError: () => {
          setRadioHint(songs1980s[radioIndex].id, 'နောက်တစ်ပုဒ်ပြောင်းနေသည်… ·')
          window.setTimeout(() => {
            if (radioOpen) loadRadioTrack(radioIndex + 1)
          }, 900)
        },
      },
    })
  })
}

function stopRadio() {
  window.clearTimeout(autoplayCheckTimer)
  radioOpen = false
  radioMini = false
  pendingPlay = false
  if (ytPlayer && ytReady) {
    try { ytPlayer.stopVideo() } catch {}
  }
  radioEl.hidden = true
  radioEl.classList.remove('mini')
  radioPlay.textContent = '▶'
  radioHintEl.textContent = ''
  musicBtn.classList.remove('active', 'playing')
}

// Preload YouTube IFrame API early so tapping 🎵 plays immediately
ensureYouTubeApi(() => {})
const fx = el('fx')
const mapCanvas = el<HTMLCanvasElement>('mapCanvas')
const mapCtx = mapCanvas.getContext('2d')!
const format = (value: number) => value.toLocaleString('en') + ' ကျပ်'

// On very short landscape mobile screens, start map compactly toggleable via 🗺️
let mapVisible = window.innerHeight > 400
const syncMapVisibility = () => {
  routemapEl.hidden = !mapVisible
  mapToggle.classList.toggle('active', mapVisible)
}
syncMapVisibility()

const keys = new Set<string>()
const pointers = new Map<number, keyof Input>()
const tapUntil = new Map<keyof Input, number>()
const bindings: Record<keyof Input, string[]> = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  gas: ['ArrowUp', 'KeyW'],
  brake: ['ArrowDown', 'KeyS', 'Space'],
  horn: ['KeyH', 'KeyF', 'KeyE'],
}
const input = (): Input => {
  const now = performance.now()
  const active = (action: keyof Input) => bindings[action].some(key => keys.has(key)) ||
    [...pointers.values()].includes(action) || (tapUntil.get(action) ?? 0) > now
  return {
    left: active('left'),
    right: active('right'),
    gas: active('gas'),
    brake: active('brake'),
    horn: active('horn'),
  }
}
const drivingKeys = Object.values(bindings).flat()
const clearInput = () => {
  keys.clear()
  pointers.clear()
  tapUntil.clear()
  document.querySelectorAll('[data-input]').forEach(button => button.classList.remove('held'))
}

function popEl(target: HTMLElement) {
  target.classList.remove('pop')
  void target.offsetWidth
  target.classList.add('pop')
}

let fxTimer = 0
function triggerFx(cls: 'crash' | 'horn', duration: number) {
  fx.className = cls
  fxTimer = duration
}

function drawRouteMap() {
  if (!mapVisible) return
  const ctx = mapCtx
  const w = mapCanvas.width
  const h = mapCanvas.height
  ctx.clearRect(0, 0, w, h)

  // Header
  ctx.fillStyle = '#ffcf58'
  ctx.font = 'bold 10.5px "Noto Sans Myanmar", sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('ပြည်လမ်း · လမ်းကြောင်း', 8, 15)

  const trackX = 24
  const topY = 30
  const botY = h - 18
  const span = botY - topY
  const totalDist = drive.terminal.distance
  const distToY = (d: number) => botY - Math.max(0, Math.min(1, d / totalDist)) * span

  // Base road track
  ctx.strokeStyle = '#2d3b4d'
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(trackX, botY)
  ctx.lineTo(trackX, topY)
  ctx.stroke()

  // Completed progress line
  const playerY = distToY(drive.distance)
  ctx.strokeStyle = '#ffbe4f'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(trackX, botY)
  ctx.lineTo(trackX, playerY)
  ctx.stroke()

  // Start depot dot
  ctx.fillStyle = '#8fa899'
  ctx.beginPath()
  ctx.arc(trackX, botY, 3.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#9db4a6'
  ctx.font = '10px "Noto Sans Myanmar", sans-serif'
  ctx.fillText(start.burmese, 38, botY + 3)

  // Stops along route in Burmese
  for (const stop of drive.stops) {
    const sy = distToY(stop.distance)
    const done = drive.boarded.has(stop)
    const passed = !stop.terminal && drive.distance > stop.distance + 14 && !done

    ctx.beginPath()
    if (stop.terminal) {
      ctx.fillStyle = '#ffcf58'
      ctx.fillRect(trackX - 5, sy - 5, 10, 10)
    } else {
      ctx.fillStyle = done ? '#5df094' : passed || stop.waiting === 0 ? '#5c7366' : '#ffcf58'
      ctx.arc(trackX, sy, 4.5, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.font = stop.terminal ? 'bold 10.5px "Noto Sans Myanmar", sans-serif' : '10px "Noto Sans Myanmar", sans-serif'
    ctx.fillStyle = done ? '#7df2a8' : passed ? '#7e9487' : '#fff5db'
    ctx.fillText(stop.burmese, 38, sy + 3, w - 68)

    if (!stop.terminal) {
      const badgeText = done ? '✓' : String(stop.waiting)
      ctx.fillStyle = done ? '#28573d' : stop.waiting > 0 ? '#ffcf58' : '#35453c'
      ctx.fillRect(w - 25, sy - 7, 19, 14)
      ctx.fillStyle = done ? '#7df2a8' : stop.waiting > 0 ? '#13241b' : '#8ea396'
      ctx.font = 'bold 9.5px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(badgeText, w - 15.5, sy + 3)
      ctx.textAlign = 'left'
    }
  }

  // Live rival YBS buses on the route map
  for (const v of drive.vehicles) {
    if (v.kind !== 'bus' || v.line === 37 || v.baseCruiseSpeed <= 0) continue
    if (v.distance < 0 || v.distance > totalDist) continue
    const vy = distToY(v.distance)
    ctx.fillStyle = v.line === 61 ? '#4cc4ba' : v.line === 21 ? '#ff6a4f' : '#589df0'
    ctx.beginPath()
    ctx.arc(trackX - 9, vy, 3, 0, Math.PI * 2)
    ctx.fill()
  }

  // Live YBS 37 player bus marker
  ctx.fillStyle = '#121726'
  ctx.beginPath()
  ctx.arc(trackX, playerY, 7, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#ffbe4f'
  ctx.beginPath()
  ctx.arc(trackX, playerY, 5.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#121726'
  ctx.beginPath()
  ctx.moveTo(trackX, playerY - 3.2)
  ctx.lineTo(trackX + 2.8, playerY + 2)
  ctx.lineTo(trackX - 2.8, playerY + 2)
  ctx.closePath()
  ctx.fill()
}

let banner = ''
let bannerTime = 0
let shownStatus: Drive['status'] | undefined

function handleEvent(ev: TickEvent) {
  banner = ev.message
  bannerTime = ev.kind === 'horn' ? 1.8 : 3.4
  if (ev.kind === 'fare') {
    sound.playFare()
    popEl(fare)
  } else if (ev.kind === 'door') {
    sound.playDoorHiss()
  } else if (ev.kind === 'bonus') {
    sound.playBonus()
    popEl(bonus)
  } else if (ev.kind === 'steal') {
    sound.playStealAlert()
  } else if (ev.kind === 'crash') {
    sound.playCrash()
    triggerFx('crash', 0.45)
  }
}

function updateHUD(dt: number, controls: Input) {
  if (fxTimer > 0) {
    fxTimer = Math.max(0, fxTimer - dt)
    if (fxTimer === 0) fx.className = ''
  }
  if (drive.hornPulse > 0.7 && fx.className !== 'crash') {
    triggerFx('horn', 0.16)
  }

  const stop = drive.nextStop
  const distance = Math.round(stop.distance - drive.distance)
  speed.textContent = String(Math.round(drive.speed * 3.6)).padStart(2, '0')
  const paxInfo = stop.terminal ? 'ဂိတ်ဆုံး' : stop.waiting + ' ဦး'
  next.textContent = stop.burmese + (distance > 12 ? ' · ' + distance.toLocaleString('en') + ' မီတာ' : '') + ' · ' + paxInfo
  fare.textContent = format(drive.fares)
  bonus.textContent = format(drive.bonus)
  progress.value = Math.min(1, drive.distance / drive.terminal.distance)
  bannerTime = Math.max(0, bannerTime - dt)

  let text = bannerTime ? banner : ''
  if (drive.status === 'driving') {
    if (drive.dwellingAt) {
      text = drive.dwellingAt.terminal
        ? `${drive.dwellingAt.burmese} ဂိတ်ဆုံးသို့ ရောက်နေသည်…`
        : drive.dwellingAt.waiting > 0
          ? `${drive.dwellingAt.burmese} တွင် ခရီးသည်တက်နေသည် · ငြိမ်ငြိမ်ရပ်ပါ (${drive.dwellingAt.waiting} ဦးကျန် · 500 ကျပ်)`
          : `${drive.dwellingAt.burmese} တွင် ခရီးသည်မကျန်တော့ပါ`
    } else if (!text && distance <= 120 && distance >= -14) {
      text = stop.terminal
        ? 'ဂိတ်ဆုံးနီးပြီ · ရပ်နားရန် အဝါကွက်တွင် ဘရိတ်အုပ်ပါ'
        : stop.waiting > 0
          ? `${stop.burmese} (${stop.waiting} ဦး) · တင်လိုလျှင် အဝါကွက်တွင် ဘရိတ်အုပ်ပါ`
          : `${stop.burmese} · ခရီးသည်မကျန်တော့ပါ`
    }
  }
  if (notice.textContent !== text) notice.textContent = text

  sound.update(drive.status === 'driving', drive.speed, controls.gas, controls.brake, controls.horn)
  drawRouteMap()

  if (shownStatus === drive.status) return
  shownStatus = drive.status
  overlay.hidden = drive.status === 'driving'
  overlay.classList.toggle('dispatch', drive.status === 'ready')
  pause.disabled = drive.status !== 'driving'
  if (drive.status === 'driving' || drive.status === 'ready') return
  clearInput()
  help.hidden = true
  primary.textContent = drive.status === 'paused' ? 'ဆက်မောင်းမည်' : 'ပြန်မောင်းမည်'
  title.textContent = drive.status === 'arrived' ? 'ခရီးစဉ်ပြီးဆုံးပါပြီ' : drive.status === 'crashed' ? 'ဂိမ်းပြီးဆုံးပါပြီ' : 'ခဏရပ်နားထားသည်'
  description.textContent = drive.status === 'arrived'
    ? `${drive.terminal.burmese} ဂိတ်ဆုံးသို့ ရောက်ရှိပါပြီ`
    : drive.status === 'crashed'
      ? drive.failure
      : `YBS 37 · ${stop.burmese}`
  details.textContent = drive.status === 'paused'
    ? 'အဆင်သင့်ဖြစ်လျှင် ဆက်မောင်းပါ။'
    : `ခရီးသည် ${drive.passengersPicked} ဦး (${format(drive.fares)}) · ကျော်တက်ဆု ${format(drive.bonus)} · စုစုပေါင်း ${format(drive.fares + drive.bonus)}` +
      (drive.passengersStolen ? ` · အခြားလိုင်းလုသွား ${drive.passengersStolen} ဦး` : '')
  primary.focus()
}

function pauseDrive() {
  if (drive.status === 'driving') {
    clearInput()
    drive.status = 'paused'
  }
}

primary.addEventListener('click', () => {
  sound.unlock()
  if (drive.status !== 'paused') {
    drive.reset()
    bannerTime = 0
  }
  primary.blur()
  drive.status = 'driving'
})
pause.addEventListener('click', pauseDrive)
muteBtn.addEventListener('click', () => {
  sound.unlock()
  sound.setMuted(!sound.muted)
  muteBtn.textContent = sound.muted ? '🔇' : '🔊'
  muteBtn.blur()
})
mapToggle.addEventListener('click', () => {
  mapVisible = !mapVisible
  syncMapVisibility()
  mapToggle.blur()
})
musicBtn.addEventListener('click', () => {
  if (!radioOpen) {
    radioMini = false
    radioMin.textContent = '−'
    loadRadioTrack(radioIndex)
  } else {
    radioMini = !radioMini
    radioEl.classList.toggle('mini', radioMini)
    radioMin.textContent = radioMini ? '+' : '−'
  }
  musicBtn.blur()
})
radioPlay.addEventListener('click', () => {
  if (!ytPlayer || !ytReady) {
    loadRadioTrack(radioIndex)
  } else if (ytPlayer.getPlayerState() === 1) {
    ytPlayer.pauseVideo()
  } else {
    ytPlayer.unMute()
    ytPlayer.playVideo()
  }
  radioPlay.blur()
})
radioNext.addEventListener('click', () => {
  loadRadioTrack(radioIndex + 1)
  radioNext.blur()
})
radioMin.addEventListener('click', () => {
  radioMini = !radioMini
  radioEl.classList.toggle('mini', radioMini)
  radioMin.textContent = radioMini ? '+' : '−'
  radioMin.blur()
})
radioStop.addEventListener('click', () => {
  stopRadio()
  radioStop.blur()
})

window.addEventListener('blur', () => {
  // Don't pause when the user taps inside the embedded YouTube 1980s radio player
  if (document.activeElement?.tagName === 'IFRAME') return
  pauseDrive()
})
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseDrive()
})
window.addEventListener('keydown', event => {
  if (event.code === 'Escape') pauseDrive()
  if (!drivingKeys.includes(event.code) || drive.status !== 'driving') return
  sound.unlock()
  event.preventDefault()
  keys.add(event.code)
  if (bindings.horn.includes(event.code)) {
    document.querySelectorAll('[data-input="horn"]').forEach(b => b.classList.add('held'))
  }
})
window.addEventListener('keyup', event => {
  keys.delete(event.code)
  if (bindings.horn.includes(event.code)) {
    document.querySelectorAll('[data-input="horn"]').forEach(b => b.classList.remove('held'))
  }
})

// Multi-touch safe pointer controls (prevent Android/iOS long-press context menu)
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-input]')) {
  button.addEventListener('contextmenu', event => event.preventDefault())
  button.addEventListener('pointerdown', event => {
    if (drive.status !== 'driving') return
    sound.unlock()
    event.preventDefault()
    button.setPointerCapture(event.pointerId)
    const action = button.dataset.input as keyof Input
    pointers.set(event.pointerId, action)
    tapUntil.set(action, performance.now() + 180)
    button.classList.add('held')
  })
  for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    button.addEventListener(eventName, event => {
      const action = button.dataset.input as keyof Input
      pointers.delete((event as PointerEvent).pointerId)
      if (eventName === 'pointercancel') tapUntil.delete(action)
      if (![...pointers.values()].includes(action)) button.classList.remove('held')
    })
  }
}

function boot() {
  let render: () => void
  try {
    render = createWorld(el('scene'), drive, start)
  } catch (error) {
    title.textContent = '3D ဂရပ်ဖစ် မရနိုင်ပါ'
    description.textContent = 'ဤဂိမ်းသည် WebGL လိုအပ်ပါသည်။'
    details.textContent = 'ဘရောက်ဇာတွင် Hardware Acceleration ဖွင့်ပြီး ပြန်ဖွင့်ကြည့်ပါ။'
    primary.hidden = help.hidden = true
    console.error(error)
    return
  }
  let previous = performance.now()
  let accumulator = 0
  const fixed = 1 / 60
  function frame(now: number) {
    const dt = Math.min(0.1, (now - previous) / 1000)
    previous = now
    accumulator += dt
    const controls = input()
    while (accumulator >= fixed) {
      const result = drive.tick(fixed, controls)
      if (result) handleEvent(result)
      accumulator -= fixed
    }
    updateHUD(dt, controls)
    render()
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}

boot()
