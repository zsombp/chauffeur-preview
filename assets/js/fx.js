/* Optional flourishes, kept apart from site.js so the core never depends on them.
   1. Weighted inertia scrolling (mouse and trackpad only). OFF unless the visitor switches it on in the footer.
   1b. FAQ rows and the quote sheet open and close smoothly.
   2. The pills: rows of promises that lean away from the pointer and spring back (no library).
   3. A soft light that follows the pointer across tiles.
   All of it stays off for reduced motion. Touch scrolling is never touched. */
(function () {
  'use strict';
  var d = document, root = d.documentElement;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (reduce) return;

  /* ---------- 1. inertia scrolling ----------
     The wheel sets a target; the page eases towards it, so a flick carries on and settles like something with
     mass. Native scrolling stays in charge of everything else: touch, keyboard, scrollbar drag, find-in-page.
     Easing is measured in time, so it feels the same at 60 and 120 Hz. Off by default: the footer has a toggle
     (remembered in this browser) and ?inertia=on in the address does the same. */
  if (fine) {
    var store = function (v) { try { if (v === undefined) return localStorage.getItem('inertia'); localStorage.setItem('inertia', v); } catch (e) { return null; } };
    var q = /[?&]inertia=(on|off)/.exec(location.search); if (q) store(q[1]);
    var on = store() === 'on';   /* native scrolling is the default (Zsomb, 2026-09-20): every premium reference ships it */
    var target = window.scrollY, cur = target, running = false, last = 0, frame = 0;
    var TAU = 115;                 /* ms; higher = heavier */
    var limit = function () { return Math.max(0, root.scrollHeight - window.innerHeight); };
    var loop = function (now) {
      var dt = Math.min(48, now - (last || now - 16)); last = now;
      cur += (target - cur) * (1 - Math.exp(-dt / TAU));
      if (Math.abs(target - cur) < 0.4) { cur = target; running = false; }
      window.scrollTo(0, cur);
      frame = running ? requestAnimationFrame(loop) : 0;
    };
    var halt = function () { running = false; if (frame) { cancelAnimationFrame(frame); frame = 0; } target = cur = window.scrollY; };
    var go = function (y) {
      target = Math.max(0, Math.min(limit(), y));
      if (!running) { running = true; last = 0; cur = window.scrollY; frame = requestAnimationFrame(loop); }
    };
    var scrollsItself = function (node) {
      for (; node && node !== d.body && node.nodeType === 1; node = node.parentElement) {
        var oy = getComputedStyle(node).overflowY;
        if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight + 1) return true;
      }
      return false;
    };
    window.addEventListener('wheel', function (e) {
      if (!on || e.ctrlKey || e.metaKey || e.shiftKey || e.defaultPrevented) return;   /* zoom, sideways */
      if (d.querySelector('dialog[open]') || scrollsItself(e.target)) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;               /* sideways swipes stay native */
      e.preventDefault();
      var unit = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? window.innerHeight : 1;
      go(target + e.deltaY * unit);
    }, { passive: false });
    /* anything that moves the page without us (keys, scrollbar, anchors, the browser) resets the target */
    window.addEventListener('scroll', function () { if (!running) { target = cur = window.scrollY; } }, { passive: true });
    d.addEventListener('keydown', halt);
    window.addEventListener('pointerdown', halt, { passive: true });   /* scrollbar drag, middle click */
    matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', function (e) { if (e.matches) { on = false; halt(); } });
    d.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!on || !a || a.getAttribute('href').length < 2) return;
      var el = d.getElementById(a.getAttribute('href').slice(1));
      if (!el) return;
      e.preventDefault();
      go(el.getBoundingClientRect().top + window.scrollY - 96);
      if (history.replaceState) history.replaceState(null, '', a.getAttribute('href'));
      el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true });
    });
    var wrap = d.querySelector('[data-inertia-wrap]'), tog = d.querySelector('[data-inertia-toggle]');
    if (wrap && tog) {
      var label = tog.querySelector('[data-inertia-state]'), words = [d.body.getAttribute('data-inertia-on') || 'on', d.body.getAttribute('data-inertia-off') || 'off'];
      var paint = function () { tog.setAttribute('aria-pressed', on ? 'true' : 'false'); if (label) label.textContent = on ? words[0] : words[1]; };
      wrap.hidden = false; paint();
      tog.addEventListener('click', function () { on = !on; halt(); store(on ? 'on' : 'off'); paint(); });
    }
  }

  /* ---------- 1b. rows that open and close smoothly ----------
     <details> snaps by default. Here the height is animated both ways; the element stays a real <details>, so
     find-in-page, keyboard and no-JS behaviour are untouched. */
  if (Element.prototype.animate) {
    Array.prototype.forEach.call(d.querySelectorAll('.faq details'), function (det) {
      var sum = det.querySelector('summary'), anim = null, turn = 0;
      if (!sum) return;
      sum.addEventListener('click', function (e) {
        e.preventDefault();
        var mine = ++turn, from = det.offsetHeight, opening = !det.open || det.classList.contains('is-closing');
        if (anim) anim.cancel();
        det.classList.remove('is-closing');
        if (opening) det.open = true;
        var to = opening ? det.scrollHeight : sum.offsetHeight;
        det.style.overflow = 'hidden';
        if (!opening) det.classList.add('is-closing');
        var a2 = anim = det.animate({ height: [from + 'px', to + 'px'] }, { duration: opening ? 360 : 280, easing: 'cubic-bezier(.4,0,.6,1)' });
        /* finish by the animation or by the clock, whichever comes first: a throttled tab must not leave a row stuck */
        var done = function () { if (mine !== turn) return; turn++; if (!opening) det.open = false; det.classList.remove('is-closing'); det.style.overflow = ''; if (anim === a2) { anim = null; a2.cancel(); } };
        a2.onfinish = done; setTimeout(done, (opening ? 360 : 280) + 90);
      });
    });
    /* the quote sheet leaves as gracefully as it arrives. The native close() stays untouched: the exit is
       played from the things a person uses to close it (button, backdrop, Escape), then close() is called. */
    Array.prototype.forEach.call(d.querySelectorAll('dialog.sheet'), function (dlg) {
      var leaving = false;
      var leave = function () {
        if (leaving || !dlg.open) return;
        leaving = true; dlg.classList.add('is-closing');
        setTimeout(function () { dlg.classList.remove('is-closing'); leaving = false; if (dlg.open) dlg.close(); }, 210);
      };
      dlg.addEventListener('cancel', function (e) { e.preventDefault(); leave(); });
      dlg.addEventListener('click', function (e) {
        if (e.target === dlg || (e.target.closest && e.target.closest('[data-close-quote]'))) { e.stopImmediatePropagation(); e.preventDefault(); leave(); }
      }, true);
    });
  }

  /* ---------- 2. the pills ----------
     A normal list, laid out in rows by CSS. With a mouse, each pill is a small mass on a spring: the pointer
     pushes the near ones aside, they overshoot a little and settle back. Nothing runs unless the pointer is
     over the block or something is still moving. */
  var pit = d.querySelector('[data-pit]');
  if (pit && fine) {
    var stage = pit.querySelector('[data-pit-stage]');
    var pills = Array.prototype.map.call(stage.querySelectorAll('li'), function (el) { return { el: el, x: 0, y: 0, vx: 0, vy: 0, cx: 0, cy: 0 }; });
    var px = -9999, py = -9999, praf = 0, plast = 0, inside = false;
    var R = 170, PUSH = 2600, K = 95, DAMP = 11;   /* reach (px), push, spring stiffness, damping */
    var measure = function () {
      var sr = stage.getBoundingClientRect();
      pills.forEach(function (p) { var r = p.el.getBoundingClientRect(); p.cx = r.left - sr.left + r.width / 2 - p.x; p.cy = r.top - sr.top + r.height / 2 - p.y; });
    };
    var tick = function (now) {
      var dt = Math.min(0.032, (now - (plast || now - 16)) / 1000); plast = now;
      var moving = false;
      for (var i = 0; i < pills.length; i++) {
        var p = pills[i], dx = p.cx + p.x - px, dy = p.cy + p.y - py, dist = Math.sqrt(dx * dx + dy * dy) || 1;
        var fx2 = -K * p.x - DAMP * p.vx, fy2 = -K * p.y - DAMP * p.vy;
        if (inside && dist < R) { var f = PUSH * (1 - dist / R) * (1 - dist / R); fx2 += f * dx / dist; fy2 += f * dy / dist; }
        p.vx += fx2 * dt; p.vy += fy2 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        if (Math.abs(p.x) + Math.abs(p.y) + Math.abs(p.vx) + Math.abs(p.vy) > 0.05) moving = true; else { p.x = p.y = p.vx = p.vy = 0; }
        p.el.style.transform = 'translate3d(' + p.x.toFixed(2) + 'px,' + p.y.toFixed(2) + 'px,0) rotate(' + (p.vx * 0.012).toFixed(3) + 'deg)';
      }
      praf = (moving || inside) ? requestAnimationFrame(tick) : 0;
      if (!praf) plast = 0;
    };
    var wake = function () { if (!praf) { plast = 0; praf = requestAnimationFrame(tick); } };
    stage.addEventListener('pointerenter', function () { measure(); inside = true; wake(); });
    stage.addEventListener('pointermove', function (e) { var sr = stage.getBoundingClientRect(); px = e.clientX - sr.left; py = e.clientY - sr.top; inside = true; wake(); });
    stage.addEventListener('pointerleave', function () { inside = false; px = py = -9999; wake(); });
    window.addEventListener('resize', function () { pills.forEach(function (p) { p.x = p.y = p.vx = p.vy = 0; p.el.style.transform = ''; }); });
  }

  /* ---------- 3. pointer light on tiles ----------
     One listener for the page. The tile under the pointer gets two custom properties; CSS paints the glow. */
  if (fine) {
    var lit = null;
    d.addEventListener('pointermove', function (e) {
      var t = e.target.closest && e.target.closest('[data-lit], .card, .route, .vip, .quick__card, .today, .moment');
      if (lit && lit !== t) { lit.classList.remove('is-lit'); lit = null; }
      if (!t) return;
      var r = t.getBoundingClientRect();
      t.style.setProperty('--mx', (e.clientX - r.left).toFixed(0) + 'px'); t.style.setProperty('--my', (e.clientY - r.top).toFixed(0) + 'px');
      if (lit !== t) { t.classList.add('is-lit'); lit = t; }
    }, { passive: true });
  }
})();
