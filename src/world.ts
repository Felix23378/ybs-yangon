import * as T from 'three'
import { crosswalks, myaynigone } from './route'
import { busHalfLength, curb, type Drive, type Stop, type Vehicle } from './drive'

const material = (color: number, roughness = 0.85, metalness = 0.05) =>
  new T.MeshStandardMaterial({ color, roughness, metalness })

// Bright Stylized Yangon Golden-Afternoon Palette (luminous, crisp, warm daylight-sunset)
const asphalt = material(0x4a4f5a, 0.52, 0.08)
const concrete = material(0xb5a69b, 0.8)
const white = material(0xfff4e0, 0.55)
const yellow = new T.MeshBasicMaterial({ color: 0xffd05b })
const glass = material(0x2a4559, 0.2, 0.25)
const litWindow = new T.MeshBasicMaterial({ color: 0xffd88c })
const coolWindow = new T.MeshBasicMaterial({ color: 0xadeee3 })
const lampGlow = new T.MeshBasicMaterial({ color: 0xffe49e })
const headLightGlow = new T.MeshBasicMaterial({ color: 0xfff8e0 })
const tailLightGlow = new T.MeshBasicMaterial({ color: 0xff463a })
const black = material(0x20262e, 0.82)
const rubber = material(0x1b1f26, 0.9)
const red = material(0xd94e3f, 0.7)
const hazardGlow = new T.MeshBasicMaterial({ color: 0xffb830 })
const silver = new T.MeshStandardMaterial({ color: 0xd2dce0, roughness: 0.28, metalness: 0.55 })
const foliage = [
  material(0x2d7352, 0.84), // Vibrant tropical emerald
  material(0x3f8c5e, 0.82), // Sunlit rain-tree green
  material(0xeb6942, 0.74), // Bright Yangon Sein-ban flame blossoms
]
const box = new T.BoxGeometry(1, 1, 1)

// Shared geometries
const busWheelGeo = new T.CylinderGeometry(0.49, 0.49, 0.29, 12)
const busHubGeo = new T.CylinderGeometry(0.24, 0.24, 0.32, 10)
const carWheelGeo = new T.CylinderGeometry(0.36, 0.36, 0.26, 12)
const carHubGeo = new T.CylinderGeometry(0.18, 0.18, 0.29, 10)
const headGeo = new T.SphereGeometry(0.16, 8, 6)
const umbrellaGeo = new T.ConeGeometry(0.62, 0.24, 10)
const shirtMats = [0x4c8fb0, 0xf2c96b, 0xb84a5e, 0x3b966b, 0xe87a4a, 0xdfd7c5, 0x8661a8].map(c => material(c))
const longyiMats = [0x1f3645, 0x5c2432, 0x224234, 0x3f2e24, 0x1e242c].map(c => material(c))
const umbrellaMats = [0xd94b54, 0x3680b8, 0xebaa38, 0x39946b].map(c => material(c, 0.6))
const skinMat = material(0xa87454)
const hairMat = material(0x18171a)

interface AnimatedNpc {
  group: T.Group
  leftLeg: T.Mesh
  rightLeg: T.Mesh
  leftArm: T.Mesh
  rightArm: T.Mesh
  phase: number
}

function block(parent: T.Object3D, mat: T.Material, x: number, y: number, z: number, w: number, h: number, d: number) {
  const mesh = new T.Mesh(box, mat)
  mesh.position.set(x, y, z)
  mesh.scale.set(w, h, d)
  parent.add(mesh)
  return mesh
}

function createNpc(seed: number, withUmbrella = false): AnimatedNpc {
  const group = new T.Group()
  const shirt = shirtMats[seed % shirtMats.length]
  const longyi = longyiMats[(seed * 3) % longyiMats.length]

  const leftLeg = block(group, longyi, -0.09, 0.36, 0, 0.15, 0.66, 0.18)
  const rightLeg = block(group, longyi, 0.09, 0.36, 0, 0.15, 0.66, 0.18)
  block(group, shirt, 0, 0.98, 0, 0.42, 0.62, 0.24)
  const leftArm = block(group, shirt, -0.27, 0.96, 0, 0.11, 0.48, 0.12)
  const rightArm = block(group, shirt, 0.27, 0.96, 0, 0.11, 0.48, 0.12)
  const head = new T.Mesh(headGeo, skinMat)
  head.position.y = 1.44
  group.add(head)
  block(group, hairMat, 0, 1.54, 0, 0.27, 0.12, 0.27)

  if (withUmbrella) {
    block(group, black, 0.28, 1.48, 0.04, 0.03, 0.96, 0.03)
    const canopy = new T.Mesh(umbrellaGeo, umbrellaMats[seed % umbrellaMats.length])
    canopy.position.set(0.28, 1.98, 0.04)
    group.add(canopy)
  }

  return { group, leftLeg, rightLeg, leftArm, rightArm, phase: seed * 1.7 }
}

function animateWalk(npc: AnimatedNpc, t: number, speedScale: number) {
  const swing = Math.sin(t * speedScale + npc.phase) * 0.48
  npc.leftLeg.rotation.x = swing
  npc.rightLeg.rotation.x = -swing
  npc.leftArm.rotation.x = -swing * 0.75
  npc.rightArm.rotation.x = swing * 0.75
}

function mirrorPlane(w: number, h: number, texture: T.Texture) {
  const geo = new T.PlaneGeometry(w, h)
  const uv = geo.attributes.uv
  for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i))
  return new T.Mesh(geo, new T.MeshBasicMaterial({ map: texture }))
}

function plaque(parent: T.Object3D, lines: string[], x: number, y: number, z: number, w: number, h: number, bg = '#122126', fg = '#ffd166', border = '') {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 160
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, 512, 160)
  if (border) {
    ctx.strokeStyle = border
    ctx.lineWidth = 10
    ctx.strokeRect(5, 5, 502, 150)
  }
  ctx.fillStyle = fg
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const [i, line] of lines.entries()) {
    ctx.font = 'bold ' + (lines.length > 1 ? 44 : 88) + 'px "Noto Sans Myanmar", Arial, sans-serif'
    ctx.fillText(line, 256, lines.length > 1 ? 50 + i * 64 : 84, 470)
  }
  const texture = new T.CanvasTexture(canvas)
  texture.colorSpace = T.SRGBColorSpace
  const mesh = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: texture, side: T.DoubleSide }))
  mesh.position.set(x, y, z)
  parent.add(mesh)
  return mesh
}

function createSkyTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  const grad = ctx.createLinearGradient(0, 0, 0, 256)
  grad.addColorStop(0.0, '#3b73b5') // Bright clear tropical sky blue
  grad.addColorStop(0.32, '#7596cc') // Warm pastel azure
  grad.addColorStop(0.56, '#d99890') // Rosy golden afternoon glow
  grad.addColorStop(0.75, '#f5b476') // Warm Burmese apricot sunset
  grad.addColorStop(0.88, '#ffe094') // Bright golden horizon
  grad.addColorStop(1.0, '#d8b498') // Bright ground haze
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 32, 256)
  const tex = new T.CanvasTexture(canvas)
  tex.colorSpace = T.SRGBColorSpace
  return tex
}

function busColor(line: number) {
  if (line === 37) return 0xf7b928 // YBS 37 amber-gold
  if (line === 61) return 0x2f9992 // YBS 61 emerald-teal
  if (line === 21) return 0xe04f3e // YBS 21 coral-vermilion
  if (line === 36) return 0x3b78c2 // YBS 36 twilight blue
  return 0x4b9468
}

const carPalette = [0xc94c42, 0xe8e2d5, 0x457d9e, 0x2d544c, 0xa17e5c, 0x566475]

interface TrafficVisual {
  model: T.Group
  hazards: T.Group
}

function vehicleMesh(v: Vehicle): TrafficVisual {
  const model = new T.Group()
  const hazards = new T.Group()
  hazards.visible = false
  model.add(hazards)

  if (v.kind === 'bus') {
    const body = material(busColor(v.line), 0.52, 0.12)
    const end = busHalfLength
    block(model, body, 0, 1.48, 0, 2.52, 2.66, end * 2)
    block(model, body, 0, 2.9, 0, 2.45, 0.21, end * 2 - 0.14)
    block(model, white, 0, 3.01, -0.55, 1.35, 0.16, 2.4)
    for (const side of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        // Warm illuminated passenger cabin windows glowing at dusk
        block(model, i % 2 === 0 ? litWindow : glass, side * 1.266, 2.07, -4.0 + i * 1.69, 0.025, 0.93, 1.55)
      }
      block(model, black, side * 1.267, 1.02, -3.27, 0.03, 1.84, 1.12)
      block(model, litWindow, side * 1.286, 1.51, -3.27, 0.02, 0.93, 0.91)
      // Glowing crimson taillights & bright warm headlights
      block(model, tailLightGlow, side * 0.98, 0.95, end + 0.02, 0.28, 0.24, 0.07)
      block(hazards, hazardGlow, side * 1.05, 1.24, end + 0.04, 0.36, 0.24, 0.08)
      block(model, headLightGlow, side * 0.87, 0.86, -end - 0.02, 0.42, 0.22, 0.07)
    }
    block(model, black, 0, 0.51, end + 0.04, 2.48, 0.22, 0.17)
    block(model, glass, 0, 2.07, end + 0.01, 2.17, 0.91, 0.03)
    block(model, glass, 0, 2.1, -end - 0.01, 2.19, 1.06, 0.03)
    // Backlit LED route signs
    plaque(model, ['YBS ' + v.line], 0, 2.09, end + 0.038, 1.28, 0.4, '#111820', '#ffcf58', '#ffcf58')
    plaque(model, ['YBS ' + v.line], 0, 2.41, -end - 0.038, 1.28, 0.4, '#111820', '#ffcf58', '#ffcf58').rotation.y = Math.PI
    plaque(model, ['ရန်ကုန်'], 0, 0.88, end + 0.03, 0.67, 0.21)
  } else if (v.kind === 'van') {
    const body = material([0xebe5d8, 0x62808e, 0xc2aa88][v.id % 3], 0.58, 0.1)
    block(model, body, 0, 1.08, 0, 2.05, 1.68, 5.4)
    block(model, glass, 0, 1.48, -2.71, 1.75, 0.68, 0.04)
    block(model, glass, 0, 1.48, 2.71, 1.75, 0.62, 0.04)
    for (const side of [-1, 1]) {
      block(model, glass, side * 1.03, 1.48, -1.35, 0.03, 0.65, 1.6)
      block(model, tailLightGlow, side * 0.78, 0.72, 2.72, 0.28, 0.22, 0.05)
      block(hazards, hazardGlow, side * 0.82, 0.95, 2.75, 0.32, 0.2, 0.06)
      block(model, headLightGlow, side * 0.78, 0.72, -2.72, 0.3, 0.2, 0.05)
    }
  } else {
    const isTaxi = v.kind === 'taxi'
    const body = material(isTaxi ? 0xf5f0e2 : carPalette[v.id % carPalette.length], 0.48, 0.16)
    block(model, body, 0, 0.66, 0, 1.9, 0.78, 4.5)
    block(model, glass, 0, 1.14, 0.12, 1.58, 0.66, 2.5)
    block(model, body, 0, 1.5, 0.12, 1.61, 0.16, 2.36)
    if (isTaxi) {
      // Glowing Yangon taxi roof sign at dusk
      block(model, tailLightGlow, 0, 1.67, -0.05, 0.58, 0.19, 0.22)
      block(model, lampGlow, 0, 1.67, -0.05, 0.44, 0.11, 0.24)
    }
    for (const side of [-1, 1]) {
      block(model, tailLightGlow, side * 0.72, 0.72, 2.26, 0.32, 0.18, 0.05)
      block(hazards, hazardGlow, side * 0.75, 0.9, 2.29, 0.34, 0.18, 0.06)
      block(model, headLightGlow, side * 0.72, 0.72, -2.26, 0.34, 0.18, 0.05)
    }
  }

  const isBus = v.kind === 'bus'
  const radius = isBus ? 0.49 : 0.36
  const wGeo = isBus ? busWheelGeo : carWheelGeo
  const hGeo = isBus ? busHubGeo : carHubGeo
  for (const x of isBus ? [-1.18, 1.18] : [-0.88, 0.88]) {
    for (const z of isBus ? [-3.2, 3.05] : v.kind === 'van' ? [-1.7, 1.7] : [-1.42, 1.42]) {
      for (const [geo, mat] of [[wGeo, rubber], [hGeo, silver]] as const) {
        const mesh = new T.Mesh(geo, mat)
        mesh.position.set(x, radius, z)
        mesh.rotation.z = Math.PI / 2
        model.add(mesh)
      }
    }
  }
  return { model, hazards }
}

function createCockpit(rearTex: T.Texture, leftMirrorTex: T.Texture, rightMirrorTex: T.Texture) {
  const cab = new T.Group()
  const paint = material(0xf7b928, 0.55, 0.12)
  const dashMat = material(0x1f272e, 0.8)
  const trimMat = material(0x2f3b44, 0.68)
  const rimMat = new T.MeshStandardMaterial({ color: 0x1a1f24, roughness: 0.6, metalness: 0.18 })

  // Bright cabin interior light so dashboard & steering wheel are vivid
  const cabLight = new T.PointLight(0xfff1d2, 3.6, 6.5)
  cabLight.position.set(-0.1, 2.65, -3.95)
  cab.add(cabLight)

  // Persistent twilight bus headlights + intense pulse when honking
  const headBeam = new T.PointLight(0xffe7b3, 6.5, 42)
  headBeam.position.set(0, 1.25, -6.4)
  cab.add(headBeam)

  // Windshield A-pillars, cab sides, and LIVE exterior wing mirrors
  for (const side of [-1, 1]) {
    block(cab, paint, side * 1.26, 2.42, -5.18, 0.12, 1.42, 0.14)
    block(cab, trimMat, side * 1.21, 2.42, -5.12, 0.06, 1.4, 0.08)
    block(cab, dashMat, side * 1.26, 1.64, -4.45, 0.1, 1.22, 1.68)

    block(cab, black, side * 1.34, 2.46, -5.14, 0.22, 0.04, 0.04)
    const mirrorGroup = new T.Group()
    mirrorGroup.position.set(side * 1.38, 2.32, -5.06)
    mirrorGroup.rotation.y = side < 0 ? 0.36 : -0.46
    block(mirrorGroup, black, 0, 0, -0.025, 0.24, 0.38, 0.045)
    const face = mirrorPlane(0.205, 0.34, side < 0 ? leftMirrorTex : rightMirrorTex)
    face.position.z = 0.002
    mirrorGroup.add(face)
    cab.add(mirrorGroup)
  }

  // Roof header brow & sun visor
  block(cab, paint, 0, 3.06, -5.12, 2.64, 0.24, 0.38)
  block(cab, trimMat, 0, 2.96, -4.98, 2.5, 0.12, 0.28)
  block(cab, black, -0.58, 2.86, -4.94, 0.68, 0.11, 0.03)

  // Wide panoramic LIVE rear-view mirror (re-centers automatically on mobile portrait!)
  const rearMirror = new T.Group()
  rearMirror.position.set(0.02, 2.78, -4.7)
  rearMirror.rotation.y = -0.14
  rearMirror.rotation.x = 0.12
  block(rearMirror, black, 0, 0.12, -0.04, 0.045, 0.22, 0.045)
  block(rearMirror, black, 0, 0, -0.028, 0.68, 0.22, 0.045)
  const rearFace = mirrorPlane(0.64, 0.185, rearTex)
  rearFace.position.z = 0.002
  rearMirror.add(rearFace)
  cab.add(rearMirror)

  // Dashboard
  block(cab, dashMat, 0, 1.64, -4.88, 2.52, 0.46, 0.72)
  block(cab, trimMat, 0, 1.87, -4.98, 2.52, 0.055, 0.54)
  block(cab, trimMat, -0.44, 1.94, -4.9, 0.62, 0.16, 0.32)
  block(cab, black, -0.44, 1.93, -4.75, 0.54, 0.13, 0.04)

  // Live glowing twilight instrument cluster
  const dashCanvas = document.createElement('canvas')
  dashCanvas.width = 256
  dashCanvas.height = 96
  const dashCtx = dashCanvas.getContext('2d')!
  const dashTex = new T.CanvasTexture(dashCanvas)
  dashTex.colorSpace = T.SRGBColorSpace
  const dashPanel = new T.Mesh(
    new T.PlaneGeometry(0.5, 0.15),
    new T.MeshBasicMaterial({ map: dashTex })
  )
  dashPanel.position.set(-0.44, 1.935, -4.725)
  dashPanel.rotation.x = -0.34
  cab.add(dashPanel)

  // Center console switches
  block(cab, black, 0.08, 1.89, -4.82, 0.34, 0.11, 0.2)
  block(cab, tailLightGlow, 0.0, 1.93, -4.73, 0.045, 0.03, 0.03)
  block(cab, yellow, 0.08, 1.93, -4.73, 0.045, 0.03, 0.03)
  block(cab, coolWindow, 0.16, 1.93, -4.73, 0.045, 0.03, 0.03)

  // Yellow YBS fare box
  block(cab, paint, 0.46, 1.76, -4.78, 0.28, 0.42, 0.28)
  block(cab, black, 0.46, 1.98, -4.78, 0.22, 0.03, 0.2)
  plaque(cab, ['500 ကျပ်'], 0.46, 1.9, -4.635, 0.22, 0.09, '#111c22', '#ffcf58')

  // Wipers
  for (const x of [-0.5, 0.45]) {
    const wiper = block(cab, black, x, 1.92, -5.19, 0.56, 0.024, 0.024)
    wiper.rotation.z = 0.07
  }

  // Steering column & animated city-bus steering wheel
  const column = new T.Mesh(new T.CylinderGeometry(0.045, 0.055, 0.46, 10), trimMat)
  column.position.set(-0.44, 1.72, -4.66)
  column.rotation.x = Math.PI / 2 - 0.78
  cab.add(column)

  const wheel = new T.Group()
  wheel.position.set(-0.44, 1.86, -4.56)
  wheel.rotation.x = -0.78
  const rim = new T.Mesh(new T.TorusGeometry(0.215, 0.024, 12, 32), rimMat)
  wheel.add(rim)
  const topMark = block(wheel, paint, 0, 0.215, 0, 0.05, 0.052, 0.052)
  topMark.renderOrder = 1
  const hub = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 0.044, 16), trimMat)
  hub.rotation.x = Math.PI / 2
  wheel.add(hub)
  const badge = new T.Mesh(new T.CylinderGeometry(0.034, 0.034, 0.05, 12), paint)
  badge.rotation.x = Math.PI / 2
  wheel.add(badge)
  block(wheel, silver, 0, -0.115, 0, 0.044, 0.175, 0.024)
  block(wheel, silver, -0.11, 0.015, 0, 0.175, 0.038, 0.024)
  block(wheel, silver, 0.11, 0.015, 0, 0.175, 0.038, 0.024)
  cab.add(wheel)

  let lastDashDraw = -1
  const updateDash = (speedMps: number, boarding: boolean, honking: boolean) => {
    const kmh = Math.round(speedMps * 3.6)
    const key = kmh * 4 + (boarding ? 2 : 0) + (honking ? 1 : 0)
    if (key === lastDashDraw) return
    lastDashDraw = key
    const ctx = dashCtx
    ctx.fillStyle = '#0d151c'
    ctx.fillRect(0, 0, 256, 96)

    const cx = 62, cy = 54, r = 34
    ctx.strokeStyle = '#253947'
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.arc(cx, cy, r, Math.PI * 0.78, Math.PI * 2.22)
    ctx.stroke()

    const frac = Math.min(1, kmh / 130)
    ctx.strokeStyle = kmh >= 85 ? '#ff6a45' : '#ffbe4f'
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.arc(cx, cy, r, Math.PI * 0.78, Math.PI * (0.78 + frac * 1.44))
    ctx.stroke()

    const ang = Math.PI * (0.78 + frac * 1.44)
    ctx.strokeStyle = '#ff5436'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + Math.cos(ang) * (r - 6), cy + Math.sin(ang) * (r - 6))
    ctx.stroke()

    ctx.fillStyle = '#fff3d6'
    ctx.font = 'bold 20px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(String(kmh).padStart(2, '0'), cx, cy + 12)

    ctx.fillStyle = '#ffbe4f'
    ctx.font = 'bold 18px sans-serif'
    ctx.fillText('YBS 37', 184, 28)
    ctx.fillStyle = honking ? '#ffb830' : boarding ? '#4df0a4' : '#8fb0bf'
    ctx.font = 'bold 13px "Noto Sans Myanmar", sans-serif'
    ctx.fillText(honking ? 'ဟွန်းတီးနေ' : boarding ? 'တက်နေသည်' : 'မောင်းနေသည်', 184, 52)

    const rpm = Math.min(1, (kmh % 35) / 35 * 0.7 + frac * 0.45)
    ctx.fillStyle = '#1e2f3b'
    ctx.fillRect(132, 68, 104, 12)
    ctx.fillStyle = rpm > 0.8 ? '#ff6a45' : '#4df0a4'
    ctx.fillRect(132, 68, Math.round(104 * rpm), 12)

    dashTex.needsUpdate = true
  }
  updateDash(0, false, false)

  return { cab, wheel, rearMirror, headBeam, updateDash }
}

interface StopCrowd {
  stop: Stop
  people: T.Group[]
}

export function createWorld(host: HTMLElement, drive: Drive, start: Stop) {
  const scene = new T.Scene()
  scene.background = new T.Color(0x9ab5d4)
  // Bright warm golden-hour atmospheric haze
  scene.fog = new T.FogExp2(0xe4b898, 0.0046)

  // Bright Golden-Afternoon Lighting: luminous sky, strong sunlight, and soft ambient fill
  scene.add(new T.AmbientLight(0xfff4e0, 0.6))
  scene.add(new T.HemisphereLight(0xfff5db, 0x7e7970, 2.75))
  const sunsetSun = new T.DirectionalLight(0xffdfa6, 2.85)
  sunsetSun.position.set(-28, 22, -45)
  scene.add(sunsetSun)
  const rimLight = new T.DirectionalLight(0xb8d4ff, 1.15)
  rimLight.position.set(22, 26, 30)
  scene.add(rimLight)

  // Gradient Sunset Sky Dome & Glowing Horizon Sun + Distant Golden Pagoda Silhouette (follows bus!)
  const skyGroup = new T.Group()
  const skyDome = new T.Mesh(
    new T.SphereGeometry(360, 24, 16),
    new T.MeshBasicMaterial({ map: createSkyTexture(), side: T.BackSide, fog: false })
  )
  skyGroup.add(skyDome)

  // Low glowing Burmese sunset sun disc
  const sunDisc = new T.Mesh(
    new T.CircleGeometry(22, 28),
    new T.MeshBasicMaterial({ color: 0xffd185, fog: false })
  )
  sunDisc.position.set(-48, 34, -310)
  skyGroup.add(sunDisc)

  // Distant glowing golden Shwedagon-inspired pagoda spire silhouette on the downtown horizon
  const pagoda = new T.Group()
  const pagodaGold = new T.MeshBasicMaterial({ color: 0xffc65c, fog: false })
  const base = new T.Mesh(new T.CylinderGeometry(7, 13, 12, 12), pagodaGold)
  base.position.y = 6
  const bell = new T.Mesh(new T.ConeGeometry(7.5, 22, 12), pagodaGold)
  bell.position.y = 22
  const spire = new T.Mesh(new T.ConeGeometry(2.1, 18, 10), new T.MeshBasicMaterial({ color: 0xffe9a8, fog: false }))
  spire.position.y = 38
  pagoda.add(base, bell, spire)
  pagoda.position.set(26, 2, -295)
  skyGroup.add(pagoda)
  scene.add(skyGroup)

  const camera = new T.PerspectiveCamera(68, 1, 0.1, 460)
  const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))
  renderer.outputColorSpace = T.SRGBColorSpace
  renderer.toneMapping = T.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.24
  host.append(renderer.domElement)

  let baseFov = 68
  const resize = () => {
    const { clientWidth: w, clientHeight: h } = host
    renderer.setSize(w, h)
    camera.aspect = w / Math.max(1, h)
    // Native portrait mobile framing: preserve wide horizontal road/cockpit sightlines in vertical mode
    if (camera.aspect < 0.72) {
      baseFov = 92
    } else if (camera.aspect < 1) {
      baseFov = 82
    } else {
      baseFov = 68
    }
    camera.fov = baseFov
    camera.updateProjectionMatrix()
  }
  new ResizeObserver(resize).observe(host)
  resize()

  // Live rear-view & side wing mirror render targets + cameras
  const rearTarget = new T.WebGLRenderTarget(384, 128)
  const leftMirrorTarget = new T.WebGLRenderTarget(144, 216)
  const rightMirrorTarget = new T.WebGLRenderTarget(144, 216)
  const rearCam = new T.PerspectiveCamera(60, 384 / 128, 0.4, 210)
  const leftMirrorCam = new T.PerspectiveCamera(56, 144 / 216, 0.4, 190)
  const rightMirrorCam = new T.PerspectiveCamera(56, 144 / 216, 0.4, 190)

  const length = drive.terminal.distance + 180
  block(scene, material(0x527a56, 0.9), 0, -0.26, -length / 2 + 30, 260, 0.3, length + 90)
  block(scene, asphalt, 0, -0.07, -length / 2 + 30, 16.1, 0.12, length + 90)
  for (const x of [-9.4, 9.4]) block(scene, concrete, x, -0.01, -length / 2 + 30, 2.7, 0.22, length + 90)
  for (const x of [-7.85, -0.13, 0.13, 7.85]) {
    block(scene, Math.abs(x) < 1 ? yellow : white, x, 0.013, -length / 2 + 30, 0.14, 0.018, length + 90)
  }

  const stripCount = Math.ceil((length + 45) / 9)
  const marks = new T.InstancedMesh(box, white, stripCount * 2)
  const marker = new T.Object3D()
  for (let i = 0; i < stripCount; i++) {
    for (const side of [-1, 1]) {
      marker.position.set(side * 4.1, 0.016, 33 - i * 9)
      marker.scale.set(0.14, 0.018, 3.6)
      marker.updateMatrix()
      marks.setMatrixAt(i * 2 + Number(side > 0), marker.matrix)
    }
  }
  scene.add(marks)

  const crowds: StopCrowd[] = []

  // Painted zebra crosswalks + illuminated warning signs
  for (const dist of crosswalks) {
    const z = -dist
    for (let x = -7.0; x <= 7.0; x += 1.4) {
      block(scene, white, x, 0.02, z, 0.65, 0.018, 4.4)
    }
    block(scene, yellow, 8.35, 1.8, z + 5.5, 0.13, 3.6, 0.13)
    plaque(scene, ['လူကူးမျဉ်းကျား', 'CROSSING'], 7.65, 3.3, z + 5.6, 2.4, 0.78, '#ffbe4f', '#131d24')
  }

  // Iconic Yangon overhead pedestrian footbridge / flyover gantries spanning Pyay Road
  for (const [bridgeDist, label] of [
    [1100, '၈ မိုင် · 8 MILE'],
    [2320, 'လှည်းတန်း · HLEDAN'],
    [3320, 'မြေနီကုန်း · MYAYNIGONE'],
  ] as const) {
    const bz = -bridgeDist
    for (const side of [-1, 1]) {
      block(scene, concrete, side * 9.8, 3.1, bz, 0.65, 6.2, 1.2)
    }
    block(scene, material(0x284b52, 0.7), 0, 5.9, bz, 20.6, 1.05, 1.8)
    block(scene, lampGlow, 0, 5.34, bz, 16.2, 0.08, 0.18) // Glowing underside accent strip
    plaque(scene, [label], 0, 5.92, bz + 0.94, 6.2, 0.84, '#102429', '#ffcf58', '#ffcf58')
  }

  // Active crosswalk NPCs
  const crossNpcs = drive.pedestrians.map(ped => {
    const npc = createNpc(ped.colorIndex, ped.hasUmbrella)
    npc.group.position.set(ped.x, 0.06, -ped.distance)
    scene.add(npc.group)
    return { ped, npc }
  })

  // Recycled sidewalk walking NPCs
  interface SidewalkNpc {
    npc: AnimatedNpc
    side: number
    laneOffset: number
    dir: number
    speed: number
    zPos: number
  }
  const sidewalkNpcs: SidewalkNpc[] = []
  for (let i = 0; i < 36; i++) {
    const side = i % 2 === 0 ? 1 : -1
    const npc = createNpc(i + 11, i % 4 === 0)
    const laneOffset = side * (8.65 + (i % 3) * 0.48)
    const dir = i % 3 === 0 ? -1 : 1
    const speed = 1.2 + (i % 5) * 0.22
    const zPos = -(i * 9 - 25)
    npc.group.position.set(laneOffset, 0.09, zPos)
    npc.group.rotation.y = dir > 0 ? Math.PI : 0
    scene.add(npc.group)
    sidewalkNpcs.push({ npc, side, laneOffset, dir, speed, zPos })
  }

  for (const stop of [start, ...drive.stops]) {
    const z = -stop.distance
    block(scene, material(0x313d3f, 0.5), curb, 0.015, z, 3.3, 0.02, 28)
    for (const x of [4.55, 7.75]) block(scene, yellow, x, 0.036, z, 0.16, 0.025, 28)
    for (const dz of [-14, 14]) block(scene, yellow, curb, 0.036, z + dz, 3.3, 0.025, 0.2)
    for (const dz of [-4, 4]) block(scene, black, 8.8, 1.25, z + dz, 0.15, 2.5, 0.14)
    block(scene, material(0x1f5c59, 0.65), 9, 2.55, z, 2.15, 0.2, 9.2)
    // Glowing shelter ceiling strip light so bus stops glow warmly in dusk
    block(scene, lampGlow, 8.9, 2.43, z, 0.35, 0.05, 7.8)
    block(scene, concrete, 9.38, 0.53, z, 0.72, 0.15, 4)
    plaque(scene, [stop.burmese, stop.name], 9, 2.05, z + 4.2, 2.9, 0.88, '#102429', '#ffcf58', '#34d399')

    if (stop !== start) {
      block(scene, yellow, 8.2, 2.5, z + 13.5, 0.16, 5.0, 0.16)
      plaque(scene, [stop.terminal ? 'ဂိတ်ဆုံး' : 'မှတ်တိုင်', stop.burmese], 7.4, 4.45, z + 13.6, 2.75, 0.88, '#ffbe4f', '#131d24')
    }

    if (stop !== start && !stop.terminal) {
      const people: T.Group[] = []
      for (let i = 0; i < 9; i++) {
        const npc = createNpc(i + Math.round(stop.distance / 100), i % 4 === 1)
        const person = npc.group
        const baseX = 8.42 + (i % 2) * 0.42
        const baseZ = z - 3.6 + i * 0.84
        person.position.set(baseX, 0.08, baseZ)
        person.rotation.y = -Math.PI / 2
        person.userData.baseX = baseX
        scene.add(person)
        people.push(person)
      }
      crowds.push({ stop, people })
    }
  }

  // Bright Stylized Heritage Yangon Shophouses + Neon Burmese Signs + Streetlights
  const walls = [0xe8a482, 0x73adb5, 0xf2c98d, 0xa892bd, 0xf5dbb0].map(c => material(c, 0.78))
  const neonShops = [
    ['လက်ဖက်ရည်', '#241428', '#ff9e64'],
    ['မုန့်ဟင်းခါး', '#142926', '#4df0b0'],
    ['ဆေးဆိုင်', '#142236', '#74c7ff'],
    ['စတိုးဆိုင်', '#2e1a18', '#ffd166'],
    ['ဖုန်းဆိုင်', '#241a36', '#f285c0'],
  ] as const

  const scenery = new T.Group()
  scene.add(scenery)
  const shadow = new T.Mesh(
    new T.CircleGeometry(1, 24),
    new T.MeshBasicMaterial({ color: 0x0b0f14, transparent: true, opacity: 0.38, depthWrite: false })
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.scale.set(1.6, 5.35, 1)
  shadow.position.y = 0.025
  scene.add(shadow)

  for (let i = 0; i < 20; i++) {
    for (const side of [-1, 1]) {
      const group = new T.Group()
      group.userData.segment = i
      scenery.add(group)
      const x = side * 18.3
      const h = 5.4 + (i * 7 % 16) * 0.62
      const d = 8.4 + i % 5
      block(group, walls[(i + (side > 0 ? 2 : 0)) % walls.length], x, h / 2, -2, 10, h, d)
      block(group, concrete, x, h + 0.14, -2, 10.5, 0.28, d + 0.4)

      // Glowing ground-floor shopfront windows + upper twilight lit apartments
      block(group, litWindow, x - side * 5.04, 1.15, -2, 0.08, 1.65, d * 0.68)
      for (let storey = 1; storey < 3; storey++) {
        for (let win = 0; win < 3; win++) {
          const isLit = (i + storey + win) % 3 !== 0
          block(
            group,
            isLit ? (win === 1 ? coolWindow : litWindow) : glass,
            x - side * 5.05,
            h * storey / 3 + 0.45,
            -4.6 + win * 2.5,
            0.08,
            0.85,
            1.15
          )
        }
      }

      // Awning & glowing neon Burmese shop sign
      block(group, side > 0 ? red : foliage[0], x - side * 5.4, 2.25, -2, 1.38, 0.18, d)
      if (i % 2 === 0) {
        const [shopText, bg, fg] = neonShops[(i + (side > 0 ? 1 : 0)) % neonShops.length]
        const sign = plaque(group, [shopText], x - side * 5.8, 2.95, -2, 2.8, 0.72, bg, fg, fg)
        sign.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2
      }

      // Tropical Yangon tree (mix of monsoon emerald & flame-orange blossom trees!)
      block(group, material(0x47382e), side * 11.1, 1.25, 6.8, 0.35, 2.5, 0.36)
      const canopy = new T.Mesh(new T.IcosahedronGeometry(1.7, 1), foliage[i % foliage.length])
      canopy.position.set(side * 11.1, 3.25, 6.8)
      canopy.scale.set(1.22, 0.85, 1.25)
      group.add(canopy)

      // Glowing warm amber Yangon streetlamp every 2 segments
      if (i % 2 === 1) {
        block(group, black, side * 8.45, 3.1, 2.2, 0.14, 6.2, 0.14)
        block(group, black, side * 7.6, 6.1, 2.2, 1.8, 0.12, 0.12)
        block(group, lampGlow, side * 6.85, 5.96, 2.2, 0.56, 0.14, 0.26)
      }

      // Shopkeepers / locals chatting under awnings
      if (i % 2 === 0) {
        const local = createNpc(i * 3 + (side > 0 ? 1 : 5), false).group
        local.position.set(side * 12.1, 0.08, -1.2)
        local.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2
        group.add(local)
      }
    }
  }

  for (const [name, burmese, distance] of [
    ['Pyay Road', 'ပြည်လမ်း', 360],
    ['Inya Lake', 'အင်းလျားကန်', 2050],
    ['Downtown Yangon', 'ရန်ကုန်မြို့လယ်', 4160],
  ] as const) {
    block(scene, black, 9.55, 2.15, -distance, 0.13, 4.3, 0.13)
    plaque(scene, [burmese, name], 9.55, 3.6, -distance + 0.09, 3.65, 1.25, '#112229', '#ffcf58', '#34d399')
  }

  const terminalZ = -drive.terminal.distance
  const office = material(0xd8bfae, 0.72)
  block(scene, office, 18.3, 8.4, terminalZ - 6, 10, 16.8, 25)
  for (let floor = 0; floor < 6; floor++) {
    block(scene, white, 18.25, 1.1 + floor * 2.65, terminalZ - 6, 10.45, 0.18, 25.3)
    for (let win = 0; win < 7; win++) {
      block(scene, (floor + win) % 2 === 0 ? litWindow : coolWindow, 13.27, 2.1 + floor * 2.65, terminalZ + 3 - win * 3, 0.08, 1.25, 1.44)
    }
  }
  plaque(scene, ['ခြောက်ထပ်ရုံး', 'ဂိတ်ဆုံး'], 9, 4.4, terminalZ + 4.2, 3.65, 1.25, '#112229', '#ffcf58', '#ffcf58')

  const { cab: player, wheel, rearMirror, headBeam, updateDash } = createCockpit(
    rearTarget.texture,
    leftMirrorTarget.texture,
    rightMirrorTarget.texture
  )
  scene.add(player)

  const traffic = drive.vehicles.map(v => {
    const vis = vehicleMesh(v)
    scene.add(vis.model)
    return vis
  })

  const frame = () => {
    player.position.set(drive.lateral, 0, -drive.distance)
    skyGroup.position.set(drive.lateral, 0, -drive.distance)
    wheel.rotation.z = -drive.steer * 1.15
    headBeam.intensity = 6.5 + drive.hornPulse * 28
    updateDash(drive.speed, Boolean(drive.dwellingAt && drive.dwellingAt.waiting > 0), drive.hornActive)
    shadow.position.x = drive.lateral
    shadow.position.z = -drive.distance

    const blink = Math.floor(performance.now() / 110) % 2 === 0
    drive.vehicles.forEach((v, i) => {
      const { model, hazards } = traffic[i]
      const visible = Math.abs(v.distance - drive.distance) < 210
      model.visible = visible
      if (!visible) return
      model.position.set(v.lane, 0, -v.distance)
      const laneDiff = v.targetLane - v.lane
      const turnAngle = Math.abs(laneDiff) > 0.05 ? -Math.sign(laneDiff) * 0.14 : 0
      model.rotation.y = (v.baseCruiseSpeed < 0 ? Math.PI : 0) + turnAngle
      hazards.visible = v.flashTimer > 0 && blink
    })

    const now = performance.now() * 0.008
    const timeSec = performance.now() * 0.001

    for (const { ped, npc } of crossNpcs) {
      const visible = Math.abs(ped.distance - drive.distance) < 190
      npc.group.visible = visible
      if (!visible) continue
      npc.group.position.set(ped.x, 0.06, -ped.distance)
      npc.group.rotation.y = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2
      animateWalk(npc, timeSec, ped.hurrying ? 12.5 : 5.5)
    }

    const busZ = -drive.distance
    for (const s of sidewalkNpcs) {
      if (drive.status === 'driving') {
        s.zPos -= s.dir * s.speed * (1 / 60)
      }
      while (s.zPos > busZ + 55) s.zPos -= 230
      while (s.zPos < busZ - 175) s.zPos += 230
      s.npc.group.position.set(s.laneOffset, 0.09, s.zPos)
      s.npc.group.rotation.y = s.dir > 0 ? Math.PI : 0
      animateWalk(s.npc, timeSec, 4.8)
    }

    for (const { stop, people } of crowds) {
      const boardingHere = drive.dwellingAt === stop && stop.waiting > 0
      for (let i = 0; i < people.length; i++) {
        const person = people[i]
        person.visible = i < stop.waiting
        if (!person.visible) continue
        if (boardingHere && i === stop.waiting - 1) {
          person.position.x = person.userData.baseX - 0.65
          person.position.y = 0.08 + Math.abs(Math.sin(now * 2)) * 0.12
        } else {
          person.position.x = person.userData.baseX
          person.position.y = 0.08
        }
      }
    }

    const first = Math.floor(drive.distance / 18) - 3
    for (const group of scenery.children) {
      const offset = (group.userData.segment - first % 20 + 20) % 20
      const segment = (first + offset) * 18
      group.position.z = -segment
      group.visible = Math.abs(segment - drive.terminal.distance) > 24
      group.scale.y = segment > myaynigone ? 1.35 : segment < 900 ? 0.78 : 1
    }

    // 1. Live rear-view & side wing mirrors
    player.visible = false
    rearCam.position.set(drive.lateral, 2.7, -drive.distance + 5.25)
    rearCam.lookAt(drive.lateral, 2.0, -drive.distance + 55)
    renderer.setRenderTarget(rearTarget)
    renderer.render(scene, rearCam)

    leftMirrorCam.position.set(drive.lateral - 1.48, 2.32, -drive.distance - 4.4)
    leftMirrorCam.lookAt(drive.lateral - 3.6, 1.5, -drive.distance + 38)
    renderer.setRenderTarget(leftMirrorTarget)
    renderer.render(scene, leftMirrorCam)

    rightMirrorCam.position.set(drive.lateral + 1.48, 2.32, -drive.distance - 4.4)
    rightMirrorCam.lookAt(drive.lateral + 2.8, 1.4, -drive.distance + 36)
    renderer.setRenderTarget(rightMirrorTarget)
    renderer.render(scene, rightMirrorCam)

    renderer.setRenderTarget(null)
    player.visible = true

    // 2. Portrait-adaptive driver POV camera (pulls back & centers cleanly in portrait so wheel + mirror + full road fit!)
    const isPortrait = camera.aspect < 0.85
    rearMirror.position.set(isPortrait ? -0.26 : 0.02, isPortrait ? 2.74 : 2.78, -4.7)
    rearMirror.rotation.y = isPortrait ? 0 : -0.14

    const speedFovBoost = Math.min(7, Math.max(0, (drive.speed * 3.6 - 50) * 0.075))
    const desiredFov = baseFov + speedFovBoost
    if (Math.abs(camera.fov - desiredFov) > 0.05) {
      camera.fov = desiredFov
      camera.updateProjectionMatrix()
    }
    const shakeX = drive.crashShake > 0 ? (Math.random() - 0.5) * 0.24 * drive.crashShake : 0
    const shakeY = drive.crashShake > 0 ? (Math.random() - 0.5) * 0.18 * drive.crashShake : 0
    const bob = Math.sin(drive.distance * 0.7) * Math.min(1, drive.speed / 18) * 0.015

    const camX = isPortrait ? -0.32 : -0.44
    const camZ = isPortrait ? -3.28 : -3.7
    const lookX = isPortrait ? -0.24 : -0.36
    camera.position.set(drive.lateral + camX + shakeX, 2.38 + bob + shakeY, -drive.distance + camZ)
    camera.lookAt(
      drive.lateral + lookX + drive.steer * 0.65,
      (isPortrait ? 1.62 : 1.52) + bob * 0.4 + drive.pitch * 18,
      -drive.distance - 16
    )
    renderer.render(scene, camera)
  }
  return frame
}
