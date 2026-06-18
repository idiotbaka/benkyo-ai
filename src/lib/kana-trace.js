import { normalizeKanaScript } from './kana-practice';

export const TRACE_PASS_SCORE = 0.72;

let traceDataPromise = null;

export function loadKanaTraceData() {
  if (!traceDataPromise) {
    traceDataPromise = import('../assets/kana-trace/kana-trace-data.json').then(module => module.default);
  }
  return traceDataPromise;
}

export function getKanaTraceEntry(traceData, script, displayKana) {
  const normalizedScript = normalizeKanaScript(script);
  const entries = traceData?.entries?.[normalizedScript] ?? [];
  return entries.find(entry => entry.kana === displayKana) ?? null;
}

export function getKanaTraceGlyphs(traceData, script, displayKana) {
  const entry = getKanaTraceEntry(traceData, script, displayKana);
  const components = entry?.components?.length ? entry.components : [...String(displayKana ?? '')];

  return components
    .map((char) => {
      const data = traceData?.characters?.[char];
      if (!data?.strokes?.length) return null;
      return {
        char,
        viewBox: data.viewBox,
        strokes: data.strokes,
      };
    })
    .filter(Boolean);
}

export function pointsToSvgPath(points) {
  if (!Array.isArray(points) || points.length === 0) return '';
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${roundPoint(point.x)},${roundPoint(point.y)}`)
    .join(' ');
}

export function sampleSvgPath(pathElement, count = 56) {
  if (!pathElement) return [];

  try {
    const length = pathElement.getTotalLength();
    if (!Number.isFinite(length) || length <= 0) return [];

    const samples = Math.max(2, Math.round(count));
    return Array.from({ length: samples }, (_, index) => {
      const distance = samples === 1 ? 0 : (length * index) / (samples - 1);
      const point = pathElement.getPointAtLength(distance);
      return { x: point.x, y: point.y };
    });
  } catch {
    return [];
  }
}

export function scoreTraceStroke(userPoints, targetPoints) {
  const user = cleanPoints(userPoints);
  const target = cleanPoints(targetPoints);
  const targetLength = getPathLength(target);
  const userLength = getPathLength(user);
  const minimumUserLength = Math.min(10, Math.max(3, targetLength * 0.22));

  if (user.length < 2 || target.length < 2 || userLength < minimumUserLength) {
    return createScoreResult(0, false, {
      reason: 'too-short',
      userLength,
      targetLength,
    });
  }

  const sampleCount = targetLength < 26 ? 28 : 56;
  const sampledUser = resamplePoints(user, sampleCount);
  const sampledTarget = resamplePoints(target, sampleCount);
  const tolerance = clampNumber(targetLength * 0.18, 7, 19);
  const endpointTolerance = clampNumber(targetLength * 0.32, 12, 26);

  const pairDistance = averageDistance(sampledUser, sampledTarget);
  const shapeScore = scoreDistance(pairDistance, tolerance);
  const coverageScore = scoreDistance(averageNearestDistance(sampledTarget, user), tolerance * 1.08);
  const driftScore = scoreDistance(averageNearestDistance(sampledUser, target), tolerance * 1.18);
  const startScore = scoreDistance(distance(user[0], target[0]), endpointTolerance);
  const endScore = scoreDistance(distance(user[user.length - 1], target[target.length - 1]), endpointTolerance);
  const lengthRatio = Math.min(userLength, targetLength) / Math.max(userLength, targetLength);
  const lengthScore = clampNumber((lengthRatio - 0.34) / 0.58, 0, 1);
  const directionScore = getDirectionScore(user, target);

  const score = (
    shapeScore * 0.24
    + coverageScore * 0.25
    + driftScore * 0.16
    + startScore * 0.12
    + endScore * 0.10
    + lengthScore * 0.08
    + directionScore * 0.05
  );
  const forgivingPass = (
    coverageScore >= 0.72
    && driftScore >= 0.66
    && lengthScore >= 0.42
    && (startScore + endScore) / 2 >= 0.36
    && score >= 0.66
  );

  return createScoreResult(score, score >= TRACE_PASS_SCORE || forgivingPass, {
    shapeScore,
    coverageScore,
    driftScore,
    startScore,
    endScore,
    lengthScore,
    directionScore,
    userLength,
    targetLength,
    tolerance,
  });
}

function createScoreResult(score, passed, details) {
  const normalizedScore = clampNumber(score, 0, 1);
  return {
    score: normalizedScore,
    percent: Math.round(normalizedScore * 100),
    passed,
    details,
  };
}

function cleanPoints(points) {
  if (!Array.isArray(points)) return [];

  const result = [];
  points.forEach((point) => {
    const x = Number(point?.x);
    const y = Number(point?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const previous = result[result.length - 1];
    if (previous && distance(previous, { x, y }) < 0.55) return;
    result.push({ x, y });
  });

  return result;
}

function getPathLength(points) {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    length += distance(points[index - 1], points[index]);
  }
  return length;
}

function resamplePoints(points, count) {
  if (points.length === 0) return [];
  if (points.length === 1) return Array.from({ length: count }, () => points[0]);

  const totalLength = getPathLength(points);
  if (totalLength <= 0) return Array.from({ length: count }, () => points[0]);

  const result = [points[0]];
  let segmentStart = points[0];
  let segmentIndex = 1;
  let distanceIntoSegment = 0;

  for (let sampleIndex = 1; sampleIndex < count - 1; sampleIndex += 1) {
    const targetDistance = (totalLength * sampleIndex) / (count - 1);

    while (segmentIndex < points.length) {
      const segmentEnd = points[segmentIndex];
      const segmentLength = distance(segmentStart, segmentEnd);

      if (distanceIntoSegment + segmentLength >= targetDistance && segmentLength > 0) {
        const ratio = (targetDistance - distanceIntoSegment) / segmentLength;
        result.push({
          x: segmentStart.x + (segmentEnd.x - segmentStart.x) * ratio,
          y: segmentStart.y + (segmentEnd.y - segmentStart.y) * ratio,
        });
        break;
      }

      distanceIntoSegment += segmentLength;
      segmentStart = segmentEnd;
      segmentIndex += 1;
    }
  }

  result.push(points[points.length - 1]);
  return result;
}

function averageNearestDistance(source, target) {
  if (source.length === 0 || target.length === 0) return Number.POSITIVE_INFINITY;

  const total = source.reduce((sum, point) => {
    let nearest = Number.POSITIVE_INFINITY;
    target.forEach((candidate) => {
      nearest = Math.min(nearest, distance(point, candidate));
    });
    return sum + nearest;
  }, 0);

  return total / source.length;
}

function averageDistance(a, b) {
  const count = Math.min(a.length, b.length);
  if (count === 0) return Number.POSITIVE_INFINITY;

  let total = 0;
  for (let index = 0; index < count; index += 1) {
    total += distance(a[index], b[index]);
  }
  return total / count;
}

function scoreDistance(value, tolerance) {
  if (!Number.isFinite(value)) return 0;
  const normalized = value / Math.max(1, tolerance);
  return clampNumber(1 - normalized / 1.22, 0, 1);
}

function getDirectionScore(user, target) {
  const userVector = vectorBetween(user[0], user[user.length - 1]);
  const targetVector = vectorBetween(target[0], target[target.length - 1]);
  const userLength = Math.hypot(userVector.x, userVector.y);
  const targetLength = Math.hypot(targetVector.x, targetVector.y);
  if (userLength < 3 || targetLength < 3) return 0.75;

  const dot = userVector.x * targetVector.x + userVector.y * targetVector.y;
  const cosine = dot / (userLength * targetLength);
  return clampNumber((cosine + 1) / 2, 0, 1);
}

function vectorBetween(a, b) {
  return {
    x: b.x - a.x,
    y: b.y - a.y,
  };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function roundPoint(value) {
  return Math.round(value * 100) / 100;
}
