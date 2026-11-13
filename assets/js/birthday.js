(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const UNLOCK_AT = Date.parse('2026-12-09T00:00:00+07:00'); // midnight WIB

  /* ---------- test mode ----------
     Open the site once in Chrome with ?preview  → full surprise unlocked for 30 minutes
     (the installed app shares this, so you can test it there too).
     ?preview=off ends it immediately. It always switches itself off after 30 minutes. */
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} },
  };
  const qs = new URLSearchParams(location.search);
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
    tag.textContent = `TEST MODE · ends ${new Date(previewUntil).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
    document.body.appendChild(tag);
  }

  /* ---------- midnight handover ----------
     Samsung Routines may bring an app forward that was already open (still showing the
     locked invitation). Reload into the real thing as soon as it's past midnight. */
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
     PETALS (canvas)
     ===================================================== */
  const cv = $('#petals');
  const g = cv.getContext('2d');
  const petalColors = ['#800020', '#A33A4E', '#5C1A1B', '#E7A9B4', '#F5EAD8', '#3F6B4A', '#5A8C64', '#8B5E3C'];
  let petals = [], running = false;
  const sprites = Array.from({ length: 8 }, (_, i) => { const im = new Image(); im.src = `assets/img/art/petal-${i + 1}.webp`; return im; });

  function resize() {
    cv.width = innerWidth * devicePixelRatio;
    cv.height = innerHeight * devicePixelRatio;
  }
  addEventListener('resize', resize);
  resize();

  function makePetal(fromTop) {
    const size = 7 + Math.random() * 9;
    return {
      x: fromTop ? Math.random() * innerWidth : innerWidth / 2 + (Math.random() - .5) * 120,
      y: fromTop ? -20 - Math.random() * innerHeight * .6 : innerHeight * .45,
      vx: fromTop ? (Math.random() - .5) * 1.2 : (Math.random() - .5) * 13,
      vy: fromTop ? 1 + Math.random() * 1.6 : -Math.random() * 12 - 4,
      size,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - .5) * .08,
      sway: Math.random() * Math.PI * 2,
      flip: Math.random() * Math.PI * 2,
      color: petalColors[(Math.random() * petalColors.length) | 0],
      sprite: sprites[(Math.random() * sprites.length) | 0],
      burst: !fromTop,
    };
  }

  function petalShower(count = 90) {
    if (reduced) count = Math.min(count, 30);
    for (let i = 0; i < count; i++) petals.push(makePetal(true));
    start();
  }
  function petalBurst(count = 160) {
    if (reduced) count = Math.min(count, 40);
    for (let i = 0; i < count; i++) petals.push(makePetal(false));
    start();
  }
  function start() {
    if (!running) { running = true; requestAnimationFrame(tick); }
  }
  function drawPetal(p) {
    g.save();
    g.translate(p.x, p.y);
    g.rotate(p.rot);
    g.scale(1, Math.abs(Math.cos(p.flip)) * .8 + .2);
    if (p.sprite.complete && p.sprite.naturalWidth) {
      const d = p.size * 2.1;
      g.drawImage(p.sprite, -d / 2, -d / 2, d, d);
      g.restore();
      return;
    }
    g.fillStyle = p.color;
    g.beginPath();
    g.moveTo(0, -p.size);
    g.bezierCurveTo(p.size * .8, -p.size * .6, p.size * .6, p.size * .6, 0, p.size);
    g.bezierCurveTo(-p.size * .6, p.size * .6, -p.size * .8, -p.size * .6, 0, -p.size);
    g.fill();
    g.globalAlpha = .18;
    g.fillStyle = '#fff';
    g.beginPath();
    g.ellipse(-p.size * .15, -p.size * .2, p.size * .18, p.size * .5, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  function tick() {
    const d = devicePixelRatio;
    g.setTransform(d, 0, 0, d, 0, 0);
    g.clearRect(0, 0, innerWidth, innerHeight);
    petals = petals.filter(p => p.y < innerHeight + 30);
    for (const p of petals) {
      if (p.burst) {
        p.vy += .25; p.vx *= .985;
        if (p.vy > 2.2) { p.vy = 2.2; p.burst = false; }
      } else {
        p.sway += .03;
        p.vx += Math.sin(p.sway) * .02;
        p.vx *= .99;
      }
      p.x += p.vx; p.y += p.vy;
      p.rot += p.vr; p.flip += .05;
      drawPetal(p);
    }
    if (petals.length) requestAnimationFrame(tick);
    else { running = false; g.clearRect(0, 0, innerWidth, innerHeight); }
  }

  /* =====================================================
     REVEAL ON SCROLL
     ===================================================== */
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { threshold: .2 });
  function watchReveals(root = document) {
    $$('.reveal', root).forEach((el, i) => {
      const sib = el.classList.contains('polaroid') ? [...el.parentElement.children].indexOf(el) : 0;
      el.style.transitionDelay = (el.closest('.hero') ? i * 220 : sib * 160) + 'ms';
      io.observe(el);
    });
  }

  /* =====================================================
     START: plain invitation card before Dec 9,
     straight into the birthday from midnight on
     ===================================================== */
  if (isLocked()) {
    $('#waiting').hidden = false;
    document.body.classList.add('is-locked');
  } else {
    setTimeout(() => {
      watchReveals($('.hero'));
      petalShower(70);
    }, reduced ? 0 : 500);
  }

  /* =====================================================
     SKY: night → morning → afternoon → sunset → night
     Each .scene has data-time; colours blend as she scrolls.
     ===================================================== */
  const TIMES = {
    night:   { top: '#12070C', bottom: '#2A0E12', fg: '#F5EAD8', soft: 'rgba(245,234,216,.72)', stars: 1,   orb: '#F2E6CF', glow: 'rgba(242,230,207,.22)', orbY: 6, orbOp: .55, accent: '#E7A9B4', moon: 1, sun: 0, day: 0, rose: 0 },
    morning: { top: '#EADBC2', bottom: '#F7EFE2', fg: '#3B1A1D', soft: 'rgba(59,26,29,.72)',    stars: 0,   orb: '#FFF3D6', glow: 'rgba(255,226,170,.55)', orbY: 8, orbOp: .9,  accent: '#800020', moon: 0, sun: .9, day: .85, rose: 0 },
    noon:    { top: '#C9D3BF', bottom: '#F1EADC', fg: '#24301F', soft: 'rgba(36,48,31,.72)',    stars: 0,   orb: '#FFF8E6', glow: 'rgba(255,240,200,.6)',  orbY: 5, orbOp: .9,  accent: '#3F6B4A', moon: 0, sun: 1, day: .95, rose: 0 },
    dawn:    { top: '#3B1E2E', bottom: '#B9867E', fg: '#FBEFE0', soft: 'rgba(251,239,224,.78)', stars: .45, orb: '#F2E6CF', glow: 'rgba(242,230,207,.2)', orbY: 12, orbOp: .5, accent: '#F3C7C0', moon: .7, sun: 0, day: 0, rose: .55 },
    sunrise: { top: '#C77B6A', bottom: '#F4D7B5', fg: '#3B1A1D', soft: 'rgba(59,26,29,.75)', stars: 0, orb: '#FFE2B0', glow: 'rgba(255,200,140,.6)', orbY: 82, orbOp: .95, accent: '#800020', moon: 0, sun: 1, day: 0, rose: .85 },
    sunset:  { top: '#5C1A1B', bottom: '#C0704E', fg: '#FBEFE0', soft: 'rgba(251,239,224,.78)', stars: .25, orb: '#F6B47C', glow: 'rgba(246,160,100,.5)',  orbY: 90, orbOp: .9, accent: '#F6C9A8', moon: 0, sun: .9, day: 0, rose: .9 },
  };
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const rgba = c => c.startsWith('#') ? [...hex(c), 1] : c.match(/[\d.]+/g).map(Number);
  const mix = (a, b, t) => {
    const x = rgba(a), y = rgba(b);
    const m = x.map((v, i) => v + (y[i] - v) * t);
    return `rgba(${m[0] | 0},${m[1] | 0},${m[2] | 0},${m[3].toFixed(3)})`;
  };
  const lerp = (a, b, t) => a + (b - a) * t;
  const scenes = $$('.scene[data-time]');
  const rootStyle = document.documentElement.style;
  const themeMeta = document.querySelector('meta[name="theme-color"]');

  function paintSky() {
    const mid = scrollY + innerHeight / 2;
    const centers = scenes.map(sc => sc.offsetTop + sc.offsetHeight / 2);
    let i = 0;
    while (i < centers.length - 1 && mid > centers[i + 1]) i++;
    const a = TIMES[scenes[i].dataset.time];
    const b = TIMES[scenes[Math.min(i + 1, scenes.length - 1)].dataset.time];
    let t = i < centers.length - 1 ? (mid - centers[i]) / (centers[i + 1] - centers[i]) : 0;
    t = Math.max(0, Math.min(1, t));
    t = t * t * (3 - 2 * t); // smoothstep
    rootStyle.setProperty('--sky-top', mix(a.top, b.top, t));
    rootStyle.setProperty('--sky-bottom', mix(a.bottom, b.bottom, t));
    rootStyle.setProperty('--fg', mix(a.fg, b.fg, t));
    rootStyle.setProperty('--fg-soft', mix(a.soft, b.soft, t));
    rootStyle.setProperty('--accent', mix(a.accent, b.accent, t));
    rootStyle.setProperty('--stars', lerp(a.stars, b.stars, t).toFixed(3));
    rootStyle.setProperty('--orb-color', mix(a.orb, b.orb, t));
    rootStyle.setProperty('--orb-glow', mix(a.glow, b.glow, t));
    rootStyle.setProperty('--orb-y', lerp(a.orbY, b.orbY, t).toFixed(1) + '%');
    rootStyle.setProperty('--moon', lerp(a.moon, b.moon, t).toFixed(3));
    rootStyle.setProperty('--sun', lerp(a.sun, b.sun, t).toFixed(3));
    rootStyle.setProperty('--clouds-day', lerp(a.day, b.day, t).toFixed(3));
    rootStyle.setProperty('--clouds-rose', lerp(a.rose, b.rose, t).toFixed(3));
    if (themeMeta) themeMeta.content = mix(a.top, b.top, t);
  }
  let skyQueued = false;
  addEventListener('scroll', () => {
    if (skyQueued) return;
    skyQueued = true;
    requestAnimationFrame(() => { skyQueued = false; paintSky(); });
  }, { passive: true });
  addEventListener('resize', paintSky);
  paintSky();

  // stars
  const starBox = $('#stars');
  for (let k = 0; k < 90; k++) {
    const st = document.createElement('i');
    if (Math.random() < .15) st.className = 'big';
    st.style.left = (Math.random() * 100) + '%';
    st.style.top = (Math.random() * 75) + '%';
    st.style.animationDelay = (-Math.random() * 3).toFixed(2) + 's';
    st.style.animationDuration = (2 + Math.random() * 3).toFixed(2) + 's';
    starBox.appendChild(st);
  }
  for (let k = 0; k < 7; k++) {
    const sp = document.createElement('img');
    sp.className = 'spark'; sp.alt = '';
    sp.src = `assets/img/art/sparkle-${(k % 3) + 1}.webp`;
    sp.style.left = (5 + Math.random() * 90) + '%';
    sp.style.top = (4 + Math.random() * 70) + '%';
    sp.style.animationDelay = (-Math.random() * 3).toFixed(2) + 's';
    starBox.appendChild(sp);
  }

  // washi tape on every polaroid
  const tapes = ['burgundy', 'green', 'brown', 'cream'];
  $$('.polaroid .face.front').forEach((f, n) => {
    const tp = document.createElement('span');
    tp.className = 'tape';
    tp.style.setProperty('--tape', `url(../img/art/tape-${tapes[n % tapes.length]}.webp)`);
    tp.style.setProperty('--tr', ((n % 2 ? 1 : -1) * (2 + (n * 7) % 6)) + 'deg');
    f.appendChild(tp);
  });

  /* =====================================================
     MUSIC: Night Changes starts on her first tap
     (phones don't allow sound before a tap)
     ===================================================== */
  const song = $('#song');
  const musicBtn = $('#musicBtn');
  let songOk = true;
  song.addEventListener('error', () => { songOk = false; musicBtn.hidden = true; });

  function fadeTo(target, ms = 1500) {
    const from = song.volume, t0 = performance.now();
    const step = now => {
      const k = Math.min(1, (now - t0) / ms);
      song.volume = from + (target - from) * k;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  async function playSong() {
    if (!songOk || !song.paused) return;
    try {
      song.volume = 0;
      await song.play();
      fadeTo(1);
      musicBtn.hidden = false;
      musicBtn.classList.remove('paused');
    } catch { /* no file yet, or blocked: the page works without it */ }
  }
  musicBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (song.paused) { song.play(); musicBtn.classList.remove('paused'); musicBtn.setAttribute('aria-label', 'Pause music'); }
    else { song.pause(); musicBtn.classList.add('paused'); musicBtn.setAttribute('aria-label', 'Play music'); }
  });

  $('#startBtn').addEventListener('click', () => {
    playSong();
    $('#story').scrollIntoView({ behavior: 'smooth' });
  });
  // if she scrolls past the button instead, start the song on her first tap anywhere
  addEventListener('pointerup', () => { if (!isLocked()) playSong(); }, { once: true });

  /* =====================================================
     YEAR COUNTER: 2013 → 2025 as she scrolls through chapter two
     ===================================================== */
  const yearsSec = $('#years'), yearEl = $('#yearCounter'), yearFill = $('#yearFill');
  function paintYears() {
    const r = yearsSec.getBoundingClientRect();
    const k = Math.max(0, Math.min(1, (innerHeight * .6 - r.top) / (innerHeight * .9)));
    yearEl.textContent = String(2013 + Math.round(k * 12));
    yearFill.style.width = (k * 100).toFixed(1) + '%';
  }
  addEventListener('scroll', () => requestAnimationFrame(paintYears), { passive: true });
  paintYears();

  /* =====================================================
     POLAROIDS: tap to flip
     ===================================================== */
  $$('.polaroid.flip').forEach(pl => pl.addEventListener('click', () => pl.classList.toggle('flipped')));

  /* =====================================================
     3. CAKE: match → wish → blow
     ===================================================== */
  const section = $('#cake');
  const stepText = $('#stepText');
  const candles = $$('.candle');
  const match = $('#match');
  const btnMatch = $('#btnMatch');
  const btnWish = $('#btnWish');
  const btnMic = $('#btnMic');
  const wishCard = $('#wishCard');
  let state = 'idle'; // idle | lighting | wish | blow | done

  function say(text) {
    stepText.style.opacity = 0;
    setTimeout(() => { stepText.textContent = text; stepText.style.opacity = 1; }, 250);
  }

  btnMatch.addEventListener('click', async () => {
    if (state !== 'idle') return;
    state = 'lighting';
    btnMatch.hidden = true;
    say('Careful, it\'s hot.');

    const stage = $('.cake-stage').getBoundingClientRect();
    const spots = candles.map(c => {
      const r = c.getBoundingClientRect();
      return { x: r.left - stage.left + r.width / 2, y: r.top - stage.top };
    });

    // match appears at the right, strikes, then visits every wick
    match.classList.add('show');
    const mBox = match.getBoundingClientRect();
    const baseX = mBox.left - stage.left + mBox.width / 2;
    const baseY = mBox.top - stage.top;
    await wait(300);
    match.classList.add('burning');
    await wait(500);

    for (let i = candles.length - 1; i >= 0; i--) {
      const dx = spots[i].x - baseX + 14;
      const dy = spots[i].y - baseY - 6;
      match.style.transition = 'transform .45s cubic-bezier(.22,.61,.36,1)';
      match.style.transform = `translate(${dx}px, ${dy}px)`;
      await wait(reduced ? 150 : 480);
      candles[i].classList.add('lit');
      section.classList.add('is-lit');
      await wait(reduced ? 50 : 160);
    }
    match.style.transform = '';
    await wait(450);
    match.classList.remove('burning', 'show');

    state = 'wish';
    say('Now close your eyes and make a wish. Take your time, I\'ll wait.');
    btnWish.hidden = false;
    btnWish.disabled = true;
    setTimeout(() => { btnWish.disabled = false; }, reduced ? 800 : 3500);
  });

  btnWish.addEventListener('click', () => {
    if (state !== 'wish') return;
    state = 'blow';
    btnWish.hidden = true;
    say('Now blow out the candles! Tap them one by one, or really blow into your phone.');
    if (navigator.mediaDevices?.getUserMedia) btnMic.hidden = false;
  });

  function blowOut(c) {
    if (state !== 'blow' || !c.classList.contains('lit')) return;
    c.classList.remove('lit');
    c.classList.add('out');
    const left = candles.filter(x => x.classList.contains('lit')).length;
    if (left === 0) finish();
    else if (left === 1) say('One more...');
    else say(`${left} to go. Blow harder!`);
  }
  candles.forEach(c => c.addEventListener('click', () => blowOut(c)));

  async function finish() {
    state = 'done';
    stopMic();
    btnMic.hidden = true;
    section.classList.remove('is-lit');
    say('Your wish is on its way.');
    petalBurst(170);
    await wait(1100);
    wishCard.classList.add('show');
    wishCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  $('#btnRelight').addEventListener('click', () => {
    candles.forEach(c => c.classList.remove('lit', 'out'));
    wishCard.classList.remove('show');
    state = 'idle';
    btnMatch.hidden = false;
    say('The candles aren\'t lit yet. Grab the match first.');
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* ---------- blow detection via microphone ---------- */
  let stream = null, actx = null, raf = 0;
  async function startMic() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      say('The mic isn\'t available. Just tap the candles.');
      btnMic.hidden = true;
      return;
    }
    actx = new (window.AudioContext || window.webkitAudioContext)();
    const an = actx.createAnalyser();
    an.fftSize = 512;
    actx.createMediaStreamSource(stream).connect(an);
    const buf = new Uint8Array(an.fftSize);
    btnMic.textContent = 'Listening... blow!';
    let strong = 0;
    const loop = () => {
      an.getByteTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) { const x = (v - 128) / 128; sum += x * x; }
      const rms = Math.sqrt(sum / buf.length);
      strong = rms > .12 ? strong + 1 : Math.max(0, strong - 1);
      if (strong > 6) {
        strong = 0;
        const lit = candles.filter(c => c.classList.contains('lit'));
        if (lit.length) blowOut(lit[(Math.random() * lit.length) | 0]);
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
  }
  function stopMic() {
    cancelAnimationFrame(raf);
    stream?.getTracks().forEach(t => t.stop());
    actx?.close();
    stream = actx = null;
    btnMic.textContent = 'Blow into the mic';
  }
  btnMic.addEventListener('click', () => (stream ? stopMic() : startMic()));

  $$('.scene:not(.hero)').forEach(sc => watchReveals(sc));
})();
