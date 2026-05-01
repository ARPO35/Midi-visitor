import { describe, expect, it } from 'vitest';

import { ScrollDirection } from '../types';
import { getViewportTimeAtAxisPosition, getViewportTimeWindow } from './viewportWindow';

const layout = {
  activeX: 120,
  activeY: 80,
  activeW: 760,
  activeH: 540,
  activeCX: 500,
  activeCY: 350,
};

describe('getViewportTimeWindow', () => {
  it('uses active viewport-relative distances in horizontal mode', () => {
    const window = getViewportTimeWindow(
      layout,
      ScrollDirection.Horizontal,
      10,
      100
    );

    expect(window).toEqual({
      startTime: 6.2,
      endTime: 13.8,
    });
  });

  it('uses distances above and below the playhead in vertical mode', () => {
    const window = getViewportTimeWindow(
      layout,
      ScrollDirection.Vertical,
      5,
      90
    );

    expect(window.startTime).toBeCloseTo(2);
    expect(window.endTime).toBeCloseTo(8);
  });
});

describe('getViewportTimeAtAxisPosition', () => {
  it('maps horizontal positions from the playhead without clamping negative time', () => {
    expect(
      getViewportTimeAtAxisPosition(layout, ScrollDirection.Horizontal, -2, 100, layout.activeCX)
    ).toBe(-2);
    expect(
      getViewportTimeAtAxisPosition(layout, ScrollDirection.Horizontal, -2, 100, 700)
    ).toBe(0);
  });

  it('maps vertical positions in the same direction as MIDI notes', () => {
    expect(
      getViewportTimeAtAxisPosition(layout, ScrollDirection.Vertical, -2, 100, 150)
    ).toBe(0);
    expect(
      getViewportTimeAtAxisPosition(layout, ScrollDirection.Vertical, -2, 100, 550)
    ).toBe(-4);
  });

  it('returns the current time when speed is not positive', () => {
    expect(
      getViewportTimeAtAxisPosition(layout, ScrollDirection.Horizontal, 3, 0, 700)
    ).toBe(3);
  });
});
