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
      if (all.vip && all.vip.on_request) return null;   /* price and availability on request (Zsomb, 2026-09-28) */
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

  /* ---------- the booking panel ----------
     Vince, 2026-09-28: "Book Your Chauffeur" is for the rides with a fixed price, "Get a Free Quote" is a personal
     inquiry for a tailored offer. Both stay short ("just book it, we chase them for the rest") and both end in
     WhatsApp. Without an endpoint the form is a WhatsApp handover: the guest reads the message and sends it there.
     The only required field is a phone number (Vince): what the guest typed, their phone and, if they book for
     someone else, the passenger's details travel in that link, which the guest sends themselves. */
  var sheet = $('[data-sheet]');
  var waBase = 'https://wa.me/' + body.getAttribute('data-wa');
  var MAIL = body.getAttribute('data-mail') || '';
  var PLACES = PRICES.places || [], TOURS = PRICES.tours || {}, JOURNEYS = PRICES.journeys || [], CITIES = PRICES.cities || [];
  function waText(service, date) {
    var tpl = body.getAttribute('data-wa-text');
    /* Without a date the sentence must still read properly. */
    if (!date) tpl = tpl.replace(/\s+\S+\s+\{date\}/, '');
    return tpl.replace('{service}', service || '').replace('{date}', date || '').replace(/\s+/g, ' ').trim();
  }
  function field(form, name) { var el = form.elements[name]; return el && el.value != null ? String(el.value).trim() : ''; }
  function checked(form, name) { var r = $('input[name="' + name + '"]:checked', form); return r ? r.value : ''; }
  function labelOf(input) { return input ? input.parentNode.textContent.trim() : ''; }
  /* "City to city" carries its city (Zsomb, 2026-09-28: four journeys, the city is picked inside). */
  function productOf(form) { var j = checked(form, 'journey'); return j === 'city' ? field(form, 'city') : j; }
  function routeText(form) {
    var s = form.elements.city;
    if (checked(form, 'journey') !== 'city' || !s || !s.value) return '';
    var name = s.selectedOptions[0].textContent, abroadFirst = (s.value === 'vienna_airport') !== !!form._flip;
    return L.city_route.replace('{a}', abroadFirst ? name : L.budapest).replace('{b}', abroadFirst ? L.budapest : name);
  }
  function journeyText(form) {
    var label = labelOf($('input[name=journey]:checked', form)), r = routeText(form);
    return r ? label + ', ' + r : label;
  }
  /* The page's WhatsApp links carry the page's own journey and nothing a visitor typed. */
  (function () {
    /* a route without a price yet (its page opens on the quote tab) names itself */
    var bf = $('form[data-kind=book]'), own = body.getAttribute('data-wa-service');
    var href = waBase + '?text=' + encodeURIComponent(waText(own || (bf ? routeText(bf) || labelOf($('input[name=journey]:checked', bf)) : ''), ''));
    $$('[data-wa-link]').forEach(function (a) { a.href = href; });
  })();
  function newId() {
    try { return crypto.randomUUID(); } catch (e) { return String(Date.now()) + Math.random().toString(16).slice(2); }
  }
  function today() { var t = new Date(); t.setMinutes(t.getMinutes() - t.getTimezoneOffset()); return t.toISOString().slice(0, 10); }
  function niceDate(v) {
    if (!v) return '';
    /* English reads the European way here: "Wed 14 October 2026" */
    try { return new Date(v + 'T12:00:00').toLocaleDateString(!root.lang || root.lang === 'en' ? 'en-GB' : root.lang, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return v; }
  }

  /* ---------- place picker ----------
     Pick-up and drop-off come from a short list of verified places (the airport, stations, hotels, sights), so a
     guest picks "Kempinski" instead of typing a street they may not know. Anything else can still be typed. The
     map link opens Google Maps in a new tab; nothing is loaded from Google on this page. */
  function fold(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
  var GROUPS = {};
  PLACES.forEach(function (p, n) {
    p._n = fold(p.name); p._k = ' ' + fold([p.name, p.address].concat(p.aliases || []).join(' ')); p._i = n;
    if (!(p.group in GROUPS)) GROUPS[p.group] = Object.keys(GROUPS).length;
  });
  function placeById(id) { return PLACES.filter(function (p) { return p.id === id; })[0] || null; }
  function findPlaces(q) {
    var f = fold(q);
    if (!f) return PLACES.filter(function (p) { return p.top; });
    var words = f.split(' ');
    return PLACES.map(function (p) {
      if (!words.every(function (w) { return p._k.indexOf(w) !== -1; })) return null;
      return { p: p, s: p._n.indexOf(f) === 0 ? 0 : p._k.indexOf(' ' + words[0]) !== -1 ? 1 : 2 };
    }).filter(Boolean).sort(function (a, b) { return a.s - b.s || a.p._i - b.p._i; }).slice(0, 8)
      /* the best eight, shown under their group headings */
      .sort(function (a, b) { return GROUPS[a.p.group] - GROUPS[b.p.group] || a.s - b.s || a.p._i - b.p._i; }).map(function (x) { return x.p; });
  }
  function mapLink(p) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(p.name + ', ' + p.address); }
  function initPlace(box) {
    var input = $('input[type=text]', box), addr = $('input[type=hidden]', box), list = $('.place__list', box), detail = $('[data-place-detail]', box);
    var found = [], active = -1;
    input.setAttribute('role', 'combobox'); input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false'); input.setAttribute('aria-controls', list.id);
    input._ph = input.placeholder;
    var close = function () { list.hidden = true; box.classList.remove('is-open'); input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); active = -1; };
    var paint = function () {
      var p = box._place; detail.textContent = '';
      box.classList.toggle('has-place', !!p);
      if (!p) { detail.hidden = true; return; }
      var a = d.createElement('span'); a.textContent = p.address; detail.appendChild(a);
      var l = d.createElement('a'); l.href = mapLink(p); l.target = '_blank'; l.rel = 'noopener'; l.textContent = L.map; detail.appendChild(l);
      detail.hidden = false;
    };
    var set = function (p, text) { box._place = p || null; input.value = p ? p.name : (text || ''); addr.value = p ? p.address : ''; paint(); };
    var pick = function (n) { if (!found[n]) return; set(found[n]); close(); input.dispatchEvent(new Event('change', { bubbles: true })); };
    var render = function () {
      found = PLACES.length ? findPlaces(input.value) : []; active = -1; list.textContent = '';
      var group = '';
      found.forEach(function (p, n) {
        if (p.group !== group) { group = p.group; var h = d.createElement('li'); h.className = 'place__group'; h.setAttribute('role', 'presentation'); h.textContent = group; list.appendChild(h); }
        var li = d.createElement('li'); li.id = list.id + '-' + n; li.className = 'place__opt'; li.setAttribute('role', 'option'); li.setAttribute('aria-selected', 'false');
        var nm = d.createElement('span'); nm.textContent = p.name; var ad = d.createElement('small'); ad.textContent = p.address;
        li.appendChild(nm); li.appendChild(ad);
        li.addEventListener('pointerdown', function (e) { e.preventDefault(); });   /* the field keeps the focus */
        li.addEventListener('click', function () { pick(n); });
        list.appendChild(li);
      });
      var open = found.length > 0 && d.activeElement === input;
      list.hidden = !open; box.classList.toggle('is-open', open);
      input.setAttribute('aria-expanded', open ? 'true' : 'false'); input.removeAttribute('aria-activedescendant');
    };
    var move = function (step) {
      var opts = $$('.place__opt', list); if (!opts.length) return;
      active = (active + step + opts.length) % opts.length;
      opts.forEach(function (o, n) { o.setAttribute('aria-selected', n === active ? 'true' : 'false'); });
      input.setAttribute('aria-activedescendant', opts[active].id);
      opts[active].scrollIntoView({ block: 'nearest' });
    };
    input.addEventListener('focus', render);
    input.addEventListener('input', function () { box._place = null; addr.value = ''; paint(); render(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (list.hidden) render(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (!list.hidden) move(-1); }
      else if (e.key === 'Enter' && !list.hidden && active > -1) { e.preventDefault(); pick(active); }
      else if (e.key === 'Escape' && !list.hidden) { e.preventDefault(); e.stopPropagation(); close(); }   /* the sheet stays open */
    });
    input.addEventListener('blur', function () {
      close();
      /* a listed place typed out in full counts as picked */
      if (!box._place && input.value) {
        var f = fold(input.value), hit = PLACES.filter(function (p) { return p._n === f; })[0];
        if (hit) { set(hit); input.dispatchEvent(new Event('change', { bubbles: true })); }
      }
    });
    box._set = set;
  }

  /* ---------- the fixed-price booking ---------- */
  function show(form, key, on) {
    $$('[data-show="' + key + '"]', form).forEach(function (el) {
      el.hidden = !on;
      $$('input,select,textarea', el).forEach(function (i) { i.disabled = !on; });
    });
  }
  function isAirport(box) {
    if (!box) return false;
    if (box._place) return box._place.id === 'bud';
    return /\b(airport|ferihegy|liszt ferenc|bud)\b|rept[eé]r/i.test($('input[type=text]', box).value) && !matchRoute($('input[type=text]', box).value);
  }
  function ridePrice(form, cls) {
    var j = checked(form, 'journey'), key = productOf(form), all = PRICES.products || {};
    if (cls === 'vip') return null;   /* the VIP line is priced in the reply */
    if (j === 'tours') { var t = TOURS[field(form, 'tour')]; return cls === 'v' && t ? { eur: t.eur, text: money(t.eur) } : null; }
    if (j === 'hourly') {
      var r = all.hourly && all.hourly[cls]; if (r == null) return null;
      var h = Math.max(all.hourly.min_hours || 1, Math.min(24, parseInt(field(form, 'hours'), 10) || 0));
      return { eur: r * h, text: money(r * h), rate: money(r), hours: h };
    }
    var named = matchRoute([field(form, 'pickup'), field(form, 'destination')].join(' '));
    if (j === 'airport') {
      /* the airport price is Budapest Airport and Budapest: another city at either end is priced in the reply */
      if (named) return null;
      if (field(form, 'pickup') && field(form, 'destination') && !isAirport(form._pick) && !isAirport(form._drop)) return null;
    } else if (named && named !== key) return null;   /* for example Vienna Airport typed on the Vienna route */
    var p = all[key] && all[key][cls];
    return p == null ? null : { eur: p, text: money(p) };
  }
  function paintPrices(form) {
    $$('.car', form).forEach(function (c) {
      var pr = ridePrice(form, c.getAttribute('data-car')), out = $('[data-car-price]', c);
      out.textContent = pr ? (pr.rate ? pr.rate + ' ' + L.per_hour : pr.text) : c.getAttribute('data-car') === 'vip' ? L.vip_req : L.on_request;
      c.classList.toggle('is-req', !pr);
    });
    var box = $('[data-price-sum]', form), out = $('[data-price-out]', box), note = $('[data-price-note]', box);
    var pr = ridePrice(form, field(form, 'vehicle_class')), j = checked(form, 'journey');
    var before = out.textContent;
    if (pr) {
      out.textContent = pr.text;
      note.textContent = (pr.hours ? L.for_hours.replace('{n}', pr.hours).replace('{rate}', pr.rate) + ' ' : '') + L.price_note;
    } else {
      out.textContent = L.price_tbc;
      note.textContent = field(form, 'vehicle_class') === 'vip' ? L.vip_req : j === 'airport' && !matchRoute([field(form, 'pickup'), field(form, 'destination')].join(' ')) ? L.airport_hint : '';
    }
    box.classList.toggle('is-tbc', !pr);
    box.hidden = false;
    if (before && before !== out.textContent) { box.classList.remove('is-new'); void box.offsetWidth; box.classList.add('is-new'); }
  }
  function placeholders(form) {
    var j = checked(form, 'journey'), key = productOf(form), city = j === 'city' ? (L.cities || {})[key] : '';
    var pick = $('input[name=pickup]', form), drop = $('input[name=destination]', form);
    pick.placeholder = pick._ph; drop.placeholder = drop._ph;
    if (city) ((key === 'vienna_airport') !== !!form._flip ? pick : drop).placeholder = L.abroad_ph.replace('{city}', city);
  }
  function setJourney(form) {
    var j = checked(form, 'journey'), ride = j !== 'hourly' && j !== 'tours';
    form.setAttribute('data-journey', j);
    show(form, 'tours', j === 'tours'); show(form, 'hourly', j === 'hourly'); show(form, 'ride', ride); show(form, 'airport', j === 'airport');
    show(form, 'city', j === 'city');
    /* the airport is filled in for an airport transfer, and taken out again if it was only our suggestion */
    var bud = placeById('bud');
    if (form._auto && (j !== 'airport') && form._auto._place === bud) { form._auto._set(null, ''); form._auto = null; }
    if (j === 'airport' && bud && !field(form, 'pickup') && !field(form, 'destination')) { form._auto = form._flip ? form._drop : form._pick; form._auto._set(bud); }
    /* private tours are V-Class tours */
    $$('.car', form).forEach(function (c) { var off = j === 'tours' && c.getAttribute('data-car') !== 'v'; c.hidden = off; $('input', c).disabled = off; });
    if (j === 'tours') { var v = $('.car[data-car=v] input', form); if (v) v.checked = true; }
    placeholders(form); paintPrices(form);
  }

  /* ---------- both forms ---------- */
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
  function valid(form) {
    clearErr(form);
    /* the one thing we need: a phone number, at least seven digits */
    $$('input[name=phone]', form).forEach(function (i) { i.setCustomValidity(i.value && (i.value.match(/\d/g) || []).length < 7 ? L.phone_invalid : ''); });
    var bad = $$('input,select,textarea', form).filter(function (i) { return i.willValidate && !i.checkValidity(); });
    if (!bad.length) { say(form, ''); return true; }
    bad.forEach(function (i) { setErr(i, i.validity.valueMissing ? L.required : i.validity.customError ? i.validationMessage : L.invalid); });
    var more = bad[0].closest('details'); if (more) more.open = true;
    bad[0].focus(); say(form, L.fix, 'error');
    return false;
  }
  function placeText(box, form, name) { var p = box && box._place; return p ? p.name + ', ' + p.address : field(form, name); }
  function lines(form) {
    var book = form.getAttribute('data-kind') === 'book', out = [];
    var add = function (label, v) { if (v) out.push(label + ': ' + v); };
    if (book) {
      var j = checked(form, 'journey'), c = $('input[name=vehicle_class]:checked', form);
      out.push(L.wa_book_hello);
      add(L.f_journey, journeyText(form));
      if (j === 'tours' && TOURS[field(form, 'tour')]) add(L.f_tour, TOURS[field(form, 'tour')].label);
      /* the airport we filled in ourselves only counts once the guest has given the other end too */
      var auto = form._auto && form._auto._place && form._auto._place.id === 'bud' && !field(form, form._auto === form._pick ? 'destination' : 'pickup') ? form._auto : null;
      if (form._pick !== auto) add(L.f_pickup, placeText(form._pick, form, 'pickup'));
      if (j !== 'hourly' && j !== 'tours' && form._drop !== auto) add(L.f_dest, placeText(form._drop, form, 'destination'));
      if (j === 'hourly') add(L.f_hours, field(form, 'hours'));
      add(L.f_when, [niceDate(field(form, 'date')), field(form, 'time')].filter(Boolean).join(', '));
      add(L.f_class, c ? $('.car__name', c.closest('.car')).textContent : '');
      if (j === 'airport') add(L.f_flight, field(form, 'flight_number'));
    } else {
      var s = form.elements.vehicle_class;
      out.push(L.wa_quote_hello);
      add(L.f_request, field(form, 'message'));
      add(L.f_date, niceDate(field(form, 'date')));
      add(L.f_class, s && s.value ? s.selectedOptions[0].textContent : '');
    }
    add(L.f_pax, field(form, 'passengers'));
    add(L.f_bags, field(form, 'luggage'));
    if ($('[data-other-toggle]', form).checked) add(L.f_passenger, [field(form, 'passenger_name'), field(form, 'passenger_phone'), field(form, 'company')].filter(Boolean).join(', '));
    add(L.f_note, field(form, 'note'));
    add(L.f_phone, field(form, 'phone')); add(L.f_email, field(form, 'email')); add(L.f_name, field(form, 'name'));
    if (book) {
      var pr = ridePrice(form, field(form, 'vehicle_class'));
      out.push(L.wa_price + ': ' + (pr ? pr.text + (pr.hours ? ' ' + L.for_hours.replace('{n}', pr.hours).replace('{rate}', pr.rate) : '.') + ' ' + L.price_note : L.price_tbc));
      out.push(L.wa_close);
    }
    return out;
  }
  function send(form, via) {
    if (!valid(form)) return;
    /* Spam signals: the hidden field, and a send within 1.5 s of the form becoming visible. A trapped send is
       told to try again. It is never shown a success it did not have. */
    if (field(form, 'website') || performance.now() - form._shown < 1500) { say(form, L.retry, 'error'); return; }
    var book = form.getAttribute('data-kind') === 'book', product = book ? productOf(form) : 'quote';
    var text = lines(form).join('\n');
    if (via === 'whatsapp') {
      /* The visitor reviews and sends the message in WhatsApp: that is the contact, so this counts as a
         WhatsApp click, not as a lead. With noopener the return value is null even on success. */
      var btn = $('button[type=submit]', form); btn.disabled = true;
      window.open(waBase + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
      setTimeout(function () { btn.disabled = false; }, 2500);
      track('whatsapp_click', { method: 'form_handoff', product: product });
      say(form, L.sent_whatsapp); return;
    }
    if (via === 'mail') {
      location.href = 'mailto:' + MAIL + '?subject=' + encodeURIComponent(book ? L.mail_book : L.mail_quote) + '&body=' + encodeURIComponent(text);
      track('email_click', { method: 'form_handoff', product: product });
      say(form, L.sent_mail); return;
    }
    var alt = $('[data-send-alt]', form);
    var data = new FormData(form), pr = book ? ridePrice(form, field(form, 'vehicle_class')) : null;
    data.set('quoted_price', pr ? pr.text : 'on request'); data.set('product', product); data.set('summary', text);
    data.set('elapsed_ms', String(Math.round(performance.now() - form._shown))); data.delete('website');
    alt.disabled = true; say(form, L.sending);
    /* Form-encoded keeps this a simple request: Apps Script has no OPTIONS handler. */
    fetch(form.getAttribute('data-endpoint'), { method: 'POST', body: new URLSearchParams(data), redirect: 'follow' })
      .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(function (res) {
        if (!res || res.ok !== true) throw new Error('rejected');
        track('generate_lead', { method: 'form', product: product });
        location.href = PRICES.thanks_url;
      })
      /* The backend dedups on request_id, so pressing send again after an unreadable response is safe. */
      .catch(function () { alt.disabled = false; say(form, L.error, 'error'); });
  }
  var forms = $$('[data-quote-form]');
  forms.forEach(function (form) {
    var book = form.getAttribute('data-kind') === 'book';
    form._shown = performance.now();
    $('input[name=page]', form).value = location.pathname;
    $('input[name=request_id]', form).value = newId();
    $$('input[type=date]', form).forEach(function (i) { i.min = today(); });
    /* WhatsApp is the way in. The second button sends the same by email, or, once the form has its own
       endpoint, posts the request to the owners directly. */
    var direct = !!form.getAttribute('data-endpoint');
    var alt = $('[data-send-alt]', form);
    if (direct) alt.textContent = L.direct_action;
    alt.addEventListener('click', function () { send(form, direct ? 'post' : 'mail'); });
    form.addEventListener('submit', function (e) { e.preventDefault(); send(form, 'whatsapp'); });
    var ot = $('[data-other-toggle]', form), ob = $('[data-other-body]', form);
    var other = function () { ob.hidden = !ot.checked; $$('input', ob).forEach(function (i) { i.disabled = !ot.checked; }); };
    ot.addEventListener('change', other); other();
    if (!book) return;
    form._pick = $('[data-place=pickup]', form); form._drop = $('[data-place=destination]', form);
    initPlace(form._pick); initPlace(form._drop);
    form._defaults = { journey: checked(form, 'journey'), cls: checked(form, 'vehicle_class') || 'v' };
    $$('input[name=journey]', form).forEach(function (r) { r.addEventListener('change', function () { setJourney(form); }); });
    form.addEventListener('input', function (e) { if (e.target.name !== 'journey') paintPrices(form); });
    form.addEventListener('change', function (e) { if (e.target.name === 'city') placeholders(form); if (e.target.name !== 'journey') paintPrices(form); });
    var sw = $('[data-swap]', form);
    sw.addEventListener('click', function () {
      var a = form._pick, b = form._drop, pa = a._place, ta = $('input[type=text]', a).value;
      a._set(b._place, $('input[type=text]', b).value); b._set(pa, ta);
      if (form._auto) form._auto = form._auto === a ? b : a;
      form._flip = !form._flip; placeholders(form); paintPrices(form);
      sw.classList.remove('is-turning'); void sw.offsetWidth; sw.classList.add('is-turning');
    });
    setJourney(form);
  });

  /* ---------- tabs ---------- */
  var panels = $$('[data-panel]');
  function setTab(panel, tab, focus) {
    panel.setAttribute('data-tab', tab);
    $$('[data-tab-btn]', panel).forEach(function (b) { var on = b.getAttribute('data-tab-btn') === tab; b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
    $$('[data-pane]', panel).forEach(function (p) { p.hidden = p.getAttribute('data-pane') !== tab; });
    var f = $('[data-pane="' + tab + '"] form', panel); if (f) f._shown = performance.now();
  }
  panels.forEach(function (panel) {
    $$('[data-tab-btn]', panel).forEach(function (b) {
      b.addEventListener('click', function () { setTab(panel, b.getAttribute('data-tab-btn')); });
      b.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); setTab(panel, panel.getAttribute('data-tab') === 'book' ? 'quote' : 'book', true); }
      });
    });
    setTab(panel, panel.getAttribute('data-start') || 'book');
  });

  /* ---------- the sheet ----------
     Every "Book Your Chauffeur" and "Get a Free Quote" button opens it. The button names the journey, the class,
     the tour or the date; everything else starts from the page's own defaults, and places already typed stay. */
  function openSheet(btn) {
    if (!sheet || !sheet.showModal) { location.hash = '#quote'; return; }
    var panel = $('[data-panel]', sheet), book = $('form[data-kind=book]', sheet), quote = $('form[data-kind=quote]', sheet);
    var g = function (a) { return (btn && btn.getAttribute(a)) || ''; };
    var product = g('data-product'), cls = g('data-class'), label = g('data-route') || g('data-service');
    var isCity = CITIES.indexOf(product) !== -1;
    var canBook = !product || JOURNEYS.indexOf(product) !== -1 || isCity;
    var tab = g('data-tab') || (canBook ? 'book' : 'quote');
    setTab(panel, tab);
    if (tab === 'book') {
      var r = $('input[name=journey][value="' + (isCity ? 'city' : product && canBook ? product : book._defaults.journey) + '"]', book); if (r) r.checked = true;
      if (isCity && book.elements.city) book.elements.city.value = product;
      var c = $('input[name=vehicle_class][value="' + (/^(e|v|s|vip)$/.test(cls) ? cls : book._defaults.cls) + '"]', book); if (c) c.checked = true;
      var tour = g('data-tour');
      if (tour) { var o = $$('option', book.elements.tour).filter(function (x) { return x.value.indexOf(tour + ':') === 0; })[0]; if (o) book.elements.tour.value = o.value; }
      if (g('data-date')) book.elements.date.value = g('data-date');
      setJourney(book);
    } else {
      if (label && !field(quote, 'message')) quote.elements.message.value = label + '. ';
      if (/^(e|v|s|vip)$/.test(cls)) quote.elements.vehicle_class.value = cls;
    }
    sheet.showModal();
    track('quote_open', { product: product || tab });
  }
  d.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-open-quote]');
    if (b) { e.preventDefault(); openSheet(b); }
    if (e.target.closest && e.target.closest('[data-close-quote]')) sheet.close();
    if (sheet && e.target === sheet) sheet.close();
  });
  /* "Bratislava, Vienna Airport or another city? Get a free quote": the quote tab of the same panel, with the
     request begun, so the guest only types the city. */
  d.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-ask-quote]'), panel = b && b.closest('[data-panel]');
    if (!panel) return;
    setTab(panel, 'quote');
    var q = $('form[data-kind=quote]', panel), m = q && q.elements.message;
    if (!m) return;
    if (!m.value) m.value = L.city_quote_prefill;
    m.focus(); try { m.setSelectionRange(m.value.length, m.value.length); } catch (x) {}
  });
  /* A link can open the sheet straight away: /#book-now or /#get-a-quote (for ads, mails, the owners' profiles). */
  var direct = { '#book-now': 'book', '#get-a-quote': 'quote' }[location.hash];
  if (direct && sheet && sheet.showModal) { var tb = d.createElement('button'); tb.setAttribute('data-tab', direct); openSheet(tb); }
  /* Back from the thank-you page out of bfcache: the form must be usable again. */
  window.addEventListener('pageshow', function (ev) {
    if (!ev.persisted) return;
    forms.forEach(function (form) {
      $('button[type=submit]', form).disabled = false; $('[data-send-alt]', form).disabled = false; say(form, '');
      $('input[name=request_id]', form).value = newId(); form._shown = performance.now();
    });
  });

  /* ---------- quick quote bar (home) ---------- */
  var quick = $('[data-quick]');
  if (quick) {
    var qs = $('[name=q_service]', quick), qr = $('[name=q_route]', quick), qc = $('[name=q_class]', quick), qd = $('[name=q_date]', quick);
    var out = $('[data-quick-price]', quick), go = $('[data-quick-go]', quick);
    qd.min = today();
    var sync = function () {
      var svc = qs.value;
      $$('option', qr).forEach(function (o) { var off = o.getAttribute('data-for') !== svc; o.hidden = off; o.disabled = off; });
      if (qr.selectedOptions[0] && qr.selectedOptions[0].disabled) { var f = $$('option', qr).filter(function (o) { return !o.disabled; })[0]; if (f) qr.value = f.value; }
      var product = qr.value, cls = qc.value, pr = priceFor(product, cls);
      while (out.firstChild) out.removeChild(out.firstChild);
      /* say which class and journey the figure belongs to */
      var what = d.createElement('span'); what.className = 'quick__what';
      what.textContent = (qc.selectedOptions[0] ? qc.selectedOptions[0].textContent : '') + (qr.selectedOptions[0] ? ', ' + qr.selectedOptions[0].textContent : '');
      out.appendChild(what);
      var strong = d.createElement('strong'); strong.className = 'num';
      strong.textContent = pr ? pr.text : L.on_request; out.appendChild(strong);
      var span = d.createElement('span');
      span.textContent = pr ? (L.price_note + (pr.min ? ' ' + L.min_hours.replace('{n}', pr.min) : '')) : L.on_request_note;
      out.appendChild(span);
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
    /* the brass rule under a section label draws itself; the fleet page's cars glide in */
    $$('.sec__head .eyebrow, .statement .eyebrow').forEach(function (n) { n.classList.add('draw-rule'); items.push(n); });
    $$('.reveal-car').forEach(function (n) { items.push(n); });
    /* siblings arrive one after another; the delay is dropped once they are in, so hovers stay instant */
    $$('.reveal').forEach(function (n) {
      var sib = Array.prototype.filter.call(n.parentNode.children, function (c) { return c.classList.contains('reveal'); });
      n.style.setProperty('--i', String(Math.max(0, sib.indexOf(n))));
    });
    items.forEach(function (n) { io.observe(n); });
    d.addEventListener('transitionend', function (e) { if (e.target.classList && e.target.classList.contains('is-in')) e.target.style.removeProperty('--i'); });
  }

  /* ---------- staging preview panel ----------
     Only on the preview build: the car ground and each piece of motion can be compared on and off. The choice
     stays in this browser. The inline script in the head applies it before the first paint. */
  var lab = $('[data-lab]');
  if (lab) {
    var LK = 'lab.v1', st = {};
    try { st = JSON.parse(localStorage.getItem(LK) || '{}'); } catch (e) {}
    st.off = st.off || []; st.cars = st.cars || 'studio';
    var apply = function () {
      ['plain', 'float'].forEach(function (k) { root.classList.toggle('lab-cars-' + k, st.cars === k); });
      ['arrival', 'ambient', 'glide', 'unveil', 'rules', 'sheen'].forEach(function (k) { root.classList.toggle('lab-no-' + k, st.off.indexOf(k) !== -1); });
      try { localStorage.setItem(LK, JSON.stringify(st)); } catch (e) {}
    };
    $$('input[name=lab-cars]', lab).forEach(function (r) { r.checked = r.value === st.cars; r.addEventListener('change', function () { st.cars = r.value; apply(); }); });
    $$('[data-lab-motion]', lab).forEach(function (c) {
      var k = c.getAttribute('data-lab-motion'); c.checked = st.off.indexOf(k) === -1;
      c.addEventListener('change', function () { st.off = st.off.filter(function (x) { return x !== k; }); if (!c.checked) st.off.push(k); apply(); });
    });
    var lb = $('[data-lab-btn]', lab), lbox = $('#lab-box');
    lb.addEventListener('click', function () { lbox.hidden = !lbox.hidden; lb.setAttribute('aria-expanded', lbox.hidden ? 'false' : 'true'); });
    apply();
  }
})();
