/* Hero kart — a low-poly 3D model, projected by hand onto a 2D canvas.
 *
 * No WebGL and no library: the mesh is a few hundred quads, the renderer is a
 * perspective projection plus a painter's-algorithm sort, and shading is a flat
 * lambert term per face. That keeps the page a single self-contained file, which
 * a WebGL library would not.
 *
 * Faces carry a `sm` (smooth) flag. Hard-edged bodywork is stroked in ink, which
 * matches the outlined look of the rest of the page. Curved surfaces — helmet,
 * tyres, steering rim — are stroked in their own fill colour so the facet seams
 * vanish, and only faces near the silhouette keep a dark edge. Without that the
 * helmet renders as a disco ball.
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
    body:    [60, 69, 94],
    bodyLo:  [41, 48, 67],
    pod:     [72, 83, 112],
    nose:    [52, 60, 82],
    frame:   [80, 90, 118],
    teal:    [23, 196, 210],
    mag:     [224, 82, 206],
    amber:   [255, 176, 32],
    red:     [230, 40, 64],
    redLo:   [170, 22, 42],
    suit:    [38, 44, 62],
    tyre:    [46, 52, 65],
    tyreLo:  [31, 36, 46],
    rim:     [208, 216, 236],
    rimLo:   [124, 135, 160],
    helmet:  [242, 245, 255],
    visor:   [18, 24, 44],
    seat:    [124, 134, 158],
    seatLo:  [86, 95, 118],
    engine:  [96, 104, 124],
    steel:   [150, 158, 178],
    plate:   [238, 242, 252]
  };

  /* ─────────────────────────────── geometry ────────────────────────────── */
  var faces = [];   // bodywork, fixed
  var wheels = [];  // {c:[x,y,z], steer:bool, f:[face]} — spin about their own axle

  function push(list, v, c, sm) { list.push({ v: v, c: c, sm: !!sm }); }

  function box(list, x0, x1, y0, y1, z0, z1, c, top, side) {
    top = top || c; side = side || c;
    push(list, [[x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0]], top);
    push(list, [[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]], c);
    push(list, [[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]], c);
    push(list, [[x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0]], c);
    push(list, [[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0]], side);
    push(list, [[x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1]], side);
  }

  // box with an independent half-width at each end — floor pan, nose, splitter
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

  // box whose cross-section shrinks (or grows) with height — hips, torso, shoulders
  // Winding matters: the renderer culls by the sign of the screen-space signed
  // area, so a face wound the wrong way is drawn exactly when it should be hidden.
  // Every primitive here winds counter-clockwise seen from outside.
  function frustum(list, hw0, hd0, hw1, hd1, y0, y1, cx, cz, c, top) {
    top = top || c;
    var a = [cx-hw0,y0,cz-hd0], b = [cx+hw0,y0,cz-hd0], d = [cx+hw0,y0,cz+hd0], e = [cx-hw0,y0,cz+hd0];
    var A = [cx-hw1,y1,cz-hd1], B = [cx+hw1,y1,cz-hd1], D = [cx+hw1,y1,cz+hd1], E = [cx-hw1,y1,cz+hd1];
    push(list, [E,D,B,A], top);
    push(list, [a,b,d,e], c);
    push(list, [d,D,E,e], c);
    push(list, [a,A,B,b], c);
    push(list, [e,E,A,a], c);
    push(list, [b,B,D,d], c);
  }

  // tapered box between two points — arms and legs
  function limb(list, x0, y0, z0, x1, y1, z1, r0, r1, c) {
    var a = [x0-r0,y0-r0,z0], b = [x0+r0,y0-r0,z0], d = [x0+r0,y0+r0,z0], e = [x0-r0,y0+r0,z0];
    var A = [x1-r1,y1-r1,z1], B = [x1+r1,y1-r1,z1], D = [x1+r1,y1+r1,z1], E = [x1-r1,y1+r1,z1];
    push(list, [a,b,d,e], c);
    push(list, [B,A,E,D], c);
    push(list, [a,e,E,A], c);
    push(list, [b,B,D,d], c);
    push(list, [e,d,D,E], c);
    push(list, [a,A,B,b], c);
  }

  // cylinder about the X axis. Caps are a single n-gon each: a triangle fan would
  // put a seam on every segment and the wheels would read as spiderwebs.
  function cylX(list, cx, cy, cz, r, hw, segs, side, cap, sm) {
    var i, j, a, L = [], R = [];
    for (i = 0; i < segs; i++) {
      a = (i / segs) * Math.PI * 2;
      L.push([cx - hw, cy + Math.cos(a) * r, cz + Math.sin(a) * r]);
      R.push([cx + hw, cy + Math.cos(a) * r, cz + Math.sin(a) * r]);
    }
    for (i = 0; i < segs; i++) {
      j = (i + 1) % segs;
      push(list, [L[i], L[j], R[j], R[i]], side, sm);
    }
    push(list, L.slice().reverse(), cap);
    push(list, R.slice(), cap);
  }

  function sphere(list, cx, cy, cz, rx, ry, lat, lon, c, capColor) {
    var i, j;
    function P(t, f) {
      return [cx + rx * Math.sin(t) * Math.cos(f),
              cy + ry * Math.cos(t),
              cz + rx * Math.sin(t) * Math.sin(f)];
    }
    for (i = 0; i < lat; i++) {
      var t0 = Math.PI * i / lat, t1 = Math.PI * (i + 1) / lat;
      for (j = 0; j < lon; j++) {
        var f0 = 2 * Math.PI * j / lon, f1 = 2 * Math.PI * (j + 1) / lon;
        push(list, [P(t0,f0), P(t0,f1), P(t1,f1), P(t1,f0)],
             (i < lat * 0.34 && capColor) ? capColor : c, true);
      }
    }
  }

  // rotate a freshly built sub-assembly into place (the steering wheel needs it —
  // cylX only makes cylinders lying along X, and a steering wheel faces the driver)
  function place(target, sub, ry, rx, tx, ty, tz) {
    var i, j, p, out;
    for (i = 0; i < sub.length; i++) {
      out = [];
      for (j = 0; j < sub[i].v.length; j++) {
        p = sub[i].v[j];
        var cy1 = Math.cos(ry), sy1 = Math.sin(ry);
        p = [p[0]*cy1 + p[2]*sy1, p[1], -p[0]*sy1 + p[2]*cy1];
        var cx1 = Math.cos(rx), sx1 = Math.sin(rx);
        p = [p[0], p[1]*cx1 - p[2]*sx1, p[1]*sx1 + p[2]*cx1];
        out.push([p[0] + tx, p[1] + ty, p[2] + tz]);
      }
      target.push({ v: out, c: sub[i].c, sm: sub[i].sm });
    }
  }

  // A flat disc gives no cue that the wheel is turning. Spokes do — they are the
  // clearest signal that the kart is moving rather than parked.
  //
  // They must TILE the rim face, not sit on top of a disc. Coplanar overlapping
  // faces cannot be ordered by a painter's sort: the disc's depth key is the axle
  // while each spoke's key is its own off-centre centroid, so half the spokes sort
  // behind the disc and get painted out — they blink instead of turning. Nudging
  // them outboard does not rescue it either; the in-plane centroid offset is ~0.10
  // world units against ~0.001 for any nudge small enough to stay invisible.
  // Tiling removes the overlap, so the ordering cannot go wrong at all.
  function wedge(list, x, a0, a1, rIn, rOut, col, segs) {
    var p = [], i, a;
    p.push([x, Math.cos(a0) * rIn, Math.sin(a0) * rIn]);
    for (i = 0; i <= segs; i++) {
      a = a0 + (a1 - a0) * i / segs;
      p.push([x, Math.cos(a) * rOut, Math.sin(a) * rOut]);
    }
    p.push([x, Math.cos(a1) * rIn, Math.sin(a1) * rIn]);
    push(list, x > 0 ? p : p.slice().reverse(), col);
  }

  function rimFace(list, x, rOut, rIn, spokes, colSpoke, colGap) {
    var step = Math.PI * 2 / spokes, half = step * 0.19, k, i, a, inner = [];
    for (i = 0; i < 12; i++) {
      a = (i / 12) * Math.PI * 2;
      inner.push([x, Math.cos(a) * rIn, Math.sin(a) * rIn]);
    }
    push(list, x > 0 ? inner : inner.slice().reverse(), colGap);
    for (k = 0; k < spokes; k++) {
      a = k * step;
      wedge(list, x, a - half, a + half, rIn, rOut, colSpoke, 2);
      wedge(list, x, a + half, a + step - half, rIn, rOut, colGap, 3);
    }
  }

  function buildWheel(cx, cy, cz, r, hw, steer) {
    var f = [];
    cylX(f, 0, 0, 0, r, hw, 16, C.tyre, C.tyreLo, true);          // tyre
    cylX(f, 0, 0, 0, r * 0.56, hw * 1.02, 12, C.rimLo, C.rimLo, true);
    rimFace(f,  hw * 1.03, r * 0.55, r * 0.16, 5, C.rim, C.rimLo);
    rimFace(f, -hw * 1.03, r * 0.55, r * 0.16, 5, C.rim, C.rimLo);
    cylX(f, 0, 0, 0, r * 0.14, hw * 1.10, 6, C.rim, C.rimLo, true);
    // sidewall band, so the tread reads as rotating from any angle
    push(f, [[ hw * 1.005, Math.cos(0.35) * r * 0.92, Math.sin(0.35) * r * 0.92],
             [ hw * 1.005, Math.cos(0.62) * r * 0.92, Math.sin(0.62) * r * 0.92],
             [ hw * 1.005, Math.cos(0.62) * r * 0.72, Math.sin(0.62) * r * 0.72],
             [ hw * 1.005, Math.cos(0.35) * r * 0.72, Math.sin(0.35) * r * 0.72]], C.steel);
    wheels.push({ c: [cx, cy, cz], steer: !!steer, f: f });
  }

  (function build() {
    // A kart is a flat floor pan with four exposed wheels, a bucket seat bolted to
    // it and the engine hung off the right-hand side. Keeping the silhouette low
    // is what stops it reading as a toy truck.

    // ── floor pan and nose ────────────────────────────────────────────────
    taper(faces, 0.54, 0.24, 0.07, 0.15, -1.20, 1.10, C.bodyLo, C.body);
    taper(faces, 0.24, 0.13, 0.13, 0.32, 0.52, 1.28, C.nose, C.body);
    taper(faces, 0.15, 0.085, 0.315, 0.335, 0.62, 1.22, C.teal);
    taper(faces, 0.50, 0.56, 0.055, 0.10, 1.02, 1.34, C.bodyLo, C.mag);
    box(faces, -0.10, 0.10, 0.18, 0.29, 1.278, 1.30, C.plate);        // number plate
    // livery — without it the whole machine reads as one grey mass
    box(faces, -0.245, -0.225, 0.16, 0.30, 0.56, 1.24, C.mag);        // nose flashes
    box(faces,  0.225,  0.245, 0.16, 0.30, 0.56, 1.24, C.mag);
    box(faces, -0.556, -0.536, 0.16, 0.28, -1.18, 0.34, C.teal);      // floor-pan stripes
    box(faces,  0.536,  0.556, 0.16, 0.28, -1.18, 0.34, C.teal);

    // ── tubular bumpers, the most kart-like detail there is ───────────────
    box(faces, -0.50,  0.50, 0.20, 0.26, 1.16, 1.22, C.steel);        // front hoop
    box(faces, -0.50, -0.44, 0.20, 0.26, 0.86, 1.22, C.steel);
    box(faces,  0.44,  0.50, 0.20, 0.26, 0.86, 1.22, C.steel);
    box(faces, -0.94, -0.88, 0.22, 0.28, -0.62, 0.42, C.steel);       // side bars
    box(faces,  0.88,  0.94, 0.22, 0.28, -0.62, 0.42, C.steel);
    box(faces, -0.62,  0.62, 0.30, 0.36, -1.16, -1.10, C.steel);      // rear hoop

    // ── side pods ─────────────────────────────────────────────────────────
    box(faces, -0.86, -0.56, 0.10, 0.32, -0.52, 0.30, C.pod, C.pod, C.teal);
    box(faces,  0.56,  0.86, 0.10, 0.32, -0.52, 0.30, C.pod, C.pod, C.teal);

    // ── engine, hung off the right side the way a real kart carries it ────
    box(faces, 0.40, 0.80, 0.16, 0.50, -0.92, -0.44, C.engine, C.frame, C.frame);
    box(faces, 0.46, 0.74, 0.50, 0.58, -0.86, -0.54, C.frame);        // head
    box(faces, 0.80, 0.90, 0.34, 0.44, -0.80, -0.58, C.amber);        // exhaust stub
    box(faces, 0.30, 0.40, 0.18, 0.44, -0.90, -0.80, C.steel);        // chain guard

    // ── bucket seat ───────────────────────────────────────────────────────
    // the side bolsters are what make it legible: they stay visible either side
    // of the driver, so you can tell he is sitting in something
    box(faces, -0.31, 0.31, 0.14, 0.27, -0.80, -0.20, C.seat, C.seatLo);
    frustum(faces, 0.31, 0.06, 0.27, 0.06, 0.26, 0.82, 0, -0.78, C.seat, C.seatLo);
    box(faces, -0.38, -0.30, 0.24, 0.70, -0.84, -0.30, C.seat, C.seatLo, C.seatLo);
    box(faces,  0.30,  0.38, 0.24, 0.70, -0.84, -0.30, C.seat, C.seatLo, C.seatLo);

    // ── driver ────────────────────────────────────────────────────────────
    frustum(faces, 0.23, 0.17, 0.20, 0.14, 0.24, 0.52, 0, -0.50, C.red, C.redLo);
    frustum(faces, 0.20, 0.14, 0.19, 0.12, 0.52, 0.74, 0, -0.52, C.red, C.redLo);
    frustum(faces, 0.19, 0.12, 0.25, 0.13, 0.74, 0.83, 0, -0.52, C.red, C.redLo);
    box(faces, -0.07, 0.07, 0.83, 0.89, -0.60, -0.46, C.suit);        // neck

    // legs stretched forward to the pedals, knees up
    limb(faces, -0.13, 0.24, -0.32, -0.15, 0.30,  0.16, 0.085, 0.075, C.red);
    limb(faces,  0.13, 0.24, -0.32,  0.15, 0.30,  0.16, 0.085, 0.075, C.red);
    limb(faces, -0.15, 0.30,  0.16, -0.13, 0.17,  0.52, 0.075, 0.065, C.suit);
    limb(faces,  0.15, 0.30,  0.16,  0.13, 0.17,  0.52, 0.075, 0.065, C.suit);

    // arms reaching to the wheel
    limb(faces, -0.22, 0.76, -0.50, -0.15, 0.60, -0.10, 0.065, 0.055, C.red);
    limb(faces,  0.22, 0.76, -0.50,  0.15, 0.60, -0.10, 0.065, 0.055, C.red);
    box(faces, -0.19, -0.11, 0.55, 0.66, -0.13, -0.05, C.plate);      // gloves
    box(faces,  0.11,  0.19, 0.55, 0.66, -0.13, -0.05, C.plate);

    // helmet: smooth-shaded, slightly egg-shaped, with a wrapped visor band
    sphere(faces, 0, 0.98, -0.54, 0.185, 0.205, 7, 14, C.helmet, C.teal);
    (function visor() {
      // f = +pi/2 is the front of the helmet; the first pass used -pi/2 and put
      // the visor on the back of his head
      var i, n = 8, a0 = 0.84, a1 = 2.30, r = 0.191;
      for (i = 0; i < n; i++) {
        var f0 = a0 + (a1 - a0) * i / n, f1 = a0 + (a1 - a0) * (i + 1) / n;
        var k0 = 0.90, k1 = 1.0;    // narrower at the brow, full width at the chin
        push(faces, [
          [r * k0 * Math.cos(f0), 1.030, -0.54 + r * k0 * Math.sin(f0)],
          [r * k0 * Math.cos(f1), 1.030, -0.54 + r * k0 * Math.sin(f1)],
          [r * k1 * Math.cos(f1), 0.930, -0.54 + r * k1 * Math.sin(f1)],
          [r * k1 * Math.cos(f0), 0.930, -0.54 + r * k1 * Math.sin(f0)]
        ], C.visor, true);
      }
    })();

    // ── steering wheel ────────────────────────────────────────────────────
    // cylX only makes cylinders lying along X; a steering wheel faces the driver,
    // so build it flat and rotate it a quarter turn, then tilt it back
    (function () {
      var sub = [];
      cylX(sub, 0, 0, 0, 0.175, 0.022, 14, C.suit, C.bodyLo, true);
      cylX(sub, 0, 0, 0, 0.05, 0.045, 8, C.steel, C.frame, true);
      place(faces, sub, Math.PI / 2, -0.62, 0, 0.60, -0.10);
    })();
    box(faces, -0.035, 0.035, 0.30, 0.58, -0.30, -0.10, C.frame);     // column

    // ── rear wing ─────────────────────────────────────────────────────────
    box(faces, -0.18, -0.13, 0.72, 0.98, -1.16, -1.06, C.bodyLo);
    box(faces,  0.13,  0.18, 0.72, 0.98, -1.16, -1.06, C.bodyLo);
    box(faces, -0.66,  0.66, 0.98, 1.04, -1.24, -1.00, C.mag);
    box(faces, -0.72, -0.64, 0.84, 1.16, -1.26, -0.98, C.bodyLo, C.teal, C.teal);
    box(faces,  0.64,  0.72, 0.84, 1.16, -1.26, -0.98, C.bodyLo, C.teal, C.teal);

    buildWheel(-0.92, 0.30,  0.82, 0.30, 0.18, true);
    buildWheel( 0.92, 0.30,  0.82, 0.30, 0.18, true);
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

  function unit(l) {
    var m = Math.hypot(l[0], l[1], l[2]);
    return [l[0] / m, l[1] / m, l[2] / m];
  }
  // Three lights rather than one: a single lambert term leaves the dark bodywork
  // reading as one flat mass. Key models the form, fill keeps the shadow side from
  // going to mud, and a cool rim from behind separates the top edges from the sky.
  var KEY  = unit([-0.45, 0.82, 0.55]);
  var FILL = unit([0.66, 0.22, 0.34]);
  var RIM  = unit([0.10, 0.50, -0.86]);

  function cl(v) { return v < 0 ? 0 : v > 255 ? 255 : v | 0; }

  function shade(c, n, ao) {
    var kd = Math.max(0, n[0]*KEY[0]  + n[1]*KEY[1]  + n[2]*KEY[2]);
    var fd = Math.max(0, n[0]*FILL[0] + n[1]*FILL[1] + n[2]*FILL[2]);
    var rd = Math.max(0, n[0]*RIM[0]  + n[1]*RIM[1]  + n[2]*RIM[2]);
    var k = (0.58 + 0.50 * kd + 0.16 * fd) * ao;
    var rim = 0.26 * rd * rd * ao;
    return "rgb(" + cl(c[0]*k + rim*116) + "," +
                    cl(c[1]*k + rim*144) + "," +
                    cl(c[2]*k + rim*182) + ")";
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
    // Measured: 5.8 -> 4.2 takes the kart from ~70% to ~92% of the canvas width.
    // Apparent size grows far faster than 1/distance once the near wheels approach
    // the lens, so these came off renders rather than off the formula.
    var dist = 5.8 - t * 1.6;
    var camY = 1.00 - t * 0.34;
    var yaw = 0.50 - t * 0.28;          // keeps a three-quarter view throughout
    var steer = Math.sin(spin * 0.11) * 0.11;
    var lean = Math.sin(spin * 0.11) * 0.03;

    var f = H * 2.15;
    // pin the ground plane so the kart grows out of the road rather than sliding
    // up the canvas as the camera closes in
    var ox = W * 0.5, oy = H * 0.88 - f * camY / dist;

    var list = [], i, j, k, wl, p;

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
        list.push({ v: dst, c: wl.f[j].c, sm: wl.f[j].sm });
      }
    }

    var out = [];
    for (i = 0; i < list.length; i++) {
      var v = list[i].v, n = v.length, pts = [], zsum = 0, ok = true, world = [];
      for (j = 0; j < n; j++) {
        p = rotX(rotY(v[j], yaw), lean);
        world.push(p);
        var vz = dist - p[2];
        if (vz < 0.35) { ok = false; break; }
        pts.push([ox + f * p[0] / vz, oy - f * (p[1] - camY) / vz]);
        zsum += vz;
      }
      if (!ok) continue;

      var area = 0;
      for (j = 0; j < pts.length; j++) {
        var q = pts[(j + 1) % pts.length];
        area += pts[j][0] * q[1] - q[0] * pts[j][1];
      }
      if (area > -0.5) continue;                      // back-facing or degenerate

      var ax = world[1][0]-world[0][0], ay = world[1][1]-world[0][1], az = world[1][2]-world[0][2];
      var bx = world[2][0]-world[0][0], by = world[2][1]-world[0][1], bz = world[2][2]-world[0][2];
      var nx = ay*bz - az*by, ny = az*bx - ax*bz, nz = ax*by - ay*bx;
      var m = Math.hypot(nx, ny, nz) || 1;
      nx /= m; ny /= m; nz /= m;
      // Point the normal at the camera, which sits at (0, camY, dist). Testing
      // nz < 0 instead looks equivalent but is not: a horizontal face has
      // nz = +/-sin(lean), so it changes sign twice per lean cycle and the whole
      // upper surface of the kart strobes between lit and ambient.
      var cxw = 0, cyw = 0, czw = 0;
      for (j = 0; j < n; j++) { cxw += world[j][0]; cyw += world[j][1]; czw += world[j][2]; }
      cxw /= n; cyw /= n; czw /= n;
      if (nx * (0 - cxw) + ny * (camY - cyw) + nz * (dist - czw) < 0) {
        nx = -nx; ny = -ny; nz = -nz;
      }

      // cheap ambient occlusion: the closer a face sits to the ground, the less
      // sky it can see. Grounds the underbody instead of letting it float.
      var ao = 0.76 + 0.24 * Math.min(1, Math.max(0, cyw) / 0.62);
      out.push({ p: pts, z: zsum / n, s: shade(list[i].c, [nx, ny, nz], ao),
                 sm: list[i].sm, n: nz });
    }

    out.sort(function (a, b) { return b.z - a.z; });

    var sScale = f / dist;
    ctx.save();
    ctx.fillStyle = "#150c22";
    ctx.globalAlpha = 0.14;
    ctx.beginPath();
    ctx.ellipse(ox, H * 0.88, sScale * 1.52, sScale * 0.29, 0, 0, Math.PI * 2);
    ctx.fill();
    // a tighter, darker patch under each wheel — the soft blob alone left the
    // kart hovering
    ctx.globalAlpha = 0.3;
    for (k = 0; k < wheels.length; k++) {
      var wp = rotX(rotY(wheels[k].c, yaw), lean);
      var wvz = dist - wp[2];
      if (wvz < 0.35) continue;
      var wsx = ox + f * wp[0] / wvz, wsy = oy - f * (0 - camY) / wvz;
      var ws = f / wvz;
      ctx.beginPath();
      ctx.ellipse(wsx, wsy, ws * 0.30, ws * 0.10, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.lineJoin = "round";
    var lw = Math.max(0.9, Math.min(2.2, sScale * 0.014));
    for (i = 0; i < out.length; i++) {
      var o = out[i];
      ctx.beginPath();
      ctx.moveTo(o.p[0][0], o.p[0][1]);
      for (j = 1; j < o.p.length; j++) ctx.lineTo(o.p[j][0], o.p[j][1]);
      ctx.closePath();
      ctx.fillStyle = o.s;
      ctx.fill();
      // Smooth surfaces get their seams painted in their own colour; only faces
      // near the silhouette (normal nearly perpendicular to the view) keep an ink
      // edge, which outlines the shape without faceting it.
      if (o.sm && o.n > 0.34) { ctx.strokeStyle = o.s; ctx.lineWidth = 1; }
      else { ctx.strokeStyle = INK; ctx.lineWidth = lw; }
      ctx.stroke();
    }
  }

  /* ─────────────────────────────── drive ───────────────────────────────── */
  var hero = document.querySelector(".hero");
  var still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var running = false;

  function readScroll() {
    if (!hero) return;
    var r = hero.getBoundingClientRect();
    var p = Math.min(Math.max(-r.top / Math.max(r.height * 0.85, 1), 0), 1);
    drive = p * p;
  }

  var last = 0;
  function loop(ts) {
    if (!running) return;
    // scale by elapsed time, not by frame count — otherwise the wheels spin twice
    // as fast on a 120Hz screen. Clamped so a backgrounded tab does not jump.
    var dt = last ? Math.min((ts - last) / 16.67, 3) : 1;
    last = ts;
    spin += (0.30 + drive * 0.55) * dt;
    readScroll();
    frame();
    requestAnimationFrame(loop);
  }

  function start() { if (!running && !still) { running = true; last = 0; requestAnimationFrame(loop); } }
  function stop() { running = false; last = 0; }

  window.addEventListener("resize", function () {
    resize();
    if (still) { readScroll(); frame(); }
  });

  if ("IntersectionObserver" in window && hero) {
    new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) start(); else stop();
    }, { rootMargin: "120px" }).observe(hero);
  } else {
    start();
  }

  // The hero can be display:none when this runs (a reload on #/booking routes
  // before this script initialises), so the canvas measures 0x0 and paints
  // nothing. Watch the element and paint as soon as it has a size — this also
  // covers route changes and a window moving between monitors of different dpr.
  if ("ResizeObserver" in window) {
    new ResizeObserver(function () {
      if (resize()) { readScroll(); frame(); }
    }).observe(canvas);
  }

  resize();
  readScroll();
  frame();
  if (still) window.addEventListener("scroll", function () { readScroll(); frame(); }, { passive: true });
})();
