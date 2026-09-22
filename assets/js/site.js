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
    form.addEventListener('submit', function (e) { if (form._step === 1) { e.preventDefault(); goStep(form, 2); return; } submit(e, form); });
    if (form.hasAttribute('data-steps')) {
      var nx = $('[data-next]', form), bk = $('[data-back]', form), cp = $('[data-copy-recap]', form);
      if (nx) nx.addEventListener('click', function () { goStep(form, 2); });
      if (bk) bk.addEventListener('click', function () { goStep(form, 1, true); });
      if (cp) cp.addEventListener('click', function () {
        var txt = recap(form).join(' · ');
        var ok = function () { var o = cp.textContent; cp.textContent = L.copied; setTimeout(function () { cp.textContent = o; }, 1600); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, function () {}); 
      });
      goStep(form, 1, true, true);
    }
  });

  /* ---------- the request in two steps ----------
     Step 1 is the journey, step 2 is who is asking. The journey is read back as one line before anything is
     sent. Without JavaScript both steps simply show, so the form still works. */
  function recap(form) {
    var v = function (n) { var el = form.elements[n]; return el && el.value ? String(el.value).trim() : ''; };
    var svc = $('input[name=service]:checked', form), cls = $('select[name=vehicle_class]', form);
    var out = [];
    if (svc) out.push(svc.value);
    if (cls && cls.selectedOptions[0]) out.push(cls.selectedOptions[0].textContent);
    var dv = v('date'), nice = dv;
    if (dv) { try { nice = new Date(dv + 'T12:00:00').toLocaleDateString(d.documentElement.lang || 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) {} }
    var when = [nice, v('time')].filter(Boolean).join(', '); if (when) out.push(when);
    if (v('pickup') || v('destination')) out.push([v('pickup'), v('destination')].filter(Boolean).join(' to '));
    else if (v('route')) out.push(v('route'));
    if (v('passengers')) out.push(v('passengers') + ' ' + (v('passengers') === '1' ? L.pax_one : L.pax_many));
    if (v('luggage')) out.push(v('luggage') + ' ' + (v('luggage') === '1' ? L.bag_one : L.bag_many));
    if (v('flight_number')) out.push(v('flight_number'));
    var product = productOf(form), pr = product && cls ? priceFor(product, cls.value) : null;
    out.push(pr ? pr.text + ' ' + L.price_note : L.price_tbc);
    return out;
  }
  function goStep(form, n, skipCheck, silent) {
    var s1 = $('[data-step="1"]', form), s2 = $('[data-step="2"]', form); if (!s1 || !s2) return;
    if (n === 2 && !skipCheck) {
      clearErr(form);
      var bad = $$('input,select,textarea', s1).filter(function (i) { return i.willValidate && !i.checkValidity(); });
      if (bad.length) { bad.forEach(function (i) { setErr(i, i.validity.valueMissing ? L.required : L.invalid); }); bad[0].focus(); say(form, L.fix, 'error'); return; }
      say(form, '');
    }
    form._step = n;
    s1.hidden = n !== 1; s2.hidden = n !== 2;
    var back = $('[data-back]', form); if (back) back.hidden = n !== 2;
    var label = $('[data-step-label]', form); if (label) label.textContent = n === 1 ? L.step1 : L.step2;
    if (n === 2) { var box = $('[data-recap]', form); if (box) { $('[data-recap-text]', box).textContent = recap(form).join(' · '); box.hidden = false; } }
    if (!silent && label) { label.focus({ preventScroll: true }); var sc = form.closest('.formbox'); if (sc && sc.scrollTo) sc.scrollTo({ top: 0 }); }
  }

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
    if (form.hasAttribute('data-steps')) goStep(form, 1, true, true);
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
      var lines = [L.wa_hello, waText(data.get('service'), data.get('date'))];
      [['pickup', L.f_pickup], ['destination', L.f_dest], ['route', L.f_route], ['time', L.f_time], ['vehicle_class', L.f_class], ['passengers', L.f_pax], ['luggage', L.f_bags], ['flight_number', L.f_flight], ['note', L.f_note]].forEach(function (k) {
        if (data.get(k[0])) lines.push(k[1] + ': ' + (k[0] === 'vehicle_class' ? $('select[name=vehicle_class]', form).selectedOptions[0].textContent : data.get(k[0])));
      });
      lines.push(L.wa_price + ': ' + (pr ? pr.text : L.price_tbc));
      lines.push(L.wa_close);
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
      /* say which class and journey the figure belongs to: the hero says from 65, this box may say 75 */
      var what = d.createElement('span'); what.className = 'quick__what';
      what.textContent = (qc.selectedOptions[0] ? qc.selectedOptions[0].textContent : '') + (qr.selectedOptions[0] ? ', ' + qr.selectedOptions[0].textContent : '');
      out.appendChild(what);
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

  /* ---------- film ----------
     A short rendered film that plays by itself when it comes into view, holds its last frame and can be played
     again. It used to be scrubbed by the scroll position: a scrubbed image sequence only changes picture when
     the page moves far enough, so slow scrolling looked like a low frame rate however it was smoothed. A video
     plays at its own steady rate. Reduced motion and data saver keep the poster; the captions are a plain list. */
  var film = $('[data-film]');
  var conn = navigator.connection || {};
  if (film && 'IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches && !conn.saveData) {
    var vid = $('video', film), caps = $$('[data-cap]', film), again = $('[data-film-toggle]', film);
    var src = film.getAttribute(matchMedia('(max-width: 760px)').matches ? 'data-src-m' : 'data-src');
    var armed = false, ended = false, giveUp = 0, inView = false;
    var go = function () { if (armed && inView && !ended && vid.readyState >= 2) { var pr = vid.play(); if (pr && pr.catch) pr.catch(function () {}); } };
    var showCaps = function () {
      var p = vid.duration ? vid.currentTime / vid.duration : 0;
      caps.forEach(function (c2, k) { var lo = k / caps.length, hi = (k + 1) / caps.length; c2.classList.toggle('is-on', ended ? k === caps.length - 1 : (p >= lo + 0.03 && p < hi)); });
    };
    var arm = function () {
      if (armed) return; armed = true;
      vid.src = src; vid.load();
      giveUp = setTimeout(function () { if (vid.readyState < 2) { vid.removeAttribute('src'); vid.load(); film.classList.remove('is-live'); } }, 8000);
      vid.addEventListener('loadeddata', function () { clearTimeout(giveUp); film.classList.add('is-live'); go(); }, { once: true });
      vid.addEventListener('timeupdate', showCaps);
      vid.addEventListener('ended', function () { ended = true; showCaps(); if (again) again.hidden = false; });
      if (again) again.addEventListener('click', function () { ended = false; again.hidden = true; vid.currentTime = 0; vid.play(); });
    };
    new IntersectionObserver(function (es) { if (es[0].isIntersecting) arm(); }, { rootMargin: '150% 0px' }).observe(film);
    new IntersectionObserver(function (es) {
      inView = es[0].intersectionRatio >= 0.5;
      if (inView) go(); else if (!vid.paused) vid.pause();
    }, { threshold: [0, 0.5, 1] }).observe(film);
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
