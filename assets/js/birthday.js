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
    tag.textContent = `TEST MODE · mati ${new Date(previewUntil).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
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
  const petalColors = ['#4A1C24', '#6B3646', '#8E2430', '#D9AEB4', '#EBD3D4', '#FAF6EE', '#A3AA87', '#7F876A'];
  let petals = [], running = false;

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
      el.style.transitionDelay = (el.closest('.hero') ? i * 220 : 0) + 'ms';
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
      watchReveals($('#hero'));
      petalShower(110);
    }, reduced ? 0 : 500);
  }

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
    say('Hati-hati ya, panas.');

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
    say('Sekarang pejamkan mata, make a wish dulu. Pelan-pelan aja, aku tunggu.');
    btnWish.hidden = false;
    btnWish.disabled = true;
    setTimeout(() => { btnWish.disabled = false; }, reduced ? 800 : 3500);
  });

  btnWish.addEventListener('click', () => {
    if (state !== 'wish') return;
    state = 'blow';
    btnWish.hidden = true;
    say('Oke, sekarang tiup lilinnya! Tap lilinnya satu per satu, atau tiup beneran ke HP kamu.');
    if (navigator.mediaDevices?.getUserMedia) btnMic.hidden = false;
  });

  function blowOut(c) {
    if (state !== 'blow' || !c.classList.contains('lit')) return;
    c.classList.remove('lit');
    c.classList.add('out');
    const left = candles.filter(x => x.classList.contains('lit')).length;
    if (left === 0) finish();
    else if (left === 1) say('Satu lagi...');
    else say(`${left} lagi. Tiup yang kenceng!`);
  }
  candles.forEach(c => c.addEventListener('click', () => blowOut(c)));

  async function finish() {
    state = 'done';
    stopMic();
    btnMic.hidden = true;
    section.classList.remove('is-lit');
    say('Wish kamu udah terkirim.');
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
    say('Lilinnya belum nyala. Ambil koreknya dulu ya.');
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* ---------- blow detection via microphone ---------- */
  let stream = null, actx = null, raf = 0;
  async function startMic() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      say('Mic-nya nggak bisa dipakai. Tap lilinnya aja ya.');
      btnMic.hidden = true;
      return;
    }
    actx = new (window.AudioContext || window.webkitAudioContext)();
    const an = actx.createAnalyser();
    an.fftSize = 512;
    actx.createMediaStreamSource(stream).connect(an);
    const buf = new Uint8Array(an.fftSize);
    btnMic.textContent = 'Lagi dengerin... tiup!';
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
    btnMic.textContent = 'Tiup lewat mic';
  }
  btnMic.addEventListener('click', () => (stream ? stopMic() : startMic()));

  watchReveals($('#cake'));
})();
