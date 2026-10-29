// Turns YouCam Skin Analysis + Facial Color Tones results into a personalised
// routine and shade-matched makeup cart. All products are SkinCart house-brand
// demo items (no third-party trademarks).

const CONCERNS = {
  acne: { label: 'Breakouts', tip: 'Salicylic acid keeps pores clear without stripping.' },
  pore: { label: 'Pores', tip: 'Niacinamide visibly tightens and balances oil.' },
  texture: { label: 'Texture', tip: 'A gentle lactic-acid exfoliant smooths rough patches.' },
  wrinkle: { label: 'Fine lines', tip: 'Retinal at night plus daily SPF is the gold standard.' },
  redness: { label: 'Redness', tip: 'Centella and azelaic acid calm visible redness.' },
  oiliness: { label: 'Oil control', tip: 'A lightweight gel moisturiser hydrates without shine.' },
  moisture: { label: 'Hydration', tip: 'Hyaluronic acid and ceramides lock moisture in.' },
  dark_circle_v2: { label: 'Dark circles', tip: 'Caffeine and vitamin C brighten the under-eye.' },
  age_spot: { label: 'Dark spots', tip: 'Vitamin C and tranexamic acid fade spots over time.' },
  radiance: { label: 'Radiance', tip: 'Vitamin C restores glow to dull skin.' },
};

const P = (id, name, step, price, targets, desc) => ({ id, name, step, price, targets, desc });

const SKINCARE = [
  P('cl-gel', 'Clarifying Gel Cleanser', 'Cleanse', 14, ['acne', 'oiliness', 'pore'], 'Low-pH gel with 0.5% salicylic acid.'),
  P('cl-cream', 'Ceramide Cream Cleanser', 'Cleanse', 14, ['moisture', 'redness'], 'Non-foaming, keeps the barrier intact.'),
  P('se-bha', '2% BHA Pore Serum', 'Treat', 22, ['acne', 'pore'], 'Salicylic acid + zinc for clear pores.'),
  P('se-nia', '10% Niacinamide Serum', 'Treat', 18, ['pore', 'oiliness', 'texture'], 'Balances oil, refines pores.'),
  P('se-vitc', '15% Vitamin C Serum', 'Treat', 28, ['age_spot', 'radiance', 'dark_circle_v2'], 'Brightens and evens tone.'),
  P('se-ret', 'Gentle Retinal Night Serum', 'Treat', 32, ['wrinkle', 'texture'], '0.05% retinal, encapsulated for comfort.'),
  P('se-cica', 'Cica Calming Serum', 'Treat', 24, ['redness'], 'Centella + 10% azelaic acid.'),
  P('se-ha', 'Hyaluronic Hydra Serum', 'Treat', 20, ['moisture'], 'Multi-weight hyaluronic acid.'),
  P('ex-lac', 'Lactic Acid Smoothing Toner', 'Treat', 19, ['texture', 'radiance'], '5% lactic acid, 2-3 nights a week.'),
  P('ey-caf', 'Caffeine Bright Eye Cream', 'Eyes', 21, ['dark_circle_v2'], 'Caffeine + peptides de-puff.'),
  P('mo-gel', 'Oil-Free Water Gel', 'Moisturise', 22, ['oiliness', 'acne'], 'Weightless hydration, matte finish.'),
  P('mo-cer', 'Barrier Repair Cream', 'Moisturise', 24, ['moisture', 'redness', 'wrinkle'], 'Ceramides + squalane.'),
  P('spf', 'Invisible Fluid SPF 50', 'Protect', 20, ['age_spot', 'wrinkle', 'redness'], 'No white cast on any skin tone.'),
];

// 16 foundation shades spanning very fair to deep (hex = shade swatch).
const FOUNDATION = [
  ['F1', 'Porcelain', '#F3D9C6'], ['F2', 'Ivory', '#EDCFB8'], ['F3', 'Shell', '#E8C4A8'], ['F4', 'Sand', '#DDB797'],
  ['F5', 'Beige', '#D4A989'], ['F6', 'Honey', '#C99B78'], ['F7', 'Golden', '#C0906C'], ['F8', 'Caramel', '#B3825F'],
  ['F9', 'Tan', '#A87654'], ['F10', 'Amber', '#9A6847'], ['F11', 'Chestnut', '#8C5B3D'], ['F12', 'Cocoa', '#7A4C32'],
  ['F13', 'Mocha', '#6A3F29'], ['F14', 'Espresso', '#5A3422'], ['F15', 'Ebony', '#4A2A1C'], ['F16', 'Onyx', '#3B2117'],
].map(([id, name, hex]) => ({ id: `fd-${id}`, name: `Skin Tint ${id} ${name}`, shade: hex, price: 26, step: 'Base' }));

const LIPS = {
  warm: [['Terracotta', '#B5523B'], ['Brick Red', '#A23A2E'], ['Peach Nude', '#C98A6B'], ['Spiced Coral', '#D0644E']],
  cool: [['Berry', '#8E2C4F'], ['Rose Mauve', '#A85A72'], ['Blue Red', '#B01E35'], ['Pink Nude', '#C9858F']],
  neutral: [['Rosewood', '#9E4F55'], ['Classic Red', '#B3262F'], ['Soft Nude', '#B97C72'], ['Dusty Rose', '#B5636B']],
};

// ---------- colour maths ----------
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
function rgbToLab([r, g, b]) {
  const lin = (c) => { c /= 255; return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92; };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  let x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  let y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  let z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  [x, y, z] = [f(x), f(y), f(z)];
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const deltaE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

function undertone(skinHex) {
  const [, a, b] = rgbToLab(hexToRgb(skinHex));
  const hue = (Math.atan2(b, a) * 180) / Math.PI; // ~45-60 for most skin
  if (hue >= 58) return 'warm';
  if (hue <= 48) return 'cool';
  return 'neutral';
}

function depth(skinHex) {
  const L = rgbToLab(hexToRgb(skinHex))[0];
  if (L >= 75) return 'fair';
  if (L >= 63) return 'light';
  if (L >= 50) return 'medium';
  if (L >= 38) return 'tan';
  return 'deep';
}

function matchFoundation(skinHex) {
  const lab = rgbToLab(hexToRgb(skinHex));
  const ranked = FOUNDATION.map((f) => ({ ...f, dE: deltaE(lab, rgbToLab(hexToRgb(f.shade))) })).sort((a, b) => a.dE - b.dE);
  const best = ranked[0];
  const match = Math.max(0, Math.round(100 - best.dE * 3));
  return { best: { ...best, match }, alternates: ranked.slice(1, 3).map((f) => ({ id: f.id, name: f.name, shade: f.shade })) };
}

// ---------- recommendation ----------
function severity(score) {
  if (score == null) return 'unknown';
  if (score < 80) return 'focus';
  if (score < 90) return 'mild';
  return 'good';
}

function buildReport(skinOutput, tone) {
  const byType = Object.fromEntries(skinOutput.map((o) => [o.type, o]));
  const concerns = Object.keys(CONCERNS)
    .filter((k) => byType[k])
    .map((k) => ({
      key: k,
      label: CONCERNS[k].label,
      score: byType[k].ui_score,
      severity: severity(byType[k].ui_score),
      mask: byType[k].mask_urls?.[0] || null,
      tip: CONCERNS[k].tip,
    }))
    .sort((a, b) => a.score - b.score);

  const overall = byType.all?.score ?? Math.round(concerns.reduce((s, c) => s + c.score, 0) / (concerns.length || 1));
  const skinAge = byType.skin_age?.score ?? null;
  const color = tone?.color || {};
  const skinHex = color.skin_color || '#C99B78';
  const ut = undertone(skinHex);

  // Pick routine: cleanser, up to 2 treatments for weakest concerns, eye cream, moisturiser, SPF.
  const weakest = concerns.filter((c) => c.severity !== 'good').map((c) => c.key);
  const focus = weakest.length ? weakest : concerns.slice(0, 2).map((c) => c.key);
  const oily = (byType.oiliness?.ui_score ?? 100) < (byType.moisture?.ui_score ?? 100);
  const pick = (step, pref) => {
    const opts = SKINCARE.filter((p) => p.step === step);
    for (const k of pref) { const hit = opts.find((p) => p.targets.includes(k)); if (hit) return hit; }
    return opts[0];
  };
  const routine = [];
  const why = (p) => {
    const hit = p.targets.filter((t) => focus.includes(t)).map((t) => CONCERNS[t].label);
    return hit.length ? `Targets your ${hit.join(' & ').toLowerCase()}` : 'Everyday essential';
  };
  routine.push(pick('Cleanse', oily ? ['oiliness', 'acne'] : ['moisture', 'redness']));
  const treats = [];
  for (const k of focus) {
    if (treats.length >= 2) break;
    const t = SKINCARE.find((p) => p.step === 'Treat' && p.targets.includes(k) && !treats.includes(p));
    if (t) treats.push(t);
  }
  routine.push(...treats);
  if (focus.includes('dark_circle_v2')) routine.push(SKINCARE.find((p) => p.id === 'ey-caf'));
  routine.push(pick('Moisturise', oily ? ['oiliness'] : ['moisture']));
  routine.push(SKINCARE.find((p) => p.id === 'spf'));

  const foundation = matchFoundation(skinHex);
  const lips = LIPS[ut].map(([name, hex], i) => ({ id: `lp-${ut}-${i}`, name: `Satin Lip ${name}`, shade: hex, price: 16, step: 'Lips' }));

  const baseImage = byType.resize_image?.mask_urls?.[0] || null;
  return {
    baseImage,
    overall: Math.round(overall),
    skinAge,
    concerns,
    tone: {
      skin: skinHex,
      undertone: ut,
      depth: depth(skinHex),
      eye: color.eye_color_name || null,
      eyeHex: color.eye_color || null,
      hair: color.hair_color_name || null,
      hairHex: color.hair_color || null,
      lip: color.lip_color || null,
    },
    routine: routine.filter(Boolean).map((p) => ({ ...p, why: why(p) })),
    foundation,
    lips,
  };
}

// YouCam makeup-vto effect payloads for a product
function effectsFor(product) {
  if (product.step === 'Lips') {
    return [{ category: 'lip_color', shape: { name: 'original' }, style: { type: 'full' }, palettes: [{ color: product.shade, texture: 'satin', colorIntensity: 70 }] }];
  }
  if (product.step === 'Base') {
    return [{ category: 'foundation', palettes: [{ color: product.shade, colorIntensity: 45, glowIntensity: 30, coverageIntensity: 55 }] }];
  }
  return null;
}

function findProduct(id, report) {
  const all = [...SKINCARE, ...FOUNDATION, ...Object.values(LIPS).flatMap((arr, gi) => arr.map(([name, hex], i) => ({ id: `lp-${Object.keys(LIPS)[gi]}-${i}`, name: `Satin Lip ${name}`, shade: hex, price: 16, step: 'Lips' })))];
  return all.find((p) => p.id === id) || null;
}

module.exports = { buildReport, effectsFor, findProduct, undertone, matchFoundation, depth, CONCERNS };
