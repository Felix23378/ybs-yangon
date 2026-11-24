import { curb, lane, type Pedestrian, type Stop, type Vehicle } from './drive'

export const start: Stop = {
  name: 'Htauk Kyant',
  burmese: 'ထောက်ကြန့်',
  distance: 0,
  passengers: 0,
  waiting: 0,
  initial: 0,
  stolen: 0,
}

export const stops: Stop[] = [
  { name: 'Saw Bwar Gyi Gone', burmese: 'စော်ဘွားကြီးကုန်း', distance: 720, passengers: 5, waiting: 5, initial: 5, stolen: 0 },
  { name: '8 Mile', burmese: '၈ မိုင်', distance: 1580, passengers: 6, waiting: 6, initial: 6, stolen: 0 },
  { name: 'Hledan', burmese: 'လှည်းတန်း', distance: 2620, passengers: 7, waiting: 7, initial: 7, stolen: 0 },
  { name: 'Myaynigone', burmese: 'မြေနီကုန်း', distance: 3580, passengers: 5, waiting: 5, initial: 5, stolen: 0 },
  { name: 'Six-Storey Office', burmese: 'ခြောက်ထပ်ရုံး', distance: 4680, passengers: 0, waiting: 0, initial: 0, stolen: 0, terminal: true },
]

export const myaynigone = 3580

// Marked zebra crosswalks along Pyay Road with active crossing NPCs
export const crosswalks = [460, 1180, 1980, 2980, 3980]

export function makePedestrians(): Pedestrian[] {
  const rand = seeded(9042)
  const peds: Pedestrian[] = []
  for (const dist of crosswalks) {
    const count = 2
    for (let k = 0; k < count; k++) {
      const fromRight = (k + Math.floor(dist)) % 2 === 0
      const startX = fromRight ? 7.4 + rand() * 1.8 : -(7.4 + rand() * 1.8)
      const baseSpeed = 1.6 + rand() * 0.75
      peds.push({
        id: peds.length + 1,
        distance: dist + (k === 0 ? -1.4 : 1.5),
        x: startX,
        startX,
        dir: fromRight ? -1 : 1,
        speed: baseSpeed,
        baseSpeed,
        hurrying: false,
        colorIndex: peds.length,
        hasUmbrella: rand() < 0.38,
      })
    }
  }
  return peds
}

// Deterministic-friendly pseudo-random sequence for rich, fair crowded Yangon traffic
function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

export function makeTraffic(): Vehicle[] {
  const rand = seeded(3761)
  const traffic: Vehicle[] = []
  const rivalLines = [61, 21, 36]

  function add(kind: Vehicle['kind'], line: number, lanePosition: number, startPosition: number, speed: number) {
    // Mix of responsive drivers (1 honk) and stubborn drivers (2-3 honks needed)
    const stubRoll = rand()
    const stubbornness = kind === 'bus'
      ? (stubRoll < 0.4 ? 2 : 3)
      : stubRoll < 0.52 ? 1 : stubRoll < 0.82 ? 2 : 3
    const reaction: 'yield' | 'boost' = rand() < 0.6 ? 'yield' : 'boost'
    traffic.push({
      id: traffic.length + 1,
      line,
      kind,
      lane: lanePosition,
      startLane: lanePosition,
      targetLane: lanePosition,
      distance: startPosition,
      start: startPosition,
      speed,
      cruiseSpeed: speed,
      baseCruiseSpeed: speed,
      dwell: 0,
      stubbornness,
      honksReceived: 0,
      reaction,
      reacted: false,
      flashTimer: 0,
      raidedStops: new Set(),
    })
  }

  // 1. Crowded curb-lane traffic (curb = 6.15): rival YBS buses competing for stops + taxis, vans, cars
  let z = 95
  let rivalIndex = 0
  while (z < 4580) {
    // Place rival YBS buses ahead of stops so they actively race to steal passengers
    const roll = rand()
    if (roll < 0.28) {
      const line = rivalLines[rivalIndex++ % rivalLines.length]
      add('bus', line, curb, z, 9.2 + rand() * 3.4)
      z += 62 + rand() * 44
    } else if (roll < 0.36) {
      add('bus', 37, curb, z, 8.8 + rand() * 2.5)
      z += 60 + rand() * 42
    } else if (roll < 0.62) {
      add('taxi', 0, curb, z, 8.2 + rand() * 4.2)
      z += 42 + rand() * 38
    } else if (roll < 0.8) {
      add('van', 0, curb, z, 7.6 + rand() * 3.2)
      z += 48 + rand() * 40
    } else {
      add('car', 0, curb, z, 8.5 + rand() * 4.5)
      z += 40 + rand() * 36
    }
  }

  // 2. Crowded inner same-direction lane (lane = 2.05): fast cars, taxis, vans, and occasional overtaking buses
  z = 135
  while (z < 4620) {
    const roll = rand()
    if (roll < 0.14) {
      const line = rivalLines[rivalIndex++ % rivalLines.length]
      add('bus', line, lane, z, 11.8 + rand() * 3.8)
      z += 74 + rand() * 56
    } else if (roll < 0.45) {
      add('taxi', 0, lane, z, 12.2 + rand() * 5.2)
      z += 48 + rand() * 46
    } else if (roll < 0.68) {
      add('van', 0, lane, z, 10.8 + rand() * 4.0)
      z += 52 + rand() * 48
    } else {
      add('car', 0, lane, z, 13.0 + rand() * 6.0)
      z += 46 + rand() * 44
    }
  }

  // 3. Dense oncoming traffic in both oncoming lanes (-lane and -curb) all the way up to 11,500m
  for (const oncomingLane of [-lane, -curb]) {
    z = oncomingLane === -lane ? 180 : 240
    while (z < 11500) {
      const roll = rand()
      if (roll < 0.18) {
        const line = rand() < 0.25 ? 37 : rivalLines[Math.floor(rand() * rivalLines.length)]
        add('bus', line, oncomingLane, z, -(9.5 + rand() * 3.5))
        z += 85 + rand() * 75
      } else if (roll < 0.5) {
        add('taxi', 0, oncomingLane, z, -(11.5 + rand() * 4.5))
        z += 52 + rand() * 58
      } else if (roll < 0.72) {
        add('van', 0, oncomingLane, z, -(10.2 + rand() * 3.5))
        z += 60 + rand() * 60
      } else {
        add('car', 0, oncomingLane, z, -(12.0 + rand() * 5.0))
        z += 50 + rand() * 55
      }
    }
  }

  return traffic
}
