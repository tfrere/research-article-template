// Data generation utilities for synthetic training data

export function generateRunNames(count) {
  const adjectives = [
    'ancient', 'brave', 'calm', 'clever', 'crimson', 'daring', 'eager', 'fearless', 
    'gentle', 'glossy', 'golden', 'hidden', 'icy', 'jolly', 'lively', 'mighty', 
    'noble', 'proud', 'quick', 'silent', 'swift', 'tiny', 'vivid', 'wild'
  ];
  const nouns = [
    'river', 'mountain', 'harbor', 'forest', 'valley', 'ocean', 'meadow', 'desert', 
    'island', 'canyon', 'harbor', 'trail', 'summit', 'delta', 'lagoon', 'ridge', 
    'tundra', 'reef', 'plateau', 'prairie', 'grove', 'bay', 'dune', 'cliff'
  ];
  const used = new Set();
  const names = [];
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  
  while (names.length < count) {
    const name = `${pick(adjectives)}-${pick(nouns)}-${Math.floor(1 + Math.random() * 7)}`;
    if (!used.has(name)) {
      used.add(name);
      names.push(name);
    }
  }
  return names;
}

export function genCurves(n) {
  const quality = Math.random();
  const good = quality > 0.66;
  const poor = quality < 0.33;
  const l0 = 2.0 + Math.random() * 4.5;
  const targetLoss = good 
    ? l0 * (0.12 + Math.random() * 0.12) 
    : (poor ? l0 * (0.35 + Math.random() * 0.25) : l0 * (0.22 + Math.random() * 0.16));
  
  const phases = 1 + Math.floor(Math.random() * 3);
  const marksSet = new Set();
  while (marksSet.size < phases - 1) {
    marksSet.add(Math.floor((0.25 + Math.random() * 0.5) * (n - 1)));
  }
  const marks = [0, ...Array.from(marksSet).sort((a, b) => a - b), n - 1];
  
  let kLoss = 0.02 + Math.random() * 0.08;
  const loss = new Array(n);
  
  for (let seg = 0; seg < marks.length - 1; seg++) {
    const a = marks[seg];
    const b = marks[seg + 1] || a + 1;
    
    for (let i = a; i <= b; i++) {
      const t = (i - a) / Math.max(1, (b - a));
      const segTarget = targetLoss * Math.pow(0.85, seg);
      let v = l0 * Math.exp(-kLoss * (i + 1));
      v = 0.6 * v + 0.4 * (l0 + (segTarget - l0) * (seg + t) / Math.max(1, (marks.length - 1)));
      const noiseAmp = (0.08 * l0) * (1 - 0.8 * (i / (n - 1)));
      v += (Math.random() * 2 - 1) * noiseAmp;
      if (Math.random() < 0.02) v += 0.15 * l0;
      loss[i] = Math.max(0, v);
    }
    kLoss *= 1.6;
  }
  
  const a0 = 0.1 + Math.random() * 0.35;
  const aMax = good 
    ? (0.92 + Math.random() * 0.07) 
    : (poor ? (0.62 + Math.random() * 0.14) : (0.8 + Math.random() * 0.1));
  
  let kAcc = 0.02 + Math.random() * 0.08;
  const acc = new Array(n);
  
  for (let i = 0; i < n; i++) {
    let v = aMax - (aMax - a0) * Math.exp(-kAcc * (i + 1));
    const noiseAmp = 0.04 * (1 - 0.8 * (i / (n - 1)));
    v += (Math.random() * 2 - 1) * noiseAmp;
    acc[i] = Math.max(0, Math.min(1, v));
    if (marksSet.has(i)) kAcc *= 1.4;
  }
  
  const accGap = 0.02 + Math.random() * 0.06;
  const lossGap = 0.05 + Math.random() * 0.15;
  const accVal = new Array(n);
  const lossVal = new Array(n);
  
  let ofStart = Math.floor(((good ? 0.85 : 0.7) + (Math.random() * 0.15 - 0.05)) * (n - 1));
  ofStart = Math.max(Math.floor(0.5 * (n - 1)), Math.min(Math.floor(0.95 * (n - 1)), ofStart));
  
  for (let i = 0; i < n; i++) {
    let av = acc[i] - accGap + (Math.random() * 0.06 - 0.03);
    let lv = loss[i] * (1 + lossGap) + (Math.random() * 0.1 - 0.05) * Math.max(1, l0 * 0.2);
    if (i >= ofStart && !poor) {
      const t = (i - ofStart) / Math.max(1, (n - 1 - ofStart));
      av -= 0.03 * t;
      lv += 0.12 * t * loss[i];
    }
    accVal[i] = Math.max(0, Math.min(1, av));
    lossVal[i] = Math.max(0, lv);
  }
  
  return { accTrain: acc, lossTrain: loss, accVal, lossVal };
}
