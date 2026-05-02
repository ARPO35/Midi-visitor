import { describe, expect, it, vi } from 'vitest';
import { buildLinearGradientCss, createCanvasLinearGradient, parseLinearGradientCss } from './gradient';

describe('gradient helpers', () => {
  it('parses multi-stop linear gradient css', () => {
    const parsed = parseLinearGradientCss('linear-gradient(45deg, #111 0%, #222 20%, #333 100%)');
    expect(parsed).not.toBeNull();
    expect(parsed?.angleDeg).toBe(45);
    expect(parsed?.stops).toEqual([
      { color: '#111', position: 0 },
      { color: '#222', position: 20 },
      { color: '#333', position: 100 },
    ]);
  });

  it('fills missing stop positions with even distribution', () => {
    const parsed = parseLinearGradientCss('linear-gradient(180deg, #000, #fff, #f00)');
    expect(parsed?.stops).toEqual([
      { color: '#000', position: 0 },
      { color: '#fff', position: 50 },
      { color: '#f00', position: 100 },
    ]);
  });

  it('builds a stable gradient string with sorted stops', () => {
    const css = buildLinearGradientCss(450, [
      { color: '#ff0000', position: 80 },
      { color: '#00ff00', position: 10 },
      { color: '#0000ff', position: 40 },
    ]);
    expect(css).toBe('linear-gradient(90deg, #00ff00 10%, #0000ff 40%, #ff0000 80%)');
  });

  it('returns null for non-linear gradient strings', () => {
    expect(parseLinearGradientCss('rgba(255,255,255,0.5)')).toBeNull();
  });

  it('creates canvas gradients and maps stop positions to 0..1', () => {
    const addColorStop = vi.fn();
    const canvasGradient = { addColorStop } as unknown as CanvasGradient;
    const createLinearGradient = vi.fn(() => canvasGradient);
    const ctx = { createLinearGradient } as unknown as CanvasRenderingContext2D;

    const parsed = parseLinearGradientCss('linear-gradient(90deg, #111111 0%, #999999 30%, #ffffff 100%)');
    expect(parsed).not.toBeNull();

    const result = createCanvasLinearGradient(
      ctx,
      { x: 10, y: 20, width: 200, height: 100 },
      parsed!
    );

    expect(result).toBe(canvasGradient);
    expect(createLinearGradient).toHaveBeenCalledTimes(1);
    expect(addColorStop).toHaveBeenNthCalledWith(1, 0, '#111111');
    expect(addColorStop).toHaveBeenNthCalledWith(2, 0.3, '#999999');
    expect(addColorStop).toHaveBeenNthCalledWith(3, 1, '#ffffff');
  });
});
