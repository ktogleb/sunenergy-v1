/*!
 * AnimatedContent — vanilla JS port of the React Bits <AnimatedContent />
 * component (JavaScript + CSS variant, https://reactbits.dev). Same props,
 * same GSAP timeline and ScrollTrigger setup; only the React wrapper is gone.
 * Needs gsap and gsap/ScrollTrigger loaded first.
 *
 *   var ac = AnimatedContent(element, { distance: 100, stagger: 0.08, trigger: 'scroll' });
 *   ac.revert();   // undo everything (the React cleanup)
 *
 * One addition: `items` — a selector for the elements to animate inside
 * `element`, for when they are not its direct children.
 *
 * The element should start hidden (visibility: hidden) so nothing flashes
 * before the script runs; it is made visible as the animation is set up.
 */
(function (global) {
  'use strict';

  var WIPES = {
    up: 'linear-gradient(to top, #000 calc(var(--ac-wipe) * 140% - 40%), transparent calc(var(--ac-wipe) * 140%))',
    down: 'linear-gradient(to bottom, #000 calc(var(--ac-wipe) * 140% - 40%), transparent calc(var(--ac-wipe) * 140%))',
    left: 'linear-gradient(to left, #000 calc(var(--ac-wipe) * 140% - 40%), transparent calc(var(--ac-wipe) * 140%))',
    right: 'linear-gradient(to right, #000 calc(var(--ac-wipe) * 140% - 40%), transparent calc(var(--ac-wipe) * 140%))',
    center:
      'radial-gradient(farthest-corner at 50% 50%, #000 calc(var(--ac-wipe) * 140% - 40%), transparent calc(var(--ac-wipe) * 140%))'
  };

  var DEFAULTS = {
    container: null,
    distance: 100,
    direction: 'vertical',
    reverse: false,
    duration: 0.8,
    ease: 'power3.out',
    initialOpacity: 0,
    animateOpacity: true,
    scale: 1,
    blur: 0,
    rotate: 0,
    tilt: 0,
    wipe: 'none',
    threshold: 0.1,
    delay: 0,
    stagger: 0,
    staggerFrom: 'start',
    trigger: 'scroll',
    once: true,
    scrub: false,
    disappearAfter: 0,
    disappearDuration: 0.5,
    disappearEase: 'power3.in',
    onStart: null,
    onComplete: null,
    onDisappearanceComplete: null,
    items: null
  };

  function AnimatedContent(el, options) {
    if (!el) return null;
    var o = {};
    var key;
    for (key in DEFAULTS) o[key] = DEFAULTS[key];
    for (key in options || {}) if (options[key] !== undefined) o[key] = options[key];

    var gsap = global.gsap;
    var ScrollTrigger = global.ScrollTrigger;
    if (!gsap || (!ScrollTrigger && o.trigger !== 'mount')) {
      // GSAP did not load: show the content as is.
      el.style.visibility = 'visible';
      return null;
    }
    if (ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

    var scroller = o.container || null;
    if (typeof scroller === 'string') scroller = document.querySelector(scroller);

    var reduce = global.matchMedia ? global.matchMedia('(prefers-reduced-motion: reduce)').matches : false;
    var timeline = null;

    var ctx = gsap.context(function () {
      var targets = o.items
        ? Array.prototype.slice.call(el.querySelectorAll(o.items))
        : o.stagger > 0 && el.children.length
          ? Array.prototype.slice.call(el.children)
          : [el];
      var horizontal = o.direction === 'horizontal';
      var axis = horizontal ? 'x' : 'y';
      var sign = o.reverse ? -1 : 1;
      var mask = WIPES[o.wipe];

      gsap.set(el, { visibility: 'visible' });

      if (reduce) {
        if (o.onComplete) o.onComplete();
        return;
      }

      var from = { scale: o.scale, opacity: o.animateOpacity ? o.initialOpacity : 1 };
      from[axis] = o.distance * sign;
      var to = { scale: 1, opacity: 1, duration: o.duration, ease: o.ease };
      to[axis] = 0;

      if (o.blur > 0) {
        from.filter = 'blur(' + o.blur + 'px)';
        to.filter = 'blur(0px)';
      }
      if (o.rotate) {
        from.rotation = o.rotate * sign;
        to.rotation = 0;
      }
      if (o.tilt) {
        var tiltAxis = horizontal ? 'rotationY' : 'rotationX';
        from[tiltAxis] = horizontal ? -o.tilt * sign : o.tilt * sign;
        to[tiltAxis] = 0;
        from.transformPerspective = 900;
        to.transformPerspective = 900;
      }
      if (mask) {
        gsap.set(targets, { maskImage: mask, webkitMaskImage: mask });
        from['--ac-wipe'] = 0;
        to['--ac-wipe'] = 1;
      }
      if (o.stagger > 0) to.stagger = { each: o.stagger, from: o.staggerFrom };

      var settle = function () {
        if (o.scrub) return;
        gsap.set(targets, { clearProps: mask ? 'filter,transform,maskImage,webkitMaskImage' : 'filter,transform' });
      };

      var disappear = function () {
        if (o.disappearAfter <= 0) return;
        var out = {
          scale: 0.8,
          opacity: o.animateOpacity ? o.initialOpacity : 0,
          delay: o.disappearAfter,
          duration: o.disappearDuration,
          ease: o.disappearEase,
          onComplete: function () {
            if (o.onDisappearanceComplete) o.onDisappearanceComplete();
          }
        };
        out[axis] = -o.distance * sign;
        if (o.blur > 0) out.filter = 'blur(' + o.blur + 'px)';
        if (o.stagger > 0) out.stagger = { each: o.stagger, from: o.staggerFrom };
        gsap.to(targets, out);
      };

      var tl = gsap.timeline({
        paused: true,
        onStart: function () {
          if (o.onStart) o.onStart();
        },
        onComplete: function () {
          if (o.onComplete) o.onComplete();
          settle();
          if (o.once && !o.scrub) disappear();
        }
      });
      tl.fromTo(targets, from, to, o.scrub ? 0 : Math.max(o.delay, 0));
      timeline = tl;

      if (o.trigger === 'mount') {
        tl.play();
        return;
      }

      var start = 'top ' + (1 - o.threshold) * 100 + '%';
      // When the element is itself one of the animated targets, ScrollTrigger would
      // measure it already shifted by `distance`, so it would start that many pixels
      // late. Measure where it sits without the offset instead (window scroller only).
      if (!scroller && targets.indexOf(el) !== -1 && axis === 'y') {
        start = function () {
          var rect = el.getBoundingClientRect();
          var k = el.offsetHeight ? rect.height / el.offsetHeight : 1;   // ancestor scale
          var shift = (Number(gsap.getProperty(el, 'y')) || 0) * k;
          return rect.top + window.pageYOffset - shift - window.innerHeight * (1 - o.threshold);
        };
      }
      var base = { trigger: el, start: start };
      if (scroller) base.scroller = scroller;

      if (o.scrub) {
        base.end = 'top ' + Math.max((1 - o.threshold) * 100 - 45, 5) + '%';
        base.scrub = o.scrub === true ? true : Math.max(Number(o.scrub) || 0, 0.01);
        base.animation = tl;
        ScrollTrigger.create(base);
        return;
      }

      base.once = o.once;
      base.onEnter = function () {
        tl.play();
      };
      if (!o.once) {
        base.onLeaveBack = function () {
          if (mask) gsap.set(targets, { maskImage: mask, webkitMaskImage: mask });
          tl.reverse();
        };
      }
      ScrollTrigger.create(base);
    }, el);

    return {
      timeline: function () {
        return timeline;
      },
      revert: function () {
        ctx.revert();
      }
    };
  }

  global.AnimatedContent = AnimatedContent;
})(window);
