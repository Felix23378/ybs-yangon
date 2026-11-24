// Procedural Web Audio sound engine tuned for a heavy diesel YBS city bus
export class SoundEngine {
  private ctx?: AudioContext
  private master?: GainNode
  private noiseBuffer?: AudioBuffer

  // Heavy diesel engine nodes
  private dieselOsc?: OscillatorNode
  private subOsc?: OscillatorNode
  private chugLfo?: OscillatorNode
  private chugDepth?: GainNode
  private dieselFilter?: BiquadFilterNode
  private dieselGain?: GainNode
  private clatterFilter?: BiquadFilterNode
  private clatterGain?: GainNode
  private tireFilter?: BiquadFilterNode
  private tireGain?: GainNode

  // Deep dual-tone bus air horn
  private hornOsc1?: OscillatorNode
  private hornOsc2?: OscillatorNode
  private hornGain?: GainNode

  // Air-brake hiss
  private brakeGain?: GainNode
  private wasBraking = false
  private prevSpeed = 0

  // Built-in 1980s Myanmar Stereo Cassette Radio (zero-latency Web Audio)
  private radioGain?: GainNode
  private radioTimer?: number
  private radioStep = 0
  radioPlaying = false
  radioTrackIndex = 0
  readonly cassetteTracks = [
    {
      title: 'ပြည်လမ်း ညနေခင်း (80s Stereo)',
      bpm: 94,
      // Nostalgic Burmese major-pentatonic / stereo acoustic progression (C - Am - F - G)
      melody: [523.25, 0, 587.33, 659.25, 783.99, 0, 659.25, 587.33, 523.25, 440, 0, 523.25, 587.33, 659.25, 587.33, 0],
      bass: [130.81, 130.81, 110.0, 110.0, 87.31, 87.31, 98.0, 98.0],
      chords: [
        [261.63, 329.63, 392.0],
        [220.0, 261.63, 329.63],
        [174.61, 220.0, 261.63],
        [196.0, 246.94, 293.66],
      ],
    },
    {
      title: 'မဟာဆန်သော သံစဉ် (80s Organ)',
      bpm: 86,
      melody: [659.25, 587.33, 523.25, 0, 440, 523.25, 587.33, 0, 783.99, 659.25, 587.33, 523.25, 440, 392.0, 440, 0],
      bass: [110.0, 110.0, 87.31, 87.31, 130.81, 130.81, 98.0, 98.0],
      chords: [
        [220.0, 261.63, 329.63],
        [174.61, 220.0, 261.63],
        [261.63, 329.63, 392.0],
        [196.0, 246.94, 293.66],
      ],
    },
    {
      title: 'ရန်ကုန် ၁၉၈၅ (80s Cassette)',
      bpm: 104,
      melody: [392.0, 440, 523.25, 587.33, 659.25, 587.33, 523.25, 0, 659.25, 783.99, 880, 783.99, 659.25, 587.33, 523.25, 0],
      bass: [130.81, 130.81, 98.0, 98.0, 110.0, 110.0, 87.31, 98.0],
      chords: [
        [261.63, 329.63, 392.0],
        [196.0, 246.94, 293.66],
        [220.0, 261.63, 329.63],
        [174.61, 220.0, 261.63],
      ],
    },
  ] as const

  muted = false
  private started = false

  unlock() {
    try {
      if (this.started) {
        if (this.ctx?.state === 'suspended') this.ctx.resume().catch(() => {})
        return
      }
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      this.ctx = ctx

    const master = ctx.createGain()
    master.gain.value = this.muted ? 0 : 0.5
    master.connect(ctx.destination)
    this.master = master

    // Shared 2-second white noise buffer for diesel clatter, tire roll, air brakes, and doors
    const bufLen = ctx.sampleRate * 2
    const noiseBuffer = ctx.createBuffer(1, bufLen, ctx.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1
    this.noiseBuffer = noiseBuffer

    // --- 1. Heavy 6-cylinder diesel bus rumble (very low fundamental, warm low-pass) ---
    const dieselFilter = ctx.createBiquadFilter()
    dieselFilter.type = 'lowpass'
    dieselFilter.frequency.value = 95
    dieselFilter.Q.value = 1.4

    const dieselGain = ctx.createGain()
    dieselGain.gain.value = 0
    dieselFilter.connect(dieselGain)
    dieselGain.connect(master)

    // Deep fundamental thump (triangle + gentle sawtooth, never buzzy)
    const dieselOsc = ctx.createOscillator()
    dieselOsc.type = 'sawtooth'
    dieselOsc.frequency.value = 26
    const osc1Mix = ctx.createGain()
    osc1Mix.gain.value = 0.55
    dieselOsc.connect(osc1Mix)
    osc1Mix.connect(dieselFilter)
    dieselOsc.start()

    const subOsc = ctx.createOscillator()
    subOsc.type = 'triangle'
    subOsc.frequency.value = 52
    const osc2Mix = ctx.createGain()
    osc2Mix.gain.value = 0.45
    subOsc.connect(osc2Mix)
    osc2Mix.connect(dieselFilter)
    subOsc.start()

    // Diesel cylinder chug modulation (slow rhythmic diesel knock/pulse)
    const chugLfo = ctx.createOscillator()
    chugLfo.type = 'sine'
    chugLfo.frequency.value = 11
    const chugDepth = ctx.createGain()
    chugDepth.gain.value = 0.055
    chugLfo.connect(chugDepth)
    chugDepth.connect(dieselGain.gain)
    chugLfo.start()

    // Soft filtered diesel mechanical clatter / exhaust rumble bed
    const clatterSrc = ctx.createBufferSource()
    clatterSrc.buffer = noiseBuffer
    clatterSrc.loop = true
    const clatterFilter = ctx.createBiquadFilter()
    clatterFilter.type = 'bandpass'
    clatterFilter.frequency.value = 120
    clatterFilter.Q.value = 1.8
    const clatterGain = ctx.createGain()
    clatterGain.gain.value = 0
    clatterSrc.connect(clatterFilter)
    clatterFilter.connect(clatterGain)
    clatterGain.connect(master)
    clatterSrc.start()

    // Subtle heavy tire & cabin wind rumble at cruising speed
    const tireSrc = ctx.createBufferSource()
    tireSrc.buffer = noiseBuffer
    tireSrc.loop = true
    const tireFilter = ctx.createBiquadFilter()
    tireFilter.type = 'lowpass'
    tireFilter.frequency.value = 180
    const tireGain = ctx.createGain()
    tireGain.gain.value = 0
    tireSrc.connect(tireFilter)
    tireFilter.connect(tireGain)
    tireGain.connect(master)
    tireSrc.start()

    this.dieselOsc = dieselOsc
    this.subOsc = subOsc
    this.chugLfo = chugLfo
    this.chugDepth = chugDepth
    this.dieselFilter = dieselFilter
    this.dieselGain = dieselGain
    this.clatterFilter = clatterFilter
    this.clatterGain = clatterGain
    this.tireFilter = tireFilter
    this.tireGain = tireGain

    // --- 2. Deep booming city-bus air horn (low brass chord: F#3 + A#3) ---
    const hornFilter = ctx.createBiquadFilter()
    hornFilter.type = 'lowpass'
    hornFilter.frequency.value = 680
    hornFilter.Q.value = 1.6
    const hornGain = ctx.createGain()
    hornGain.gain.value = 0
    hornFilter.connect(hornGain)
    hornGain.connect(master)

    const h1 = ctx.createOscillator()
    h1.type = 'sawtooth'
    h1.frequency.value = 185.0 // Deep F#3
    h1.connect(hornFilter)
    h1.start()

    const h2 = ctx.createOscillator()
    h2.type = 'sawtooth'
    h2.frequency.value = 233.1 // Deep A#3
    h2.connect(hornFilter)
    h2.start()

    this.hornOsc1 = h1
    this.hornOsc2 = h2
    this.hornGain = hornGain

    // --- 3. Air-brake hiss ---
    const brakeSrc = ctx.createBufferSource()
    brakeSrc.buffer = noiseBuffer
    brakeSrc.loop = true
    const brakeFilter = ctx.createBiquadFilter()
    brakeFilter.type = 'bandpass'
    brakeFilter.frequency.value = 1750
    brakeFilter.Q.value = 1.3
    const brakeGain = ctx.createGain()
    brakeGain.gain.value = 0
    brakeSrc.connect(brakeFilter)
    brakeFilter.connect(brakeGain)
    brakeGain.connect(master)
    brakeSrc.start()
    this.brakeGain = brakeGain

    const radioGain = ctx.createGain()
    radioGain.gain.value = 0.42
    radioGain.connect(master)
    this.radioGain = radioGain

    this.started = true
    } catch {
      // AudioContext unavailable or restricted; game still runs cleanly
    }
  }

  startCassette(trackIndex = this.radioTrackIndex) {
    this.unlock()
    if (!this.ctx || !this.radioGain) return
    this.stopCassette()
    this.radioTrackIndex = (trackIndex + this.cassetteTracks.length) % this.cassetteTracks.length
    this.radioPlaying = true
    this.radioStep = 0
    const track = this.cassetteTracks[this.radioTrackIndex]
    const stepMs = (60 / track.bpm / 2) * 1000 // eighth-note groove

    const tickNote = () => {
      if (!this.radioPlaying || !this.ctx || !this.radioGain) return
      const now = this.ctx.currentTime
      const step = this.radioStep++
      const mIdx = step % track.melody.length
      const bIdx = Math.floor(step / 2) % track.bass.length
      const cIdx = Math.floor(step / 4) % track.chords.length

      // Warm 80s electric guitar / vintage keyboard melody note
      const melFreq = track.melody[mIdx]
      if (melFreq > 0) {
        const osc = this.ctx.createOscillator()
        const filt = this.ctx.createBiquadFilter()
        const g = this.ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(melFreq, now)
        filt.type = 'lowpass'
        filt.frequency.setValueAtTime(1800, now)
        filt.frequency.exponentialRampToValueAtTime(750, now + 0.35)
        g.gain.setValueAtTime(0.001, now)
        g.gain.linearRampToValueAtTime(0.24, now + 0.02)
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.42)
        osc.connect(filt)
        filt.connect(g)
        g.connect(this.radioGain)
        osc.start(now)
        osc.stop(now + 0.45)
      }

      // Warm 80s electric bass on every beat
      if (step % 2 === 0) {
        const bOsc = this.ctx.createOscillator()
        const bg = this.ctx.createGain()
        bOsc.type = 'sine'
        bOsc.frequency.setValueAtTime(track.bass[bIdx], now)
        bg.gain.setValueAtTime(0.001, now)
        bg.gain.linearRampToValueAtTime(0.22, now + 0.02)
        bg.gain.exponentialRampToValueAtTime(0.001, now + 0.45)
        bOsc.connect(bg)
        bg.connect(this.radioGain)
        bOsc.start(now)
        bOsc.stop(now + 0.48)
      }

      // Soft vintage organ chord strum every 2 beats
      if (step % 4 === 0) {
        for (const freq of track.chords[cIdx]) {
          const cOsc = this.ctx.createOscillator()
          const cg = this.ctx.createGain()
          cOsc.type = 'sine'
          cOsc.frequency.setValueAtTime(freq, now)
          cg.gain.setValueAtTime(0.001, now)
          cg.gain.linearRampToValueAtTime(0.075, now + 0.04)
          cg.gain.exponentialRampToValueAtTime(0.001, now + 0.9)
          cOsc.connect(cg)
          cg.connect(this.radioGain)
          cOsc.start(now)
          cOsc.stop(now + 0.95)
        }
      }

      // Gentle 80s cassette hi-hat / snare brush rhythm
      if (this.noiseBuffer && (step % 2 === 1 || step % 4 === 2)) {
        const src = this.ctx.createBufferSource()
        src.buffer = this.noiseBuffer
        const filt = this.ctx.createBiquadFilter()
        filt.type = 'highpass'
        filt.frequency.value = step % 4 === 2 ? 1400 : 4800
        const ng = this.ctx.createGain()
        ng.gain.setValueAtTime(step % 4 === 2 ? 0.07 : 0.028, now)
        ng.gain.exponentialRampToValueAtTime(0.001, now + (step % 4 === 2 ? 0.11 : 0.045))
        src.connect(filt)
        filt.connect(ng)
        ng.connect(this.radioGain)
        src.start(now)
        src.stop(now + 0.13)
      }
    }

    tickNote()
    this.radioTimer = window.setInterval(tickNote, stepMs)
  }

  stopCassette() {
    this.radioPlaying = false
    if (this.radioTimer !== undefined) {
      window.clearInterval(this.radioTimer)
      this.radioTimer = undefined
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.03)
    }
  }

  update(active: boolean, speedMps: number, gas: boolean, brake: boolean, horn: boolean) {
    if (!this.started || !this.ctx) return
    const now = this.ctx.currentTime
    if (!active) {
      this.dieselGain?.gain.setTargetAtTime(0, now, 0.08)
      this.clatterGain?.gain.setTargetAtTime(0, now, 0.08)
      this.tireGain?.gain.setTargetAtTime(0, now, 0.08)
      this.hornGain?.gain.setTargetAtTime(0, now, 0.04)
      this.brakeGain?.gain.setTargetAtTime(0, now, 0.05)
      return
    }

    const kmh = speedMps * 3.6
    // Heavy bus 6-speed transmission with low diesel RPM range (no race-car whine)
    const gear = kmh < 18 ? 0 : kmh < 36 ? 1 : kmh < 58 ? 2 : kmh < 85 ? 3 : kmh < 118 ? 4 : 5
    const gMin = [0, 14, 32, 52, 78, 110][gear]
    const gSpan = [22, 26, 30, 38, 45, 70][gear]
    const rpmFrac = Math.min(1, Math.max(0, (kmh - gMin) / gSpan))

    // Deep bus diesel stays in 24..54 Hz fundamental range
    const baseFreq = 24 + rpmFrac * 22 + (gas ? 5.5 : 0)
    this.dieselOsc?.frequency.setTargetAtTime(baseFreq, now, 0.1)
    this.subOsc?.frequency.setTargetAtTime(baseFreq * 1.5, now, 0.1) // Deep fifth harmonic for heavy diesel body
    this.chugLfo?.frequency.setTargetAtTime(10 + rpmFrac * 12 + (gas ? 2 : 0), now, 0.1)
    this.chugDepth?.gain.setTargetAtTime(gas ? 0.055 : 0.035, now, 0.1)

    // Keep lowpass warm & deep so it sounds like a heavy diesel engine, never a buzzsaw
    this.dieselFilter?.frequency.setTargetAtTime(82 + rpmFrac * 78 + (gas ? 36 : 0), now, 0.1)
    this.dieselGain?.gain.setTargetAtTime(0.18 + (gas ? 0.11 : 0) + Math.min(0.06, kmh * 0.0005), now, 0.1)

    // Low diesel exhaust clatter
    this.clatterFilter?.frequency.setTargetAtTime(105 + rpmFrac * 75 + (gas ? 30 : 0), now, 0.1)
    this.clatterGain?.gain.setTargetAtTime(0.055 + (gas ? 0.055 : 0), now, 0.1)

    // Heavy tire road rumble rises smoothly with speed
    this.tireFilter?.frequency.setTargetAtTime(130 + Math.min(260, kmh * 2.1), now, 0.12)
    this.tireGain?.gain.setTargetAtTime(Math.min(0.16, kmh * 0.0014), now, 0.12)

    // Deep bus air horn
    this.hornGain?.gain.setTargetAtTime(horn ? 0.36 : 0, now, horn ? 0.02 : 0.07)
    if (horn) {
      this.hornOsc1?.frequency.setTargetAtTime(185.0, now, 0.02)
      this.hornOsc2?.frequency.setTargetAtTime(233.1, now, 0.02)
    }

    // Air-brake pressure hiss + release "pssht" when coming to a halt
    const brakingHard = brake && speedMps > 2.2
    this.brakeGain?.gain.setTargetAtTime(brakingHard ? Math.min(0.12, speedMps * 0.004) : 0, now, 0.05)
    if ((this.wasBraking && !brake && speedMps < 5) || (brake && this.prevSpeed > 1.2 && speedMps <= 0.35)) {
      this.playAirHiss(0.24, 2200, 0.14)
    }
    this.wasBraking = brakingHard
    this.prevSpeed = speedMps
  }

  // Pneumatic bus door hiss (when stopping to board passengers)
  playDoorHiss() {
    this.playAirHiss(0.38, 1500, 0.15)
  }

  private playAirHiss(duration: number, freq: number, vol: number) {
    if (!this.started || !this.ctx || !this.master || !this.noiseBuffer) return
    const now = this.ctx.currentTime
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    const filt = this.ctx.createBiquadFilter()
    filt.type = 'bandpass'
    filt.frequency.setValueAtTime(freq, now)
    filt.frequency.exponentialRampToValueAtTime(freq * 0.55, now + duration)
    filt.Q.value = 1.4
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(vol, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration)
    src.connect(filt)
    filt.connect(gain)
    gain.connect(this.master)
    src.start(now)
    src.stop(now + duration + 0.02)
  }

  playFare() {
    this.tone(880, 1174, 0.11, 'triangle', 0.2)
    setTimeout(() => this.tone(1318, 1318, 0.12, 'triangle', 0.16), 70)
  }

  playBonus() {
    this.tone(587, 587, 0.09, 'triangle', 0.2)
    setTimeout(() => this.tone(784, 784, 0.1, 'triangle', 0.2), 75)
    setTimeout(() => this.tone(1046, 1046, 0.18, 'triangle', 0.22), 150)
  }

  playStealAlert() {
    this.tone(520, 400, 0.14, 'triangle', 0.16)
    setTimeout(() => this.tone(400, 300, 0.16, 'triangle', 0.16), 140)
  }

  playCrash() {
    if (!this.started || !this.ctx || !this.master || !this.noiseBuffer) return
    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(110, now)
    osc.frequency.exponentialRampToValueAtTime(24, now + 0.45)
    gain.gain.setValueAtTime(0.6, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48)
    osc.connect(gain)
    gain.connect(this.master)
    osc.start(now)
    osc.stop(now + 0.5)

    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    const filt = this.ctx.createBiquadFilter()
    filt.type = 'lowpass'
    filt.frequency.value = 950
    const ng = this.ctx.createGain()
    ng.gain.setValueAtTime(0.42, now)
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.36)
    src.connect(filt)
    filt.connect(ng)
    ng.connect(this.master)
    src.start(now)
    src.stop(now + 0.38)
  }

  private tone(startFreq: number, endFreq: number, duration: number, type: OscillatorType, vol: number) {
    if (!this.started || !this.ctx || !this.master) return
    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(startFreq, now)
    if (endFreq !== startFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration)
    gain.gain.setValueAtTime(vol, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration)
    osc.connect(gain)
    gain.connect(this.master)
    osc.start(now)
    osc.stop(now + duration + 0.02)
  }
}
