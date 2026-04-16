import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type React from 'react';

import Sidebar from './Sidebar';
import { DEFAULT_CONFIG } from '../constants';
import type { VisualConfig, WaveformBuildProgress } from '../types';

const makeConfig = (): VisualConfig => ({
  ...DEFAULT_CONFIG,
  bpm: 120,
  stretch: 20,
  offset: 10,
  hiddenTracks: [],
});

const makeWaveformProgress = (status: WaveformBuildProgress['status']): WaveformBuildProgress => ({
  generationId: 1,
  peaksPerSecond: [480],
  completedChunks: 2,
  totalChunks: 4,
  status,
});

const makeProps = (overrides: Partial<React.ComponentProps<typeof Sidebar>> = {}) => {
  const setConfigMock = vi.fn();

  const renderProps = {
    isOpen: true,
    setIsOpen: vi.fn(),
    config: makeConfig(),
    setConfig: setConfigMock as unknown as React.Dispatch<React.SetStateAction<VisualConfig>>,
    handleFileUpload: vi.fn(),
    handleAudioUpload: vi.fn(),
    clearAudio: vi.fn(),
    fileName: null,
    audioFileName: null,
    hasExternalAudio: false,
    isPlaying: false,
    togglePlay: vi.fn(),
    stopPlayback: vi.fn(),
    currentTime: 0,
    duration: 120,
    onSeek: vi.fn(),
    tracks: [
      {
        id: 1,
        name: 'Piano',
        instrument: 'Grand Piano',
        noteCount: 42,
        channel: 0,
      },
    ],
    originalBpm: null,
    effectiveBpm: 120,
    waveformBuildProgress: makeWaveformProgress('idle'),
    ...overrides,
  } satisfies React.ComponentProps<typeof Sidebar>;

  return { renderProps, setConfigMock };
};

function resolveUpdater(call: unknown, current: VisualConfig) {
  if (typeof call === 'function') {
    return (call as (prev: VisualConfig) => VisualConfig)(current);
  }

  return call as VisualConfig;
}

describe('Sidebar', () => {
  it('commits only valid BPM values and clamps the minimum', async () => {
    const user = userEvent.setup();
    const { renderProps, setConfigMock } = makeProps();
    const { rerender } = render(<Sidebar {...renderProps} />);
    const bpmInput = screen.getByLabelText('BPM');

    await user.clear(bpmInput);
    await user.type(bpmInput, '128');
    fireEvent.blur(bpmInput);

    expect(setConfigMock).toHaveBeenCalledTimes(1);
    let next = resolveUpdater(setConfigMock.mock.calls[0][0], renderProps.config);
    expect(next.bpm).toBe(128);

    rerender(<Sidebar {...renderProps} config={next} />);
    expect(screen.getByLabelText('BPM')).toHaveValue('128');

    await user.clear(bpmInput);
    await user.type(bpmInput, 'abc');
    fireEvent.blur(bpmInput);

    expect(setConfigMock).toHaveBeenCalledTimes(1);
    expect(bpmInput).toHaveValue('128');

    await user.clear(bpmInput);
    await user.type(bpmInput, '0');
    fireEvent.blur(bpmInput);

    expect(setConfigMock).toHaveBeenCalledTimes(2);
    next = resolveUpdater(setConfigMock.mock.calls[1][0], renderProps.config);
    expect(next.bpm).toBe(1);
    expect(bpmInput).toHaveValue('1');

    rerender(<Sidebar {...renderProps} config={next} />);
    expect(screen.getByLabelText('BPM')).toHaveValue('1');
  });

  it('preserves offset when stretch changes and toggles track visibility', async () => {
    const user = userEvent.setup();
    const { renderProps, setConfigMock } = makeProps();
    render(<Sidebar {...renderProps} />);

    const stretch = screen.getByLabelText('Stretch (Pitch)');
    fireEvent.change(stretch, { target: { value: '40' } });

    expect(setConfigMock).toHaveBeenCalledTimes(1);
    const stretched = resolveUpdater(setConfigMock.mock.calls[0][0], renderProps.config);
    expect(stretched.stretch).toBe(40);
    expect(stretched.offset).toBe(20);

    await user.click(screen.getByText('Piano'));
    expect(setConfigMock).toHaveBeenCalledTimes(2);
    const hidden = resolveUpdater(setConfigMock.mock.calls[1][0], renderProps.config);
    expect(hidden.hiddenTracks).toEqual([1]);
  });

  it('shows waveform progress and calls playback controls', async () => {
    const user = userEvent.setup();
    const { renderProps } = makeProps({
      hasExternalAudio: true,
      audioFileName: 'audio.wav',
      waveformBuildProgress: makeWaveformProgress('building'),
    });
    render(<Sidebar {...renderProps} />);

    expect(screen.getByText('Building 2/4')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Play' }));
    expect(renderProps.togglePlay).toHaveBeenCalledTimes(1);
  });

  it('maps the speed slider exponentially into the high-speed range', () => {
    const { renderProps, setConfigMock } = makeProps();
    render(<Sidebar {...renderProps} />);

    const speedSlider = screen.getByLabelText('Speed');
    fireEvent.change(speedSlider, { target: { value: '1000' } });

    expect(setConfigMock).toHaveBeenCalledTimes(1);
    const updated = resolveUpdater(setConfigMock.mock.calls[0][0], renderProps.config);
    expect(updated.speed).toBe(100000);
  });
});
