import { describe, expect, it } from 'vitest';

import {
  SPEED_MAX,
  SPEED_MIN,
  speedToSliderValue,
  sliderValueToSpeed,
} from './speedControl';

describe('speed control mapping', () => {
  it('maps the slider endpoints to the configured speed range', () => {
    expect(sliderValueToSpeed(0)).toBe(SPEED_MIN);
    expect(sliderValueToSpeed(1000)).toBe(SPEED_MAX);
  });

  it('round-trips representative speed values with exponential mapping', () => {
    expect(sliderValueToSpeed(speedToSliderValue(100))).toBeCloseTo(100, -1);
    expect(sliderValueToSpeed(speedToSliderValue(6000))).toBeCloseTo(6000, -2);
    expect(sliderValueToSpeed(speedToSliderValue(100000))).toBeCloseTo(100000, -2);
  });
});
