(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const smooth = (p, a, b) => { const t = clamp((p - a) / (b - a)); return t * t * (3 - 2 * t); };
  const buzz = ms => { try { navigator.vibrate?.(ms); } catch {} };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;

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
  const petalColors = ['#800020', '#A33A4E', '#5C1A1B', '#E7A9B4', '#F5EAD8', '#3F6B4A', '#5A8C64', '#8B5E3C'];
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
      color: petalColors[(Math.random() * petalColors.length) | 0],
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
    g.save();
    g.translate(p.x, p.y);
    g.rotate(p.rot);
    g.scale(1, Math.abs(Math.cos(p.flip)) * .8 + .2);
    if (p.sprite.complete && p.sprite.naturalWidth) {
      const d = p.size * 2.1;
      g.drawImage(p.sprite, -d / 2, -d / 2, d, d);
    } else {
      g.fillStyle = p.color;
      g.beginPath();
      g.moveTo(0, -p.size);
      g.bezierCurveTo(p.size * .8, -p.size * .6, p.size * .6, p.size * .6, 0, p.size);
      g.bezierCurveTo(-p.size * .6, p.size * .6, -p.size * .8, -p.size * .6, 0, -p.size);
      g.fill();
    }
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
     REVEAL ON SCROLL
     ===================================================== */
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { threshold: .2 });
  function watchReveals(scope = document) {
    $$('.reveal', scope).forEach(el => {
      if (!el.style.transitionDelay) {
        const sib = el.classList.contains('polaroid') ? [...el.parentElement.children].indexOf(el) : 0;
        el.style.transitionDelay = sib * 160 + 'ms';
      }
      io.observe(el);
    });
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
  let songOk = true, looped = false, tailing = false, fadeToken = 0;
  song.addEventListener('error', () => { songOk = false; musicBtn.hidden = true; });

  function fadeTo(target, ms) {
    const token = ++fadeToken, from = song.volume, t0 = performance.now();
    const step = now => {
      if (token !== fadeToken) return; // a newer fade took over
      const k = Math.min(1, (now - t0) / ms);
      try { song.volume = clamp(from + (target - from) * k); } catch {}
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  async function playSong() {
    if (!songOk || !song.paused) return;
    try {
      song.volume = 0;
      await song.play();
      fadeTo(1, 1500);
      musicBtn.hidden = false;
    } catch { /* no file, or blocked: the page works without it */ }
  }
  // tail: ease down over the last seconds so the loop doesn't start with a jump
  song.addEventListener('timeupdate', () => {
    if (looped || tailing || !song.duration) return;
    if (song.duration - song.currentTime < 6) { tailing = true; fadeTo(LOOP_VOLUME, 5000); }
  });
  song.addEventListener('ended', () => {
    looped = true;
    fadeToken++;
    song.currentTime = 0;
    try { song.volume = LOOP_VOLUME; } catch {}
    song.play().catch(() => {});
  });
  musicBtn.addEventListener('click', () => {
    song.muted = !song.muted;
    if (!song.muted && song.paused) song.play().catch(() => {});
    musicBtn.classList.toggle('muted', song.muted);
    musicBtn.setAttribute('aria-pressed', String(song.muted));
    musicBtn.setAttribute('aria-label', song.muted ? 'Unmute music' : 'Mute music');
  });

  /* =====================================================
     START
     Before 9 Dec (WIB): the plain invitation card.
     From midnight: the hero, gated behind "Tap to open".
     ===================================================== */
  const hero = $('.hero');
  const openBtn = $('#openBtn');
  if (isLocked()) {
    $('#waiting').hidden = false;
    document.body.classList.add('is-locked');
  } else {
    root.classList.add('gated');
    try { history.scrollRestoration = 'manual'; } catch {}
    scrollTo(0, 0);
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
    $$('.hero-body .reveal', hero).forEach((el, i) => {
      el.style.transitionDelay = (reduced ? 0 : 250 + i * 260) + 'ms';
      el.classList.add('in');
    });
    petalShower(70);
    measure();
  });

  /* =====================================================
     SKY
     Every section paints its own sky, so text always sits on the right
     background. Two sections are taller "tracks" whose content sticks
     while the sky changes behind it (noon → dusk → night, sunset → night).
     A single requestAnimationFrame pass per scroll frame writes only
     transform/opacity, with progress clamped to 0..1.
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

  const scenes = $$('.scene[data-time]');
  const plain = [];   // { sc, orbs, clouds, stars, top, h }   gentle parallax
  const tracks = [];  // { sc, apply, top, h, last }           sticky sky changes

  scenes.forEach((sc, i) => {
    const T = TIMES[sc.dataset.time];
    const prev = scenes[i - 1], next = scenes[i + 1];
    // start on the exact colour the previous section ends on
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
      tracks.push({
        sc, top: 0, h: 0, last: -1,
        apply(p, vh) {
          const mid = M ? smooth(p, .26, .58) : 0;
          const end = M ? smooth(p, .6, .95) : smooth(p, .3, .92);
          if (midL) midL.style.opacity = mid;
          endL.style.opacity = end;
          stars.style.opacity = end;
          sun.style.transform = `translate3d(0, ${(p * vh * .5).toFixed(1)}px, 0)`;
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
    const item = { sc, orbs: [], clouds: null, stars: null, top: 0, h: 0, last: -1 };
    if (T.stars) { item.stars = starfield(T.stars); deco.append(item.stars); }
    if (T.moon) { const m = img('orb moon', ART + 'moon.webp'); m.style.opacity = T.moon; deco.append(m); item.orbs.push(m); }
    if (T.sun) { const s = img('orb sun', ART + 'sun.webp'); deco.append(s); item.orbs.push(s); }
    if (T.clouds) { item.clouds = cloudset(T.clouds); deco.append(item.clouds); }
    sc.prepend(deco);
    plain.push(item);
  });

  let vh = innerHeight;
  function measure() {
    vh = innerHeight;
    for (const it of plain) { it.top = it.sc.offsetTop; it.h = it.sc.offsetHeight; it.last = -1; }
    for (const t of tracks) { t.top = t.sc.offsetTop; t.h = t.sc.offsetHeight; t.last = -1; }
    queueFrame();
  }
  function frame() {
    queued = false;
    const y = scrollY;
    for (const t of tracks) {
      if (y + vh < t.top || y > t.top + t.h) continue;        // off screen
      const p = Math.round(clamp((y - t.top) / Math.max(1, t.h - vh)) * 500) / 500;
      if (p === t.last) continue;
      t.last = p;
      t.apply(p, vh);
    }
    if (reduced) return;
    for (const it of plain) {
      if (y + vh < it.top || y > it.top + it.h) continue;
      const p = Math.round(clamp((y + vh - it.top) / (it.h + vh)) * 400) / 400; // 0 entering … 1 leaving
      if (p === it.last) continue;
      it.last = p;
      const d = p - .5;
      for (const o of it.orbs) o.style.transform = `translate3d(0, ${(d * 70).toFixed(1)}px, 0)`;
      if (it.clouds) it.clouds.style.transform = `translate3d(0, ${(d * -46).toFixed(1)}px, 0)`;
      if (it.stars) it.stars.style.transform = `translate3d(0, ${(d * 30).toFixed(1)}px, 0)`;
    }
  }
  let queued = false;
  function queueFrame() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(frame);
  }
  addEventListener('scroll', queueFrame, { passive: true });
  addEventListener('resize', measure);
  addEventListener('load', measure);
  document.fonts?.ready.then(measure);
  measure();

  // browser bar colour follows the section in the middle of the screen
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
     YEAR COUNTER: rolls 2013 → 2025 once it's in view
     ===================================================== */
  const yearEl = $('#yearCounter'), yearFill = $('#yearFill');
  const yio = new IntersectionObserver(es => {
    if (!es.some(e => e.isIntersecting)) return;
    yio.disconnect();
    const t0 = performance.now(), dur = reduced ? 300 : 2600;
    const step = now => {
      const k = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3); // ease-out
      yearEl.textContent = String(2013 + Math.round(e * 12));
      yearFill.style.transform = `scaleX(${e})`;
      if (k < 1) requestAnimationFrame(step);
    };
    setTimeout(() => requestAnimationFrame(step), 350);
  }, { threshold: .6 });
  yio.observe(yearEl);

  /* =====================================================
     CHAPTER FOUR: tap a photo to flip it
     ===================================================== */
  const pile = $('.pile');
  $$('.polaroid.flip').forEach(card => {
    const flip = () => {
      const on = card.classList.toggle('flipped');
      card.setAttribute('aria-pressed', String(on));
      pile.classList.add('touched'); // hides the "tap photo" hint
      buzz(10);
    };
    card.addEventListener('click', flip);
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); }
    });
  });

  /* =====================================================
     CAKE: strike the match, light the 2 and the 6 (drag, or tap each)
     The candles stay lit. Then three beats: wish → letter → save the date.
     ===================================================== */
  const section = $('#cake');
  const stepText = $('#stepText');
  const candles = $$('.candle', section);
  const match = $('#match');
  const matchTip = $('.match-tip', match);
  const wishCard = $('#wishCard');
  const btnLetter = $('#btnLetter'), btnLast = $('#btnLast');
  const letter = $('#letter'), invite = $('#invite');
  const LIGHT_RADIUS = 30; // px between match head and wick
  let matchLit = false, allLit = false, drag = null, hopping = false;
  const off = { x: 0, y: 0 };

  function say(text) {
    stepText.style.opacity = 0;
    setTimeout(() => { stepText.textContent = text; stepText.style.opacity = 1; }, 250);
  }
  const center = r => ({ x: r.left + r.width / 2, y: r.top });
  const tipPos = () => center(matchTip.getBoundingClientRect());
  const wickPos = c => center(c.getBoundingClientRect());
  const place = () => { match.style.transform = `translate3d(${off.x.toFixed(1)}px, ${off.y.toFixed(1)}px, 0)`; };

  function ignite() {
    if (matchLit || allLit) return;
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

  // --- drag (touch-action: none on the match, so it never fights page scrolling)
  match.addEventListener('pointerdown', e => {
    if (allLit || hopping) return;
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
  };
  match.addEventListener('pointerup', endDrag);
  match.addEventListener('pointercancel', endDrag);
  match.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ignite(); }
  });

  // --- two-tap fallback: tap the match, then tap each candle
  async function hopTo(c) {
    if (allLit || hopping || drag || c.classList.contains('lit')) return;
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
    c.addEventListener('click', () => hopTo(c));
    c.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hopTo(c); }
    });
  });

  // --- embers drift up from the flames while the cake is on screen
  let cakeOnScreen = false;
  new IntersectionObserver(es => { cakeOnScreen = es.some(e => e.isIntersecting); }, { threshold: .1 }).observe($('.cake-stage'));
  setInterval(() => {
    if (!cakeOnScreen || document.hidden || reduced) return;
    for (const c of candles) {
      if (c.classList.contains('lit') && Math.random() < .55) { const w = wickPos(c); ember(w.x, w.y - 10); }
    }
  }, 420);

  // --- the three beats
  async function finale() {
    if (allLit) return;
    allLit = true;
    drag = null;
    match.classList.remove('dragging', 'burning');
    match.classList.add('gone');
    say('Close your eyes and make a wish...');
    await wait(reduced ? 600 : 2500);

    // Beat 1: the wish, with both candles still glowing
    wishCard.classList.add('show');
    wishCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    petalShower(50);
    await wait(reduced ? 300 : 2000);
    btnLetter.classList.add('show');
  }
  // Beat 2: the letter
  btnLetter.addEventListener('click', async () => {
    if (!letter.hidden) { letter.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    letter.hidden = false;
    watchReveals(letter);
    requestAnimationFrame(() => letter.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    await wait(reduced ? 300 : 2600);
    btnLast.classList.add('show');
  });
  // Beat 3: save the date
  btnLast.addEventListener('click', () => {
    if (invite.hidden) {
      invite.hidden = false;
      watchReveals(invite);
    }
    requestAnimationFrame(() => invite.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  });

  $$('.scene:not(.hero)').forEach(sc => watchReveals(sc));
})();
