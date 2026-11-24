export interface Stop {
  name: string
  burmese: string
  distance: number
  passengers: number
  waiting: number
  initial: number
  stolen: number
  terminal?: boolean
}

export interface Vehicle {
  id: number
  line: number
  kind: 'bus' | 'car' | 'taxi' | 'van'
  lane: number
  startLane: number
  targetLane: number
  distance: number
  start: number
  speed: number
  cruiseSpeed: number
  baseCruiseSpeed: number
  dwell: number
  stubbornness: number
  honksReceived: number
  reaction: 'yield' | 'boost'
  reacted: boolean
  flashTimer: number
  raidedStops: Set<number>
}

export interface Pedestrian {
  id: number
  distance: number
  x: number
  startX: number
  dir: number
  speed: number
  baseSpeed: number
  hurrying: boolean
  colorIndex: number
  hasUmbrella: boolean
}

export interface Input {
  left: boolean
  right: boolean
  gas: boolean
  brake: boolean
  horn: boolean
}

export type TickEventKind = 'fare' | 'bonus' | 'steal' | 'horn' | 'crash' | 'door' | 'info'
export interface TickEvent {
  kind: TickEventKind
  message: string
}

export const lane = 2.05
export const curb = 6.15
export const busHalfLength = 5.2
export const busHalfWidth = 1.27
export const FARE_PER_PASSENGER = 500

export class Drive {
  distance = 0
  lateral = curb
  speed = 0
  steer = 0
  pitch = 0
  hornActive = false
  hornPulse = 0
  crashShake = 0
  failure = 'တိုက်မိပါပြီ'
  fares = 0
  bonus = 0
  passengersPicked = 0
  passengersStolen = 0
  status: 'ready' | 'driving' | 'paused' | 'crashed' | 'arrived' = 'ready'
  boarded = new Set<Stop>()
  passed = new Set<number>()
  private passAttempts = new Map<number, boolean>()
  private dwell = 0
  private boardTimer = 0
  private prevHorn = false
  private hornRepeatTimer = 0
  dwellingAt?: Stop
  boardingCount = 0

  constructor(readonly stops: Stop[], readonly vehicles: Vehicle[], readonly pedestrians: Pedestrian[] = []) {
    this.randomizeStops()
  }

  get terminal() { return this.stops[this.stops.length - 1] }

  get nextStop() {
    return this.stops.find(stop => !this.boarded.has(stop) && (stop.terminal || this.distance < stop.distance + 14)) ?? this.terminal
  }

  randomizeStops() {
    for (const stop of this.stops) {
      if (stop.terminal) {
        stop.passengers = stop.waiting = stop.initial = stop.stolen = 0
      } else {
        const count = 3 + Math.floor(Math.random() * 7) // 3 to 9 passengers
        stop.passengers = count
        stop.waiting = count
        stop.initial = count
        stop.stolen = 0
      }
    }
  }

  reset() {
    this.distance = this.speed = this.steer = this.pitch = this.fares = this.bonus = this.dwell = this.boardTimer = 0
    this.passengersPicked = this.passengersStolen = this.boardingCount = 0
    this.hornActive = this.prevHorn = false
    this.hornPulse = this.hornRepeatTimer = this.crashShake = 0
    this.lateral = curb
    this.status = 'ready'
    this.failure = 'တိုက်မိပါပြီ'
    this.boarded.clear()
    this.passed.clear()
    this.passAttempts.clear()
    this.dwellingAt = undefined
    this.randomizeStops()
    for (const vehicle of this.vehicles) {
      vehicle.distance = vehicle.start
      vehicle.lane = vehicle.startLane
      vehicle.targetLane = vehicle.startLane
      vehicle.cruiseSpeed = vehicle.baseCruiseSpeed
      vehicle.speed = vehicle.baseCruiseSpeed
      vehicle.dwell = 0
      vehicle.honksReceived = 0
      vehicle.reacted = false
      vehicle.flashTimer = 0
      vehicle.raidedStops.clear()
    }
    for (const ped of this.pedestrians) {
      ped.x = ped.startX
      ped.dir = ped.startX > 0 ? -1 : 1
      ped.speed = ped.baseSpeed
      ped.hurrying = false
    }
  }

  private vehicleHalfLength(v: Vehicle) {
    if (v.kind === 'bus') return busHalfLength
    if (v.kind === 'van') return 2.75
    return 2.25
  }

  private vehicleHalfWidth(v: Vehicle) {
    if (v.kind === 'bus') return busHalfWidth
    if (v.kind === 'van') return 1.05
    return 0.95
  }

  private isLaneClear(targetLane: number, atDistance: number, ignoreId: number) {
    for (const other of this.vehicles) {
      if (other.id === ignoreId) continue
      if (Math.abs(other.lane - targetLane) > 1.8 && Math.abs(other.targetLane - targetLane) > 1.8) continue
      if (Math.abs(other.distance - atDistance) < 16) return false
    }
    return true
  }

  private triggerHorn(): TickEvent | undefined {
    this.hornPulse = 1

    // Honking near a crosswalk makes crossing pedestrians sprint out of the road!
    let hurriedPed = false
    for (const ped of this.pedestrians) {
      const delta = ped.distance - this.distance
      if (delta > 3 && delta < 85 && Math.abs(ped.x) < 8.5) {
        ped.hurrying = true
        ped.speed = 5.4
        // Sprint away from the bus's lateral lane toward the safer side
        ped.dir = ped.x >= this.lateral ? 1 : -1
        hurriedPed = true
      }
    }

    // Find closest same-direction vehicle directly ahead in our lane
    let target: Vehicle | undefined
    let bestDelta = 75
    for (const v of this.vehicles) {
      if (v.baseCruiseSpeed <= 0) continue
      const delta = v.distance - this.distance
      if (delta < 7 || delta > bestDelta) continue
      if (Math.abs(v.lane - this.lateral) > 2.35) continue
      bestDelta = delta
      target = v
    }
    if (!target) {
      return hurriedPed ? { kind: 'horn', message: 'လမ်းဖြတ်ကူးသူ အမြန်ရှောင်သွားပြီ!' } : undefined
    }

    target.flashTimer = 0.65
    target.honksReceived += 1

    // Some stubborn drivers ignore the first 1-2 honks and need multiple honks
    if (target.honksReceived < target.stubbornness) {
      const remaining = target.stubbornness - target.honksReceived
      return {
        kind: 'horn',
        message: remaining === 1 ? 'ရှေ့ကားမဖယ်သေးပါ · ထပ်ဟွန်းတီးပါ!' : 'ခေါင်းမာသောကား · ဟွန်းဆက်တိုက်တီးပါ!',
      }
    }

    // React: move aside to adjacent same-direction lane OR speed up!
    const otherLane = Math.abs(target.targetLane - lane) < 1.0 ? curb : lane
    const canYield = target.dwell <= 0 && this.isLaneClear(otherLane, target.distance, target.id)
    if ((target.reaction === 'yield' || target.reacted) && canYield && Math.abs(target.targetLane - otherLane) > 1) {
      target.targetLane = otherLane
      target.reacted = true
      return {
        kind: 'horn',
        message: target.kind === 'bus' ? `YBS ${target.line} ဘေးဖယ်ပေးလိုက်ပြီ!` : 'ရှေ့ကား ဘေးဖယ်ပေးလိုက်ပြီ!',
      }
    }

    // Otherwise, accelerate away faster to clear the road
    target.cruiseSpeed = Math.min(28, Math.max(target.cruiseSpeed + 6.5, this.speed + 4.5))
    target.dwell = 0
    target.reacted = true
    return {
      kind: 'horn',
      message: target.kind === 'bus' ? `YBS ${target.line} အရှိန်တင်မောင်းသွားပြီ!` : 'ရှေ့ကား အရှိန်တင်မောင်းသွားပြီ!',
    }
  }

  tick(dt: number, input: Input): TickEvent | undefined {
    this.crashShake = Math.max(0, this.crashShake - dt * 2.5)
    this.hornPulse = Math.max(0, this.hornPulse - dt * 3.5)
    if (this.status !== 'driving') {
      this.hornActive = false
      return
    }
    let event: TickEvent | undefined

    // Horn edge detection + repeat pulse if held continuously
    this.hornActive = input.horn
    if (input.horn) {
      if (!this.prevHorn) {
        event = this.triggerHorn() ?? event
        this.hornRepeatTimer = 0.72
      } else {
        this.hornRepeatTimer -= dt
        if (this.hornRepeatTimer <= 0) {
          event = this.triggerHorn() ?? event
          this.hornRepeatTimer = 0.72
        }
      }
    } else {
      this.hornRepeatTimer = 0
    }
    this.prevHorn = input.horn

    // Uncapped high-speed acceleration with realistic aerodynamic drag & strong brakes
    const drag = 0.0012 * this.speed * this.speed + 0.35
    const accel = input.brake
      ? -15.5
      : input.gas
        ? Math.max(1.4, 5.4 - drag)
        : -(0.75 + drag * 0.6)
    const prevSpeed = this.speed
    this.speed = Math.max(0, this.speed + accel * dt)
    this.distance += this.speed * dt

    // Subtle cab pitch on hard braking / acceleration
    const targetPitch = input.brake && prevSpeed > 1 ? -0.022 : input.gas ? 0.012 : 0
    this.pitch += (targetPitch - this.pitch) * Math.min(1, dt * 8)

    const steer = Number(input.right) - Number(input.left)
    this.steer += (steer - this.steer) * Math.min(1, dt * 11)
    const steerScale = this.speed > 0.25 ? Math.min(5.8, 1.3 + this.speed * 0.34) : 0
    this.lateral += steer * steerScale * dt

    const bay = this.stops.find(stop => Math.abs(stop.distance - this.distance) < 30)

    // Boarding stops are optional (player decision); only passing the terminal ends the run
    if (this.distance > this.terminal.distance + 24) {
      this.failure = `ဂိတ်ဆုံး (${this.terminal.burmese}) ကို ကျော်သွားပါပြီ`
      this.status = 'crashed'
      return { kind: 'crash', message: this.failure }
    }

    if (this.lateral < -7.15 || this.lateral > (bay || this.distance < 36 ? 7.15 : 6.8)) {
      this.failure = 'လမ်းဘေးပလက်ဖောင်းနှင့် တိုက်မိပါပြီ'
      this.status = 'crashed'
      this.crashShake = 1
      return { kind: 'crash', message: this.failure }
    }

    // Traffic simulation: lane-yielding, rival bus passenger stealing, and car-following spacing
    for (let i = 0; i < this.vehicles.length; i++) {
      const v = this.vehicles[i]
      if (v.flashTimer > 0) v.flashTimer = Math.max(0, v.flashTimer - dt)

      // Smoothly change lanes if yielded to horn
      const laneDiff = v.targetLane - v.lane
      if (Math.abs(laneDiff) > 0.02) {
        v.lane += Math.sign(laneDiff) * Math.min(Math.abs(laneDiff), 3.4 * dt)
      }

      if (v.dwell > 0) {
        v.dwell = Math.max(0, v.dwell - dt)
        v.speed = Math.max(0, v.speed - 14 * dt)
      } else {
        // Rival bus steals passengers when arriving at a stop in the curb lane
        if (v.kind === 'bus' && v.line !== 37 && v.baseCruiseSpeed > 0 && Math.abs(v.lane - curb) < 0.8) {
          for (let s = 0; s < this.stops.length; s++) {
            const stop = this.stops[s]
            if (stop.terminal || this.boarded.has(stop) || stop.waiting <= 0 || v.raidedStops.has(s)) continue
            if (Math.abs(v.distance - stop.distance) < 5.5) {
              v.raidedStops.add(s)
              v.dwell = 1.8
              const stolen = Math.min(stop.waiting, 1 + Math.floor(Math.random() * 3))
              stop.waiting -= stolen
              stop.stolen += stolen
              this.passengersStolen += stolen
              if (stop.distance > this.distance - 30 && stop.distance < this.distance + 1200) {
                event = {
                  kind: 'steal',
                  message: `YBS ${v.line} က ${stop.burmese} တွင် ခရီးသည် ${stolen} ဦး လုသွားပြီ!`,
                }
              }
              break
            }
          }
        }

        // Car-following spacing in same lane
        let targetSpeed = v.cruiseSpeed
        if (v.baseCruiseSpeed > 0) {
          for (let j = 0; j < this.vehicles.length; j++) {
            if (i === j) continue
            const ahead = this.vehicles[j]
            if (Math.abs(ahead.lane - v.lane) > 1.2 || ahead.baseCruiseSpeed <= 0) continue
            const gap = ahead.distance - v.distance - (this.vehicleHalfLength(v) + this.vehicleHalfLength(ahead))
            if (gap > 0 && gap < 14) {
              targetSpeed = Math.min(targetSpeed, Math.max(0, ahead.speed * (gap / 14)))
            }
          }
          // Yield when approaching player from behind so traffic doesn't unfairly rear-end during boarding
          if (Math.abs(this.lateral - v.lane) < 1.8) {
            const playerGap = this.distance - v.distance - (this.vehicleHalfLength(v) + busHalfLength)
            if (playerGap > 0 && playerGap < 18 && this.speed < v.speed) {
              targetSpeed = Math.min(targetSpeed, Math.max(0, this.speed * 0.9))
            }
          }
        }
        v.speed += (targetSpeed - v.speed) * Math.min(1, dt * 3.5)
      }

      v.distance += v.speed * dt

      // Collision check with player
      const delta = this.distance - v.distance
      const halfLength = this.vehicleHalfLength(v)
      const halfWidth = this.vehicleHalfWidth(v)
      if (Math.abs(delta) < busHalfLength + halfLength - 0.15 &&
          Math.abs(this.lateral - v.lane) < busHalfWidth + halfWidth - 0.12) {
        this.failure = v.kind === 'bus' ? `YBS ${v.line} နှင့် တိုက်မိပါပြီ` : 'ရှေ့ကားနှင့် တိုက်မိပါပြီ'
        this.status = 'crashed'
        this.crashShake = 1
        return { kind: 'crash', message: this.failure }
      }
    }

    // Crosswalk pedestrian NPCs: walk back and forth across marked zebra crossings when nearby
    for (const ped of this.pedestrians) {
      const distAhead = ped.distance - this.distance
      if (distAhead < -35 || distAhead > 165) continue
      ped.x += ped.dir * ped.speed * dt
      if (ped.x > 9.4) {
        ped.x = 9.4
        ped.dir = -1
        ped.hurrying = false
        ped.speed = ped.baseSpeed
      } else if (ped.x < -9.4) {
        ped.x = -9.4
        ped.dir = 1
        ped.hurrying = false
        ped.speed = ped.baseSpeed
      }
      // Collision check if pedestrian is on the road surface
      if (Math.abs(ped.x) < 7.75 &&
          Math.abs(this.distance - ped.distance) < busHalfLength + 0.35 &&
          Math.abs(this.lateral - ped.x) < busHalfWidth + 0.35) {
        this.failure = 'လူကူးမျဉ်းကျားတွင် လမ်းဖြတ်ကူးသူကို တိုက်မိပါပြီ!'
        this.status = 'crashed'
        this.crashShake = 1
        return { kind: 'crash', message: this.failure }
      }
    }

    // Clean overtake bonus for passing a rival YBS line
    for (const vehicle of this.vehicles) {
      if (vehicle.kind !== 'bus' || vehicle.line === 37 || vehicle.baseCruiseSpeed <= 0 || this.passed.has(vehicle.id)) continue
      const delta = this.distance - vehicle.distance
      const inHomeLane = Math.abs(this.lateral - vehicle.lane) < 1.0
      const inPassingLane = Math.abs(this.lateral - lane) < 1.35 || this.lateral < 0.2
      if (delta > 85 || delta < -90) this.passAttempts.delete(vehicle.id)
      if (inHomeLane && delta >= -85 && delta <= -11) this.passAttempts.set(vehicle.id, false)
      if (inPassingLane && Math.abs(delta) <= 9 && this.passAttempts.has(vehicle.id)) {
        this.passAttempts.set(vehicle.id, true)
      }
      if (inHomeLane && delta >= 12 && delta <= 85 && this.passAttempts.get(vehicle.id)) {
        this.bonus += 100
        this.passed.add(vehicle.id)
        this.passAttempts.delete(vehicle.id)
        event = { kind: 'bonus', message: `+100 ကျပ် · YBS ${vehicle.line} ကို ကျော်တက်နိုင်ပြီ!` }
      }
    }

    // Optional stop & one-by-one passenger boarding (500 MMK per passenger)
    const stoppedAt = bay && !this.boarded.has(bay) && Math.abs(bay.distance - this.distance) <= 13 &&
      Math.abs(this.lateral - curb) <= 1.25 && this.speed < 0.35 ? bay : undefined
    if (stoppedAt !== this.dwellingAt) {
      this.dwell = 0
      this.boardTimer = 0
      this.boardingCount = 0
      if (stoppedAt && !stoppedAt.terminal && stoppedAt.waiting > 0) {
        event = { kind: 'door', message: `${stoppedAt.burmese} မှတ်တိုင် · တံခါးဖွင့်ပြီ` }
      }
    }
    this.dwellingAt = stoppedAt
    if (!stoppedAt) return event

    this.dwell += dt
    if (stoppedAt.terminal) {
      if (this.dwell >= 0.7) {
        this.boarded.add(stoppedAt)
        this.status = 'arrived'
        return { kind: 'bonus', message: `${stoppedAt.burmese} ဂိတ်ဆုံးသို့ ရောက်ရှိပါပြီ!` }
      }
      return event
    }

    if (stoppedAt.waiting > 0) {
      this.boardTimer += dt
      if (this.boardTimer >= 0.32) {
        this.boardTimer -= 0.32
        stoppedAt.waiting -= 1
        this.boardingCount += 1
        this.passengersPicked += 1
        this.fares += FARE_PER_PASSENGER
        if (stoppedAt.waiting === 0) {
          this.boarded.add(stoppedAt)
          return {
            kind: 'fare',
            message: `+${(this.boardingCount * FARE_PER_PASSENGER).toLocaleString('en')} ကျပ် · ${stoppedAt.burmese} မှတ်တိုင် ခရီးသည် ${this.boardingCount} ဦးလုံးတက်ပြီးပြီ!`,
          }
        }
        return {
          kind: 'fare',
          message: `+500 ကျပ် · ခရီးသည်တက်ပြီ (${this.boardingCount}/${this.boardingCount + stoppedAt.waiting})`,
        }
      }
    } else if (this.dwell >= 0.5) {
      this.boarded.add(stoppedAt)
      return { kind: 'info', message: `${stoppedAt.burmese} မှတ်တိုင်တွင် ခရီးသည်မကျန်တော့ပါ` }
    }
    return event
  }
}
