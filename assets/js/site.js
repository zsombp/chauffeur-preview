/* Chauffeur service site. No dependencies. Without JS every price is already in the HTML and the forms show
   mail and phone instead of a send button. */
(function () {
  'use strict';
  var d = document, body = d.body;
  var $ = function (s, r) { return (r || d).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); };
  var PRICES = {};
  try { PRICES = JSON.parse($('#price-data').textContent); } catch (e) {}
  var T0 = Date.now();

  /* ---------- consent (basic mode: no Google script before Accept) ---------- */
  var GA4 = body.getAttribute('data-ga4'), ADS = body.getAttribute('data-ads');
  var KEY = 'consent.v1';
  var banner = $('[data-consent]');
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  var loaded = false;
  function loadGoogle() {
    if (loaded || (!GA4 && !ADS)) return;
    loaded = true;
    gtag('consent', 'default', { ad_storage: 'denied', analytics_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    gtag('consent', 'update', { ad_storage: 'granted', analytics_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted' });
    var s = d.createElement('script'); s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA4 || ADS);
    d.head.appendChild(s);
    gtag('js', new Date());
    if (GA4) gtag('config', GA4);
    if (ADS) gtag('config', ADS);
  }
  function getConsent() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function setConsent(v) { try { localStorage.setItem(KEY, v); } catch (e) {} if (banner) banner.hidden = true; if (v === 'granted') loadGoogle(); }
  if (banner) {
    var c = getConsent();
    if (c === 'granted') loadGoogle();
    /* The banner only matters when there is something to consent to. */
    else if (!c && (GA4 || ADS)) banner.hidden = false;
    $('[data-consent-accept]').addEventListener('click', function () { setConsent('granted'); });
    $('[data-consent-reject]').addEventListener('click', function () { setConsent('denied'); });
    $$('[data-consent-open]').forEach(function (b) { b.addEventListener('click', function () { banner.hidden = false; $('[data-consent-accept]').focus(); }); });
  }
  function track(name, params) {
    params = params || {}; params.product = params.product || body.getAttribute('data-page');
    if (loaded) gtag('event', name, params);
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
  if (burger && nav) burger.addEventListener('click', function () {
    var open = nav.classList.toggle('is-open'); burger.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  /* ---------- prices ---------- */
  function money(n) { return '€' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  /* Returns {text, note} for a product + class, or null when the owners have not set a price. */
  function priceFor(product, cls, hours) {
    var p = PRICES.products && PRICES.products[product];
    if (!p) return null;
    if (product === 'vip' || cls === 'vip') {
      var rate = PRICES.products.vip.rate;
      return { text: money(rate) + ' ' + PRICES.labels.per_hour, hourly: true };
    }
    var v = p[cls];
    if (v == null) return null;
    if (p.unit === 'hour') {
      var h = Math.max(parseInt(hours, 10) || p.min_hours, p.min_hours);
      return { text: money(v) + ' ' + PRICES.labels.per_hour, total: money(v * h), hours: h, hourly: true };
    }
    return { text: money(v) };
  }

  /* ---------- quote forms ---------- */
  var sheet = $('[data-sheet]');
  var waLinks = $$('[data-wa-link]');
  var waBase = 'https://wa.me/' + body.getAttribute('data-wa');
  function waText(service, date) {
    var tpl = body.getAttribute('data-wa-text');
    /* Without a date the sentence must still read properly. */
    if (!date) tpl = tpl.replace(/\s+\S+\s+\{date\}/, '');
    return tpl.replace('{service}', service || '').replace('{date}', date || '').replace(/\s+/g, ' ').trim();
  }
  function refreshWa(service, date) {
    var href = waBase + '?text=' + encodeURIComponent(waText(service, date));
    waLinks.forEach(function (a) { a.href = href; });
  }
  refreshWa($('[data-quote-form] input[name=service]:checked') ? $('[data-quote-form] input[name=service]:checked').value : '', '');

  function productOf(form) {
    var r = $('input[name=service]:checked', form);
    var skey = r ? r.getAttribute('data-skey') : '';
    var preset = form.getAttribute('data-product');
    if (skey === 'airport') return 'airport';
    if (skey === 'hourly') return 'hourly';
    if (skey === 'tour') return 'tours';
    if (skey === 'city') return (preset && PRICES.routes && PRICES.routes[preset]) ? preset : matchRoute($('input[name=route]', form).value);
    return preset;
  }
  function matchRoute(text) {
    text = (text || '').toLowerCase();
    if (/vienna airport|schwechat|vie\b/.test(text)) return 'vienna_airport';
    if (/vienna|wien|b[eé]cs/.test(text)) return 'vienna';
    if (/prague|praha|pr[aá]ga/.test(text)) return 'prague';
    if (/bratislava|pozsony/.test(text)) return 'bratislava';
    return '';
  }
  function updateSum(form) {
    var box = $('[data-price-sum]', form); if (!box) return;
    var cls = $('select[name=vehicle_class]', form).value;
    var product = productOf(form);
    var pr = product ? priceFor(product, cls) : null;
    if (!pr) { box.hidden = true; return; }
    $('[data-price-out]', box).textContent = pr.text;
    box.hidden = false;
  }
  $$('[data-quote-form]').forEach(function (form) {
    $('input[name=page]', form).value = location.pathname;
    $('input[name=t0]', form).value = String(T0);
    var date = $('input[name=date]', form);
    var today = new Date(); today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    date.min = today.toISOString().slice(0, 10);
    form.addEventListener('input', function () { updateSum(form); });
    form.addEventListener('change', function () {
      updateSum(form);
      var r = $('input[name=service]:checked', form);
      refreshWa(r ? r.value : '', date.value);
    });
    updateSum(form);
    form.addEventListener('submit', function (e) { submit(e, form); });
  });

  function openQuote(btn) {
    if (!sheet || !sheet.showModal) { location.hash = '#quote'; return; }
    var form = $('[data-quote-form]', sheet);
    if (btn) {
      var cls = btn.getAttribute('data-class'), product = btn.getAttribute('data-product'), route = btn.getAttribute('data-route');
      if (cls) $('select[name=vehicle_class]', form).value = cls;
      if (product) {
        form.setAttribute('data-product', product);
        var skey = product === 'airport' ? 'airport' : product === 'hourly' || product === 'vip' ? 'hourly' : product === 'tours' ? 'tour' : 'city';
        var radio = $('input[data-skey="' + skey + '"]', form); if (radio) radio.checked = true;
      }
      if (route) $('input[name=route]', form).value = route;
      var dt = btn.getAttribute('data-date'); if (dt) $('input[name=date]', form).value = dt;
    }
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
    input.setAttribute('aria-invalid', 'true');
    var holder = input.closest('.field') || input.closest('fieldset');
    if (holder && !$('.err', holder)) { var s = d.createElement('span'); s.className = 'err'; s.textContent = msg; holder.appendChild(s); }
  }
  function clearErr(form) { $$('[aria-invalid]', form).forEach(function (i) { i.removeAttribute('aria-invalid'); }); $$('.err', form).forEach(function (n) { n.remove(); }); }

  function submit(e, form) {
    var status = $('[data-form-status]', form), L = PRICES.labels || {};
    clearErr(form);
    var bad = $$('input,select,textarea', form).filter(function (i) { return i.willValidate && !i.checkValidity(); });
    if (bad.length) {
      e.preventDefault();
      bad.forEach(function (i) { setErr(i, i.validity.valueMissing ? L.required : L.invalid); });
      bad[0].focus(); status.setAttribute('data-state', 'error'); status.textContent = L.fix; return;
    }
    /* Spam traps: a filled honeypot or a submit faster than a human. Pretend success, send nothing. */
    var trapped = $('input[name=website]', form).value || (Date.now() - T0 < 3000);
    var endpoint = form.getAttribute('data-endpoint');
    var data = new FormData(form);
    var product = productOf(form), cls = data.get('vehicle_class');
    var pr = product ? priceFor(product, cls) : null;
    data.set('quoted_price', pr ? pr.text : 'on request');
    data.set('product', product || '');
    if (!endpoint) {
      /* No endpoint configured yet: hand the request to WhatsApp, which needs no server. */
      e.preventDefault();
      if (trapped) return;
      var lines = [waText(data.get('service'), data.get('date'))];
      ['route', 'time', 'vehicle_class', 'passengers', 'luggage', 'name', 'email', 'phone', 'note'].forEach(function (k) {
        if (data.get(k)) lines.push(k.replace('_', ' ') + ': ' + data.get(k));
      });
      track('generate_lead', { method: 'whatsapp_fallback', product: product });
      window.open(waBase + '?text=' + encodeURIComponent(lines.join('\n')), '_blank', 'noopener');
      status.removeAttribute('data-state'); status.textContent = L.sent_whatsapp; return;
    }
    e.preventDefault();
    var btn = $('button[type=submit]', form); btn.disabled = true; status.removeAttribute('data-state'); status.textContent = L.sending;
    if (trapped) { setTimeout(function () { location.href = PRICES.thanks_url; }, 600); return; }
    /* Form-encoded keeps this a simple request: Apps Script has no OPTIONS handler. */
    fetch(endpoint, { method: 'POST', body: new URLSearchParams(data), redirect: 'follow' })
      .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.text(); })
      .then(function () { track('generate_lead', { method: 'form', product: product }); location.href = PRICES.thanks_url; })
      .catch(function () { btn.disabled = false; status.setAttribute('data-state', 'error'); status.textContent = L.error; });
  }

  /* ---------- quick quote bar (home) ---------- */
  var quick = $('[data-quick]');
  if (quick) {
    var qs = $('[name=q_service]', quick), qr = $('[name=q_route]', quick), qc = $('[name=q_class]', quick), qd = $('[name=q_date]', quick);
    var out = $('[data-quick-price]', quick), go = $('[data-quick-go]', quick);
    qd.min = $('[data-quote-form] input[name=date]').min;
    var sync = function () {
      var svc = qs.value;
      $$('option', qr).forEach(function (o) { o.hidden = o.getAttribute('data-for') !== svc; });
      if (qr.selectedOptions[0] && qr.selectedOptions[0].hidden) { var f = $$('option', qr).filter(function (o) { return !o.hidden; })[0]; if (f) qr.value = f.value; }
      var product = qr.value, cls = qc.value;
      var pr = priceFor(product, cls);
      out.innerHTML = '';
      var strong = d.createElement('strong'); strong.className = 'num';
      strong.textContent = pr ? pr.text : PRICES.labels.on_request; out.appendChild(strong);
      var span = d.createElement('span');
      var min = PRICES.products[product] && PRICES.products[product].min_hours;
      span.textContent = pr ? (PRICES.labels.price_note + (pr.hourly && min ? ' ' + PRICES.labels.min_hours.replace('{n}', min) : '')) : PRICES.labels.on_request_note;
      out.appendChild(span);
      if (cls === 's') { var n = d.createElement('span'); n.className = 'chip'; n.textContent = PRICES.labels.s_note; out.appendChild(n); }
      go.setAttribute('data-product', product); go.setAttribute('data-class', cls);
      go.setAttribute('data-route', qr.selectedOptions[0] ? qr.selectedOptions[0].textContent : '');
      go.setAttribute('data-date', qd.value);
    };
    [qs, qr, qc, qd].forEach(function (el) { el.addEventListener('change', sync); });
    sync();
  }

  /* ---------- reveal ---------- */
  var items = $$('.reveal');
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
    items.forEach(function (n) { io.observe(n); });
  } else items.forEach(function (n) { n.classList.add('is-in'); });
})();
