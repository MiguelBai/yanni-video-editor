// Builds the one paused GSAP timeline for a paper-cut edit.
// build.mjs writes window.YANNI (absolute times, resolved layout); this file
// only turns that spec into tweens. Pure function of time: no clocks, no rAF.
(function () {
  const S = window.YANNI;
  const tl = gsap.timeline({ paused: true });
  const $ = (id) => document.getElementById(id);
  const q = (el, sel) => el.querySelector(sel);

  // camera punch-ins on face beats (hard set, like a jump-cut zoom)
  S.cams.forEach((c) => tl.set("#cam", { scale: c.zoom }, c.t));

  // smear helper: motion blurred copy visible while moving, sharp copy lands
  function smearIn(it, t, len) {
    const sm = q(it, ".smear"), sh = q(it, ".sharp");
    if (!sm || !sh) return;
    tl.fromTo(sm, { opacity: 1 }, { opacity: 0, duration: len * 0.6, ease: "none" }, t + len * 0.4);
    tl.fromTo(sh, { opacity: 0 }, { opacity: 1, duration: len * 0.6, ease: "none" }, t + len * 0.4);
  }

  const ENTER = {
    cut() {},
    drop(it, t) {
      tl.fromTo(it, { y: -1100 }, { y: 0, duration: 0.22, ease: "power3.out" }, t);
      tl.fromTo(it, { scale: 1.07 }, { scale: 1, duration: 0.34, ease: "power2.out" }, t + 0.18);
      smearIn(it, t, 0.22);
    },
    zoom(it, t) {
      tl.fromTo(it, { scale: 2.2, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.24, ease: "power3.out" }, t);
      smearIn(it, t, 0.24);
    },
    whip(it, t) {
      tl.fromTo(it, { x: 1150 }, { x: 0, duration: 0.24, ease: "power3.out" }, t + 0.05);
      smearIn(it, t + 0.05, 0.24);
    },
    push(it, t) {
      tl.fromTo(it, { y: 560, opacity: 0 }, { y: 0, opacity: 1, duration: 0.26, ease: "power3.out" }, t);
      smearIn(it, t, 0.26);
    },
    pop(it, t) {
      tl.fromTo(it, { scale: 0.55, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(2.2)" }, t);
    },
    rise(it, t) {
      tl.fromTo(it, { y: 50, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, ease: "power2.out" }, t);
    },
  };

  const EXIT = {
    whip(shot, t) { tl.to(shot, { x: -1150, opacity: 0.2, duration: 0.17, ease: "power2.in" }, t); },
    zoom(shot, t) { tl.to(shot, { opacity: 0, duration: 0.12, ease: "none" }, t); },
  };

  S.shots.forEach((s) => {
    const shot = $(s.id);
    tl.set(shot, { autoAlpha: 1 }, s.t0);
    tl.set(shot, { autoAlpha: 0 }, s.t1);
    if (s.exit && EXIT[s.exit]) EXIT[s.exit](shot, s.exitAt);

    s.items.forEach((i) => {
      const it = $(i.id);
      const t = s.t0 + (i.delay || 0);
      if (i.carry) {
        tl.fromTo(it, { x: i.carry.x, y: i.carry.y, scale: i.carry.s },
          { x: 0, y: 0, scale: 1, duration: 0.26, ease: "power3.out" }, t);
      } else {
        (ENTER[i.enter] || ENTER.cut)(it, t);
      }
      if (i.punch != null) {
        tl.fromTo(q(it, ".in"), { scale: 1 }, { scale: 1.09, duration: 0.18, ease: "power3.out" }, i.punch);
      }
      if (i.slice) {
        const [a, b] = i.slice;
        const A = q(it, ".sl.a"), B = q(it, ".sl.b"), sh = q(it, ".sharp");
        const n = i.sliceN; // unit normal of the cut, pointing into piece A
        const d = i.sliceD; // unit direction along the cut
        tl.set(sh, { opacity: 0 }, a);
        tl.set([A, B], { opacity: 1 }, a);
        tl.fromTo(A, { x: 0, y: 0 }, { x: n[0] * 34 - d[0] * 18, y: n[1] * 34 - d[1] * 18, duration: 0.2, ease: "power3.out" }, a);
        tl.fromTo(B, { x: 0, y: 0 }, { x: -n[0] * 34 + d[0] * 18, y: -n[1] * 34 + d[1] * 18, duration: 0.2, ease: "power3.out" }, a);
        const hold = Math.max(0.05, b - a - 0.4);
        tl.to(A, { x: n[0] * 46 - d[0] * 30, y: n[1] * 46 - d[1] * 30, duration: hold, ease: "none" }, a + 0.2);
        tl.to(B, { x: -n[0] * 46 + d[0] * 30, y: -n[1] * 46 + d[1] * 30, duration: hold, ease: "none" }, a + 0.2);
        tl.to([A, B], { x: 0, y: 0, duration: 0.2, ease: "power2.inOut" }, b - 0.2);
        tl.set(sh, { opacity: 1 }, b);
        tl.set([A, B], { opacity: 0 }, b);
      }
    });
  });

  // brand stamp: line one whips in, line two slams over it with an echo
  S.stamps.forEach((st) => {
    const l1 = $(st.id + "-1"), l2 = $(st.id + "-2"), e = $(st.id + "-e");
    const t = st.t;
    tl.fromTo(l1, { x: 820 }, { x: 0, duration: 0.18, ease: "power3.out" }, t);
    smearIn(l1, t, 0.18);
    tl.fromTo(l2, { scaleY: 0.06, opacity: 0 }, { scaleY: 1, opacity: 1, duration: 0.16, ease: "power3.out" }, t + 0.3);
    tl.fromTo(e, { opacity: 0, y: -40 }, { opacity: 1, y: 0, duration: 0.16, ease: "power3.out" }, t + 0.3);
  });

  // captions: one page per phrase, each word fades in on its own timestamp
  S.pages.forEach((p) => {
    const pg = $(p.id);
    tl.set(pg, { autoAlpha: 1 }, p.t0);
    tl.set(pg, { autoAlpha: 0 }, p.t1);
    p.words.forEach((w) => {
      tl.fromTo($(w.id), { opacity: 0 }, { opacity: 1, duration: 0.14, ease: "none" }, w.t);
    });
  });

  window.__timelines = window.__timelines || {};
  window.__timelines["main"] = tl;
})();
