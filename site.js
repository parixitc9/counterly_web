// Counterly site script, shared by every page. Each part runs only if its element is on the page.
(() => {
  const motion = document.documentElement.classList.contains('motion');
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const inr = v => '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const rupees = v => '₹' + Math.round(v).toLocaleString('en-IN');

  // Count a number from its last value to `to`.
  function tween(el, to, ms = 600, fmt = inr) {
    const from = el._v ?? to, id = el._t = (el._t || 0) + 1, t0 = performance.now();
    el._v = to;
    if (!motion || !ms) { el.textContent = fmt(to); return; }
    const step = now => {
      if (el._t !== id) return;
      const k = Math.min(1, (now - t0) / ms);
      el.textContent = fmt(from + (to - from) * (1 - (1 - k) ** 3));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // GST: same state → CGST + SGST, other state → IGST
  const gst = $('#gst');
  $$('.seg button').forEach(b => b.addEventListener('click', () => {
    gst.dataset.supply = b.dataset.supply;
    $$('.seg button').forEach(x => x.setAttribute('aria-pressed', x === b));
  }));

  // Contact form: compose the message and hand it to WhatsApp or the mail app. No server.
  const form = $('#contact-form');
  form?.addEventListener('submit', e => {
    e.preventDefault();
    const d = new FormData(form), topic = d.get('topic');
    const text = [['Topic', topic], ['Name', d.get('name')], ['Shop', d.get('shop')], ['Phone', d.get('phone')], ['Email', d.get('email')], ['Hardware ID', d.get('hwid')]]
      .filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n') + '\n\n' + d.get('message');
    location.href = e.submitter?.value === 'wa'
      ? 'https://wa.me/91XXXXXXXXXX?text=' + encodeURIComponent(text)
      : `mailto:sales@counterly.example?subject=${encodeURIComponent('Counterly: ' + topic)}&body=${encodeURIComponent(text)}`;
  });

  if (!motion) return; // reduced motion: the finished states in the markup stay as they are

  // FIFO: sell 15 bags, oldest lot first
  const fifo = $('.fifo');
  let playFifo = () => {};
  if (fifo) {
    const bags = $$('.bag', fifo), soldOf = $$('[data-sold]', fifo), replay = $('.replay', fifo);
    const [sales, cogs, profit] = $$('.pl dd', fifo);
    let busy = false;
    const reset = () => { bags.forEach(b => b.classList.remove('sold')); soldOf.forEach(s => s.textContent = 0); [sales, cogs, profit].forEach(d => tween(d, 0, 0, rupees)); };
    playFifo = async () => {
      if (busy) return;
      busy = replay.disabled = true;
      reset();
      await sleep(600);
      for (let n = 0, cost = 0; n < 15; n++) {
        const lot = n < 10 ? 0 : 1;
        cost += lot ? 1000 : 900;
        bags[n].classList.add('sold');
        soldOf[lot].textContent = lot ? n - 9 : n + 1;
        tween(cogs, cost, 250, rupees);
        tween(sales, (n + 1) * 1050, 250, rupees);
        await sleep(170);
      }
      await sleep(300);
      tween(profit, 1750, 1000, rupees);
      await sleep(1000);
      busy = replay.disabled = false;
    };
    reset();
    replay.hidden = false;
    replay.addEventListener('click', playFifo);
  }

  // Count-ups start at zero until seen
  const countFmt = n => v => v.toLocaleString('en-IN', { minimumFractionDigits: +(n.dataset.dec || 0), maximumFractionDigits: +(n.dataset.dec || 0) });
  $$('[data-count]').forEach(n => tween(n, 0, 0, countFmt(n)));

  // Scroll reveal
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    io.unobserve(e.target);
    e.target.classList.add('in');
    $$('[data-count]', e.target).forEach(n => tween(n, +n.dataset.count, 1600, countFmt(n)));
    if (e.target === fifo) playFifo();
  }), { threshold: .2, rootMargin: '0px 0px -8% 0px' });
  $$('[data-reveal]').forEach(el => io.observe(el));

  // Home hero demo: a bill being made, on a loop, only while on screen
  const app = $('#demo');
  if (!app) return;
  const q = $('.q', app), placeholder = q.textContent;
  const lines = $$('.lines li', app), eds = $$('.ed', app), toasts = $$('.toast', app);
  const rate = $('.rate', app), amt1 = $('.amt', app), upi = $('.upi', app), checkout = $('.checkout', app), count = $('[data-k=count]', app);
  const money = ['sub', 'gst', 'tot', 'tot2'].map(k => $(`[data-k=${k}]`, app));
  const totals = (sub, ms) => [sub, sub * .18, sub * 1.18, sub * 1.18].forEach((v, i) => tween(money[i], v, ms));
  let onScreen = false;
  new IntersectionObserver(([e]) => onScreen = e.isIntersecting).observe(app);

  const type = async text => {
    q.className = 'q typing'; q.textContent = '';
    for (const ch of text) { q.textContent += ch; await sleep(75); }
  };
  const add = async (i, sub, text, scanned) => {
    if (scanned) { q.className = 'q scan'; q.textContent = text; } else await type(text);
    await sleep(scanned ? 450 : 300);
    lines[i].classList.add('on');
    app.classList.add('has');
    count.textContent = `${i + 1} item${i ? 's' : ''}`;
    totals(sub);
    await sleep(350);
    q.className = 'q'; q.textContent = placeholder;
  };

  (async () => {
    app.classList.add('play');
    for (;;) {
      app.classList.remove('has');
      [...lines, ...eds, ...toasts, upi].forEach(el => el.classList.remove('on'));
      rate.textContent = inr(2450); tween(amt1, 9800, 0); totals(0, 0); count.textContent = '0 items';
      while (!onScreen || document.hidden) await sleep(300);
      await sleep(1200);
      await add(0, 9800, 'caustic');
      await sleep(800);
      rate.textContent = inr(2350);                        // per-bill rate override
      rate.classList.remove('flash'); void rate.offsetWidth; rate.classList.add('flash');
      eds.forEach(el => el.classList.add('on'));
      tween(amt1, 9400); totals(9400);
      await sleep(1400);
      await add(1, 9875, '8904125600017', true);           // USB barcode scan
      await sleep(400);
      await add(2, 14075, 'hydrogen');
      await sleep(400);
      await add(3, 14500, 'hypo');
      await sleep(800);
      upi.classList.add('on');
      await sleep(800);
      checkout.classList.add('press'); await sleep(200); checkout.classList.remove('press');
      await sleep(300);
      toasts[0].classList.add('on'); await sleep(700); toasts[1].classList.add('on');
      await sleep(4000);
      toasts.forEach(t => t.classList.remove('on'));
      await sleep(500);
    }
  })();
})();
