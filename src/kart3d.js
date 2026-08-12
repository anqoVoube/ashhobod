/* Hero kart — a real low-poly 3D model, projected by hand onto a 2D canvas.
 *
 * No WebGL and no library: the mesh is a few hundred quads, the renderer is a
 * perspective projection plus a painter's-algorithm sort, and shading is a flat
 * lambert term per face. That keeps the page a single self-contained file, which
 * a WebGL library would not.
 *
 * Axes: +X right, +Y up, +Z toward the viewer. The kart drives along +Z.
 */
(function () {
  "use strict";

  var canvas = document.getElementById("kart3d");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");

  var INK = "#14161f";

  /* ─────────────────────────────── palette ─────────────────────────────── */
  var C = {
    body:    [42, 49, 69],
    bodyLo:  [27, 33, 48],
    pod:     [51, 60, 84],
    nose:    [36, 43, 61],
    teal:    [23, 196, 210],
    mag:     [210, 68, 192],
    amber:   [255, 176, 32],
    red:     [255, 45, 70],
    redLo:   [192, 19, 38],
    tyre:    [34, 38, 47],
    tyreLo:  [24, 27, 34],
    rim:     [205, 214, 234],
    rimLo:   [121, 132, 156],
    helmet:  [238, 242, 255],
    visor:   [16, 21, 38],
    seat:    [22, 26, 38]
  };

  /* ─────────────────────────────── geometry ────────────────────────────── */
  var faces = [];   // {v:[[x,y,z]x4], c:[r,g,b]}   — bodywork, fixed
  var wheels = [];  // {c:[x,y,z], steer:bool, f:[{v,c}]}  — spin about their own axle

  function push(list, v, c) { list.push({ v: v, c: c }); }

  // axis-aligned box
  function box(list, x0, x1, y0, y1, z0, z1, c, top, side) {
    top = top || c; side = side || c;
    push(list, [[x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0]], top);   // top
    push(list, [[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]], c);     // bottom
    push(list, [[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]], c);     // front
    push(list, [[x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0]], c);     // back
    push(list, [[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0]], side);  // left
    push(list, [[x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1]], side);  // right
  }

  // box with an independent half-width at each end — the floor pan and nose taper
  function taper(list, hwBack, hwFront, y0, y1, z0, z1, c, top) {
    top = top || c;
    var a = [-hwBack,y0,z0], b = [hwBack,y0,z0], d = [hwFront,y0,z1], e = [-hwFront,y0,z1];
    var A = [-hwBack,y1,z0], B = [hwBack,y1,z0], D = [hwFront,y1,z1], E = [-hwFront,y1,z1];
    push(list, [E,D,B,A], top);
    push(list, [a,b,d,e], c);
    push(list, [e,d,D,E], c);
    push(list, [b,a,A,B], c);
    push(list, [a,e,E,A], c);
    push(list, [d,b,B,D], c);
  }

  // box whose cross-section shrinks with height — torsos and helmets sit on this
  function frustum(list, hw0, hd0, hw1, hd1, y0, y1, cz, c, top) {
    top = top || c;
    var a = [-hw0,y0,cz-hd0], b = [hw0,y0,cz-hd0], d = [hw0,y0,cz+hd0], e = [-hw0,y0,cz+hd0];
    var A = [-hw1,y1,cz-hd1], B = [hw1,y1,cz-hd1], D = [hw1,y1,cz+hd1], E = [-hw1,y1,cz+hd1];
    push(list, [A,B,D,E], top);
    push(list, [e,d,b,a], c);
    push(list, [e,E,D,d], c);
    push(list, [b,B,A,a], c);
    push(list, [a,A,E,e], c);
    push(list, [d,D,B,b], c);
  }

  // cylinder about the X axis — every wheel, and the steering rim.
  // Caps are a single n-gon each: a triangle fan would put a stroked seam on every
  // segment and the wheels would read as spiderwebs.
  function cylX(list, cx, cy, cz, r, hw, segs, side, cap) {
    var i, j, a, L = [], R = [];
    for (i = 0; i < segs; i++) {
      a = (i / segs) * Math.PI * 2;
      L.push([cx - hw, cy + Math.cos(a) * r, cz + Math.sin(a) * r]);
      R.push([cx + hw, cy + Math.cos(a) * r, cz + Math.sin(a) * r]);
    }
    for (i = 0; i < segs; i++) {
      j = (i + 1) % segs;
      push(list, [L[i], L[j], R[j], R[i]], side);
    }
    push(list, L.slice().reverse(), cap);
    push(list, R.slice(), cap);
  }

  function sphere(list, cx, cy, cz, r, lat, lon, c, capColor) {
    var i, j, t0, t1, f0, f1;
    for (i = 0; i < lat; i++) {
      t0 = Math.PI * i / lat; t1 = Math.PI * (i + 1) / lat;
      for (j = 0; j < lon; j++) {
        f0 = 2 * Math.PI * j / lon; f1 = 2 * Math.PI * (j + 1) / lon;
        var P = function (t, f) {
          return [cx + r * Math.sin(t) * Math.cos(f),
                  cy + r * Math.cos(t),
                  cz + r * Math.sin(t) * Math.sin(f)];
        };
        push(list, [P(t0,f0), P(t0,f1), P(t1,f1), P(t1,f0)],
             (i < lat * 0.42 && capColor) ? capColor : c);
      }
    }
  }

  function buildWheel(cx, cy, cz, r, hw, steer) {
    var f = [];
    cylX(f, 0, 0, 0, r, hw, 14, C.tyre, C.tyreLo);              // tyre
    cylX(f, 0, 0, 0, r * 0.55, hw * 1.06, 8, C.rimLo, C.rim);   // rim
    cylX(f, 0, 0, 0, r * 0.14, hw * 1.12, 6, C.rim, C.rimLo);   // hub nut
    wheels.push({ c: [cx, cy, cz], steer: !!steer, f: f });
  }

  (function build() {
    // A kart is essentially a flat floor pan with four exposed wheels. Keeping the
    // whole silhouette low is what stops it reading as a toy truck.

    // floor pan — thin, wide at the rear, tapering into the nose
    taper(faces, 0.54, 0.24, 0.07, 0.15, -1.20, 1.10, C.bodyLo, C.body);

    // nose, low and pointed
    taper(faces, 0.24, 0.13, 0.13, 0.32, 0.52, 1.28, C.nose, C.body);
    taper(faces, 0.18, 0.10, 0.32, 0.35, 0.58, 1.24, C.teal);        // blade

    // front splitter
    taper(faces, 0.58, 0.68, 0.04, 0.08, 1.06, 1.42, C.bodyLo, C.mag);

    // side pods, low and long
    box(faces, -0.86, -0.54, 0.10, 0.34, -0.54, 0.32, C.pod, C.pod, C.teal);
    box(faces,  0.54,  0.86, 0.10, 0.34, -0.54, 0.32, C.pod, C.pod, C.teal);

    // seat tub and backrest
    box(faces, -0.36, 0.36, 0.14, 0.30, -0.78, -0.10, C.seat);
    box(faces, -0.34, 0.34, 0.30, 0.74, -0.84, -0.72, C.seat, C.bodyLo);

    // driver — hips into shoulders, then the helmet
    frustum(faces, 0.30, 0.20, 0.26, 0.15, 0.28, 0.68, -0.50, C.red, C.redLo);
    frustum(faces, 0.30, 0.16, 0.17, 0.13, 0.68, 0.80, -0.50, C.red, C.redLo);
    sphere(faces, 0, 0.92, -0.52, 0.195, 4, 9, C.helmet, C.teal);
    push(faces, [[-0.14, 0.94, -0.36], [0.14, 0.94, -0.36],
                 [0.14, 0.85, -0.38], [-0.14, 0.85, -0.38]], C.visor);

    // steering column and rim
    box(faces, -0.035, 0.035, 0.34, 0.52, -0.26, -0.06, C.bodyLo);
    cylX(faces, 0, 0.55, -0.02, 0.165, 0.026, 12, C.seat, C.bodyLo);

    // rear wing: plane, endplates, twin pylons
    box(faces, -0.18, -0.13, 0.72, 0.98, -1.16, -1.06, C.bodyLo);
    box(faces,  0.13,  0.18, 0.72, 0.98, -1.16, -1.06, C.bodyLo);
    box(faces, -0.66, 0.66, 0.98, 1.04, -1.24, -1.00, C.mag);
    box(faces, -0.72, -0.64, 0.84, 1.16, -1.26, -0.98, C.bodyLo, C.teal, C.teal);
    box(faces,  0.64,  0.72, 0.84, 1.16, -1.26, -0.98, C.bodyLo, C.teal, C.teal);

    // exhaust stubs
    box(faces, -0.94, -0.82, 0.30, 0.42, -0.66, -0.50, C.amber);
    box(faces,  0.82,  0.94, 0.30, 0.42, -0.66, -0.50, C.amber);

    buildWheel(-0.92, 0.30, 0.82, 0.30, 0.18, true);
    buildWheel( 0.92, 0.30, 0.82, 0.30, 0.18, true);
    buildWheel(-1.00, 0.37, -0.92, 0.37, 0.27, false);
    buildWheel( 1.00, 0.37, -0.92, 0.37, 0.27, false);
  })();

  /* ─────────────────────────────── maths ───────────────────────────────── */
  function rotX(p, a) {
    var c = Math.cos(a), s = Math.sin(a);
    return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c];
  }
  function rotY(p, a) {
    var c = Math.cos(a), s = Math.sin(a);
    return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
  }

  var LIGHT = (function (l) {
    var m = Math.hypot(l[0], l[1], l[2]);
    return [l[0] / m, l[1] / m, l[2] / m];
  })([-0.45, 0.82, 0.55]);

  function shade(c, n) {
    var d = n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2];
    var k = 0.58 + 0.44 * Math.max(0, d);
    return "rgb(" + ((c[0] * k) | 0) + "," + ((c[1] * k) | 0) + "," + ((c[2] * k) | 0) + ")";
  }

  /* ─────────────────────────────── render ──────────────────────────────── */
  var drive = 0, spin = 0, W = 0, H = 0, dpr = 1;

  function resize() {
    var r = canvas.getBoundingClientRect();
    if (!r.width) return false;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    return true;
  }

  function frame() {
    if (!W && !resize()) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    var t = drive;
    // camera pulls in and drops toward the kart's eye line as it comes at us
    // Measured: 5.8 -> 4.2 takes the kart from ~70% to ~92% of the canvas width. Any
    // closer and the near wheels blow past the frame edge — the growth is far steeper
    var dist = 5.8 - t * 1.6;
    var camY = 1.00 - t * 0.34;
    var yaw = 0.50 - t * 0.28;          // keeps a three-quarter view throughout
    var steer = Math.sin(spin * 0.11) * 0.11;
    var lean = Math.sin(spin * 0.11) * 0.03;

    var f = H * 2.15;                    // focal length in px
    // pin the ground plane to a fixed line so the kart grows out of the road
    // instead of sliding up the canvas as the camera closes in
    var ox = W * 0.5, oy = H * 0.88 - f * camY / dist;

    var list = [], i, j, k, wl, p, out;

    for (i = 0; i < faces.length; i++) list.push(faces[i]);

    for (k = 0; k < wheels.length; k++) {
      wl = wheels[k];
      for (j = 0; j < wl.f.length; j++) {
        var src = wl.f[j].v, dst = [];
        for (i = 0; i < src.length; i++) {
          p = rotX(src[i], spin);
          if (wl.steer) p = rotY(p, steer);
          dst.push([p[0] + wl.c[0], p[1] + wl.c[1], p[2] + wl.c[2]]);
        }
        list.push({ v: dst, c: wl.f[j].c });
      }
    }

    out = [];
    for (i = 0; i < list.length; i++) {
      var v = list[i].v, n = v.length, pts = [], zsum = 0, ok = true;
      var world = [];
      for (j = 0; j < n; j++) {
        p = rotY(v[j], yaw);
        p = rotX(p, lean);
        world.push(p);
        var vz = dist - p[2];
        if (vz < 0.35) { ok = false; break; }          // behind/through the camera
        pts.push([ox + f * p[0] / vz, oy - f * (p[1] - camY) / vz]);
        zsum += vz;
      }
      if (!ok) continue;

      // face normal from the first three world-space points
      var ax = world[1][0] - world[0][0], ay = world[1][1] - world[0][1], az = world[1][2] - world[0][2];
      var bx = world[2][0] - world[0][0], by = world[2][1] - world[0][1], bz = world[2][2] - world[0][2];
      var nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
      var m = Math.hypot(nx, ny, nz) || 1;
      nx /= m; ny /= m; nz /= m;

      // screen-space winding decides which side we are looking at
      var area = 0;
      for (j = 0; j < pts.length; j++) {
        var q = pts[(j + 1) % pts.length];
        area += pts[j][0] * q[1] - q[0] * pts[j][1];
      }
      if (area > 0) continue;                          // back face
      if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; }

      out.push({ p: pts, z: zsum / n, s: shade(list[i].c, [nx, ny, nz]) });
    }

    out.sort(function (a, b) { return b.z - a.z; });   // far to near

    // ground shadow, projected flat
    var sy = H * 0.88;
    var sScale = f / dist;
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = "#150c22";
    ctx.beginPath();
    ctx.ellipse(ox, sy, sScale * 1.55, sScale * 0.30, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(1, Math.min(2.4, sScale * 0.016));
    ctx.strokeStyle = INK;
    for (i = 0; i < out.length; i++) {
      var o = out[i];
      ctx.beginPath();
      ctx.moveTo(o.p[0][0], o.p[0][1]);
      for (j = 1; j < o.p.length; j++) ctx.lineTo(o.p[j][0], o.p[j][1]);
      ctx.closePath();
      ctx.fillStyle = o.s;
      ctx.fill();
      ctx.stroke();
    }
  }

  /* ─────────────────────────────── drive ───────────────────────────────── */
  var hero = document.querySelector(".hero");
  var still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var visible = true, running = false;

  function readScroll() {
    if (!hero) return;
    var r = hero.getBoundingClientRect();
    var p = Math.min(Math.max(-r.top / Math.max(r.height * 0.85, 1), 0), 1);
    drive = p * p;
  }

  function loop() {
    if (!running) return;
    spin += 0.30 + drive * 0.55;
    readScroll();
    frame();
    requestAnimationFrame(loop);
  }

  function start() {
    if (running || still) return;
    running = true;
    requestAnimationFrame(loop);
  }
  function stop() { running = false; }

  window.addEventListener("resize", function () { resize(); if (still) { readScroll(); frame(); } });

  if ("IntersectionObserver" in window && hero) {
    new IntersectionObserver(function (es) {
      visible = es[0].isIntersecting;
      if (visible) start(); else stop();
    }, { rootMargin: "120px" }).observe(hero);
  } else {
    start();
  }

  resize();
  readScroll();
  frame();                       // paint one frame immediately, before any scrolling
  if (still) window.addEventListener("scroll", function () { readScroll(); frame(); }, { passive: true });
})();
