import { describe, expect, it } from 'vitest';

import { ScrollDirection } from '../types';
import { getViewportTimeWindow } from './viewportWindow';

describe('getViewportTimeWindow', () => {
  it('uses active viewport-relative distances in horizontal mode', () => {
    const window = getViewportTimeWindow(
      {
        activeX: 120,
        activeY: 80,
        activeW: 760,
        activeH: 540,
        activeCX: 500,
        activeCY: 350,
      },
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
      {
        activeX: 120,
        activeY: 80,
        activeW: 760,
        activeH: 540,
        activeCX: 500,
        activeCY: 350,
      },
      ScrollDirection.Vertical,
      5,
      90
    );

    expect(window.startTime).toBeCloseTo(2);
    expect(window.endTime).toBeCloseTo(8);
  });
});
