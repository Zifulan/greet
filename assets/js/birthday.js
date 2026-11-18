(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const smooth = (p, a, b) => { const t = clamp((p - a) / (b - a)); return t * t * (3 - 2 * t); };
  const buzz = ms => { try { navigator.vibrate?.(ms); } catch {} };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;
  const qs = new URLSearchParams(location.search);

  /* =====================================================
     PACING  (edit the numbers here)
     The story plays by itself: each chapter glides in, shows its text in
     order, and holds for about as long as a person needs to read it (the
     script counts the words on screen, reads them at a normal speed, each
     line only once it has faded in, adds a moment for photos and a pause),
     then glides on. Change the copy and the timing follows. She can pause,
     go back or forward at any time. Open the link with ?fast to skip the
     waiting while testing (before 9 Dec:  ?preview&fast).
     ===================================================== */
  const READING = {
    wordsPerSecond: 3.3,      // about 200 words a minute: relaxed, so she can take each line in while it plays hands-free
    glance: .15,              // seconds to notice a new line before reading it
    photo: .8,                // seconds to take in a photo
    pause: 1.6,               // seconds to let it sink in after the last line
    min: 6,                   // no chapter holds for less than this
    extra: { confess: 1, tonight: 1, us: 4 },   // a little longer where she wants a beat (or to flip the photos)
    interact: 6,              // seconds the page waits after she touches something (flipping a photo)
    assistAfter: 6,           // seconds after she could have read the cake heading before the match lights the candles for her
    chorusDrop: 'letter',     // when the last chorus comes in: 'letter' (the wish is made in the hush) or 'candles' (the moment the last candle is lit)
    letterWordsPerSecond: 3.2,// how fast the letter scrolls by itself (a little slower: it is the letter)
  };
  const SKY = { years: 6, engaged: 5 };    // seconds the sky takes to change in those two chapters
  const FAST = qs.has('fast');
  const PACE = FAST ? .12 : 1;
  const sec = s => Math.max(FAST ? 600 : 0, s * 1000 * PACE);
  const GLIDE = reduced ? 0 : (FAST ? 450 : 1100);   // ms to glide from one chapter to the next
  if (FAST) root.classList.add('fast');

  // Midnight in Jakarta (WIB, UTC+7), written with its offset so it never depends on the phone's time zone.
  const UNLOCK_AT = Date.parse('2026-12-09T00:00:00+07:00');

  /* ---------- test mode ----------
     Open the site once with ?preview → full surprise unlocked for 30 minutes
     (the installed app shares this, so you can test it there too).
     ?preview=off ends it immediately. It always switches itself off after 30 minutes. */
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} },
  };
  if (qs.has('preview')) {
    if (qs.get('preview') === 'off') store.del('previewUntil');
    else store.set('previewUntil', String(Date.now() + 30 * 60 * 1000));
  }
  const previewUntil = Number(store.get('previewUntil') || 0);
  const PREVIEW = Date.now() < previewUntil;
  const isLocked = () => Date.now() < UNLOCK_AT && Date.now() >= Number(store.get('previewUntil') || 0);
  const lockedAtLoad = isLocked();
  if (PREVIEW) {
    const tag = document.createElement('div');
    tag.className = 'preview-tag';
    tag.textContent = `TEST MODE · ends ${new Date(previewUntil).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}${FAST ? ' · FAST' : ''}`;
    document.body.appendChild(tag);
  }

  /* ---------- midnight handover ----------
     If the page was already open before midnight (still showing the invitation card),
     reload into the real thing as soon as it's past midnight. */
  function reloadIfUnlocked() {
    if (lockedAtLoad && !isLocked()) location.reload();
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) reloadIfUnlocked(); });
  addEventListener('pageshow', reloadIfUnlocked);
  addEventListener('focus', reloadIfUnlocked);
  setInterval(reloadIfUnlocked, 15000);

  if ('serviceWorker' in navigator) {
    addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  /* =====================================================
     CANVAS: falling petals + candle embers
     ===================================================== */
  const cv = $('#petals');
  const g = cv.getContext('2d');
  let petals = [], embers = [], running = false;
  const sprites = Array.from({ length: 8 }, (_, i) => { const im = new Image(); im.src = `assets/img/art/petal-${i + 1}.webp`; return im; });

  const DPR = Math.min(devicePixelRatio || 1, 2);
  function resize() {
    cv.width = innerWidth * DPR;
    cv.height = innerHeight * DPR;
  }
  addEventListener('resize', resize);
  resize();

  function makePetal() {
    return {
      x: Math.random() * innerWidth,
      y: -20 - Math.random() * innerHeight * .6,
      vx: (Math.random() - .5) * 1.2,
      vy: 1 + Math.random() * 1.6,
      size: 7 + Math.random() * 9,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - .5) * .08,
      sway: Math.random() * Math.PI * 2,
      flip: Math.random() * Math.PI * 2,
      sprite: sprites[(Math.random() * sprites.length) | 0],
    };
  }
  function petalShower(count = 90) {
    if (reduced) count = Math.min(count, 30);
    for (let i = 0; i < count; i++) petals.push(makePetal());
    start();
  }
  function ember(x, y, n = 1) {
    if (reduced) n = Math.min(n, 2);
    for (let i = 0; i < n; i++) {
      embers.push({
        x: x + (Math.random() - .5) * 6, y,
        vx: (Math.random() - .5) * .7, vy: -(.5 + Math.random() * 1.1),
        r: .8 + Math.random() * 1.4, life: 1, decay: .012 + Math.random() * .016,
        sway: Math.random() * 6.28,
      });
    }
    start();
  }
  function start() {
    if (!running) { running = true; requestAnimationFrame(tick); }
  }
  function drawPetal(p) {
    if (!(p.sprite.complete && p.sprite.naturalWidth)) return;
    g.save();
    g.translate(p.x, p.y);
    g.rotate(p.rot);
    g.scale(1, Math.abs(Math.cos(p.flip)) * .8 + .2);
    const d = p.size * 2.1;
    g.drawImage(p.sprite, -d / 2, -d / 2, d, d);
    g.restore();
  }
  function tick() {
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.clearRect(0, 0, innerWidth, innerHeight);
    petals = petals.filter(p => p.y < innerHeight + 30);
    for (const p of petals) {
      p.sway += .03;
      p.vx += Math.sin(p.sway) * .02;
      p.vx *= .99;
      p.x += p.vx; p.y += p.vy;
      p.rot += p.vr; p.flip += .05;
      drawPetal(p);
    }
    embers = embers.filter(e => e.life > 0);
    for (const e of embers) {
      e.sway += .12;
      e.x += e.vx + Math.sin(e.sway) * .25; e.y += e.vy;
      e.life -= e.decay;
      const a = clamp(e.life);
      g.globalAlpha = a * .28;
      g.fillStyle = '#ff9a3c';
      g.beginPath(); g.arc(e.x, e.y, e.r * 3, 0, 6.2832); g.fill();
      g.globalAlpha = a;
      g.fillStyle = '#ffd98a';
      g.beginPath(); g.arc(e.x, e.y, e.r, 0, 6.2832); g.fill();
    }
    g.globalAlpha = 1;
    if (petals.length || embers.length) requestAnimationFrame(tick);
    else { running = false; g.clearRect(0, 0, innerWidth, innerHeight); }
  }

  /* =====================================================
     MUSIC
     Phones (and WhatsApp's in-app browser) only allow sound after a real tap,
     so the song starts from the "Tap to open" button.
     First play-through at full volume; if she lingers it loops softly at 30%.
     ===================================================== */
  const song = $('#song');
  const musicBtn = $('#musicBtn');
  const LOOP_VOLUME = .3;
  // The song's map (measured): 120 BPM, a bar is 2 s. `choruses` are the story's sync points (the chapters line up with them);
  // the last chorus's very first hit, which the letter drops in on, is at `drop`.
  // Just before the last chorus there is a quiet 12 s hush.
  // The file on the page is one remix: the instrumental up to a bar line at 190.8 s (the last chorus has played 16 s),
  // then the vocal version from its own last-chorus downbeat. The join sits on a bar line, so it plays as one piece.
  // Replays use the full vocal version.
  const SONG = { choruses: [40.3, 112.3, 174.3], drop: 174.8, hushFrom: 162.3, hushLoop: 166.3, hushEnd: 173.95, vocalIn: 190.8 };
  const instClock = p => p > SONG.vocalIn ? p - 16 : p;       // after the join the remix is 16 s ahead of the instrumental
  const vocal = new Audio('assets/audio/night-changes-vocal.mp3');
  vocal.preload = 'none'; vocal.loop = true; vocal.volume = 0;
  let vocalOk = true;
  vocal.addEventListener('error', () => { vocalOk = false; });
  const fades = new WeakMap();
  function fadeAudio(el, target, ms) {
    const token = (fades.get(el) || 0) + 1, from = el.volume, t0 = performance.now();
    fades.set(el, token);
    const step = now => {
      if (fades.get(el) !== token) return;
      const k = Math.min(1, (now - t0) / ms);
      try { el.volume = clamp(from + (target - from) * k); } catch {}
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  let songOk = true, looped = false, tailing = false;
  song.addEventListener('error', () => { songOk = false; musicBtn.hidden = true; });
  const fadeTo = (target, ms) => fadeAudio(song, target, ms);

  /* ---- the page breathes with the song: a warm glow rises with the loudness (quiet verses barely, choruses fully),
          and each time a chorus kicks in a shower of petals is let loose. The loudness curve was measured from the mp3. */
  const glow = $('#glow');
  let energy = null, glowV = 0, fxOn = false;
  fetch('assets/data/energy.json').then(r => r.json()).then(d => { energy = d; }).catch(() => {});
  glow.addEventListener('animationend', () => glow.classList.remove('hit'));
  function flash(strength = 1) {            // a key line lands
    if (reduced) return;
    glow.classList.remove('hit'); void glow.offsetWidth; glow.classList.add('hit');
    petalShower(Math.round(16 * strength));
    buzz(12);
  }
  function startMusicFx() {
    if (fxOn || reduced) return;
    fxOn = true;
    let lastT = 0;
    const frame = () => {
      requestAnimationFrame(frame);
      if (song.paused) return;
      const t = instClock(song.currentTime);
      for (const c of SONG.choruses) {                        // a chorus kicks in (only while playing straight through)
        if (lastT < c && t >= c && t - lastT < .6) flash(c > 170 ? 2.4 : 1.6);
      }
      lastT = t;
      if (!energy || glow.classList.contains('hit')) return;
      const e = energy.e[Math.min(energy.e.length - 1, Math.floor(t / energy.hop))] || 0;
      glowV += (e - glowV) * .06;
      glow.style.opacity = (glowV * glowV * .5).toFixed(3);
    };
    requestAnimationFrame(frame);
  }

  // The last chorus is saved for the letter. While she lights the candles and makes her wish, the song stays in the
  // hush (the last bars of it loop, and it is so quiet that the seam cannot be heard). When the letter opens, the
  // chorus drops in on its first beat, and 16 s later the vocals bloom in on the next bar line.
  const songLive = () => !FAST && songOk && !song.paused && !looped;
  let hushOn = false, hushTimer = 0;
  function crossfadeTo(to) {
    fadeTo(0, 350);
    setTimeout(() => { try { song.currentTime = to; } catch {} fadeTo(1, 600); }, 380);
  }
  function holdHush() {
    if (FAST || !songOk) return;
    hushOn = true;
    if (vocalOk) { vocal.preload = 'auto'; vocal.load(); }                 // have the replay track ready
    if (looped) {                                                        // the song already ended and is replaying: bring the hush back
      fadeAudio(vocal, 0, 500); setTimeout(() => vocal.pause(), 520);
      looped = false; tailing = false;
      try { song.currentTime = SONG.hushLoop; song.volume = 0; } catch {}
      song.play().then(() => fadeTo(1, 700)).catch(() => {});
    } else if (!song.paused) {
      const t = song.currentTime;
      if (t >= SONG.hushEnd - .05) crossfadeTo(SONG.hushLoop);             // the song already ran past it
      else if (t < 150) crossfadeTo(SONG.hushFrom);                        // she got here early
    }
    clearInterval(hushTimer);
    hushTimer = setInterval(() => {
      if (!hushOn || song.paused) return;
      const t2 = song.currentTime;
      if (t2 >= SONG.hushEnd && t2 < SONG.choruses[2] + 2) song.currentTime = SONG.hushLoop;
    }, 40);
  }
  const releaseHush = () => { hushOn = false; };

  // Lines of the last chorus that the letter echoes: seconds after the vocals' first beat (every line is 2 bars long).
  // Each cue lights the matching words in the letter when they are sung.
  const LYRIC_CUES = [['a', 1.1], ['b', 12.4], ['c', 17.1], ['d', 29.3], ['e', 33.0], ['f', 38.3]];
  const cuesDone = new Set();
  let letterMusicTimer = 0, bloomed = false;
  function letterMusicTick() {
    if (!onLetter || song.paused) return;
    const into = song.currentTime - SONG.vocalIn;
    if (into < -1 || into > 60) return;
    if (into >= 0 && !bloomed) { bloomed = true; flash(1.6); }              // the vocals bloom in
    for (const [id, at] of LYRIC_CUES) {
      if (cuesDone.has(id) || into < at) continue;
      cuesDone.add(id);
      const w = $(`#letter [data-cue="${id}"]`);
      if (!w) continue;
      w.classList.add('sung');
      buzz(10);
    }
    if (cuesDone.size === LYRIC_CUES.length) clearInterval(letterMusicTimer);
  }
  function dropChorus() {
    hushOn = false;
    if (FAST || !songOk) return;
    looped = false; tailing = false;
    flash(2.4);
    try { song.currentTime = SONG.drop; } catch {}                        // the chorus drops in on its first hit
    fadeTo(1, 250);
    if (song.paused) song.play().catch(() => {});
    cuesDone.clear(); bloomed = false;
    clearInterval(letterMusicTimer);
    letterMusicTimer = setInterval(letterMusicTick, 50);
  }
  async function playSong() {
    if (!songOk || !song.paused) return;
    try {
      song.volume = 0;
      await song.play();
      fadeTo(1, 1500);
      musicBtn.hidden = false;
      startMusicFx();
    } catch { /* no file, or blocked: the page works without it */ }
  }
  // tail: ease down over the last seconds, then the full vocal version replays softly for whoever lingers
  song.addEventListener('timeupdate', () => {
    if (looped || tailing || !song.duration) return;
    if (song.duration - song.currentTime < 6) { tailing = true; fadeTo(LOOP_VOLUME, 5000); }
  });
  song.addEventListener('ended', () => {
    looped = true;
    if (vocalOk) {
      vocal.currentTime = 0; vocal.volume = 0; vocal.muted = song.muted;
      vocal.play().then(() => fadeAudio(vocal, LOOP_VOLUME, 2500)).catch(() => {
        song.currentTime = 0; song.volume = LOOP_VOLUME; song.play().catch(() => {});
      });
    } else { song.currentTime = 0; song.volume = LOOP_VOLUME; song.play().catch(() => {}); }
  });
  musicBtn.addEventListener('click', () => {
    song.muted = !song.muted;
    vocal.muted = song.muted;
    const active = looped && vocalOk ? vocal : song;
    if (!song.muted && active.paused) active.play().catch(() => {});
    musicBtn.classList.toggle('muted', song.muted);
    musicBtn.setAttribute('aria-pressed', String(song.muted));
    musicBtn.setAttribute('aria-label', song.muted ? 'Unmute music' : 'Mute music');
  });

  /* =====================================================
     SKY
     Every chapter paints its own sky (built once, nothing moves while she
     reads). Chapter two and the engagement are "tracks": the sky changes
     over time while the chapter holds (noon -> dusk -> night).
     ===================================================== */
  const TIMES = {
    night:   { top: '#12070C', bottom: '#2A0E12', stars: 1,  moon: 1,  sun: 0, clouds: '' },
    morning: { top: '#EADBC2', bottom: '#F7EFE2', stars: 0,  moon: 0,  sun: 1, clouds: 'day' },
    noon:    { top: '#C9D3BF', bottom: '#F1EADC', stars: 0,  moon: 0,  sun: 1, clouds: 'day' },
    dawn:    { top: '#3B1E2E', bottom: '#B9867E', stars: .5, moon: .8, sun: 0, clouds: 'rose' },
    sunrise: { top: '#C77B6A', bottom: '#F4D7B5', stars: 0,  moon: 0,  sun: 1, clouds: 'rose' },
    sunset:  { top: '#5C1A1B', bottom: '#C0704E', stars: .3, moon: 0,  sun: 1, clouds: 'rose' },
  };
  const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  const mix = (x, y, t = .5) => {
    const a = hex(x), b = hex(y);
    return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('');
  };
  const ART = 'assets/img/art/';
  const el = (cls, tag = 'div') => { const d = document.createElement(tag); d.className = cls; return d; };
  const img = (cls, src) => { const im = el(cls, 'img'); im.src = src; im.alt = ''; im.decoding = 'async'; return im; };
  const cloudset = kind => {
    const set = el('cloudset');
    set.append(img('cloud c1', `${ART}cloud-${kind}-1.webp`), img('cloud c2', `${ART}cloud-${kind}-2.webp`));
    return set;
  };
  const starfield = (opacity, sparks = 3) => {
    const sf = el('starfield');
    sf.style.opacity = opacity;
    for (let k = 0; k < sparks; k++) {
      const sp = img('spark', `${ART}sparkle-${(k % 3) + 1}.webp`);
      sp.style.left = (8 + Math.random() * 84) + '%';
      sp.style.top = (6 + Math.random() * 60) + '%';
      sp.style.animationDelay = (-Math.random() * 3).toFixed(2) + 's';
      sf.append(sp);
    }
    return sf;
  };

  const BLOOMS = { story: ['peach', 'r', -2], dream: ['orchid', 'l', 62], confess: ['burgundy', 'r', 70], firsts: ['whitemix', 'l', 66], 'firsts-chat': ['peach', 'r', 72], tonight: ['burgundy', 'l', -2] };
  const scenes = $$('.scene[data-time]');
  const tracks = new Map();   // scene -> { apply(p) }

  scenes.forEach((sc, i) => {
    const T = TIMES[sc.dataset.time];
    const prev = scenes[i - 1], next = scenes[i + 1];
    // start on the exact colour the previous chapter ends on
    const from = !prev ? T.top
      : prev.dataset.timeEnd ? TIMES[prev.dataset.timeEnd].top
      : mix(TIMES[prev.dataset.time].bottom, T.top);
    const deco = el('deco');
    deco.setAttribute('aria-hidden', 'true');

    if (sc.classList.contains('track')) {
      const E = TIMES[sc.dataset.timeEnd];
      const M = sc.dataset.timeMid ? TIMES[sc.dataset.timeMid] : null;
      const base = el('sky-l'), midL = M && el('sky-l'), endL = el('sky-l');
      base.style.background = `linear-gradient(180deg, ${from} 0, ${T.top} 26%, ${T.bottom} 100%)`;
      if (midL) { midL.style.background = `linear-gradient(180deg, ${M.top}, ${M.bottom})`; midL.style.opacity = 0; }
      endL.style.background = E.top;
      endL.style.opacity = 0;
      const stars = starfield(0, 4);
      const sun = img('orb sun', ART + 'sun.webp');
      const moon = img('orb moon', ART + 'moon.webp');
      moon.style.opacity = 0;
      const cloudsA = cloudset(T.clouds || 'day');
      const cloudsB = M ? cloudset('rose') : null;
      if (cloudsB) cloudsB.style.opacity = 0;
      deco.append(base, ...(midL ? [midL] : []), endL, stars, sun, moon, cloudsA, ...(cloudsB ? [cloudsB] : []));
      const pin = $('.pin', sc), body = $('.pin-body', sc);
      pin.prepend(deco);
      sc.style.background = E.top;
      const fade = sc.hasAttribute('data-fade');
      tracks.set(sc, {
        apply(p) {
          const mid = M ? smooth(p, .26, .58) : 0;
          const end = M ? smooth(p, .6, .95) : smooth(p, .3, .92);
          if (midL) midL.style.opacity = mid;
          endL.style.opacity = end;
          stars.style.opacity = end;
          sun.style.transform = `translate3d(0, ${(p * innerHeight * .5).toFixed(1)}px, 0)`;
          sun.style.opacity = 1 - smooth(p, .5, .86);
          moon.style.transform = `translate3d(0, ${((1 - smooth(p, .6, 1)) * 46).toFixed(1)}px, 0)`;
          moon.style.opacity = smooth(p, .68, 1);
          cloudsA.style.opacity = M ? 1 - mid : 1 - end;
          cloudsA.style.transform = `translate3d(${(p * -24).toFixed(1)}px, 0, 0)`;
          if (cloudsB) {
            cloudsB.style.opacity = mid * (1 - end);
            cloudsB.style.transform = `translate3d(${(p * 24).toFixed(1)}px, 0, 0)`;
          }
          // dark daytime text bows out before the sky turns dark behind it
          if (fade) body.style.opacity = 1 - smooth(p, .3, .56);
        },
      });
      return;
    }

    const to = next ? mix(T.bottom, TIMES[next.dataset.time].top) : T.bottom;
    sc.style.background = `linear-gradient(180deg, ${from} 0, ${T.top} min(24vh, 28%), ${T.bottom} max(calc(100% - 24vh), 72%), ${to} 100%)`;
    if (T.stars) deco.append(starfield(T.stars));
    if (T.moon) { const m = img('orb moon', ART + 'moon.webp'); m.style.opacity = T.moon; deco.append(m); }
    if (T.sun) deco.append(img('orb sun', ART + 'sun.webp'));
    if (T.clouds) deco.append(cloudset(T.clouds));
    // a bouquet tucked into a corner of the chapter, swaying gently while the chapter is on screen
    if (BLOOMS[sc.dataset.stop]) {
      const [kind, side, topPct] = BLOOMS[sc.dataset.stop];
      const bl = img('bloom ' + side, `assets/img/bq/${kind}.webp`);
      bl.style.top = topPct + '%';
      deco.append(bl);
    }
    sc.prepend(deco);
  });

  tracks.forEach(fx => fx.apply(0));

  // browser bar colour follows the chapter on screen
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    const tio = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) themeMeta.content = TIMES[e.target.dataset.time].top;
    }), { rootMargin: '-50% 0px -50% 0px' });
    scenes.forEach(sc => tio.observe(sc));
  }

  // washi tape on every polaroid
  const tapes = ['burgundy', 'green', 'brown', 'cream'];
  $$('.polaroid .face.front').forEach((f, n) => {
    const tp = el('tape', 'span');
    tp.style.setProperty('--tape', `url(../img/art/tape-${tapes[n % tapes.length]}.webp)`);
    tp.style.setProperty('--tr', ((n % 2 ? 1 : -1) * (2 + (n * 7) % 6)) + 'deg');
    f.appendChild(tp);
  });

  /* =====================================================
     REVEALS: a chapter's text appears one piece at a time when it arrives
     ===================================================== */
  const STEP = e => e.classList.contains('bubble') ? 950 : e.matches('.polaroid, .ticket, .notif') ? 380 : 440;
  function revealList(items, base = 200) {
    let t = base, last = base;
    const plan = [];
    for (const e of items) {
      if (e.classList.contains('in')) continue;
      e.style.transitionDelay = Math.round(t * PACE) + 'ms';
      e.classList.add('in');
      plan.push({ el: e, at: t });                // unscaled ms after the chapter starts to appear
      if (e.classList.contains('hit')) setTimeout(() => flash(1.4), Math.round((t + 500) * PACE));
      last = t; t += STEP(e);
    }
    return { done: Math.round((last + 900) * PACE), plan };   // ms until the last piece has finished fading in
  }
  const stopOf = e => e.closest('[data-stop]');
  const revealStop = (stop, base) => revealList($$('.reveal', stop).filter(e => stopOf(e) === stop), base);

  // ---- simulated reading: how long until a person would be done with this chapter
  const wordsOf = e => e ? e.textContent.replace(/\b\d\d:\d\d\b/g, '').trim().split(/\s+/).filter(Boolean).length : 0;
  function readMs(e) {
    if (e.matches('.doodles, .divider, .year-track, .rings')) return 200;
    if (e.matches('.year-counter')) return 3400;                                     // it rolls from 2013 to 2025
    if (e.matches('.polaroid')) return (READING.photo + wordsOf(e.querySelector('figcaption')) / READING.wordsPerSecond) * 1000;
    if (e.matches('.ticket')) return (READING.photo * .8 + wordsOf(e) / READING.wordsPerSecond) * 1000;
    const skim = e.matches('.kicker, .chat-date, .day-tag') ? 2.5 : 1;               // small labels are skimmed
    return (READING.glance + wordsOf(e) / (READING.wordsPerSecond * skim)) * 1000;
  }
  function readingEnd(plan) {
    let t = 0;
    for (const { el, at } of plan) t = Math.max(t, at + 450) + readMs(el);          // can't read a line before it has faded in
    return t;
  }

  /* =====================================================
     AUTOPLAY
     After "Tap to open" the story plays by itself: each chapter holds for its
     reading time, then glides on. She never has to scroll or press anything.
     She can take over at any moment: pause, step back or forward with the
     buttons, or swipe. Taking over pauses autoplay until she presses play.
     ===================================================== */
  const STOPS = $$('[data-stop]');
  const hero = $('.hero');
  const openBtn = $('#openBtn');
  const player = $('#player'), plPrev = $('#plPrev'), plNext = $('#plNext'), plPause = $('#plPause');
  const plCaption = $('#plCaption'), holdFill = $('#holdFill');
  let cur = -1, entering = false, gliding = false, anchorY = 0;
  let auto = true, inFinale = false, onLetter = false, swapping = false;
  const locked = () => root.classList.contains('guided') && !root.classList.contains('free');

  // The story clock only runs while autoplay is on (and never jumps ahead after the tab was in the background).
  let storyT = 0, lastFrame = 0, loopOn = false;
  const tasks = new Map();                           // key -> fn(storyT, dt): true when finished
  function loop(now) {
    const dt = Math.min(100, now - lastFrame); lastFrame = now;
    if (auto) storyT += dt;
    for (const [k, fn] of [...tasks]) if (fn(storyT, auto ? dt : 0)) tasks.delete(k);
    requestAnimationFrame(loop);
  }
  function startLoop() { if (loopOn) return; loopOn = true; lastFrame = performance.now(); requestAnimationFrame(loop); }

  // the time left in the chapter (the thin line in the player)
  const timer = { t0: 0, total: 0 };
  function runTimer(totalMs, done) {
    timer.t0 = storyT; timer.total = totalMs;
    holdFill.style.transform = 'scaleX(0)';
    tasks.set('timer', T => {
      const k = clamp((T - timer.t0) / timer.total);
      holdFill.style.transform = `scaleX(${k.toFixed(4)})`;
      if (k >= 1) { done(); return true; }
      return false;
    });
  }
  function stopTimer() { tasks.delete('timer'); holdFill.style.transform = 'scaleX(0)'; }
  function bump(ms) {                                 // she is doing something: never yank the page away right after
    if (!tasks.has('timer')) return;
    const left = timer.total - (storyT - timer.t0);
    if (left < ms) timer.total += ms - left;
  }

  function playSky(sc, delayMs, durMs) {
    const fx = tracks.get(sc);
    if (!fx) return;
    const t0 = storyT, d = delayMs * PACE, D = Math.max(300, durMs * PACE);
    tasks.set('sky-' + sc.dataset.stop, T => { const p = clamp((T - t0 - d) / D); fx.apply(p); return p >= 1; });
  }
  const yearEl = $('#yearCounter'), yearFill = $('#yearFill');
  function rollYears() {
    const t0 = storyT + 1500 * PACE, dur = reduced ? 300 : Math.max(300, 2400 * PACE);
    tasks.set('years-count', T => {
      const k = clamp((T - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      yearEl.textContent = String(2013 + Math.round(e * 12));
      yearFill.style.transform = `scaleX(${e})`;
      return k >= 1;
    });
  }

  function glideTo(y, ms) {
    return new Promise(res => {
      const y0 = scrollY, dy = y - y0;
      if (!ms || Math.abs(dy) < 2) { window.scrollTo(0, y); return res(); }
      const t0 = performance.now();
      gliding = true;
      const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const step = now => {
        const k = Math.min(1, (now - t0) / ms);
        window.scrollTo(0, y0 + dy * ease(k));
        if (k < 1) requestAnimationFrame(step); else { gliding = false; res(); }
      };
      requestAnimationFrame(step);
    });
  }
  function targetFor(stop) {
    const top = stop.getBoundingClientRect().top + scrollY;
    if (stop.classList.contains('scene')) return Math.round(top);
    const scene = stop.closest('.scene');
    const sTop = scene.getBoundingClientRect().top + scrollY, sBottom = sTop + scene.offsetHeight;
    return Math.round(clamp(top - 72, sTop, Math.max(sTop, sBottom - innerHeight)));
  }

  // leaving a chapter puts it back to its beginning, so coming back plays it again from the start
  function resetStop(stop) {
    const key = stop.dataset.stop;
    if (key === 'cake') return;
    $$('.reveal', stop).filter(e => stopOf(e) === stop).forEach(e => {
      e.style.transition = 'none'; e.style.transitionDelay = '';
      e.classList.remove('in');
      void e.offsetWidth;
      e.style.transition = '';
    });
    tasks.delete('sky-' + key);
    const fx = tracks.get(stop);
    if (fx) fx.apply(0);
    if (key === 'years') { tasks.delete('years-count'); yearEl.textContent = '2013'; yearFill.style.transform = 'scaleX(0)'; }
  }

  window.__guided = { holds: [], get audio() { return { t: song.currentTime, paused: song.paused, looped, vocalT: vocal.currentTime, vocalPaused: vocal.paused }; }, get cur() { return cur; }, get auto() { return auto; }, get t() { return storyT; } };   // (for testing)
  async function enter(i) {
    const prev = cur;
    cur = i; entering = true;
    const stop = STOPS[i], key = stop.dataset.stop;
    STOPS.forEach(s => s.classList.toggle('on', s === stop));
    stopTimer(); tasks.delete('assist');
    player.dataset.mode = key === 'cake' ? 'cake' : 'chapter';
    if (key !== 'cake') releaseHush();
    plPrev.disabled = i === 0;
    anchorY = targetFor(stop);
    const glide = glideTo(anchorY, GLIDE);
    await wait(GLIDE * .65);            // the text starts fading in as the glide settles
    if (cur !== i) return;
    const { done, plan } = revealStop(stop, key === 'cake' ? 300 : 200);
    if (key === 'years') rollYears();
    if (key === 'cake') {
      cakeArrive(done, plan);
    } else {
      const read = readingEnd(plan);
      let holdMs = Math.max(READING.min * 1000, read + (READING.pause + (READING.extra[key] || 0)) * 1000);
      if (SKY[key]) {                   // the sky starts changing just as she finishes reading, then settles
        const dur = SKY[key] * 1000;
        let delay = key === 'years' ? Math.max(1000, read - dur * .3) : 1500;
        if (key === 'years' && songLive()) {       // night should be complete just as the first chorus lands
          const want = (SONG.choruses[0] + 1.2 - dur / 1000 - song.currentTime) * 1000;
          if (want > 1000 && want < read) delay = want;
        }
        playSky(stop, delay, dur);
        holdMs = Math.max(holdMs, delay + dur + 1000);
      }
      if (STOPS[i + 1]?.dataset.stop === 'firsts-chat' && songLive()) {   // the chat ("cieee", "yesss") opens on chorus 2
        const d = SONG.choruses[1] - (song.currentTime + (holdMs + GLIDE) / 1000);
        if (d > -2 && d < 9) holdMs += d * 1000;
      }
      window.__guided.holds.push({ key, seconds: +(holdMs / 1000).toFixed(1), reading: +(read / 1000).toFixed(1) });
      runTimer(Math.max(FAST ? 700 : 0, holdMs * PACE, done + 600 * PACE), () => go(1, false));
    }
    await glide;
    entering = false;
    if (prev >= 0 && prev !== i) resetStop(STOPS[prev]);
  }

  // go to the next / previous chapter. A manual move (button or swipe) means she took over: autoplay pauses.
  // The song's beat grid (measured from the mp3). A chapter change that happens by itself waits for the next beat,
  // so the glide lands on the beat, and when a chorus is about to start it lands exactly on the chorus.
  const BEAT = { period: .5, offset: .29, choruses: SONG.choruses };   // (bars start .79 s past the even second, beats every .5 s from .29)   // 120 BPM exactly; bars are 2 s; the choruses start on bars 20, 56 and 87
  function beatDelay(glideMs) {
    if (FAST || reduced || !songOk || song.paused || looped) return 0;
    const t = song.currentTime + glideMs / 1000;               // when the next chapter would arrive
    const c = BEAT.choruses.find(x => x >= t && x - t <= 4.2);
    const d = c !== undefined ? c - t : (Math.ceil((t - BEAT.offset) / BEAT.period) * BEAT.period + BEAT.offset) - t;
    return d < .04 ? 0 : d * 1000;
  }
  let navTok = 0;
  function go(delta, manual) {
    if (entering || inFinale) return;
    const j = cur + delta;
    if (j < 0 || j >= STOPS.length) return;
    const tok = ++navTok;
    if (manual) { buzz(10); setAuto(false); }
    else {
      const d = beatDelay(GLIDE);
      if (d > 0) { tasks.delete("timer"); setTimeout(() => { if (tok === navTok && !entering && !inFinale) enter(j); }, d); return; }
    }
    enter(j);
  }

  let captionTimer = 0, letterSync = () => {};
  function caption(text, ms = 1800) {
    plCaption.textContent = text;
    plCaption.classList.add('show');
    clearTimeout(captionTimer);
    captionTimer = setTimeout(() => plCaption.classList.remove('show'), ms);
  }
  function setAuto(on) {
    if (auto === on) return;
    auto = on;
    player.classList.toggle('paused', !on);
    plPause.setAttribute('aria-label', on ? 'Pause' : 'Play');
    caption(on ? 'Playing' : 'Paused', 1500);
    if (on && onLetter) letterSync();
  }
  plPause.addEventListener('click', () => setAuto(!auto));
  plNext.addEventListener('click', () => go(1, true));
  plPrev.addEventListener('click', () => go(-1, true));

  // no hand scrolling in the story: block touch, wheel and keys (the letter page scrolls freely)
  addEventListener('touchmove', e => { if (locked()) e.preventDefault(); }, { passive: false });
  addEventListener('wheel', e => { if (locked()) e.preventDefault(); else if (onLetter) setAuto(false); }, { passive: false });
  addEventListener('keydown', e => {
    const k = e.key;
    if (onLetter) { if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(k)) setAuto(false); return; }
    if (!locked()) return;
    if (!['ArrowRight', 'ArrowDown', 'PageDown', 'ArrowLeft', 'ArrowUp', 'PageUp', ' '].includes(k)) return;
    if (e.target.closest?.('button, a, [role="button"]')) return;
    e.preventDefault();
    if (k === ' ') setAuto(!auto);
    else go(['ArrowRight', 'ArrowDown', 'PageDown'].includes(k) ? 1 : -1, true);
  });
  // if anything nudges the page (a focus jump, say), put it back
  addEventListener('scroll', () => {
    if (locked() && !gliding && cur >= 0 && Math.abs(scrollY - anchorY) > 3) window.scrollTo(0, anchorY);
  }, { passive: true });
  // swipe up = next, swipe down = back (a manual move, so autoplay pauses); touching the letter takes over its auto-scroll
  let sx = 0, sy = 0, sTarget = null;
  addEventListener('pointerdown', e => {
    sx = e.clientX; sy = e.clientY; sTarget = e.target;
    if (onLetter && !e.target.closest?.('button, a, .player')) setAuto(false);
  }, { passive: true });
  addEventListener('pointerup', e => {
    if (!locked() || !sTarget?.closest) return;
    if (sTarget.closest('#match, .candle, button, a, .player')) return;
    const dy = e.clientY - sy, dx = e.clientX - sx;
    if (Math.abs(dx) < 90 && Math.abs(dy) > 56) go(dy < 0 ? 1 : -1, true);
  }, { passive: true });

  /* =====================================================
     START: the invitation card before 9 Dec (WIB), the gate after midnight
     ===================================================== */
  if (isLocked()) {
    $('#waiting').hidden = false;
    document.body.classList.add('is-locked');
  } else {
    root.classList.add('guided', 'gated');
    try { history.scrollRestoration = 'manual'; } catch {}
    window.scrollTo(0, 0);
    requestAnimationFrame(() => {
      $('.kicker', hero).classList.add('in');
      openBtn.classList.add('ready');
    });
  }
  openBtn.addEventListener('click', () => {
    if (!root.classList.contains('gated')) return;
    playSong();                       // must run inside the tap
    buzz(15);
    root.classList.remove('gated');
    openBtn.classList.add('gone');
    petalShower(70);
    startLoop();
    player.classList.add('on');
    try { plPause.focus({ preventScroll: true }); } catch {}     // the gate button just vanished: keep keyboard focus on the player
    enter(0);
    setTimeout(() => caption('Pause or skip any time', 3400), 2600 * PACE);
  });

  /* =====================================================
     CHAPTER FOUR: tap a photo to flip it
     ===================================================== */
  const pile = $('.pile');
  $$('.polaroid.flip').forEach(card => {
    const flip = () => {
      const on = card.classList.toggle('flipped');
      card.setAttribute('aria-pressed', String(on));
      pile.classList.add('touched'); // hides the "tap photo" hint
      bump(READING.interact * 1000 * PACE);          // she is reading a note: give her time before the page moves on
      buzz(10);
    };
    card.addEventListener('click', flip);
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); }
    });
  });

  /* =====================================================
     CAKE: strike the match, light the 2 and the 6 (drag, or tap each).
     If she doesn't, the match lights them for her after a while.
     The candles stay lit. Then three beats: wish, letter, save the date.
     ===================================================== */
  const section = $('#cake');
  const stepText = $('#stepText');
  const candles = $$('.candle', section);
  const match = $('#match');
  const matchTip = $('.match-tip', match);
  const wishCard = $('#wishCard');
  const btnLetter = $('#btnLetter'), btnReplay = $('#btnReplay');
  const letterEl = $('#letter');
  const LIGHT_RADIUS = 30; // px between match head and wick
  let armed = false, matchLit = false, allLit = false, drag = null, hopping = false, assistPoke = () => {};
  const off = { x: 0, y: 0 };

  function say(text) {
    stepText.style.opacity = 0;
    setTimeout(() => { stepText.textContent = text; stepText.style.opacity = 1; }, 250);
  }
  const center = r => ({ x: r.left + r.width / 2, y: r.top });
  const tipPos = () => center(matchTip.getBoundingClientRect());
  const wickPos = c => center(c.getBoundingClientRect());
  const place = () => { match.style.transform = `translate3d(${off.x.toFixed(1)}px, ${off.y.toFixed(1)}px, 0)`; };

  function cakeArrive(revealMs, plan) {
    setTimeout(() => { armed = true; match.classList.add('armed'); }, revealMs * .6);
    holdHush();      // the song waits in its hush for the wish
    // hands-free: when she has had time to read the heading and hasn't touched anything, the match lights the candles
    const wait4 = (readingEnd(plan) + READING.assistAfter * 1000) * PACE;
    let idle0 = storyT;
    assistPoke = () => { idle0 = storyT; };
    tasks.set('assist', T => {
      if (allLit) return true;
      if (!armed || drag || hopping) { idle0 = T; return false; }
      if (T - idle0 >= wait4) { autoLight(); return true; }
      return false;
    });
  }
  async function autoLight() {
    if (allLit) return;
    say('Let me light them for you.');
    await wait(reduced ? 100 : 900);
    for (const c of [candles[1], candles[0]]) {
      if (allLit) return;
      if (!c.classList.contains('lit')) await hopTo(c);
      await wait(reduced ? 60 : 350);
    }
  }

  function ignite() {
    if (!armed || matchLit || allLit) return;
    matchLit = true;
    match.classList.add('burning');
    buzz(25);
    const t = tipPos();
    ember(t.x, t.y, 9);
    say('Careful, it\'s hot.');
    setTimeout(() => { if (!allLit && !candles.some(c => c.classList.contains('lit'))) say('Now bring it to the candles, or just tap them.'); }, 1700);
  }
  function light(c) {
    if (c.classList.contains('lit')) return;
    c.classList.add('lit');
    c.setAttribute('aria-label', c.classList.contains('c2') ? 'Number 2 candle, lit' : 'Number 6 candle, lit');
    section.classList.add('is-lit');
    buzz(25);
    const w = wickPos(c);
    ember(w.x, w.y - 6, 10);
    if (candles.every(x => x.classList.contains('lit'))) finale();
  }
  function touchCandles() {
    const t = tipPos();
    for (const c of candles) {
      if (c.classList.contains('lit')) continue;
      const w = wickPos(c);
      if (Math.hypot(t.x - w.x, t.y - w.y) < LIGHT_RADIUS) light(c);
    }
  }

  // --- drag (touch-action: none on the match, so it never fights anything)
  match.addEventListener('pointerdown', e => {
    assistPoke();
    if (!armed || allLit || hopping) return;
    e.preventDefault();
    try { match.setPointerCapture(e.pointerId); } catch {}
    drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: off.x, oy: off.y };
    match.classList.add('dragging');
    ignite();
  });
  match.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    off.x = drag.ox + e.clientX - drag.sx;
    off.y = drag.oy + e.clientY - drag.sy;
    place();
    touchCandles();
  });
  const endDrag = e => {
    if (!drag || e.pointerId !== drag.id) return;
    try { match.releasePointerCapture(e.pointerId); } catch {}
    drag = null;
    match.classList.remove('dragging');
    assistPoke();
  };
  match.addEventListener('pointerup', endDrag);
  match.addEventListener('pointercancel', endDrag);
  match.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ignite(); }
  });

  // --- two-tap fallback: tap the match, then tap each candle
  async function hopTo(c) {
    if (!armed || allLit || hopping || drag || c.classList.contains('lit')) return;
    hopping = true;
    ignite();
    const t = tipPos(), w = wickPos(c);
    off.x += w.x - t.x + 5;
    off.y += w.y - t.y - 3;
    place(); // .match has a transform transition when not being dragged
    await wait(reduced ? 80 : 420);
    light(c);
    hopping = false;
  }
  candles.forEach(c => {
    c.addEventListener('click', () => { assistPoke(); hopTo(c); });
    c.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); assistPoke(); hopTo(c); }
    });
  });

  // --- embers drift up from the flames while the cake is on screen
  setInterval(() => {
    if (cur < STOPS.length - 1 || document.hidden || reduced) return;
    for (const c of candles) {
      if (c.classList.contains('lit') && Math.random() < .55) { const w = wickPos(c); ember(w.x, w.y - 10); }
    }
  }, 420);

  // --- Beat 1: the wish rises over the lower cake while the candles keep glowing
  async function finale() {
    if (allLit) return;
    allLit = true; inFinale = true;
    if (READING.chorusDrop === 'candles') dropChorus();
    drag = null;
    tasks.delete('assist');
    match.classList.remove('dragging', 'burning');
    match.classList.add('gone');
    player.dataset.mode = 'wish';
    say('Close your eyes and make a wish...');
    await wait(reduced ? 600 : sec(2.5));
    const stage = $('.cake-stage');
    section.style.setProperty('--lift', -Math.round(stage.offsetHeight * (innerHeight < 760 ? .57 : .5)) + 'px');
    section.classList.add('wish-mode');
    wishCard.classList.add('show');
    petalShower(40);
    // she has time to read the wish, then the letter opens by itself
    const words = wordsOf(wishCard) - wordsOf(btnLetter);
    runTimer(Math.max(FAST ? 800 : 0, (words / READING.wordsPerSecond * 1000 + READING.pause * 1000 + 1500) * PACE), () => swapTo('letter'));
    await wait(sec(2));
    btnLetter.classList.add('show');
  }

  // --- Beat 2 and 3 are their own pages (a short fade, then the page is swapped)
  const veil = $('#veil');
  async function swapTo(page) {
    if (swapping) return;
    swapping = true;
    stopTimer();
    veil.classList.add('on');
    await wait(reduced ? 80 : 560);
    root.classList.add('free');                       // the letter is long, so it scrolls
    document.body.classList.remove('page-letter');
    document.body.classList.add('page-' + page);
    const pageEl = letterEl;
    pageEl.hidden = false;
    window.scrollTo(0, 0);
    const to = $('.letter-to', letterEl);
    if (to) { to.tabIndex = -1; try { to.focus({ preventScroll: true }); } catch {} }   // the button she pressed is gone: focus the letter
    onLetter = page === 'letter';
    player.dataset.mode = page === 'letter' ? 'letter' : 'end';
    await wait(140);
    veil.classList.remove('on');
    revealList($$('.reveal', pageEl), 450);
    if (page === 'letter') {
      if (READING.chorusDrop !== 'candles') dropChorus();
      startLetterRead();
      setTimeout(() => btnReplay.classList.add('show'), sec(2.6));
    }
    swapping = false;
  }
  btnLetter.addEventListener('click', () => swapTo('letter'));
  btnReplay.addEventListener('click', () => location.reload());      // play it all again, from the gate

  // The letter scrolls by itself at reading pace, keeping the line being read about halfway down the screen.
  // Touching it (or pressing pause) hands control back to her; play picks up from wherever she scrolled to.
  function startLetterRead() {
    const paper = $('.letter', letterEl);
    const r = paper.getBoundingClientRect();
    const top = r.top + scrollY, bottom = r.bottom + scrollY;
    const ms = Math.max(8000, wordsOf(paper) / READING.letterWordsPerSecond * 1000) * PACE;
    const speed = (bottom - top) / ms;                // px of paper per ms of story time
    let cursor = top + 40, lastT = storyT, endedAt = null;
    letterSync = () => { cursor = clamp(scrollY + innerHeight * .55, top, bottom); endedAt = null; lastT = storyT; };
    tasks.set('letter', T => {
      if (!onLetter) return true;
      const dt = T - lastT; lastT = T;
      if (dt <= 0) return false;
      cursor = Math.min(bottom, cursor + speed * dt);
      const maxY = document.documentElement.scrollHeight - innerHeight;
      const want = clamp(cursor - innerHeight * .55, 0, maxY);
      window.scrollTo(0, scrollY + (want - scrollY) * Math.min(1, dt / 220));
      if (cursor >= bottom) {                         // she has read it all: the letter just stays, the song keeps playing
        if (endedAt === null) endedAt = T;
        if (T - endedAt >= 2600 * PACE) { player.dataset.mode = 'end'; return true; }
      }
      return false;
    });
  }
})();
