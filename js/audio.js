'use strict';

/*
 * DAF QUEST — audio.js
 * window.AUDIO — lazy WebAudio chiptune engine.
 * - AUDIO.unlock()      create/resume the context on first user gesture, start bgm.
 * - AUDIO.sfx(name)     short synthesized jingles.
 * - AUDIO.music(mode)   'night' | 'tense' | 'dawn' background loops (lookahead scheduler).
 * Everything fails silent: no AudioContext, no problem.
 */

(function () {

  // ------------------------------------------------------------------
  // Internal state
  // ------------------------------------------------------------------

  var ctx = null;          // AudioContext (created lazily in unlock)
  var masterGain = null;   // final output
  var sfxGain = null;      // sfx bus  (~0.15)
  var bgmGain = null;      // music bus (~0.06)
  var modeGain = null;     // per-music-mode sub-bus (crossfaded on mode switch)
  var noiseBuffer = null;  // shared 1s white-noise buffer

  var unlocked = false;
  var currentMode = null;    // mode currently being scheduled
  var pendingMode = 'night'; // mode requested before unlock
  var schedulerTimer = null;
  var nextNoteTime = 0;      // absolute ctx time of next step
  var stepIndex = 0;

  var LOOKAHEAD = 0.18;      // seconds scheduled ahead
  var TICK_MS = 40;          // scheduler poll interval

  // ------------------------------------------------------------------
  // Note frequencies (Hz) — just the ones we use
  // ------------------------------------------------------------------

  var N = {
    A1: 55.00, E2: 82.41, D2: 73.42, Eb2: 77.78, C2: 65.41, G2: 98.00, F2: 87.31,
    A2: 110.00, B2: 123.47, C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61,
    G3: 196.00, A3: 220.00, B3: 246.94, C4: 261.63, D4: 293.66, E4: 329.63,
    F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88, C5: 523.25, D5: 587.33,
    E5: 659.25, G5: 783.99, C6: 1046.50, E6: 1318.51
  };

  // ------------------------------------------------------------------
  // Low-level synth helpers (all assume ctx is alive; callers try/catch)
  // ------------------------------------------------------------------

  // Single oscillator note with attack/decay envelope.
  // dest: gain bus. slideTo: optional target frequency (exp glide over dur).
  function tone(dest, freq, when, dur, type, vol, slideTo, attack) {
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, when);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), when + dur);
    }
    var atk = (attack === undefined) ? 0.008 : attack;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), when + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(when);
    osc.stop(when + dur + 0.05);
    return osc;
  }

  // Filtered white-noise burst (percussion / whoosh / growl texture).
  function noise(dest, when, dur, vol, filterFreq, filterType, freqEnd) {
    if (!noiseBuffer) return;
    var src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    var flt = ctx.createBiquadFilter();
    flt.type = filterType || 'lowpass';
    flt.frequency.setValueAtTime(filterFreq || 1000, when);
    if (freqEnd) {
      flt.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), when + dur);
    }
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(flt);
    flt.connect(g);
    g.connect(dest);
    src.start(when);
    src.stop(when + dur + 0.05);
  }

  // Long soft pad note (slow attack + slow release) for atmosphere.
  function pad(dest, freq, when, dur, type, vol) {
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, when);
    var atk = Math.min(1.6, dur * 0.35);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), when + atk);
    g.gain.setValueAtTime(vol, when + dur - atk);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(when);
    osc.stop(when + dur + 0.1);
  }

  // ------------------------------------------------------------------
  // MUSIC — mode definitions
  // Each mode: stepDur (seconds per step) + step(i, when) scheduling hook.
  // The scheduler walks steps forever; patterns loop via modulo.
  // ------------------------------------------------------------------

  var MUSIC = {

    // NIGHT — slow, sparse, mystical A-minor. Signature atmosphere:
    // a slow minor arpeggio (triangle), an occasional deep breathing pad,
    // and rare high "star sparkle" pings.
    night: {
      stepDur: 0.44,
      seq: [
        // 64 steps = 8 bars of 8. 0 = rest.
        N.A2, 0, N.E3, 0, N.A3, 0, N.E3, 0,
        N.C3, 0, N.G3, 0, N.C4, 0, N.G3, 0,
        N.A2, 0, N.E3, 0, N.A3, 0, N.B3, 0,
        N.D3, 0, N.F3, 0, N.E3, 0, 0, 0,
        N.A2, 0, N.E3, 0, N.A3, 0, N.C4, 0,
        N.F3, 0, N.C4, 0, N.A3, 0, N.F3, 0,
        N.E3, 0, N.G3, 0, N.B3, 0, N.G3, 0,
        N.A3, 0, N.E3, 0, N.A2, 0, 0, 0
      ],
      step: function (i, when) {
        var p = i % this.seq.length;
        var f = this.seq[p];
        if (f) {
          // Main arpeggio voice: soft triangle, long tail.
          tone(modeGain, f, when, 1.5, 'triangle', 0.55, null, 0.03);
          // Faint octave shimmer on bar-starts.
          if (p % 8 === 0) {
            tone(modeGain, f * 2, when + 0.02, 1.1, 'sine', 0.14, null, 0.06);
          }
        }
        // Occasional deep pad: a slow breathing low fifth (A1+E2),
        // roughly every 2 bars, sometimes skipped so it stays "occasional".
        if (p % 16 === 0 && Math.random() < 0.75) {
          var padDur = this.stepDur * 14;
          pad(modeGain, N.A1, when, padDur, 'sine', 0.5);
          pad(modeGain, N.E2, when + 0.3, padDur - 0.3, 'triangle', 0.22);
        }
        // Rare high star sparkle, off-beat, very quiet.
        if (p % 2 === 1 && Math.random() < 0.05) {
          tone(modeGain, N.E6, when + 0.1, 0.5, 'sine', 0.08, N.C6, 0.01);
        }
      }
    },

    // TENSE — pulsing low D-minor ostinato with a dissonant half-step,
    // dry noise ticks, and a tritone stab every other bar.
    tense: {
      stepDur: 0.19,
      seq: [
        N.D2, 0, N.D2, N.D2, 0, N.Eb2, 0, N.D2,
        N.D2, 0, N.D2, N.D2, 0, N.F2, N.Eb2, 0
      ],
      step: function (i, when) {
        var p = i % this.seq.length;
        var f = this.seq[p];
        if (f) {
          tone(modeGain, f, when, 0.22, 'square', 0.5, null, 0.004);
          tone(modeGain, f * 0.5, when, 0.24, 'sine', 0.4, null, 0.004); // sub weight
        }
        // Dry tick on even steps.
        if (p % 2 === 0) {
          noise(modeGain, when, 0.03, 0.12, 3200, 'highpass');
        }
        // Tritone stab every 32 steps.
        if (i % 32 === 16) {
          tone(modeGain, N.A3, when, 0.9, 'triangle', 0.3, null, 0.01);
          tone(modeGain, N.Eb2 * 4, when, 0.9, 'triangle', 0.26, null, 0.01);
        }
      }
    },

    // DAWN — warm C-major, gentle rising arpeggio + sunny pad.
    dawn: {
      stepDur: 0.3,
      seq: [
        N.C3, N.E3, N.G3, N.C4, N.E4, N.C4, N.G3, N.E3,
        N.F3, N.A3, N.C4, N.F4, N.A4, N.F4, N.C4, N.A3,
        N.G3, N.B3, N.D4, N.G4, N.B4, N.G4, N.D4, N.B3,
        N.C4, N.E4, N.G4, N.C5, N.E5, N.C5, N.G4, 0
      ],
      step: function (i, when) {
        var p = i % this.seq.length;
        var f = this.seq[p];
        if (f) {
          tone(modeGain, f, when, 0.55, 'triangle', 0.5, null, 0.015);
        }
        // Warm sustained chord pad, once per 16-step phrase.
        if (p % 16 === 0) {
          var root = (p < 16) ? N.C2 : N.G2;
          pad(modeGain, root, when, this.stepDur * 15, 'triangle', 0.4);
          pad(modeGain, root * 3, when + 0.2, this.stepDur * 14, 'sine', 0.14);
        }
      }
    }
  };

  // ------------------------------------------------------------------
  // Lookahead scheduler
  // ------------------------------------------------------------------

  function schedulerTick() {
    try {
      if (!ctx || !currentMode) return;
      var def = MUSIC[currentMode];
      if (!def) return;
      // Never let the pointer lag far behind real time (tab was hidden etc.).
      if (nextNoteTime < ctx.currentTime - 0.25) {
        nextNoteTime = ctx.currentTime + 0.05;
      }
      while (nextNoteTime < ctx.currentTime + LOOKAHEAD) {
        def.step(stepIndex, nextNoteTime);
        nextNoteTime += def.stepDur;
        stepIndex++;
      }
    } catch (e) { /* fail silent */ }
  }

  function startMode(mode) {
    // Crossfade: fade out the old mode bus, spin up a fresh one.
    if (modeGain) {
      try {
        var old = modeGain;
        var t = ctx.currentTime;
        old.gain.setValueAtTime(old.gain.value, t);
        old.gain.linearRampToValueAtTime(0.0001, t + 0.9);
        setTimeout(function () {
          try { old.disconnect(); } catch (e) { /* noop */ }
        }, 1200);
      } catch (e) { /* noop */ }
    }
    modeGain = ctx.createGain();
    modeGain.gain.setValueAtTime(1, ctx.currentTime);
    modeGain.connect(bgmGain);
    currentMode = mode;
    stepIndex = 0;
    nextNoteTime = ctx.currentTime + 0.08;
    if (!schedulerTimer) {
      schedulerTimer = setInterval(schedulerTick, TICK_MS);
    }
  }

  // ------------------------------------------------------------------
  // SFX bank
  // ------------------------------------------------------------------

  var SFX = {

    pickup: function (t) {
      tone(sfxGain, N.E5, t, 0.09, 'square', 0.6);
      tone(sfxGain, N.C6, t + 0.07, 0.14, 'square', 0.6);
    },

    seal: function (t) {
      // Ceremonial rising chime + shimmer.
      tone(sfxGain, N.C5, t, 0.22, 'triangle', 0.7);
      tone(sfxGain, N.E5, t + 0.12, 0.22, 'triangle', 0.7);
      tone(sfxGain, N.G5, t + 0.24, 0.4, 'triangle', 0.75);
      tone(sfxGain, N.C6, t + 0.36, 0.6, 'sine', 0.5);
      tone(sfxGain, N.E6, t + 0.4, 0.7, 'sine', 0.25);
    },

    door: function (t) {
      // Wooden thud + short creak.
      noise(sfxGain, t, 0.12, 0.7, 300, 'lowpass', 90);
      tone(sfxGain, 120, t, 0.16, 'square', 0.45, 70);
      tone(sfxGain, 190, t + 0.1, 0.28, 'sawtooth', 0.12, 260, 0.05);
    },

    star: function (t) {
      // Bright twinkle ping.
      tone(sfxGain, N.E6, t, 0.28, 'sine', 0.55, null, 0.005);
      tone(sfxGain, N.C6, t + 0.09, 0.3, 'sine', 0.4, N.E6, 0.005);
      tone(sfxGain, N.G5 * 2, t + 0.05, 0.15, 'triangle', 0.2);
    },

    roar: function (t) {
      // PUNCHY descending lion growl: saw + sub + rumble noise.
      tone(sfxGain, 170, t, 0.75, 'sawtooth', 0.9, 48, 0.01);
      tone(sfxGain, 85, t, 0.8, 'sine', 0.85, 30, 0.01);
      tone(sfxGain, 255, t + 0.03, 0.55, 'square', 0.35, 70, 0.01);
      noise(sfxGain, t, 0.8, 0.6, 900, 'lowpass', 120);
      noise(sfxGain, t + 0.02, 0.25, 0.3, 2500, 'bandpass', 500);
    },

    fail: function (t) {
      // Sad little "wah-wah" downward.
      tone(sfxGain, N.E4, t, 0.18, 'square', 0.5, N.D4);
      tone(sfxGain, N.D4, t + 0.18, 0.3, 'square', 0.5, N.B3 * 0.98);
    },

    win: function (t) {
      // PUNCHY triumphant fanfare: fast major arpeggio up + big held chord.
      var run = [N.C4, N.E4, N.G4, N.C5, N.E5, N.G5];
      for (var i = 0; i < run.length; i++) {
        tone(sfxGain, run[i], t + i * 0.07, 0.16, 'square', 0.65);
        tone(sfxGain, run[i] * 2, t + i * 0.07, 0.1, 'triangle', 0.2);
      }
      var hold = t + run.length * 0.07 + 0.02;
      tone(sfxGain, N.C5, hold, 1.1, 'square', 0.55, null, 0.01);
      tone(sfxGain, N.E5, hold, 1.1, 'square', 0.45, null, 0.01);
      tone(sfxGain, N.G5, hold, 1.1, 'square', 0.4, null, 0.01);
      tone(sfxGain, N.C6, hold, 1.2, 'triangle', 0.5, null, 0.01);
      noise(sfxGain, hold, 0.35, 0.25, 6000, 'highpass'); // sparkle splash
    },

    step: function (t) {
      // Tiny dry footstep tick.
      noise(sfxGain, t, 0.045, 0.22, 700, 'lowpass', 250);
    },

    magic: function (t) {
      // Rising glissando + sparkle rain.
      tone(sfxGain, 350, t, 0.6, 'sine', 0.5, 1800, 0.01);
      tone(sfxGain, 500, t + 0.05, 0.55, 'triangle', 0.3, 2400, 0.01);
      var sp = [N.C6, N.E6, N.G5 * 2, N.C6 * 1.5];
      for (var i = 0; i < sp.length; i++) {
        tone(sfxGain, sp[i], t + 0.35 + i * 0.09, 0.25, 'sine', 0.3);
      }
    },

    snore: function (t) {
      // Comic snore: buzzy inhale down... squeaky exhale up.
      tone(sfxGain, 110, t, 0.45, 'sawtooth', 0.4, 62, 0.05);
      noise(sfxGain, t, 0.4, 0.18, 400, 'lowpass', 150);
      tone(sfxGain, 480, t + 0.55, 0.3, 'sine', 0.25, 640, 0.05);
    },

    hic: function (t) {
      // Comic hiccup blip: fast upward chirp.
      tone(sfxGain, 320, t, 0.1, 'square', 0.6, 950, 0.004);
      tone(sfxGain, 640, t + 0.06, 0.06, 'sine', 0.3, 1400, 0.004);
    },

    click: function (t) {
      tone(sfxGain, 900, t, 0.035, 'square', 0.25);
    },

    quiz: function (t) {
      // Questioning "da-DUM?" with an upward bend.
      tone(sfxGain, N.G4, t, 0.14, 'triangle', 0.55);
      tone(sfxGain, N.C5, t + 0.16, 0.35, 'triangle', 0.6, N.D5);
    }
  };

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------

  window.AUDIO = {

    // Create/resume the AudioContext (call from a user gesture) and start bgm.
    unlock: function () {
      try {
        if (!ctx) {
          var AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          ctx = new AC();

          masterGain = ctx.createGain();
          masterGain.gain.value = 1;
          masterGain.connect(ctx.destination);

          sfxGain = ctx.createGain();
          sfxGain.gain.value = 0.15;
          sfxGain.connect(masterGain);

          bgmGain = ctx.createGain();
          bgmGain.gain.value = 0.06;
          bgmGain.connect(masterGain);

          // Shared white-noise buffer (1 second).
          noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
          var data = noiseBuffer.getChannelData(0);
          for (var i = 0; i < data.length; i++) {
            data[i] = Math.random() * 2 - 1;
          }
        }
        if (ctx.state === 'suspended') {
          ctx.resume();
        }
        if (!unlocked) {
          unlocked = true;
          startMode(pendingMode || 'night');
        }
      } catch (e) { /* fail silent */ }
    },

    // Play a named sound effect. Unknown names / locked context = silent no-op.
    sfx: function (name) {
      try {
        if (!ctx || !unlocked) return;
        var fn = SFX[name];
        if (!fn) return;
        fn(ctx.currentTime + 0.01);
      } catch (e) { /* fail silent */ }
    },

    // Switch background music mode: 'night' | 'tense' | 'dawn'.
    music: function (mode) {
      try {
        if (!MUSIC[mode]) return;
        pendingMode = mode;
        if (!ctx || !unlocked) return; // starts on unlock
        if (mode === currentMode) return;
        startMode(mode);
      } catch (e) { /* fail silent */ }
    }
  };

})();
