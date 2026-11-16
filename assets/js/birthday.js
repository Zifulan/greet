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
     The page never scrolls by hand. Each chapter glides in, shows its
     text in order, holds for the seconds below, then a Continue button
     appears. Open the link with ?fast to skip the waiting while testing
     (combine with ?preview before 9 Dec:  ?preview&fast).
     ===================================================== */
  const HOLD = {              // seconds the chapter holds before Continue appears
    hero: 8,
    story: 13,
    years: 21,                // includes the sky changing from noon to night
    dream: 14,
    confess: 16,
    firsts: 13,               // the ticket and the first-date story
    'firsts-chat': 14,        // the 15 January chat
    us: 24,                   // time to flip the photos
    engaged: 9,
    tonight: 16,
  };
  const SKY = {               // [seconds before the sky starts to change, seconds the change takes]
    years: [10, 10],
    engaged: [2.5, 6],
  };
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
    sc.prepend(deco);
  });

  function playSky(sc, [delay, dur]) {
    const fx = tracks.get(sc);
    if (!fx) return;
    const t0 = performance.now(), d = delay * 1000 * PACE, D = Math.max(300, dur * 1000 * PACE);
    const step = now => {
      const p = clamp((now - t0 - d) / D);
      fx.apply(p);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
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
  const STEP = e => e.classList.contains('bubble') ? 1100 : e.matches('.polaroid, .ticket, .notif') ? 420 : 520;
  function revealList(items, base = 250) {
    let t = base, last = base;
    for (const e of items) {
      if (e.classList.contains('in')) continue;
      e.style.transitionDelay = Math.round(t * PACE) + 'ms';
      e.classList.add('in');
      last = t; t += STEP(e);
    }
    return Math.round((last + 900) * PACE);       // ms until the last piece has finished fading in
  }
  const stopOf = e => e.closest('[data-stop]');
  const revealStop = (stop, base) => revealList($$('.reveal', stop).filter(e => stopOf(e) === stop), base);

  const yearEl = $('#yearCounter'), yearFill = $('#yearFill');
  function rollYears() {
    const t0 = performance.now() + 1500 * PACE, dur = reduced ? 300 : Math.max(300, 2400 * PACE);
    const step = now => {
      const k = clamp((now - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      yearEl.textContent = String(2013 + Math.round(e * 12));
      yearFill.style.transform = `scaleX(${e})`;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* =====================================================
     GUIDED FLOW: the page only moves when she presses Continue
     ===================================================== */
  const STOPS = $$('[data-stop]');
  const hero = $('.hero');
  const openBtn = $('#openBtn');
  const nextBox = $('#next'), nextBtn = $('#nextBtn'), holdFill = $('#holdFill');
  let cur = -1, ready = false, gliding = false, anchorY = 0;
  const locked = () => root.classList.contains('guided') && !root.classList.contains('free');

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

  function showHold(ms) {
    ready = false;
    nextBox.classList.remove('ready'); nextBox.classList.add('holding');
    holdFill.style.transition = 'none';
    holdFill.style.transform = 'scaleX(0)';
    void holdFill.offsetWidth;
    holdFill.style.transition = `transform ${ms}ms linear`;
    holdFill.style.transform = 'scaleX(1)';
  }
  function showNext() { ready = true; nextBox.classList.remove('holding'); nextBox.classList.add('ready'); }
  function hideNext() { ready = false; nextBox.classList.remove('holding', 'ready'); }

  async function enter(i) {
    cur = i;
    const stop = STOPS[i], key = stop.dataset.stop;
    hideNext();
    anchorY = targetFor(stop);
    glideTo(anchorY, GLIDE);
    await wait(GLIDE * .65);            // the text starts fading in as the glide settles
    if (cur !== i) return;
    const done = revealStop(stop, key === 'cake' ? 300 : 250);
    if (key === 'years') rollYears();
    if (SKY[key]) playSky(stop, SKY[key]);
    if (key === 'cake') return cakeArrive(done);
    const hold = Math.max(sec(HOLD[key] ?? 12), done + sec(2));
    showHold(hold);
    await wait(hold);
    if (cur === i) showNext();
  }
  function advance() {
    if (!ready || cur >= STOPS.length - 1) return;
    buzz(10);
    enter(cur + 1);
  }
  nextBtn.addEventListener('click', advance);

  // no hand scrolling: block touch, wheel and keys (except on the free-scrolling letter page)
  addEventListener('touchmove', e => { if (locked()) e.preventDefault(); }, { passive: false });
  addEventListener('wheel', e => { if (locked()) e.preventDefault(); }, { passive: false });
  addEventListener('keydown', e => {
    if (!locked()) return;
    if (![' ', 'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End'].includes(e.key)) return;
    if (e.target.closest?.('button, a, [role="button"]')) return;
    e.preventDefault();
    if (e.key === ' ' || e.key === 'ArrowDown' || e.key === 'PageDown') advance();
  });
  // if anything nudges the page (a focus jump, say), put it back
  addEventListener('scroll', () => {
    if (locked() && !gliding && cur >= 0 && Math.abs(scrollY - anchorY) > 3) window.scrollTo(0, anchorY);
  }, { passive: true });
  // once Continue is showing, swiping up works too
  let sx = 0, sy = 0, sTarget = null;
  addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; sTarget = e.target; }, { passive: true });
  addEventListener('pointerup', e => {
    if (!ready || !locked() || !sTarget?.closest) return;
    if (sTarget.closest('#match, .candle, button, a')) return;
    const dy = e.clientY - sy, dx = e.clientX - sx;
    if (dy < -56 && Math.abs(dx) < 90) advance();
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
    enter(0);
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
      buzz(10);
    };
    card.addEventListener('click', flip);
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); }
    });
  });

  /* =====================================================
     CAKE: strike the match, light the 2 and the 6 (drag, or tap each).
     The candles stay lit. Then three beats: wish, letter, save the date.
     ===================================================== */
  const section = $('#cake');
  const stepText = $('#stepText');
  const candles = $$('.candle', section);
  const match = $('#match');
  const matchTip = $('.match-tip', match);
  const wishCard = $('#wishCard');
  const btnLetter = $('#btnLetter'), btnLast = $('#btnLast');
  const letterEl = $('#letter'), inviteEl = $('#invite');
  const LIGHT_RADIUS = 30; // px between match head and wick
  let armed = false, matchLit = false, allLit = false, drag = null, hopping = false;
  const off = { x: 0, y: 0 };

  function say(text) {
    stepText.style.opacity = 0;
    setTimeout(() => { stepText.textContent = text; stepText.style.opacity = 1; }, 250);
  }
  const center = r => ({ x: r.left + r.width / 2, y: r.top });
  const tipPos = () => center(matchTip.getBoundingClientRect());
  const wickPos = c => center(c.getBoundingClientRect());
  const place = () => { match.style.transform = `translate3d(${off.x.toFixed(1)}px, ${off.y.toFixed(1)}px, 0)`; };

  function cakeArrive(revealMs) {
    setTimeout(() => { armed = true; match.classList.add('armed'); }, revealMs * .6);
    // if the song already ran out and is looping softly, bring the last chorus back for the cake
    if (looped && songOk) { song.currentTime = 173; fadeTo(.75, 3000); }
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
    c.addEventListener('click', () => hopTo(c));
    c.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hopTo(c); }
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
    allLit = true;
    drag = null;
    match.classList.remove('dragging', 'burning');
    match.classList.add('gone');
    say('Close your eyes and make a wish...');
    await wait(reduced ? 600 : sec(2.5));
    const stage = $('.cake-stage');
    section.style.setProperty('--lift', -Math.round(stage.offsetHeight * (innerHeight < 760 ? .57 : .5)) + 'px');
    section.classList.add('wish-mode');
    wishCard.classList.add('show');
    petalShower(40);
    await wait(sec(2));
    btnLetter.classList.add('show');
  }

  // --- Beat 2 and 3 are their own pages (a short fade, then the page is swapped)
  const veil = $('#veil');
  async function swapTo(page) {
    hideNext();
    veil.classList.add('on');
    await wait(reduced ? 80 : 560);
    root.classList.add('free');                       // the letter is long: it scrolls by hand
    document.body.classList.remove('page-letter', 'page-invite');
    document.body.classList.add('page-' + page);
    const pageEl = page === 'letter' ? letterEl : inviteEl;
    pageEl.hidden = false;
    window.scrollTo(0, 0);
    await wait(140);
    veil.classList.remove('on');
    revealList($$('.reveal', pageEl), 450);
    if (page === 'letter') setTimeout(() => btnLast.classList.add('show'), sec(2.6));
  }
  btnLetter.addEventListener('click', () => swapTo('letter'));
  btnLast.addEventListener('click', () => swapTo('invite'));
})();
