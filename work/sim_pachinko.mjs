const W = 720;
const H = 900;
const fixedPinRadius = 3;
const physics = {
  ballMassG: 5,
  gravity: .0048,
  airDrag: .0011,
  rollingDrag: .0022,
  maxSpeed: 1.65,
  nailRestitution: .72,
  wallRestitution: .58,
  lcdRestitution: .54,
  ballRestitution: .42,
  randomNailScatter: .10
};
const nailSettingTable = {
  1: { spinsPer250: 17.2, startPerBall: 17.2 / 250 },
  2: { spinsPer250: 20.5, startPerBall: 20.5 / 250 },
  3: { spinsPer250: 24.4, startPerBall: 24.4 / 250 },
  4: { spinsPer250: 27.4, startPerBall: 27.4 / 250 },
  5: { spinsPer250: 30.5, startPerBall: 30.5 / 250 },
  6: { spinsPer250: 34.4, startPerBall: 34.4 / 250 }
};
const pockets = [
  { x: 360, y: 790, r: 20, type: "start" },
  { x: 194, y: 720, r: 25, type: "normal" },
  { x: 526, y: 720, r: 25, type: "normal" },
  { x: 632, y: 568, r: 38, type: "attacker" },
  { x: 360, y: 872, r: 44, type: "out" }
];
const hitAreas = {
  lcd: { x: 118, y: 166, w: 484, h: 363 },
  windmill: { x: 88, y: 594, r: 24 },
  launch: { x: 42, y: 78, r: 18 },
  push: { x: 82, y: 824, r: 49 }
};

function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function buildPins(variant = {}) {
  const pins = [];
  const add = (x, y, kind = "normal", r = 3.1) => pins.push({ x, y, r, kind });
  const line = (x1, y1, x2, y2, count, kind = "normal", r = 3.1) => {
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : i / (count - 1);
      add(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, kind, r);
    }
  };
  const curve = (points, count, kind = "normal", r = 3.1) => {
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : i / (count - 1);
      const seg = Math.min(points.length - 2, Math.floor(t * (points.length - 1)));
      const local = t * (points.length - 1) - seg;
      const a = points[seg];
      const b = points[seg + 1];
      add(a.x + (b.x - a.x) * local, a.y + (b.y - a.y) * local, kind, r);
    }
  };

  const roadShift = variant.roadShift ?? 0;
  const hesoOpen = variant.hesoOpen ?? 0;
  const spillOpen = variant.spillOpen ?? 0;

  curve([{ x: 42, y: 86 }, { x: 58, y: 190 }, { x: 64, y: 360 }, { x: 78, y: 536 }], 11, "warp", 2.8);
  curve([{ x: 104, y: 126 }, { x: 98, y: 280 }, { x: 110, y: 430 }, { x: 122, y: 582 }], 10, "normal", 2.7);
  line(326, 122, 178, 158, 5, "spill", 2.7);
  line(394, 122, 542, 158, 5, "spill", 2.7);
  add(288, 146, "normal", 2.6);
  add(432, 146, "normal", 2.6);
  line(48, 472, 80, 546, 4, "spill", 2.7);
  line(126, 472, 84, 546, 4, "spill", 2.7);
  add(62, 582, "road", 2.8);
  add(124, 588, "road", 2.8);
  line(118, 616, 232 + roadShift, 654, 5, "road", 2.8);
  line(214, 644, 340 + roadShift, 696, 5, "road", 2.8);
  line(300, 696, 352 + roadShift * .4, 732, 3, "road", 2.8);
  line(94, 674, 54, 744, 3, "spill", 2.7);
  line(292 - spillOpen, 724, 238 - spillOpen, 792, 3, "spill", 2.7);

  line(302 - hesoOpen, 704, 344 - hesoOpen * .3, 738, 4, "heso", 2.8);
  line(418 + hesoOpen, 704, 376 + hesoOpen * .3, 738, 4, "heso", 2.8);
  add(336 - hesoOpen * .15, 758, "heso", 3.0);
  add(384 + hesoOpen * .15, 758, "heso", 3.0);
  add(350, 782, "heso", 2.7);
  add(370, 782, "heso", 2.7);
  line(252 - spillOpen, 760, 314 - spillOpen * .35, 826, 4, "spill", 2.8);
  line(468 + spillOpen, 760, 406 + spillOpen * .35, 826, 4, "spill", 2.8);
  line(236, 826, 318, 858, 5, "spill", 2.7);
  line(484, 826, 402, 858, 5, "spill", 2.7);

  return pins;
}

function lcdBlock() {
  const lcd = hitAreas.lcd;
  return { left: lcd.x, top: lcd.y, right: lcd.x + lcd.w, bottom: lcd.y + lcd.h };
}

function guideBall(ball, dt, rng, variant) {
  let target;
  if (ball.y < 360) target = { x: 62, y: 410, force: .00105 };
  else if (ball.y < 535) target = { x: 96, y: 585, force: .00110 };
  else if (ball.y < 660) target = { x: 252 + (variant.guideShift ?? 0), y: 670, force: .00116 };
  else if (ball.y < 735) target = { x: 344 + (variant.guideShift ?? 0) * .45, y: 742, force: .00118 };
  else if (ball.startEligible) target = { x: 360, y: 790, force: .00118 };
  else target = { x: 350, y: 858, force: .00090 };

  const dx = target.x - ball.x;
  const dy = target.y - ball.y;
  const dist = Math.max(80, Math.hypot(dx, dy));
  ball.vx += dx / dist * target.force * dt;
  ball.vy += dy / dist * target.force * dt;

  if (ball.x < 150 && ball.y < 560) {
    ball.vx += .0008 * dt;
    ball.vy += .010 * dt;
  }
  const wx = hitAreas.windmill.x;
  const wy = hitAreas.windmill.y;
  const dxw = ball.x - wx;
  const dyw = ball.y - wy;
  const dw = Math.hypot(dxw, dyw);
  if (dw < 78 && dw > 1) {
    const spin = Math.sin(ball.t / 260);
    const rightBias = ball.startEligible ? (variant.windEligible ?? .0062) : (variant.windBias ?? .0042);
    const sideKick = dxw < 0 ? .0018 : .0034;
    ball.vx += (rightBias + sideKick + spin * .0012) * dt;
    ball.vy += .003 * dt;
  }
  if (ball.y > 535 && ball.y < 670 && ball.x > 88 && ball.x < 300) {
    if (!ball.leftLcdSplitSide) {
      const chance = ball.startEligible ? (variant.splitEligible ?? .88) : (variant.splitChance ?? .72);
      ball.leftLcdSplitSide = rng() < chance ? 1 : -1;
    }
    const splitX = ball.leftLcdSplitSide > 0 ? 318 + (variant.guideShift ?? 0) : 152;
    ball.vx += (splitX - ball.x) * .000060 * dt;
    ball.vy += .005 * dt;
    if (Math.abs(ball.x - 220) < 42) ball.vx += ball.leftLcdSplitSide * .0022 * dt;
  }
  if (ball.y > 520) {
    const laneX = ball.y < 690 ? 302 + (variant.guideShift ?? 0) : 356;
    ball.vx += (laneX - ball.x) * .000026 * dt;
  }
  if (ball.y > 690 && ball.y < 775 && Math.abs(ball.x - 360) < 116) {
    const centerPull = 360 - ball.x;
    ball.vx += centerPull * .000022 * dt;
    ball.vy += .0028 * dt;
  }
  if (ball.startEligible && ball.y > 650 && ball.y < 812) {
    ball.vx += (360 - ball.x) * (variant.hesoPull ?? .000072) * dt;
    ball.vy += .0058 * dt;
  }
  if (!ball.startEligible && ball.y > 748) {
    ball.vx += (360 - ball.x) * .000024 * dt;
    ball.vy += .010 * dt;
    if (ball.y > 792 && Math.abs(ball.x - 360) < 54) {
      ball.vx *= .97;
      ball.vy += .010 * dt;
    }
  }
  if (ball.x > 470 && ball.y > 640) {
    ball.vx += (360 - ball.x) * .000050 * dt;
    ball.vy += .005 * dt;
  }
  if (ball.startEligible && ball.y > 500) {
    ball.vx *= .998;
    ball.vy *= .996;
  }
}

function collideWithPlayfieldCircle(ball) {
  const field = { x: 360, y: 500, rx: 432, ry: 444, topY: 42 };
  const flatTopHalf = field.rx * .93;
  if (ball.y < field.topY + ball.r && Math.abs(ball.x - field.x) < flatTopHalf) {
    ball.y = field.topY + ball.r;
    ball.vy = Math.abs(ball.vy) * physics.wallRestitution;
    return;
  }
  const dx = ball.x - field.x;
  const dy = ball.y - field.y;
  const rx = field.rx - ball.r - 2;
  const ry = field.ry - ball.r - 2;
  const normalized = Math.hypot(dx / rx, dy / ry);
  if (normalized <= 1 || normalized <= .01) return;
  ball.x = field.x + dx / normalized;
  ball.y = field.y + dy / normalized;
  const nxRaw = dx / (rx * rx);
  const nyRaw = dy / (ry * ry);
  const nLen = Math.max(.01, Math.hypot(nxRaw, nyRaw));
  const nx = nxRaw / nLen;
  const ny = nyRaw / nLen;
  const dot = ball.vx * nx + ball.vy * ny;
  if (dot > 0) {
    ball.vx -= (1 + physics.wallRestitution) * dot * nx;
    ball.vy -= (1 + physics.wallRestitution) * dot * ny;
  }
  if (ball.y > 705) {
    ball.vx += (360 - ball.x) * .006;
    ball.vy = Math.max(ball.vy, .45);
  }
}

function collideWithLcdFrame(ball, rng) {
  const block = lcdBlock();
  const pad = ball.r + 4;
  if (ball.x < block.left - pad || ball.x > block.right + pad || ball.y < block.top - pad || ball.y > block.bottom + pad) return;
  const insideX = ball.x > block.left && ball.x < block.right;
  const insideY = ball.y > block.top && ball.y < block.bottom;
  if (!insideX || !insideY) return;
  const exits = [
    { side: "left", d: Math.abs(ball.x - block.left) },
    { side: "right", d: Math.abs(block.right - ball.x) },
    { side: "top", d: Math.abs(ball.y - block.top) },
    { side: "bottom", d: Math.abs(block.bottom - ball.y) }
  ].sort((a, b) => a.d - b.d);
  if (exits[0].side === "left") {
    ball.x = block.left - pad;
    ball.vx = -Math.abs(ball.vx) * physics.lcdRestitution - .12;
  } else if (exits[0].side === "right") {
    ball.x = block.right + pad;
    ball.vx = Math.abs(ball.vx) * physics.lcdRestitution + .12;
  } else if (exits[0].side === "top") {
    ball.y = block.top - pad;
    ball.vy = -Math.abs(ball.vy) * physics.lcdRestitution;
    const center = (block.left + block.right) / 2;
    const side = ball.x < center ? -1 : 1;
    ball.vx += side * .18 + (ball.x - center) * .0008;
  } else {
    ball.y = block.bottom + pad;
    ball.vy = Math.abs(ball.vy) * physics.lcdRestitution + .10;
  }
  ball.vx += (rng() - .5) * .08;
  ball.vy += (rng() - .5) * .05;
}

function collideWithWindmill(ball) {
  const x = hitAreas.windmill.x;
  const y = hitAreas.windmill.y;
  const r = hitAreas.windmill.r;
  const dx = ball.x - x;
  const dy = ball.y - y;
  const dist = Math.hypot(dx, dy);
  const min = r + ball.r + 1;
  if (dist >= min || dist <= .01) return;
  const nx = dx / dist;
  const ny = dy / dist;
  const overlap = min - dist;
  ball.x += nx * overlap;
  ball.y += ny * overlap;
  const dot = ball.vx * nx + ball.vy * ny;
  if (dot < 0) {
    ball.vx -= (1 + physics.nailRestitution * .85) * dot * nx;
    ball.vy -= (1 + physics.nailRestitution * .85) * dot * ny;
  }
  const spin = Math.sin(ball.t / 180) * .22;
  ball.vx += spin + nx * .18;
  ball.vy = Math.max(.25, ball.vy + .12);
}

function collideWithPushButton(ball) {
  const button = hitAreas.push;
  const dx = ball.x - button.x;
  const dy = ball.y - button.y;
  const dist = Math.hypot(dx, dy);
  const min = button.r + ball.r + 2;
  if (dist >= min || dist <= .01) return;
  const nx = dx / dist;
  const ny = dy / dist;
  ball.x += nx * (min - dist);
  ball.y += ny * (min - dist);
  const dot = ball.vx * nx + ball.vy * ny;
  if (dot < 0) {
    ball.vx -= (1 + physics.wallRestitution * .7) * dot * nx;
    ball.vy -= (1 + physics.wallRestitution * .7) * dot * ny;
  }
  ball.vx += (360 - ball.x) * .0025;
  ball.vy = Math.max(ball.vy, .32);
}

function simulate(variant, balls = 10000, setting = 3, seed = 12345) {
  const rng = makeRng(seed);
  const pins = buildPins(variant).map(p => ({ ...p, r: Math.max(1.45, fixedPinRadius) }));
  const settingInfo = nailSettingTable[setting];
  let startMeter = 0;
  const stat = { start: 0, out: 0, normal: 0, leftOut: 0, hesoZone: 0, eligible: 0, eligibleStart: 0, nonEligibleStart: 0, timeout: 0 };
  for (let i = 0; i < balls; i++) {
    startMeter += settingInfo.startPerBall;
    const startEligible = startMeter >= 1;
    if (startEligible) {
      startMeter -= 1;
      stat.eligible++;
    }
    const power = 62;
    const ball = {
      x: hitAreas.launch.x,
      y: hitAreas.launch.y,
      vx: power * .0012,
      vy: power * .006,
      r: Math.max(5, W * .0105),
      live: true,
      startEligible,
      t: i * 37,
      leftLcdSplitSide: 0,
      sawHeso: false
    };
    let result = "timeout";
    for (let step = 0; step < 520 && ball.live; step++) {
      const dt = 16.67;
      ball.t += dt;
      guideBall(ball, dt, rng, variant);
      ball.vy += physics.gravity * dt;
      const drag = Math.max(0, 1 - (physics.airDrag + physics.rollingDrag) * dt);
      ball.vx *= drag;
      ball.vy *= Math.max(0, 1 - physics.airDrag * dt);
      const speed = Math.hypot(ball.vx, ball.vy);
      if (speed > physics.maxSpeed) {
        const cap = physics.maxSpeed / speed;
        ball.vx *= cap;
        ball.vy *= cap;
      }
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      if (ball.y > 690 && ball.y < 820 && ball.x > 290 && ball.x < 430) ball.sawHeso = true;
      collideWithPlayfieldCircle(ball);
      collideWithLcdFrame(ball, rng);
      collideWithWindmill(ball);
      collideWithPushButton(ball);
      if (ball.x < ball.r + 12) {
        ball.x = ball.r + 12;
        ball.vx = Math.abs(ball.vx) * physics.wallRestitution;
      }
      if (ball.x > W - ball.r - 12) {
        ball.x = W - ball.r - 12;
        ball.vx = -Math.abs(ball.vx) * physics.wallRestitution;
      }
      if (ball.y < ball.r + 12) {
        ball.y = ball.r + 12;
        ball.vy = Math.abs(ball.vy) * physics.wallRestitution;
      }
      for (const pin of pins) {
        const dx = ball.x - pin.x;
        const dy = ball.y - pin.y;
        const dist = Math.hypot(dx, dy);
        const min = ball.r + pin.r;
        if (dist < min && dist > .01) {
          const nx = dx / dist;
          const ny = dy / dist;
          ball.x += nx * (min - dist);
          ball.y += ny * (min - dist);
          const dot = ball.vx * nx + ball.vy * ny;
          if (dot < 0) {
            ball.vx -= (1 + physics.nailRestitution) * dot * nx;
            ball.vy -= (1 + physics.nailRestitution) * dot * ny;
          }
          const tangentX = -ny;
          const tangentY = nx;
          const tangent = ball.vx * tangentX + ball.vy * tangentY;
          ball.vx -= tangentX * tangent * .035;
          ball.vy -= tangentY * tangent * .035;
          ball.vx += (rng() - .5) * physics.randomNailScatter;
          ball.vy += (rng() - .5) * physics.randomNailScatter * .55;
        }
      }
      if (ball.x > 455 && ball.y < 760) {
        const routeX = ball.y < 560 ? 142 : 318;
        ball.vx += (routeX - ball.x) * .00018 * dt;
        if (ball.vx > 1.1) ball.vx *= .72;
      }
      for (const pocket of pockets) {
        if (pocket.type === "attacker") continue;
        const dist = Math.hypot(ball.x - pocket.x, ball.y - pocket.y);
        if (dist < pocket.r && ball.live) {
          result = pocket.type;
          ball.live = false;
          break;
        }
      }
      if (ball.y > H + 60) {
        result = "out";
        ball.live = false;
      }
    }
    if (ball.sawHeso) stat.hesoZone++;
    if (result === "start") {
      stat.start++;
      if (startEligible) stat.eligibleStart++;
      else stat.nonEligibleStart++;
    } else if (result === "normal") stat.normal++;
    else if (result === "out") {
      stat.out++;
      if (ball.x < 250) stat.leftOut++;
    } else stat.timeout++;
  }
  return {
    ...stat,
    spinsPer250: stat.start / balls * 250,
    hesoZoneRate: stat.hesoZone / balls,
    leftOutRate: stat.leftOut / Math.max(1, stat.out),
    startRate: stat.start / balls,
    eligibleCapture: stat.eligibleStart / Math.max(1, stat.eligible),
    nonEligibleStartRate: stat.nonEligibleStart / Math.max(1, balls - stat.eligible)
  };
}

const candidates = [];
for (const guideShift of [18, 34]) {
  for (const roadShift of [12, 24]) {
    for (const hesoOpen of [10, 18]) {
      for (const spillOpen of [12]) {
        for (const windBias of [.0064]) {
          for (const splitChance of [.84]) {
            const variant = { guideShift, roadShift, hesoOpen, spillOpen, windBias, splitChance };
            const r = simulate(variant, 120, 3, 2468);
            const score =
              Math.abs(r.spinsPer250 - nailSettingTable[3].spinsPer250) * 3 +
              Math.max(0, r.leftOutRate - .38) * 28 +
              Math.max(0, .55 - r.hesoZoneRate) * 22 +
              Math.max(0, .72 - r.eligibleCapture) * 12;
            candidates.push({ score, variant, r });
          }
        }
      }
    }
  }
}
candidates.sort((a, b) => a.score - b.score);
for (const row of candidates.slice(0, 12)) {
  console.log(JSON.stringify(row));
}
console.log("settings", JSON.stringify([1, 2, 3, 4, 5, 6].map(setting => ({ setting, ...simulate(candidates[0].variant, 12000, setting, 9876 + setting) }))));
