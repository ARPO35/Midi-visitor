export interface GradientStop {
  color: string;
  position: number;
}

export interface ParsedLinearGradient {
  angleDeg: number;
  stops: GradientStop[];
}

export interface GradientRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const DEFAULT_STOPS: GradientStop[] = [
  { color: '#000000', position: 0 },
  { color: '#ffffff', position: 100 },
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const normalizeAngle = (angle: number) => {
  if (!Number.isFinite(angle)) return 180;
  const wrapped = angle % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
};

const splitGradientArgs = (content: string) => {
  const tokens: string[] = [];
  let depth = 0;
  let tokenStart = 0;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth = Math.max(0, depth - 1);
    } else if (char === ',' && depth === 0) {
      tokens.push(content.slice(tokenStart, index).trim());
      tokenStart = index + 1;
    }
  }

  tokens.push(content.slice(tokenStart).trim());
  return tokens.filter(Boolean);
};

const parseStop = (token: string, fallbackPosition: number): GradientStop | null => {
  const trimmed = token.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(.*?)(?:\s+(-?\d+(?:\.\d+)?)%)?$/);
  if (!match) return null;

  const color = match[1]?.trim();
  if (!color) return null;

  const maybePosition = match[2] !== undefined ? Number.parseFloat(match[2]) : fallbackPosition;
  return {
    color,
    position: clamp(Number.isFinite(maybePosition) ? maybePosition : fallbackPosition, 0, 100),
  };
};

const normalizeStops = (stops: GradientStop[]) =>
  [...stops]
    .map((stop) => ({ color: stop.color, position: clamp(stop.position, 0, 100) }))
    .sort((a, b) => a.position - b.position);

export const buildLinearGradientCss = (angleDeg: number, stops: GradientStop[]) => {
  const normalizedStops = normalizeStops(stops.length >= 2 ? stops : DEFAULT_STOPS);
  const stopTokens = normalizedStops.map((stop) => `${stop.color} ${stop.position.toFixed(2).replace(/\.?0+$/, '')}%`);
  return `linear-gradient(${normalizeAngle(angleDeg)}deg, ${stopTokens.join(', ')})`;
};

export const parseLinearGradientCss = (value: string): ParsedLinearGradient | null => {
  const raw = value.trim();
  if (!raw.toLowerCase().startsWith('linear-gradient(') || !raw.endsWith(')')) {
    return null;
  }

  const content = raw.slice(raw.indexOf('(') + 1, -1).trim();
  const tokens = splitGradientArgs(content);
  if (tokens.length < 2) {
    return null;
  }

  let angleDeg = 180;
  let stopTokens = tokens;
  const angleMatch = tokens[0].match(/^(-?\d+(?:\.\d+)?)deg$/i);
  if (angleMatch) {
    angleDeg = Number.parseFloat(angleMatch[1]);
    stopTokens = tokens.slice(1);
  }

  if (stopTokens.length < 2) {
    return null;
  }

  const lastIndex = stopTokens.length - 1;
  const parsed = stopTokens
    .map((token, index) => {
      const fallback = lastIndex === 0 ? 0 : (index / lastIndex) * 100;
      return parseStop(token, fallback);
    })
    .filter((stop): stop is GradientStop => stop !== null);

  if (parsed.length < 2) {
    return null;
  }

  return {
    angleDeg: normalizeAngle(angleDeg),
    stops: normalizeStops(parsed),
  };
};

export const createCanvasLinearGradient = (
  ctx: CanvasRenderingContext2D,
  rect: GradientRect,
  gradient: ParsedLinearGradient
) => {
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  const rad = (gradient.angleDeg * Math.PI) / 180;
  const dirX = Math.sin(rad);
  const dirY = -Math.cos(rad);
  const halfLength = Math.max(1, Math.hypot(rect.width, rect.height) / 2);

  const startX = centerX - dirX * halfLength;
  const startY = centerY - dirY * halfLength;
  const endX = centerX + dirX * halfLength;
  const endY = centerY + dirY * halfLength;

  const canvasGradient = ctx.createLinearGradient(startX, startY, endX, endY);
  for (const stop of gradient.stops) {
    canvasGradient.addColorStop(clamp(stop.position / 100, 0, 1), stop.color);
  }
  return canvasGradient;
};
