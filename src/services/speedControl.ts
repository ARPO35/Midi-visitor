export const SPEED_MIN = 10;
export const SPEED_MAX = 100000;
export const SPEED_SLIDER_MAX = 1000;

const SPEED_RANGE_RATIO = SPEED_MAX / SPEED_MIN;

export const speedToSliderValue = (speed: number) => {
  const safeSpeed = Math.min(Math.max(speed, SPEED_MIN), SPEED_MAX);
  const normalized = Math.log(safeSpeed / SPEED_MIN) / Math.log(SPEED_RANGE_RATIO);
  return Math.round(normalized * SPEED_SLIDER_MAX);
};

export const sliderValueToSpeed = (sliderValue: number) => {
  const safeSliderValue = Math.min(Math.max(sliderValue, 0), SPEED_SLIDER_MAX);
  const normalized = safeSliderValue / SPEED_SLIDER_MAX;
  return Math.round(SPEED_MIN * Math.pow(SPEED_RANGE_RATIO, normalized));
};
