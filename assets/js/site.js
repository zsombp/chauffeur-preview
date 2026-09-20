/* Chauffeur service site. No dependencies. Without JS every price is already in the HTML and the forms show
   mail and phone instead of a send button. */
(function () {
  'use strict';
  var d = document, body = d.body, root = d.documentElement;
  var $ = function (s, r) { return (r || d).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); };
  var PRICES = {};
  try { PRICES = JSON.parse($('#price-data').textContent); } catch (e) {}
  var L = PRICES.labels || {};
  var ROUTES = PRICES.routes || {};

  /* ---------- consent (basic mode: no Google script before Accept) ----------
     The banner asks for analytics only, so only analytics_storage is ever granted. Advertising storage stays
     denied until the site gets a separate, separately worded advertising choice. */
  var GA4 = body.getAttribute('data-ga4');
  var KEY = 'consent.v1';
  var banner = $('[data-consent]');
  var DENIED = { ad_storage: 'denied', analytics_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' };
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  var loaded = false, granted = false;
  function loadGoogle() {
    if (!GA4) return;
    granted = true;
    if (loaded) { gtag('consent', 'update', { analytics_storage: 'granted' }); return; }
    loaded = true;
    gtag('consent', 'default', DENIED);
    gtag('consent', 'update', { analytics_storage: 'granted' });
    var s = d.createElement('script'); s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA4);
    d.head.appendChild(s);
    gtag('js', new Date());
    gtag('config', GA4);
  }
  function getConsent() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function setConsent(v) {
    try { localStorage.setItem(KEY, v); } catch (e) {}
    if (banner) banner.hidden = true;
    if (v === 'granted') loadGoogle();
    else { granted = false; if (loaded) gtag('consent', 'update', DENIED); } /* revocation takes effect at once */
  }
  if (banner) {
    var c = getConsent();
    if (c === 'granted') loadGoogle();
    /* The banner only matters when there is something to consent to. */
    else if (!c && GA4) banner.hidden = false;
    $('[data-consent-accept]').addEventListener('click', function () { setConsent('granted'); });
    $('[data-consent-reject]').addEventListener('click', function () { setConsent('denied'); });
    $$('[data-consent-open]').forEach(function (b) { b.addEventListener('click', function () { banner.hidden = false; $('[data-consent-accept]').focus(); }); });
  }
  /* Events never carry form content: only the event name and the product key. */
  function track(name, params) {
    params = params || {}; params.product = params.product || body.getAttribute('data-page');
    if (loaded && granted) gtag('event', name, params);
    try { d.dispatchEvent(new CustomEvent('site:track', { detail: { name: name, params: params } })); } catch (e) {}
  }
  d.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-track]');
    if (a) track(a.getAttribute('data-track'));
  });

  /* ---------- header ---------- */
  var head = $('[data-head]');
  if (head) {
    var onScroll = function () { head.classList.toggle('is-stuck', window.scrollY > 8); };
    onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
  }
  var burger = $('[data-burger]'), nav = $('#nav');
  function setMenu(open, focusBack) {
    if (!burger || !nav) return;
    nav.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    var label = $('.sr', burger); if (label) label.textContent = open ? burger.getAttribute('data-close') : burger.getAttribute('data-open');
    if (!open && focusBack) burger.focus();
  }
  if (burger && nav) {
    burger.addEventListener('click', function () { setMenu(!nav.classList.contains('is-open')); });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && nav.classList.contains('is-open')) setMenu(false, true); });
    d.addEventListener('click', function (e) { if (nav.classList.contains('is-open') && !e.target.closest('[data-head]')) setMenu(false); });
    window.addEventListener('resize', function () { if (nav.classList.contains('is-open') && getComputedStyle(burger).display === 'none') setMenu(false); });
  }

  /* ---------- prices ----------
     A price is shown only when the owners stated one for exactly this product and class. The VIP rate is an
     hourly rate: it is never shown for a fixed route, the airport or a tour. */
  function money(n) { return '€' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function priceFor(product, cls) {
    var all = PRICES.products || {};
    if (cls === 'vip' || product === 'vip') {
      if (product === 'hourly' || product === 'vip') return { text: money(all.vip.rate) + ' ' + L.per_hour, hourly: true };
      return null;
    }
    var p = all[product];
    if (!p || p[cls] == null) return null;
    return p.unit === 'hour' ? { text: money(p[cls]) + ' ' + L.per_hour, hourly: true, min: p.min_hours } : { text: money(p[cls]) };
  }
  function matchRoute(text) {
    text = (text || '').toLowerCase();
    if (/vienna airport|schwechat|\bvie\b/.test(text)) return 'vienna_airport';
    if (/vienna|wien|b[eé]cs/.test(text)) return 'vienna';
    if (/prague|praha|pr[aá]ga/.test(text)) return 'prague';
    if (/bratislava|pozsony/.test(text)) return 'bratislava';
    return '';
  }

  /* ---------- quote forms ---------- */
  var sheet = $('[data-sheet]');
  var waBase = 'https://wa.me/' + body.getAttribute('data-wa');
  function waText(service, date) {
    var tpl = body.getAttribute('data-wa-text');
    /* Without a date the sentence must still read properly. */
    if (!date) tpl = tpl.replace(/\s+\S+\s+\{date\}/, '');
    return tpl.replace('{service}', service || '').replace('{date}', date || '').replace(/\s+/g, ' ').trim();
  }
  /* The page's WhatsApp links carry the page's own service and nothing a visitor typed. */
  (function () {
    var first = $('[data-quote-form] input[name=service]:checked');
    var href = waBase + '?text=' + encodeURIComponent(waText(first ? first.value : '', ''));
    $$('[data-wa-link]').forEach(function (a) { a.href = href; });
  })();

  function productOf(form) {
    var r = $('input[name=service]:checked', form);
    var skey = r ? r.getAttribute('data-skey') : '';
    if (skey === 'airport') return 'airport';
    if (skey === 'hourly') return 'hourly';
    if (skey === 'tour') return 'tours';
    if (skey === 'city') {
      /* What the visitor typed wins over the page preset, so a changed route never keeps the old price. */
      var typed = $('input[name=route]', form).value;
      var m = matchRoute(typed);
      if (m) return m;
      var preset = form.getAttribute('data-product');
      return (!typed.trim() && ROUTES[preset]) ? preset : '';
    }
    return '';
  }
  function updateSum(form) {
    var box = $('[data-price-sum]', form); if (!box) return;
    var product = productOf(form);
    var pr = product ? priceFor(product, $('select[name=vehicle_class]', form).value) : null;
    if (!pr) { box.hidden = true; return; }
    $('[data-price-out]', box).textContent = pr.text;
    $('[data-price-note]', box).textContent = L.price_note + (pr.min ? ' ' + L.min_hours.replace('{n}', pr.min) : '');
    box.hidden = false;
  }
  function setDateMin(form) {
    var t = new Date(); t.setMinutes(t.getMinutes() - t.getTimezoneOffset());
    $('input[name=date]', form).min = t.toISOString().slice(0, 10);
  }
  function newId() {
    try { return crypto.randomUUID(); } catch (e) { return String(Date.now()) + Math.random().toString(16).slice(2); }
  }
  var forms = $$('[data-quote-form]');
  forms.forEach(function (form) {
    form._shown = performance.now();
    var checked = $('input[name=service]:checked', form);
    form._defaults = { product: form.getAttribute('data-product'), cls: $('select[name=vehicle_class]', form).value,
      skey: checked ? checked.getAttribute('data-skey') : '' };
    $('input[name=page]', form).value = location.pathname;
    $('input[name=request_id]', form).value = newId();
    setDateMin(form);
    /* No endpoint configured: the form is a WhatsApp handoff and says so. Contact details are not asked for,
       because WhatsApp identifies the sender and nothing personal should travel in a URL. */
    if (!form.getAttribute('data-endpoint')) {
      form.setAttribute('data-mode', 'whatsapp');
      $$('[data-contact-field]', form).forEach(function (f) { f.hidden = true; $$('input', f).forEach(function (i) { i.required = false; i.disabled = true; }); });
      $('button[type=submit]', form).textContent = L.whatsapp_action;
      var fine = $('[data-fine]', form); if (fine) fine.textContent = L.handoff_note;
    }
    form.addEventListener('input', function () { updateSum(form); });
    form.addEventListener('change', function () { updateSum(form); });
    updateSum(form);
    form.addEventListener('submit', function (e) { submit(e, form); });
  });

  function openQuote(btn) {
    if (!sheet || !sheet.showModal) { location.hash = '#quote'; return; }
    var form = $('[data-quote-form]', sheet), def = form._defaults;
    /* Start from the page defaults every time, so nothing from an earlier trigger leaks into this one.
       Text the visitor typed into the route field is kept unless this trigger names a route. */
    var cls = (btn && btn.getAttribute('data-class')) || def.cls;
    var product = (btn && btn.getAttribute('data-product')) || def.product;
    var route = btn && btn.getAttribute('data-route');
    var skey = product === 'airport' ? 'airport' : (product === 'hourly' || product === 'vip') ? 'hourly' : product === 'tours' ? 'tour' : ROUTES[product] ? 'city' : def.skey;
    form.setAttribute('data-product', product);
    $('select[name=vehicle_class]', form).value = cls;
    var radio = $('input[data-skey="' + skey + '"]', form); if (radio) radio.checked = true;
    if (route) $('input[name=route]', form).value = route;
    var dt = btn && btn.getAttribute('data-date'); if (dt) $('input[name=date]', form).value = dt;
    form._shown = performance.now();
    updateSum(form);
    sheet.showModal();
    track('quote_open');
    var first = $('input[name=route]', form); if (first) first.focus();
  }
  d.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-open-quote]');
    if (b) { e.preventDefault(); openQuote(b); }
    if (e.target.closest && e.target.closest('[data-close-quote]')) sheet.close();
    if (sheet && e.target === sheet) sheet.close();
  });

  function setErr(input, msg) {
    var group = input.type === 'radio' ? input.closest('fieldset') : null;
    var target = group || input, holder = group || input.closest('.field');
    target.setAttribute('aria-invalid', 'true');
    if (holder && !$('.err', holder)) {
      var s = d.createElement('span'); s.className = 'err'; s.textContent = msg; s.id = (input.id || input.name) + '-err';
      holder.appendChild(s); target.setAttribute('aria-describedby', s.id);
    }
  }
  function clearErr(form) {
    $$('[aria-invalid]', form).forEach(function (i) { i.removeAttribute('aria-invalid'); i.removeAttribute('aria-describedby'); });
    $$('.err', form).forEach(function (n) { n.remove(); });
  }
  function say(form, text, state) {
    var status = $('[data-form-status]', form);
    if (state) status.setAttribute('data-state', state); else status.removeAttribute('data-state');
    status.textContent = text;
  }

  function submit(e, form) {
    e.preventDefault();
    clearErr(form);
    var bad = $$('input,select,textarea', form).filter(function (i) { return i.willValidate && !i.checkValidity(); });
    if (bad.length) {
      bad.forEach(function (i) { setErr(i, i.validity.valueMissing ? L.required : L.invalid); });
      bad[0].focus(); say(form, L.fix, 'error'); return;
    }
    /* Spam signals: the hidden field, and a send within 1.5 s of the form becoming visible. A trapped send is
       told to try again. It is never shown a success it did not have. */
    if ($('input[name=website]', form).value || performance.now() - form._shown < 1500) { say(form, L.retry, 'error'); return; }
    var btn = $('button[type=submit]', form);
    if (btn.disabled) return;
    var data = new FormData(form);
    var product = productOf(form), pr = product ? priceFor(product, data.get('vehicle_class')) : null;
    data.set('quoted_price', pr ? pr.text : 'on request');
    data.set('product', product || '');
    data.set('elapsed_ms', String(Math.round(performance.now() - form._shown)));
    data.delete('website');

    if (form.getAttribute('data-mode') === 'whatsapp') {
      /* Journey details only. The visitor reviews and sends the message in WhatsApp: that is the contact,
         so this counts as a WhatsApp click, not as a lead. */
      var lines = [waText(data.get('service'), data.get('date'))];
      [['route', L.f_route], ['time', L.f_time], ['vehicle_class', L.f_class], ['passengers', L.f_pax], ['luggage', L.f_bags], ['flight_number', L.f_flight], ['note', L.f_note]].forEach(function (k) {
        if (data.get(k[0])) lines.push(k[1] + ': ' + data.get(k[0]));
      });
      btn.disabled = true;
      var w = window.open(waBase + '?text=' + encodeURIComponent(lines.join('\n')), '_blank', 'noopener');
      setTimeout(function () { btn.disabled = false; }, 2500);
      /* With noopener the return value is null in most browsers even on success, so say what to do either way. */
      track('whatsapp_click', { method: 'form_handoff', product: product });
      say(form, L.sent_whatsapp); void w; return;
    }

    btn.disabled = true; say(form, L.sending);
    /* Form-encoded keeps this a simple request: Apps Script has no OPTIONS handler. */
    fetch(form.getAttribute('data-endpoint'), { method: 'POST', body: new URLSearchParams(data), redirect: 'follow' })
      .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(function (res) {
        if (!res || res.ok !== true) throw new Error('rejected');
        track('generate_lead', { method: 'form', product: product });
        location.href = PRICES.thanks_url;
      })
      /* The backend dedups on request_id, so pressing send again after an unreadable response is safe. */
      .catch(function () { btn.disabled = false; say(form, L.error, 'error'); });
  }
  /* Back from the thank-you page out of bfcache: the form must be usable again. */
  window.addEventListener('pageshow', function (ev) {
    if (!ev.persisted) return;
    forms.forEach(function (form) {
      $('button[type=submit]', form).disabled = false; say(form, '');
      $('input[name=request_id]', form).value = newId(); setDateMin(form); form._shown = performance.now();
    });
  });

  /* ---------- quick quote bar (home) ---------- */
  var quick = $('[data-quick]');
  if (quick) {
    var qs = $('[name=q_service]', quick), qr = $('[name=q_route]', quick), qc = $('[name=q_class]', quick), qd = $('[name=q_date]', quick);
    var out = $('[data-quick-price]', quick), go = $('[data-quick-go]', quick);
    qd.min = $('[data-quote-form] input[name=date]').min;
    var sync = function () {
      var svc = qs.value;
      $$('option', qr).forEach(function (o) { var off = o.getAttribute('data-for') !== svc; o.hidden = off; o.disabled = off; });
      if (qr.selectedOptions[0] && qr.selectedOptions[0].disabled) { var f = $$('option', qr).filter(function (o) { return !o.disabled; })[0]; if (f) qr.value = f.value; }
      var product = qr.value, cls = qc.value, pr = priceFor(product, cls);
      while (out.firstChild) out.removeChild(out.firstChild);
      var strong = d.createElement('strong'); strong.className = 'num';
      strong.textContent = pr ? pr.text : L.on_request; out.appendChild(strong);
      var span = d.createElement('span');
      span.textContent = pr ? (L.price_note + (pr.min ? ' ' + L.min_hours.replace('{n}', pr.min) : '')) : L.on_request_note;
      out.appendChild(span);
      if (cls === 's') { var n = d.createElement('span'); n.className = 'chip'; n.textContent = L.s_note; out.appendChild(n); }
      go.setAttribute('data-product', product); go.setAttribute('data-class', cls);
      go.setAttribute('data-route', qr.selectedOptions[0] ? qr.selectedOptions[0].textContent : '');
      go.setAttribute('data-date', qd.value);
    };
    [qs, qr, qc, qd].forEach(function (el) { el.addEventListener('change', sync); });
    sync();
  }

  /* ---------- scroll film ----------
     A rendered image sequence scrubbed by scroll position on a pinned canvas. It only switches on when the
     visitor has not asked for reduced motion or data saving; otherwise the poster and the captions stay as a
     normal static block. Frames load after the page is idle: every fourth first, then the gaps. */
  var film = $('[data-film]');
  var conn = navigator.connection || {};
  if (film && 'IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches && !conn.saveData) {
    var small = matchMedia('(max-width: 760px)').matches;
    var count = parseInt(film.getAttribute(small ? 'data-count-m' : 'data-count'), 10);
    var base = film.getAttribute('data-base') + (small ? 'm' : 'd') + '-';
    var canvas = $('canvas', film), ctx = canvas.getContext('2d'), caps = $$('[data-cap]', film);
    var frames = new Array(count), drawn = -1, started = false, cur = 0;
    var nearest = function (i) { for (var d2 = 0; d2 < count; d2++) { if (frames[i - d2]) return frames[i - d2]; if (frames[i + d2]) return frames[i + d2]; } return null; };
    var draw = function () {
      var r = film.getBoundingClientRect(), span = r.height - window.innerHeight;
      var target = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
      /* the picture eases after the scroll position instead of snapping to it */
      cur += (target - cur) * 0.14;
      if (Math.abs(target - cur) < 0.0006) cur = target;
      var p = cur;
      var i = Math.round(p * (count - 1)), img = nearest(i);
      if (img && img._i !== drawn) {
        /* cover-fit the 16:9 frame into whatever shape the canvas box has */
        var cw = canvas.clientWidth, ch = canvas.clientHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
        if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) { canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr); }
        var nw = img.naturalWidth, nh = img.naturalHeight, W2 = canvas.width, H2 = canvas.height;
        if (W2 / H2 < 1.25) {
          /* tall box (phones): the car must stay whole, so fit by width with a little zoom and let the studio
             wall and floor run on above and below by stretching the frame's first and last rows */
          var w3 = W2 * 1.28, h3 = w3 * nh / nw, x3 = (W2 - w3) / 2, y3 = (H2 - h3) / 2;
          ctx.drawImage(img, 0, 0, nw, 2, 0, 0, W2, Math.ceil(y3) + 1);
          ctx.drawImage(img, 0, nh - 2, nw, 2, 0, Math.floor(y3 + h3) - 1, W2, Math.ceil(H2 - y3 - h3) + 2);
          ctx.drawImage(img, x3, y3, w3, h3);
        } else {
          var s2 = Math.max(W2 / nw, H2 / nh), w2 = nw * s2, h2 = nh * s2;
          ctx.drawImage(img, (W2 - w2) / 2, (H2 - h2) / 2, w2, h2);
        }
        drawn = img._i; canvas.classList.add('is-ready');
      }
      caps.forEach(function (c2, k) { var a = k / caps.length, b2 = (k + 1) / caps.length; c2.classList.toggle('is-on', p >= a + 0.04 && p < b2 - 0.02 || (k === caps.length - 1 && p >= a + 0.04)); });
      if (cur !== target) onMove();
    };
    var tick = false, onMove = function () { if (!tick) { tick = true; requestAnimationFrame(function () { tick = false; draw(); }); } };
    var load = function (i) { var im = new Image(); im.decoding = 'async'; im._i = i; im.onload = function () { frames[i] = im; if (drawn < 0 || Math.abs(i - drawn) < 3) { drawn = -1; onMove(); } }; im.src = base + ('00' + i).slice(-3) + '.webp'; };
    var start = function () {
      if (started) return; started = true;
      film.classList.add('is-live');
      var order = [], i2;
      for (i2 = 0; i2 < count; i2 += 4) order.push(i2);
      for (i2 = 0; i2 < count; i2++) if (i2 % 4) order.push(i2);
      order.forEach(function (n, k) { setTimeout(function () { load(n); }, k * 12); });
      window.addEventListener('scroll', onMove, { passive: true }); window.addEventListener('resize', function () { drawn = -1; onMove(); });
      onMove();
    };
    /* start when the film is within two screens, and never before the page has settled */
    var fio = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { fio.disconnect(); if (window.requestIdleCallback) requestIdleCallback(start, { timeout: 1500 }); else setTimeout(start, 1); } }, { rootMargin: '200% 0px' });
    fio.observe(film);
  }

  /* ---------- reveal ----------
     Content is visible by default. It is only hidden for the entrance once the observer certainly exists. */
  var items = $$('.reveal');
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
    root.classList.add('motion-ready');
    /* Statement headlines rise word by word. The heading keeps its text for assistive tech via aria-label. */
    $$('.statement h2').forEach(function (h) {
      var words = h.textContent.trim().split(/\s+/);
      h.setAttribute('aria-label', h.textContent.trim());
      h.textContent = '';
      words.forEach(function (w, n) {
        var outer = d.createElement('span'), inner = d.createElement('span');
        outer.className = 'w'; outer.setAttribute('aria-hidden', 'true');
        inner.style.setProperty('--i', n); inner.textContent = w;
        outer.appendChild(inner); h.appendChild(outer);
        if (n < words.length - 1) h.appendChild(d.createTextNode(' '));
      });
      h.classList.add('reveal-words'); items.push(h);
    });
    $$('[data-route-line]').forEach(function (n) { items.push(n); });
    items.forEach(function (n) { io.observe(n); });
  }
})();
