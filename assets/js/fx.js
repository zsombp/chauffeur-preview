/* Optional flourishes, kept apart from site.js so the core never depends on them.
   1. Weighted inertia scrolling (mouse and trackpad only).
   2. The "pit": promise pills that drop, settle and can be thrown around (matter.js, loaded on demand).
   Both stay off for reduced motion. Touch scrolling is never touched. */
(function () {
  'use strict';
  var d = document, root = d.documentElement;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (reduce) return;

  /* ---------- 1. inertia scrolling ----------
     The wheel sets a target; the page eases towards it, so a flick carries on and settles like something with
     mass. Native scrolling stays in charge of everything else: touch, keyboard, scrollbar drag, find-in-page. */
  if (fine) {
    var target = window.scrollY, cur = target, running = false;
    var EASE = 0.09;               /* lower = heavier */
    root.style.scrollBehavior = 'auto';
    var limit = function () { return Math.max(0, root.scrollHeight - window.innerHeight); };
    var loop = function () {
      cur += (target - cur) * EASE;
      if (Math.abs(target - cur) < 0.35) { cur = target; running = false; }
      window.scrollTo(0, cur);
      if (running) requestAnimationFrame(loop);
    };
    var go = function (y) {
      target = Math.max(0, Math.min(limit(), y));
      if (!running) { running = true; cur = window.scrollY; requestAnimationFrame(loop); }
    };
    var scrollsItself = function (node) {
      for (; node && node !== d.body && node.nodeType === 1; node = node.parentElement) {
        var oy = getComputedStyle(node).overflowY;
        if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight + 1) return true;
      }
      return false;
    };
    window.addEventListener('wheel', function (e) {
      if (e.ctrlKey || e.metaKey || e.defaultPrevented) return;          /* pinch zoom, browser zoom */
      if (d.querySelector('dialog[open]') || scrollsItself(e.target)) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;               /* sideways swipes stay native */
      e.preventDefault();
      var unit = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? window.innerHeight : 1;
      go(target + e.deltaY * unit);
    }, { passive: false });
    /* anything that moves the page without us (keys, scrollbar, anchors, the browser) resets the target */
    window.addEventListener('scroll', function () { if (!running) { target = cur = window.scrollY; } }, { passive: true });
    d.addEventListener('keydown', function () { running = false; });
    d.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a || a.getAttribute('href').length < 2) return;
      var el = d.getElementById(a.getAttribute('href').slice(1));
      if (!el) return;
      e.preventDefault();
      go(el.getBoundingClientRect().top + window.scrollY - 96);
      if (history.replaceState) history.replaceState(null, '', a.getAttribute('href'));
      el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true });
    });
  }

  /* ---------- 2. the pit ----------
     The pills are a normal list in the HTML. The physics only takes over their position; the text stays real
     text. matter.js (MIT, self-hosted) is fetched when the pit comes near, never on first load. */
  var pit = d.querySelector('[data-pit]');
  if (!pit || !('IntersectionObserver' in window)) return;
  var started = false;
  var near = new IntersectionObserver(function (es) {
    if (!es[0].isIntersecting || started) return;
    started = true; near.disconnect();
    var s = d.createElement('script'); s.src = pit.getAttribute('data-matter'); s.async = true;
    s.onload = boot; d.head.appendChild(s);
  }, { rootMargin: '60% 0px' });
  near.observe(pit);

  function boot() {
    var M = window.Matter; if (!M) return;
    var stage = pit.querySelector('[data-pit-stage]'), pills = Array.prototype.slice.call(stage.querySelectorAll('li'));
    var sizes = pills.map(function (p) { var r = p.getBoundingClientRect(); return { w: r.width, h: r.height }; });
    var engine = M.Engine.create({ enableSleeping: true });
    engine.gravity.y = 1.05;
    var W, H, walls = [], bodies = [], visible = false, dropped = false, raf = 0;

    function buildWalls() {
      walls.forEach(function (w) { M.Composite.remove(engine.world, w); });
      W = stage.clientWidth; H = stage.clientHeight;
      var t = 200, o = { isStatic: true, friction: 0.6 };
      walls = [M.Bodies.rectangle(W / 2, H + t / 2, W + 2 * t, t, o), M.Bodies.rectangle(-t / 2, H / 2 - 600, t, H + 1600, o), M.Bodies.rectangle(W + t / 2, H / 2 - 600, t, H + 1600, o)];
      M.Composite.add(engine.world, walls);
    }
    function drop() {
      /* go live first, then measure: the stage only has its tall shape once it is live */
      dropped = true; pit.classList.add('is-live'); buildWalls();
      pills.forEach(function (p, i) {
        var s = sizes[i];
        var b = M.Bodies.rectangle(W * (0.15 + 0.7 * ((i * 0.37) % 1)), -80 - i * 95, s.w, s.h,
          { chamfer: { radius: s.h / 2 - 1 }, restitution: 0.32, friction: 0.45, frictionAir: 0.012, density: 0.0016, angle: (i % 2 ? 1 : -1) * (0.15 + (i * 0.07) % 0.4) });
        b._el = p; b._w = s.w; b._h = s.h; bodies.push(b);
      });
      M.Composite.add(engine.world, bodies);
      if (fine) {
        var mouse = M.Mouse.create(stage);
        /* matter.js swallows the wheel over its element by default: give the page its scroll back */
        ['wheel', 'mousewheel', 'DOMMouseScroll'].forEach(function (ev) { mouse.element.removeEventListener(ev, mouse.mousewheel); });
        M.Composite.add(engine.world, M.MouseConstraint.create(engine, { mouse: mouse, constraint: { stiffness: 0.16, damping: 0.2, render: { visible: false } } }));
      }
    }
    function frame() {
      raf = 0;
      if (!visible) return;
      M.Engine.update(engine, 1000 / 60);
      for (var i = 0; i < bodies.length; i++) {
        var b = bodies[i];
        if (b.position.y > H + 400) M.Body.setPosition(b, { x: W / 2, y: -100 }), M.Body.setVelocity(b, { x: 0, y: 0 });
        b._el.style.transform = 'translate(' + (b.position.x - b._w / 2).toFixed(1) + 'px,' + (b.position.y - b._h / 2).toFixed(1) + 'px) rotate(' + b.angle.toFixed(3) + 'rad)';
      }
      raf = requestAnimationFrame(frame);
    }
    buildWalls();
    new IntersectionObserver(function (es) {
      visible = es[0].isIntersecting;
      if (visible && !dropped && es[0].intersectionRatio > 0.25) drop();
      if (visible && dropped && !raf) raf = requestAnimationFrame(frame);
    }, { threshold: [0, 0.25, 0.6] }).observe(pit);
    var rt; window.addEventListener('resize', function () {
      clearTimeout(rt); rt = setTimeout(function () { buildWalls(); bodies.forEach(function (b) { M.Sleeping.set(b, false); if (b.position.x > W - 20) M.Body.setPosition(b, { x: W / 2, y: b.position.y }); }); }, 200);
    });
  }
})();
