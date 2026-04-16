import { ScrollDirection } from '../types';

export interface ViewportTimeWindowLayout {
  activeX: number;
  activeY: number;
  activeW: number;
  activeH: number;
  activeCX: number;
  activeCY: number;
}

export interface ViewportTimeWindow {
  startTime: number;
  endTime: number;
}

export const getViewportTimeWindow = (
  layout: ViewportTimeWindowLayout,
  direction: ScrollDirection,
  currentTime: number,
  speed: number
): ViewportTimeWindow => {
  if (speed <= 0) {
    return {
      startTime: currentTime,
      endTime: currentTime,
    };
  }

  if (direction === ScrollDirection.Horizontal) {
    const leftPixels = Math.max(0, layout.activeCX - layout.activeX);
    const rightPixels = Math.max(0, layout.activeX + layout.activeW - layout.activeCX);

    return {
      startTime: currentTime - leftPixels / speed,
      endTime: currentTime + rightPixels / speed,
    };
  }

  const bottomPixels = Math.max(0, layout.activeY + layout.activeH - layout.activeCY);
  const topPixels = Math.max(0, layout.activeCY - layout.activeY);

  return {
    startTime: currentTime - bottomPixels / speed,
    endTime: currentTime + topPixels / speed,
  };
};
