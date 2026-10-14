const jscad = require('@jscad/modeling');

const { polygon } = jscad.primitives;
const { cuboid: _cuboid, cylinder } = jscad.primitives;
const { translate, rotate } = jscad.transforms;
const { subtract } = jscad.booleans;
const { extrudeLinear } = jscad.extrusions;
const { colorize, colorNameToRgb } = jscad.colors;
const { geom2 } = jscad.geometries;

// Unit helper
const mm = (inches) => inches * 25.4;

// 1. Wrapper Builder
const cuboid = (options = {}) => {
  if (Array.isArray(options)) return _cuboid({ size: options });
  if (typeof options === 'number') return _cuboid({ size: [options, options, options] });
  return _cuboid(options);
};

const build = (geometry, options = {}) => {
  let shape = geometry;
  if (options.height && geom2.isA(shape)) {
    shape = extrudeLinear({ height: options.height }, shape);
  }
  if (options.rot) shape = rotate(options.rot, shape);
  if (options.pos) shape = translate(options.pos, shape);
  if (options.color) {
    let finalColor = options.color;
    if (typeof options.color === 'string') {
      const rgb = colorNameToRgb(options.color);
      const alpha = options.alpha !== undefined ? options.alpha : 1.0;
      finalColor = [...rgb, alpha];
    }
    shape = colorize(finalColor, shape);
  }
  return shape;
};

// 2. 2D Sketch Parser
function plot2d(txt, externalVars = {}) {
  let unitScale = 1.0;
  let currentX = 0;
  let currentY = 0;
  const vars = { ...externalVars };

  const resolveValue = (token) => {
    if (!token) return 0;
    const cleaned = token.replace(/^['`"]|['`"]$/g, '');
    if (Object.prototype.hasOwnProperty.call(vars, cleaned)) {
      return parseFloat(vars[cleaned]);
    }
    const num = parseFloat(token);
    return isNaN(num) ? 0 : num;
  };

  const rawPoints = [];
  let started = false;
  const lines = txt.replace(/\u00A0/g, ' ').split(/\r?\n/);

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) continue;

    const assignMatch = trimmed.match(/^['`"]?([a-zA-Z0-9_]+)['`"]?\s*=\s*(.+)$/);
    if (assignMatch) {
      vars[assignMatch[1]] = resolveValue(assignMatch[2].trim());
      continue;
    }

    const tokens = trimmed.split(/\s+/).filter(t => t.length > 0);
    let i = 0;
    let lineMoved = false;
    let pendingFillet = null;

    while (i < tokens.length) {
      const cmd = tokens[i].toLowerCase();
      if (cmd === 'inches') { unitScale = 25.4; i++; }
      else if (cmd === 'mm') { unitScale = 1.0; i++; }
      else if (cmd === 'xy') {
        currentX = resolveValue(tokens[i + 1]);
        currentY = resolveValue(tokens[i + 2]);
        i += 3;
        if (!started) { rawPoints.push({ x: currentX, y: currentY, fillet: 0 }); started = true; }
        else { lineMoved = true; }
      }
      else if (cmd === 'u') { currentY += resolveValue(tokens[i + 1]) * unitScale; lineMoved = true; i += 2; }
      else if (cmd === 'd') { currentY -= resolveValue(tokens[i + 1]) * unitScale; lineMoved = true; i += 2; }
      else if (cmd === 'r') { currentX += resolveValue(tokens[i + 1]) * unitScale; lineMoved = true; i += 2; }
      else if (cmd === 'l') { currentX -= resolveValue(tokens[i + 1]) * unitScale; lineMoved = true; i += 2; }
      else if (cmd === 'c' || cmd === 'close') {
        if (rawPoints.length > 0) { currentX = rawPoints[0].x; currentY = rawPoints[0].y; lineMoved = true; }
        i++;
      }
      else if (cmd === 'f') { pendingFillet = resolveValue(tokens[i + 1]) * unitScale; i += 2; }
      else { i++; }
    }

    if (!started && lineMoved) { rawPoints.push({ x: 0, y: 0, fillet: 0 }); started = true; }
    if (lineMoved) {
      rawPoints.push({ x: currentX, y: currentY, fillet: pendingFillet !== null ? pendingFillet : 0 });
    }
  }

  const points = [];
  for (const pt of rawPoints) {
    if (points.length === 0) points.push(pt);
    else {
      const last = points[points.length - 1];
      if (Math.hypot(pt.x - last.x, pt.y - last.y) > 1e-4) points.push(pt);
    }
  }

  if (points.length > 1) {
    const first = points[0];
    const last = points[points.length - 1];
    if (Math.hypot(first.x - last.x, first.y - last.y) < 1e-4) points.pop();
  }

  const finalPoints = [];
  const n = points.length;
  const segments = 12;

  for (let idx = 0; idx < n; idx++) {
    const prev = points[(idx - 1 + n) % n];
    const curr = points[idx];
    const next = points[(idx + 1) % n];
    const r = curr.fillet || 0;

    if (r <= 0) { finalPoints.push([curr.x, curr.y]); continue; }

    const v1 = { x: prev.x - curr.x, y: prev.y - curr.y };
    const v2 = { x: next.x - curr.x, y: next.y - curr.y };
    const l1 = Math.hypot(v1.x, v1.y);
    const l2 = Math.hypot(v2.x, v2.y);
    const u1 = { x: v1.x / l1, y: v1.y / l1 };
    const u2 = { x: v2.x / l2, y: v2.y / l2 };
    const dot = Math.max(-1, Math.min(1, u1.x * u2.x + u1.y * u2.y));
    const angle = Math.acos(dot);

    if (angle < 0.05 || Math.abs(angle - Math.PI) < 0.05) { finalPoints.push([curr.x, curr.y]); continue; }

    const d = r / Math.tan(angle / 2);
    if (d > l1 / 2 || d > l2 / 2) { finalPoints.push([curr.x, curr.y]); continue; }

    const t1 = { x: curr.x + u1.x * d, y: curr.y + u1.y * d };
    const t2 = { x: curr.x + u2.x * d, y: curr.y + u2.y * d };
    const bisector = { x: u1.x + u2.x, y: u1.y + u2.y };
    const bLen = Math.hypot(bisector.x, bisector.y);
    const uB = { x: bisector.x / bLen, y: bisector.y / bLen };
    const cDist = r / Math.sin(angle / 2);
    const center = { x: curr.x + uB.x * cDist, y: curr.y + uB.y * cDist };

    const a1 = Math.atan2(t1.y - center.y, t1.x - center.x);
    let a2 = Math.atan2(t2.y - center.y, t2.x - center.x);
    let diff = a2 - a1;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;

    for (let s = 0; s <= segments; s++) {
      const th = a1 + (diff * s) / segments;
      finalPoints.push([center.x + r * Math.cos(th), center.y + r * Math.sin(th)]);
    }
  }

  return polygon({ points: finalPoints });
}

// 3. User Parameters
const getParameterDefinitions = () => {
  return [
    {
      name: 'notesGroup',
      type: 'group',
      caption: 'NOTICE: Add at least 0.012" clearance to ruler dims'
    },
    {
      name: 'input_rulerHeight_inches',
      type: 'float',
      initial: 0.261,
      caption: 'Ruler H (in):'
    },
    {
      name: 'input_rulerWidth_inches',
      type: 'float',
      initial: 1.431,
      caption: 'Ruler W (in):'
    },
    {
      name: 'blade_offset_inches',
      type: 'float',
      initial: 4.75,
      caption: 'Blade Offset (in):'
    }
  ];
};

// 4. Main Model Assembly
const main = (params = {}) => {
  const input_rulerHeight_inches = params.input_rulerHeight_inches !== undefined ? params.input_rulerHeight_inches : 0.261;
  const input_rulerWidth_inches = params.input_rulerWidth_inches !== undefined ? params.input_rulerWidth_inches : 1.431;
  const blade_offset_inches = params.blade_offset_inches !== undefined ? params.blade_offset_inches : 4.75;

  const rulerHgt = mm(input_rulerHeight_inches);
  const rulerWdth = mm(input_rulerWidth_inches);
  const nutthickness = 5.6;
  const nutwidth = 11.5;
  const bracketHgt = rulerWdth + 6;
  const bladeoffset = blade_offset_inches;

  const nutslot = build(cuboid([50.9, nutthickness, nutwidth]), {
    pos: [-45, -6, 0],
    color: 'yellow',
    alpha: 1.0
  });

  const rulerslot = build(cuboid([65, rulerHgt, rulerWdth]), {
    pos: [-50, -21, 0],
    color: 'green',
    alpha: 0.5
  });

  const txt = `inches
    xy -50 0
    l 1 f .1
    d 1.3 f .1
    r 1 
    u .6
    r 'bladeoffset'
    u 0.05
    u .25 l .25 f .1
    l 4 f .1
    c
  `;
  const poly2d = plot2d(txt, { bladeoffset });

  const shp = build(poly2d, {
    height: bracketHgt,
    pos: [0, 0, bracketHgt / -2],
    color: 'blue',
    alpha: 0.8
  });

  const quarinchholeradius = 25.4 / 8 + 1;
  const ninty = Math.PI / 2;

  const hole1 = build(
    cylinder({ height: 30, radius: quarinchholeradius, segments: 32 }),
    { pos: [-60, -5, 0], rot: [ninty, 0, 0], color: 'orange', alpha: 1.0 }
  );

  const hole2 = build(
    cylinder({ height: 30, radius: quarinchholeradius, segments: 32 }),
    { pos: [67.7, -10, -12], rot: [ninty, 0, 0], color: 'orange', alpha: 1.0 }
  );

  const hole3 = build(
    cylinder({ height: 30, radius: quarinchholeradius, segments: 32 }),
    { pos: [67.7, -10, 12], rot: [ninty, 0, 0], color: 'orange', alpha: 1.0 }
  );

  const txt2 = `
    inches
    r .4
    u 1 l .4
    d 1 l .4
    c`;
  const awlslot = build(plot2d(txt2), {
    height: 5,
    pos: [-63, -19, 10],
    color: 'black',
    alpha: 1
  });

  return [subtract(shp, awlslot, nutslot, rulerslot, hole1, hole2, hole3)];
};

module.exports = { main, getParameterDefinitions };