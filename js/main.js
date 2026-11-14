/*!
 * SUN Energy landing — page behaviour
 *
 *   1. Frame scaling      — the 1920px Figma frame is scaled to the viewport width
 *   2. Light rays         — hero background (js/light-rays.js)
 *   3. Card backgrounds   — js/card-backgrounds.js
 *   4. Liquid Gooey Nav   — hover pill that melts between the nav links
 *   5. Origin buttons     — radial fill that starts at, and follows, the cursor
 *   6. Glass              — specular rim + edge refraction for the Figma "Glass" effect
 */
(function () {
  'use strict';

  var DESIGN_WIDTH = 1920;
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------------ */
  /* 1. Frame scaling                                                    */
  /* ------------------------------------------------------------------ */
  var viewport = document.getElementById('viewport');
  var page = document.getElementById('page');

  // Desktop (≥ 1280px) shows the 1920px Figma frame scaled to the viewport.
  // Tablet and mobile use their own fluid layouts (see the media queries in style.css).
  var desktopQuery = window.matchMedia('(min-width: 1280px)');

  function fitPage() {
    if (!desktopQuery.matches) {
      page.style.transform = '';
      viewport.style.height = '';
      document.documentElement.style.setProperty('--page-scale', '1');
      return;
    }
    var scale = document.documentElement.clientWidth / DESIGN_WIDTH;
    page.style.transform = 'scale(' + scale + ')';
    viewport.style.height = Math.ceil(page.offsetHeight * scale) + 'px';
    document.documentElement.style.setProperty('--page-scale', String(scale));
  }

  fitPage();
  window.addEventListener('resize', fitPage);
  window.addEventListener('load', fitPage);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitPage);

  /* ------------------------------------------------------------------ */
  /* 2. Light rays (configuration from the design)                       */
  /* ------------------------------------------------------------------ */
  if (window.LightRays) {
    window.LightRays.create(document.getElementById('light-rays'), {
      raysOrigin: 'top-center',
      raysColor: '#f97316',
      raysSpeed: 1,
      lightSpread: 0.5,
      rayLength: 3,
      glow: 0.6,
      haze: 0.25,
      followMouse: true,
      mouseInfluence: 0.1
    });
  }

  /* ------------------------------------------------------------------ */
  /* 3. Card backgrounds                                                 */
  /* ------------------------------------------------------------------ */
  if (window.CardBackgrounds) window.CardBackgrounds.init(document);

  /* ------------------------------------------------------------------ */
  /* 4. Liquid Gooey Nav                                                 */
  /* One pill inside an SVG goo filter (blur 8 + alpha contrast 18 / -7),*/
  /* moved between items by a spring (stiffness 350, damping 28).        */
  /* The design has no active item, so the pill only exists on hover.    */
  /* ------------------------------------------------------------------ */
  function initGooeyNav(nav) {
    var pill = nav.querySelector('.nav__pill');
    var links = Array.prototype.slice.call(nav.querySelectorAll('.nav__link'));
    if (!pill || !links.length) return;

    var STIFFNESS = 350;
    var DAMPING = 28;
    var keys = ['x', 'y', 'w', 'h'];
    var cur = { x: 0, y: 0, w: 0, h: 0 };
    var vel = { x: 0, y: 0, w: 0, h: 0 };
    var goal = { x: 0, y: 0, w: 0, h: 0 };
    var shown = false;
    var raf = 0;
    var last = 0;

    function rectOf(link) {
      return { x: link.offsetLeft, y: link.offsetTop, w: link.offsetWidth, h: link.offsetHeight };
    }

    function paint() {
      pill.style.transform = 'translate3d(' + cur.x.toFixed(2) + 'px,' + cur.y.toFixed(2) + 'px,0)';
      pill.style.width = Math.max(0, cur.w).toFixed(2) + 'px';
      pill.style.height = Math.max(0, cur.h).toFixed(2) + 'px';
    }

    function step(now) {
      raf = 0;
      var dt = Math.min(0.032, (now - last) / 1000 || 0.016);
      last = now;
      var moving = false;
      // fixed sub-steps keep the spring stable at any frame rate
      var steps = Math.max(1, Math.round(dt / 0.004));
      var h = dt / steps;
      for (var s = 0; s < steps; s++) {
        for (var i = 0; i < keys.length; i++) {
          var k = keys[i];
          var accel = -STIFFNESS * (cur[k] - goal[k]) - DAMPING * vel[k];
          vel[k] += accel * h;
          cur[k] += vel[k] * h;
        }
      }
      for (var j = 0; j < keys.length; j++) {
        var key = keys[j];
        if (Math.abs(vel[key]) > 0.02 || Math.abs(cur[key] - goal[key]) > 0.02) moving = true;
        else { cur[key] = goal[key]; vel[key] = 0; }
      }
      paint();
      if (moving) raf = requestAnimationFrame(step);
    }

    function run() {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(step);
    }

    function setGoal(rect, snap) {
      goal.x = rect.x; goal.y = rect.y; goal.w = rect.w; goal.h = rect.h;
      if (snap || reducedMotion) {
        keys.forEach(function (k) { cur[k] = goal[k]; vel[k] = 0; });
        paint();
      } else {
        run();
      }
    }

    function activate(link) {
      var rect = rectOf(link);
      links.forEach(function (l) { l.classList.toggle('is-active', l === link); });
      if (!shown) {
        // grow out of the item's centre like a drop
        shown = true;
        var seed = { x: rect.x + rect.w * 0.25, y: rect.y + rect.h * 0.2, w: rect.w * 0.5, h: rect.h * 0.6 };
        keys.forEach(function (k) { cur[k] = seed[k]; vel[k] = 0; });
        paint();
        nav.classList.add('is-hover');
      }
      setGoal(rect);
    }

    function deactivate() {
      if (!shown) return;
      shown = false;
      links.forEach(function (l) { l.classList.remove('is-active'); });
      nav.classList.remove('is-hover');
      // melt back into the centre while the layer fades out
      setGoal({ x: cur.x + cur.w * 0.2, y: cur.y + cur.h * 0.15, w: cur.w * 0.6, h: cur.h * 0.7 });
    }

    links.forEach(function (link) {
      link.addEventListener('pointerenter', function () { activate(link); });
      link.addEventListener('focus', function () {
        if (link.matches(':focus-visible')) activate(link);
      });
    });
    nav.addEventListener('pointerleave', deactivate);
    nav.addEventListener('focusout', function (event) {
      if (!nav.contains(event.relatedTarget) && !nav.matches(':hover')) deactivate();
    });
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-gooey-nav]'), initGooeyNav);

  /* ------------------------------------------------------------------ */
  /* 5. Origin buttons — radial fill, Follow Cursor ON                   */
  /* A circle centred on the cursor scales 0 -> 1 on enter and 1 -> 0 on */
  /* leave; while hovered its centre follows the cursor. Its diameter is */
  /* always just enough to cover the farthest corner of the button.      */
  /* ------------------------------------------------------------------ */
  function initOriginButton(btn) {
    var fill = btn.querySelector('.btn__fill');
    if (!fill) return;

    var FOLLOW = 0.2;                       // cursor follow smoothing per frame @60fps
    var cx = 0, cy = 0, tx = 0, ty = 0;
    var raf = 0;

    function local(event) {
      var r = btn.getBoundingClientRect();
      var sx = r.width ? btn.offsetWidth / r.width : 1;      // undo the page transform
      var sy = r.height ? btn.offsetHeight / r.height : 1;
      return {
        x: Math.min(Math.max((event.clientX - r.left) * sx, 0), btn.offsetWidth),
        y: Math.min(Math.max((event.clientY - r.top) * sy, 0), btn.offsetHeight)
      };
    }

    function place() {
      var w = btn.offsetWidth;
      var h = btn.offsetHeight;
      var d = 2 * Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy)) + 2;
      fill.style.width = d + 'px';
      fill.style.height = d + 'px';
      fill.style.transform = 'translate3d(' + (cx - d / 2).toFixed(2) + 'px,' + (cy - d / 2).toFixed(2) + 'px,0)';
    }

    function loop() {
      raf = 0;
      cx += (tx - cx) * FOLLOW;
      cy += (ty - cy) * FOLLOW;
      if (Math.abs(tx - cx) < 0.1 && Math.abs(ty - cy) < 0.1) { cx = tx; cy = ty; }
      place();
      if (cx !== tx || cy !== ty) raf = requestAnimationFrame(loop);
    }

    function follow(point) {
      tx = point.x;
      ty = point.y;
      if (reducedMotion) { cx = tx; cy = ty; place(); return; }
      if (!raf) raf = requestAnimationFrame(loop);
    }

    function enter(point) {
      if (!btn.classList.contains('is-hover')) {
        cx = tx = point.x;
        cy = ty = point.y;
        place();
        // commit the start position before the scale transition begins
        void fill.offsetWidth;
      }
      btn.classList.add('is-hover');
    }

    btn.addEventListener('pointerenter', function (event) { enter(local(event)); });
    btn.addEventListener('pointermove', function (event) {
      if (btn.classList.contains('is-hover')) follow(local(event));
    });
    btn.addEventListener('pointerleave', function (event) {
      follow(local(event));                 // shrink towards the exit point
      btn.classList.remove('is-hover');
    });
    btn.addEventListener('pointercancel', function () { btn.classList.remove('is-hover'); });

    // keyboard: fill from the centre
    btn.addEventListener('focus', function () {
      if (btn.matches(':focus-visible')) enter({ x: btn.offsetWidth / 2, y: btn.offsetHeight / 2 });
    });
    btn.addEventListener('blur', function () {
      if (!btn.matches(':hover')) btn.classList.remove('is-hover');
    });
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-origin-button]'), initOriginButton);

  /* ------------------------------------------------------------------ */
  /* 5b. Menu (tablet / mobile) — Figma "Menu Button" + "Mobile Menu"    */
  /* ------------------------------------------------------------------ */
  function initMenu(toggle) {
    var header = toggle.closest('.header');
    var menu = document.getElementById(toggle.getAttribute('aria-controls'));
    if (!header || !menu) return;

    function setOpen(open) {
      header.classList.toggle('is-menu-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Закрити меню' : 'Відкрити меню');
      menu.inert = !open;
      if (open) initGlass(menu);
    }

    toggle.addEventListener('click', function () {
      setOpen(!header.classList.contains('is-menu-open'));
    });
    menu.addEventListener('click', function (event) {
      if (event.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && header.classList.contains('is-menu-open')) {
        setOpen(false);
        toggle.focus();
      }
    });
    document.addEventListener('pointerdown', function (event) {
      if (!header.classList.contains('is-menu-open')) return;
      if (menu.contains(event.target) || toggle.contains(event.target)) return;
      setOpen(false);
    });
    desktopQuery.addEventListener('change', function () { setOpen(false); });
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-menu-toggle]'), initMenu);

  /* ------------------------------------------------------------------ */
  /* 6. Glass                                                            */
  /* Figma's Glass effect = frost + light + refraction/depth/dispersion. */
  /*   frost       -> CSS backdrop blur (style.css)                      */
  /*   light       -> a 1px specular rim shaded by the edge normal       */
  /*   refraction  -> SVG displacement map on the backdrop (Chromium)    */
  /* ------------------------------------------------------------------ */
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var isChromium = !!(navigator.userAgentData && navigator.userAgentData.brands &&
    navigator.userAgentData.brands.some(function (b) { return b.brand === 'Chromium'; })) ||
    (/Chrome\//.test(navigator.userAgent) && !/Edg\/|OPR\//.test(navigator.userAgent) && !!window.chrome);
  if (/Edg\//.test(navigator.userAgent)) isChromium = true;

  function cssNumber(style, name, fallback) {
    var value = parseFloat(style.getPropertyValue(name));
    return isFinite(value) ? value : fallback;
  }

  // Signed distance + outward normal of a rounded rectangle with per-corner radii.
  function roundedRect(w, h, radii) {
    var hw = w / 2;
    var hh = h / 2;
    var maxR = Math.min(hw, hh);
    var r = {
      tl: Math.min(radii.tl, maxR), tr: Math.min(radii.tr, maxR),
      bl: Math.min(radii.bl, maxR), br: Math.min(radii.br, maxR)
    };
    return function (px, py) {
      var x = px - hw;
      var y = py - hh;
      var rad = x < 0 ? (y < 0 ? r.tl : r.bl) : (y < 0 ? r.tr : r.br);
      var sx = x < 0 ? -1 : 1;
      var sy = y < 0 ? -1 : 1;
      var qx = Math.abs(x) - (hw - rad);
      var qy = Math.abs(y) - (hh - rad);
      var nx, ny, dist;
      if (qx > 0 && qy > 0) {
        var len = Math.hypot(qx, qy) || 1;
        dist = len - rad;
        nx = (qx / len) * sx;
        ny = (qy / len) * sy;
      } else if (qx > qy) {
        dist = qx - rad;
        nx = sx; ny = 0;
      } else {
        dist = qy - rad;
        nx = 0; ny = sy;
      }
      return { d: dist, nx: nx, ny: ny };   // d < 0 inside
    };
  }

  function drawRim(el, w, h, sdf, lightAngle, intensity) {
    var ratio = 2;
    var canvas = document.createElement('canvas');
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
    var ctx = canvas.getContext('2d');
    var image = ctx.createImageData(canvas.width, canvas.height);
    var data = image.data;
    // Figma light angle: 0° = from the top, positive = clockwise.
    var a = (lightAngle * Math.PI) / 180;
    var lx = Math.sin(a);
    var ly = -Math.cos(a);
    var bevel = 1;                              // px, Figma bevel size
    for (var py = 0; py < canvas.height; py++) {
      for (var px = 0; px < canvas.width; px++) {
        var s = sdf((px + 0.5) / ratio, (py + 0.5) / ratio);
        var inside = -s.d;
        if (inside < 0 || inside > bevel + 0.75) continue;
        var band = Math.min(1, inside / 0.5) * Math.min(1, Math.max(0, (bevel + 0.75 - inside) / 0.75));
        var facing = s.nx * lx + s.ny * ly;     // 1 = edge faces the light
        // tight highlight where the edge faces the light, mirrored on the far side
        var lit = facing > 0 ? Math.pow(facing, 8) : 0.8 * Math.pow(-facing, 8);
        var alpha = Math.min(1, intensity * (0.07 + 0.93 * lit)) * band;
        var o = (py * canvas.width + px) * 4;
        data[o] = 255; data[o + 1] = 255; data[o + 2] = 255;
        data[o + 3] = Math.round(alpha * 255);
      }
    }
    ctx.putImageData(image, 0, 0);
    el.style.setProperty('--glass-rim', 'url(' + canvas.toDataURL('image/png') + ')');
    el.classList.add('has-rim');
  }

  var glassCount = 0;
  function addRefraction(el, w, h, sdf, depth, refraction, dispersion, frost) {
    var defs = document.querySelector('.svg-defs defs');
    if (!defs) return;
    var canvas = document.createElement('canvas');
    canvas.width = Math.round(w);
    canvas.height = Math.round(h);
    var ctx = canvas.getContext('2d');
    var image = ctx.createImageData(canvas.width, canvas.height);
    var data = image.data;
    var maxShift = depth * refraction * 0.6;    // px at the very edge
    var scale = Math.max(1, maxShift * 2);
    for (var py = 0; py < canvas.height; py++) {
      for (var px = 0; px < canvas.width; px++) {
        var s = sdf(px + 0.5, py + 0.5);
        var inside = -s.d;
        var o = (py * canvas.width + px) * 4;
        var dx = 0, dy = 0;
        if (inside >= 0 && inside < depth) {
          var t = 1 - inside / depth;           // 1 at the edge, 0 where the bevel ends
          var shift = maxShift * t * t;
          dx = -s.nx * shift;                   // sample towards the centre: a convex edge
          dy = -s.ny * shift;
        }
        data[o] = Math.round(128 + (dx / scale) * 255);
        data[o + 1] = Math.round(128 + (dy / scale) * 255);
        data[o + 2] = 128;
        data[o + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);

    var id = el.__glassFilterId || (el.__glassFilterId = 'glass-refraction-' + (++glassCount));
    var old = document.getElementById(id);
    if (old) old.remove();
    var filter = document.createElementNS(SVG_NS, 'filter');
    filter.setAttribute('id', id);
    filter.setAttribute('color-interpolation-filters', 'sRGB');
    filter.setAttribute('x', '0');
    filter.setAttribute('y', '0');
    filter.setAttribute('width', '100%');
    filter.setAttribute('height', '100%');

    function node(name, attrs) {
      var n = document.createElementNS(SVG_NS, name);
      for (var key in attrs) n.setAttribute(key, attrs[key]);
      filter.appendChild(n);
      return n;
    }

    var map = node('feImage', { x: 0, y: 0, width: w, height: h, preserveAspectRatio: 'none', result: 'map' });
    map.setAttribute('href', canvas.toDataURL('image/png'));

    // dispersion: red bends a little more than blue
    var spread = 0.25 * dispersion;
    var channels = [
      { s: scale * (1 + spread), m: '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0', r: 'r' },
      { s: scale, m: '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0', r: 'g' },
      { s: scale * (1 - spread), m: '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0', r: 'b' }
    ];
    channels.forEach(function (c) {
      node('feDisplacementMap', { in: 'SourceGraphic', in2: 'map', scale: c.s.toFixed(2), xChannelSelector: 'R', yChannelSelector: 'G', result: 'd' + c.r });
      node('feColorMatrix', { in: 'd' + c.r, type: 'matrix', values: c.m, result: c.r });
    });
    node('feBlend', { in: 'r', in2: 'g', mode: 'screen', result: 'rg' });
    node('feBlend', { in: 'rg', in2: 'b', mode: 'screen' });
    defs.appendChild(filter);

    var value = 'url(#' + id + ') blur(' + frost + 'px)';
    el.style.setProperty('-webkit-backdrop-filter', value);
    el.style.setProperty('backdrop-filter', value);
  }

  function initGlass(el) {
    var w = el.offsetWidth;
    var h = el.offsetHeight;
    if (!w || !h) return;
    var style = getComputedStyle(el);
    var sizeKey = [w, h, style.borderRadius].join('|');
    if (el.__glassKey === sizeKey) return;
    el.__glassKey = sizeKey;
    var sdf = roundedRect(w, h, {
      tl: parseFloat(style.borderTopLeftRadius) || 0,
      tr: parseFloat(style.borderTopRightRadius) || 0,
      bl: parseFloat(style.borderBottomLeftRadius) || 0,
      br: parseFloat(style.borderBottomRightRadius) || 0
    });
    var frost = cssNumber(style, '--glass-frost', 0);
    drawRim(el, w, h, sdf, cssNumber(style, '--glass-light-angle', 315), cssNumber(style, '--glass-light', 0.5));

    // With heavy frost the refracted backdrop is blurred away anyway, so the
    // displacement pass is only worth its cost on lightly frosted glass.
    if (isChromium && frost <= 8) {
      addRefraction(el, w, h, sdf,
        cssNumber(style, '--glass-depth', 16),
        cssNumber(style, '--glass-refraction', 0.5),
        cssNumber(style, '--glass-dispersion', 0),
        frost);
    }
  }

  function initAllGlass() {
    Array.prototype.forEach.call(document.querySelectorAll('.glass'), initGlass);
  }

  // Layout changes between breakpoints resize the glass, so redraw it after a resize settles.
  var glassTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(glassTimer);
    glassTimer = setTimeout(initAllGlass, 150);
  });


  // Sizes depend on the webfont, so wait for it.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(initAllGlass);
  else window.addEventListener('load', initAllGlass);

  /* ------------------------------------------------------------------ */
  /* 7. Content reveal — React Bits AnimatedContent (js/animated-content.js) */
  /*    distance 100, vertical, 0.8s power3.out, stagger 0.08, threshold 0.1 */
  /* ------------------------------------------------------------------ */
  var REVEAL = { distance: 100, direction: 'vertical', duration: 0.8, ease: 'power3.out', blur: 0, threshold: 0.1 };

  function num(value, fallback) {
    var n = parseFloat(value);
    return isFinite(n) ? n : fallback;
  }

  // Items marked data-animate-row animate one by one, but only among the items
  // that share a row on the current layout (3 + 2 cards on desktop, 2 + 2 + 1 on
  // tablet, one per row on mobile), each row starting when it scrolls in.
  function rowDelay(el) {
    var step = num(el.getAttribute('data-animate-row'), 0);
    if (!step) return 0;
    var top = Math.round(el.getBoundingClientRect().top);
    var peers = Array.prototype.filter.call(el.parentNode.parentNode.querySelectorAll('[data-animate-row]'), function (p) {
      return Math.abs(Math.round(p.getBoundingClientRect().top) - top) < 2;
    });
    peers.sort(function (a, b) { return a.getBoundingClientRect().left - b.getBoundingClientRect().left; });
    return peers.indexOf(el) * step;
  }

  function initReveal() {
    if (!window.AnimatedContent) {
      document.documentElement.classList.remove('js');
      return;
    }
    Array.prototype.forEach.call(document.querySelectorAll('[data-animate]'), function (el) {
      var opts = {};
      for (var k in REVEAL) opts[k] = REVEAL[k];
      opts.trigger = el.getAttribute('data-animate-trigger') || 'scroll';
      opts.stagger = num(el.getAttribute('data-animate-stagger'), 0);
      opts.delay = num(el.getAttribute('data-animate-delay'), 0) + rowDelay(el);
      opts.items = el.getAttribute('data-animate-items') || null;
      // lets CSS run follow-up moments once a block has landed (e.g. the hero underline)
      opts.onComplete = function () { el.classList.add('is-revealed'); };
      window.AnimatedContent(el, opts);
    });
    if (window.ScrollTrigger) window.ScrollTrigger.refresh();
  }

  // Start once the webfont is in (the hero would otherwise re-wrap mid-animation),
  // but never wait longer than 800ms.
  (function () {
    var started = false;
    function start() {
      if (started) return;
      started = true;
      fitPage();
      initReveal();
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(start);
    setTimeout(start, 800);
  })();
})();
