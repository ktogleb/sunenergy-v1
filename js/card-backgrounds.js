/*!
 * Card backgrounds for the "Benefits" section.
 *
 *   bars     — Gradient Bars background (CSS, 15 bars)
 *   arc      — Originkit "Predictive Arc"            (red, preset from the design)
 *   horizon  — Originkit "Predictive Arc 2 / Horizon" (blue)
 *   echo     — Originkit "Predictive Arc 04 / Echo"   (magenta)
 *   signal   — Originkit "Predictive Arc 03 / Signal" (green)
 *
 * The four dot fields are vanilla ports of the Originkit components: the
 * fragment shaders are theirs, verbatim, plus one `uOff` uniform. The
 * components are authored for a 1200 × 800 stage, and the Figma cards show a
 * crop of that stage — so each field is rendered on a *virtual* stage of the
 * original size and the card shows the same crop ("focus") as the design.
 */
(function (global) {
  'use strict';

  var MAX_DPR = 2;

  /* ------------------------------------------------------------------ */
  /* Gradient Bars                                                       */
  /* ------------------------------------------------------------------ */
  function createBars(host, numBars) {
    var total = numBars || 15;
    var wrap = document.createElement('div');
    wrap.className = 'bars';
    wrap.style.setProperty('--bars', total);
    for (var index = 0; index < total; index++) {
      var position = index / (total - 1);
      var distanceFromCenter = Math.abs(position - 0.5);
      var heightPercentage = Math.pow(distanceFromCenter * 2, 1.2);
      var height = 30 + (100 - 30) * heightPercentage;
      var bar = document.createElement('div');
      bar.className = 'bars__bar';
      bar.style.setProperty('--initial-scale', (height / 100).toFixed(4));
      bar.style.setProperty('--i', index);
      wrap.appendChild(bar);
    }
    host.appendChild(wrap);
  }

  /* ------------------------------------------------------------------ */
  /* Dot fields — shared GLSL                                            */
  /* ------------------------------------------------------------------ */
  var VERT_SRC = 'attribute vec2 a_pos;\nvoid main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }\n';

  var PRECISION = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    ''
  ].join('\n');

  // Cell lookup shared by every field. `fc` is gl_FragCoord shifted into the
  // virtual stage, so the card can show any crop of it.
  var CELL = [
    '  vec2 fc = gl_FragCoord.xy + uOff;',
    '  float cs = max(uCell, 2.0);',
    '  vec2 ci = floor(fc / cs);',
    '  vec2 cc = (ci + 0.5) * cs;               // cell centre, device px',
    ''
  ].join('\n');

  function ink(coverage) {
    return [
      '  vec3 col = uBg;',
      '  if (i > 0.02) {',
      '    float side = uDot * i * uDpr;',
      '    vec2 d = abs(fc - cc);',
      '    float cov = 1.0 - smoothstep(side * 0.5 - 1.0, side * 0.5 + 1.0, ' + coverage + ');',
      '',
      '    vec3 ink = mix(uBase, uAccent, clamp(pow(i, 1.1), 0.0, 1.0));',
      '    ink = mix(ink, uHigh, smoothstep(0.72, 1.0, i));',
      '    col = mix(uBg, ink, cov * clamp(i * 1.6, 0.0, 1.0));',
      '  }',
      '  gl_FragColor = vec4(col, 1.0);',
      '}'
    ].join('\n');
  }

  var STAGE = [
    '  // CSS pixels, y down',
    '  float x = cc.x / uDpr;',
    '  float y = (uRes.y - cc.y) / uDpr;',
    '  float w = uRes.x / uDpr;',
    '  float h = uRes.y / uDpr;',
    ''
  ].join('\n');

  var FRAG = {};

  /* Predictive Arc */
  FRAG.arc = PRECISION + [
    'uniform vec2  uRes, uOff;',
    'uniform float uTime, uDpr, uCell, uDot;',
    'uniform float uPeak, uHeight, uThick, uFall;',
    'uniform vec3  uBg, uBase, uAccent, uHigh;',
    'uniform vec2  uMouse;',
    'uniform float uMouseRadius, uMouseStrength;',
    '',
    'void main(){',
    CELL,
    STAGE,
    '  float normX = (x - w * 0.5) / (w * 0.75);',
    '  float curveY = h * uPeak + normX * normX * (h * uHeight);',
    '',
    '  // pointer bend: pull curveY toward the cursor, Gaussian falloff along x',
    '  float mdx = x - uMouse.x;',
    '  float influence = uMouseStrength * exp(-(mdx * mdx) / (2.0 * uMouseRadius * uMouseRadius + 1.0));',
    '  curveY = mix(curveY, uMouse.y, influence);',
    '',
    '  float dist = abs(y - curveY);',
    '  float th = (140.0 + (1.0 - abs(normX)) * 80.0) * uThick;',
    '',
    '  float i = 0.0;',
    '  if (dist < th) {',
    '    i = 1.0 - dist / th;',
    '    float waveX = sin(x * 0.015 + uTime);',
    '    float waveY = cos(y * 0.02 + uTime);',
    '    i = i * 0.7 + waveX * waveY * 0.3 * i;',
    '    i *= max(0.0, 1.0 - pow(abs(normX), uFall));',
    '  }',
    '',
    ink('max(d.x, d.y)')
  ].join('\n');

  /* Predictive Arc 2 — Horizon */
  FRAG.horizon = PRECISION + [
    'uniform vec2  uRes, uOff;',
    'uniform float uTime, uDpr, uCell, uDot, uHover;',
    'uniform vec2  uPtr;   // CSS px, y measured from the top',
    'uniform float uA, uB, uC, uD; // Rise, Radius, Thickness, Falloff',
    'uniform vec3  uBg, uBase, uAccent, uHigh;',
    '',
    'void main(){',
    CELL,
    STAGE,
    '  float t = uTime;',
    '',
    '  float i = 0.0;',
    '  float R = w * uB;',
    '  // Negative: a positive rotation of the sample moves the crest LEFT.',
    '  float rot = -clamp((uPtr.x - w * 0.5) / w, -0.5, 0.5) * 0.9 * uHover;',
    '  vec2 c = vec2(w * 0.5, h * (1.0 - uA) + R);',
    '  vec2 q = vec2(x, y) - c;',
    '  float cr = cos(rot);',
    '  float sr = sin(rot);',
    '  q = vec2(cr * q.x - sr * q.y, sr * q.x + cr * q.y);',
    '  float r = length(q);',
    '  float dist = r - R;                      // > 0 outside, i.e. above',
    '  float normX = q.x / (w * 0.75);',
    '  float th = (140.0 + (1.0 - min(abs(normX), 1.0)) * 80.0) * uC;',
    '  float thS = dist > 0.0 ? th : th * 0.45;',
    '  float ad = abs(dist);',
    '  if (ad < thS && q.y < 0.0) {',
    '    i = 1.0 - ad / thS;',
    '    float waveX = sin(x * 0.015 + t);',
    '    float waveR = cos(r * 0.02 - t * 1.6);',
    '    i = i * 0.7 + waveX * waveR * 0.3 * i;',
    '    i *= max(0.0, 1.0 - pow(min(abs(normX), 1.0), uD));',
    '  }',
    '',
    ink('max(d.x, d.y)')
  ].join('\n');

  /* Predictive Arc 04 — Echo */
  FRAG.echo = PRECISION + [
    'uniform vec2  uRes, uOff;',
    'uniform float uTime, uDpr, uCell, uDot, uHover;',
    'uniform vec2  uPtr;   // CSS px, y measured from the top',
    'uniform float uA, uB, uC, uD; // Count, Gap, Height, Thickness',
    'uniform vec3  uBg, uBase, uAccent, uHigh;',
    '',
    'void main(){',
    CELL,
    STAGE,
    '  float t = uTime;',
    '',
    '  float i = 0.0;',
    '  float leanX = (uPtr.x - w * 0.5) * 0.5 * uHover;',
    '  float leanY = (uPtr.y - h * 0.5) * 0.25 * uHover;',
    '  float n1 = max(uA, 1.0);',
    '  for (int n = 0; n < 8; n++) {',
    '    float fn = float(n);',
    '    if (fn >= n1) break;',
    '    float par = 1.0 - 0.6 * fn / n1;        // inner arches lean most',
    '    float cx = w * 0.5 + leanX * par;',
    '    float normX = (x - cx) / (w * 0.75);',
    '    float curveY = h * 0.3 + fn * h * uB + leanY * par',
    '                 + normX * normX * h * uC * (1.0 + 0.08 * fn);',
    '    float th = (40.0 + (1.0 - min(abs(normX), 1.0)) * 25.0) * uD;',
    '    float dist = abs(y - curveY);',
    '    if (dist < th) {',
    '      float b = 1.0 - dist / th;',
    '      float waveX = sin(x * 0.015 + t);',
    '      float waveY = cos(y * 0.02 + t);',
    '      b = b * 0.7 + waveX * waveY * 0.3 * b;',
    '      b *= max(0.0, 1.0 - pow(abs(normX), 2.5));',
    '      b *= 0.45 + 0.55 * (0.5 + 0.5 * sin(t * 1.5 - fn * 0.9));',
    '      i = max(i, b);',
    '    }',
    '  }',
    '',
    ink('max(d.x, d.y)')
  ].join('\n');

  /* Predictive Arc 03 — Signal */
  FRAG.signal = PRECISION + [
    'uniform vec2  uRes, uOff;',
    'uniform float uTime, uDpr, uCell, uDot, uHover;',
    'uniform vec2  uPtr;   // CSS px, y measured from the top',
    'uniform float uA, uB, uC, uD; // Level, Amplitude, Wavelength, Thickness',
    'uniform vec3  uBg, uBase, uAccent, uHigh;',
    '',
    'void main(){',
    CELL,
    STAGE,
    '  float t = uTime;',
    '',
    '  float i = 0.0;',
    '  float k = 6.2831853 / max(w * uC, 1.0);',
    '  float y0 = h * uA + h * uB * (sin(x * k - t * 1.2) + 0.35 * sin(x * k * 2.3 + t * 0.9)) / 1.35;',
    '  float gx = (x - uPtr.x) / (w * 0.12);',
    '  float curveY = y0 + (uPtr.y - h * 0.5) * exp(-gx * gx) * 0.8 * uHover;',
    '  float dist = abs(y - curveY);',
    '  float normX = (x - w * 0.5) / (w * 0.75);',
    '  float th = (70.0 + 30.0 * sin(x * k * 0.5 + t * 0.7)) * uD;',
    '  if (dist < th) {',
    '    i = 1.0 - dist / th;',
    '    float waveX = sin(x * 0.015 + t);',
    '    float waveY = cos(y * 0.02 + t);',
    '    i = i * 0.7 + waveX * waveY * 0.3 * i;',
    '    i *= max(0.0, 1.0 - pow(abs(normX), 2.5));',
    '  }',
    '',
    ink('length(d)')
  ].join('\n');

  /* ------------------------------------------------------------------ */
  /* Presets                                                             */
  /* stage  — the size the component was designed at (CSS px)            */
  /* focus  — the part of that stage the Figma card shows                */
  /* ------------------------------------------------------------------ */
  var PRESETS = {
    arc: {
      stage: { w: 1200, h: 800 },
      focus: { x: 324, y: 367, w: 552, h: 433 },   // bottom-centre: the arc's crest sits on the card's bottom edge
      background: '#030303',
      baseColor: '#FF0000',
      accentColor: '#FF9898',
      highlight: '#FF0000',
      density: 78,
      dotSize: 102,
      speed: 50,
      arch: { peak: 100, archHeight: 0, thickness: 206, falloff: 600 },
      pointer: { enabled: true, radius: 236, strength: 34 }
    },
    horizon: {
      stage: { w: 1200, h: 800 },
      focus: { x: 315, y: 220, w: 570, h: 447 },
      background: '#02040A',
      baseColor: '#0B2A5E',
      accentColor: '#3FA9FF',
      highlight: '#E8F6FF',
      density: 40,
      dotSize: 100,
      speed: 50,
      hover: 100,
      shape: { a: 45 / 100, b: 90 / 100, c: 100 / 100, d: 250 / 100 }   // rise, radius, thickness, falloff
    },
    echo: {
      stage: { w: 1200, h: 800 },
      focus: { x: 117.6, y: 169, w: 964.9, h: 495 },
      background: '#07030A',
      baseColor: '#3A0B3F',
      accentColor: '#FF4FD8',
      highlight: '#FFFFFF',
      density: 160,
      dotSize: 100,
      speed: 50,
      hover: 31,
      shape: { a: 5, b: 9 / 100, c: 70 / 100, d: 100 / 100 }             // count, gap, height, thickness
    },
    signal: {
      stage: { w: 1036, h: 503 },
      focus: { x: 27.9, y: 0, w: 980.5, h: 503 },
      background: '#030604',
      baseColor: '#0E3B1F',
      accentColor: '#3DFF8A',
      highlight: '#FFFFFF',
      density: 160,
      dotSize: 100,
      speed: 50,
      hover: 100,
      shape: { a: 50 / 100, b: 18 / 100, c: 60 / 100, d: 100 / 100 }     // level, amplitude, wavelength, thickness
    }
  };

  /* ------------------------------------------------------------------ */
  /* Dot field runtime                                                   */
  /* ------------------------------------------------------------------ */
  function clampN(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function parseColor(input, fb) {
    if (!input) return fb;
    var str = String(input).trim();
    if (str.charAt(0) === '#') {
      var hex = str.slice(1);
      if (hex.length === 3 || hex.length === 4) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      if (hex.length >= 6) {
        var r = parseInt(hex.slice(0, 2), 16);
        var g = parseInt(hex.slice(2, 4), 16);
        var b = parseInt(hex.slice(4, 6), 16);
        if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return [r / 255, g / 255, b / 255];
      }
      return fb;
    }
    var m = str.match(/[\d.]+/g);
    if (m && m.length >= 3) {
      return [Math.min(255, parseFloat(m[0])) / 255, Math.min(255, parseFloat(m[1])) / 255, Math.min(255, parseFloat(m[2])) / 255];
    }
    return fb;
  }

  function compile(gl, type, src, name) {
    var sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error(name + ' shader:', gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function createDotField(host, kind, overrides) {
    var preset = PRESETS[kind];
    if (!preset) return null;
    var cfg = {};
    var key;
    for (key in preset) cfg[key] = preset[key];
    for (key in overrides || {}) cfg[key] = overrides[key];

    var canvas = document.createElement('canvas');
    host.appendChild(canvas);
    var gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false });
    if (!gl) {
      console.error('Dot field (' + kind + '): WebGL unavailable');
      return null;
    }

    var vs = compile(gl, gl.VERTEX_SHADER, VERT_SRC, kind);
    var fs = compile(gl, gl.FRAGMENT_SHADER, FRAG[kind], kind);
    if (!vs || !fs) return null;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('Dot field (' + kind + ') link:', gl.getProgramInfoLog(prog));
      return null;
    }
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    var locs = {};
    function u(name) {
      if (!(name in locs)) locs[name] = gl.getUniformLocation(prog, name);
      return locs[name];
    }

    // Live values, clamped exactly like the component's property controls.
    var v = {
      bg: parseColor(cfg.background, [0.012, 0.012, 0.012]),
      base: parseColor(cfg.baseColor, [0.169, 0.055, 0.369]),
      accent: parseColor(cfg.accentColor, [0.627, 0.314, 1.0]),
      high: parseColor(cfg.highlight, [1, 1, 1]),
      density: Math.round(clampN(cfg.density, 40, 320)),
      dotSize: clampN(cfg.dotSize, 20, 400) / 100,
      speed: clampN(cfg.speed, 0, 100) / 50,
      hover: clampN(cfg.hover === undefined ? 100 : cfg.hover, 0, 200) / 100
    };
    var arch = cfg.arch || {};
    var ptrCfg = cfg.pointer || {};
    if (kind === 'arc') {
      v.peak = clampN(arch.peak, 0, 100) / 100;
      v.archHeight = clampN(arch.archHeight, 0, 300) / 100;
      v.thickness = clampN(arch.thickness, 20, 400) / 100;
      v.falloff = clampN(arch.falloff, 50, 600) / 100;
      v.pointerEnabled = ptrCfg.enabled !== false;
      v.pointerRadius = clampN(ptrCfg.radius, 40, 600);
      v.pointerStrength = clampN(ptrCfg.strength, 0, 100) / 100;
    }

    var stage = cfg.stage;
    var focus = cfg.focus;
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // What part of the stage the card shows right now (cover-fit of `focus`).
    var view = { x: 0, y: 0, w: stage.w, h: stage.h, scale: 1 };
    function updateView(cw, ch) {
      var scale = Math.max(cw / focus.w, ch / focus.h);
      var vw = cw / scale;
      var vh = ch / scale;
      view.scale = scale;
      view.w = vw;
      view.h = vh;
      view.x = focus.x + (focus.w - vw) / 2;
      view.y = focus.y + (focus.h - vh) / 2;
    }

    // Pointer state. `arc` bends toward the cursor; the others lean / rotate.
    var bend = { x: 0, y: 0, targetX: 0, targetY: 0, active: 0, targetActive: 0 };
    var ptr = { tx: 0.5, ty: 0.5, x: 0.5, y: 0.5 };
    var target = host.closest('.card') || host;

    function track(e) {
      if (reduced) return;
      var r = canvas.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      var sx = view.x + ((e.clientX - r.left) / r.width) * view.w;   // stage px
      var sy = view.y + ((e.clientY - r.top) / r.height) * view.h;   // stage px, from the top
      if (kind === 'arc') {
        bend.targetX = sx;
        bend.targetY = stage.h - sy;                                  // as in the component
        bend.targetActive = 1;
      } else {
        ptr.tx = clampN(sx / stage.w, 0, 1);
        ptr.ty = clampN(sy / stage.h, 0, 1);
      }
    }
    function onLeave() {
      bend.targetActive = 0;
      ptr.tx = 0.5;
      ptr.ty = 0.5;
    }
    target.addEventListener('pointermove', track);
    target.addEventListener('pointerenter', track);
    target.addEventListener('pointerleave', onLeave);
    target.addEventListener('pointercancel', onLeave);

    var raf = 0;
    var last = performance.now();
    var clock = 0;
    var visible = true;
    var PTR_RATE = 6.0;

    function render(now) {
      raf = 0;
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!reduced) clock = (clock + dt * 0.9 * v.speed) % 6283;   // reduced motion: a still frame

      var cw = canvas.clientWidth || 1;
      var ch = canvas.clientHeight || 1;
      var rect = canvas.getBoundingClientRect();
      var pageScale = rect.width > 0 ? rect.width / cw : 1;          // CSS transform on .page
      var dpr = clampN(Math.min(window.devicePixelRatio || 1, MAX_DPR) * pageScale, 0.5, MAX_DPR);
      var bw = Math.max(1, Math.round(cw * dpr));
      var bh = Math.max(1, Math.round(ch * dpr));
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }
      gl.viewport(0, 0, bw, bh);
      updateView(cw, ch);

      var k = dpr * view.scale;                                       // device px per stage px
      // Density is cells down the SHORT edge of the stage.
      var pitch = Math.min(stage.w, stage.h) / v.density;

      gl.uniform2f(u('uRes'), stage.w * k, stage.h * k);
      gl.uniform2f(u('uOff'), view.x * k, (stage.h - view.y - view.h) * k);
      gl.uniform1f(u('uTime'), clock);
      gl.uniform1f(u('uDpr'), k);
      gl.uniform1f(u('uCell'), Math.max(2, pitch * k));
      gl.uniform1f(u('uDot'), pitch * 1.2 * v.dotSize);
      gl.uniform3f(u('uBg'), v.bg[0], v.bg[1], v.bg[2]);
      gl.uniform3f(u('uBase'), v.base[0], v.base[1], v.base[2]);
      gl.uniform3f(u('uAccent'), v.accent[0], v.accent[1], v.accent[2]);
      gl.uniform3f(u('uHigh'), v.high[0], v.high[1], v.high[2]);

      if (kind === 'arc') {
        var posLerp = Math.min(1, dt * 12);
        var activeLerp = Math.min(1, dt * 6);
        bend.x += (bend.targetX - bend.x) * posLerp;
        bend.y += (bend.targetY - bend.y) * posLerp;
        bend.active += (bend.targetActive - bend.active) * activeLerp;
        gl.uniform1f(u('uPeak'), v.peak);
        gl.uniform1f(u('uHeight'), v.archHeight);
        gl.uniform1f(u('uThick'), v.thickness);
        gl.uniform1f(u('uFall'), v.falloff);
        gl.uniform2f(u('uMouse'), bend.x, bend.y);
        gl.uniform1f(u('uMouseRadius'), v.pointerRadius);
        gl.uniform1f(u('uMouseStrength'), v.pointerEnabled ? v.pointerStrength * bend.active : 0);
      } else {
        var ease = 1 - Math.exp(-dt * PTR_RATE);
        ptr.x += (ptr.tx - ptr.x) * ease;
        ptr.y += (ptr.ty - ptr.y) * ease;
        gl.uniform1f(u('uA'), cfg.shape.a);
        gl.uniform1f(u('uB'), cfg.shape.b);
        gl.uniform1f(u('uC'), cfg.shape.c);
        gl.uniform1f(u('uD'), cfg.shape.d);
        gl.uniform1f(u('uHover'), v.hover);
        gl.uniform2f(u('uPtr'), ptr.x * stage.w, ptr.y * stage.h);
      }

      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!reduced && visible && document.visibilityState !== 'hidden') raf = requestAnimationFrame(render);
    }

    function wake() {
      if (raf || !visible || document.visibilityState === 'hidden') return;
      last = performance.now();
      raf = requestAnimationFrame(render);
    }

    // Only animate while the card is on screen.
    var io = new IntersectionObserver(function (entries) {
      visible = entries.some(function (entry) { return entry.isIntersecting; });
      wake();
    }, { rootMargin: '100px' });
    io.observe(host);
    document.addEventListener('visibilitychange', wake);
    if (reduced) window.addEventListener('resize', wake);    // redraw the still frame at the new size

    wake();

    return {
      canvas: canvas,
      destroy: function () {
        cancelAnimationFrame(raf);
        io.disconnect();
        document.removeEventListener('visibilitychange', wake);
        target.removeEventListener('pointermove', track);
        target.removeEventListener('pointerenter', track);
        target.removeEventListener('pointerleave', onLeave);
        target.removeEventListener('pointercancel', onLeave);
      }
    };
  }

  function init(root) {
    var hosts = (root || document).querySelectorAll('[data-card-bg]');
    Array.prototype.forEach.call(hosts, function (host) {
      var kind = host.getAttribute('data-card-bg');
      if (kind === 'bars') createBars(host, 15);
      else createDotField(host, kind);
    });
  }

  global.CardBackgrounds = { init: init, createBars: createBars, createDotField: createDotField, presets: PRESETS };
})(window);
