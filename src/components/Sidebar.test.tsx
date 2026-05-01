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
    canExportProject: false,
    handleProjectExport: vi.fn(),
    handleProjectImport: vi.fn(),
    handleColorImageSelected: vi.fn(() => "url('blob:mock') center / cover no-repeat"),
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

const expandSection = async (user: ReturnType<typeof userEvent.setup>, name: RegExp) => {
  await user.click(screen.getByRole('button', { name }));
};

describe('Sidebar', () => {
  it('keeps import and playback visible while configuration categories start collapsed', () => {
    const { renderProps } = makeProps({
      hasExternalAudio: true,
      audioFileName: 'audio.wav',
    });
    render(<Sidebar {...renderProps} />);

    expect(screen.getByText('导入 / 清除')).toBeInTheDocument();
    expect(screen.getByText('播放控制')).toBeInTheDocument();
    expect(screen.getByLabelText('导入 MIDI 文件')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /导出配置包/ })).toBeDisabled();
    expect(screen.getByLabelText('导入配置包文件')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '播放' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /播放参数/i })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: /同步与音乐/i })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: /轨道过滤/i })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: /音符与滚动/i })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: /画布与取景/i })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: /窗口外观/i })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: /波形叠加/i })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText('BPM')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('速度')).not.toBeInTheDocument();
  });

  it('keeps project package import and export controls visible', async () => {
    const user = userEvent.setup();
    const handleProjectExport = vi.fn();
    const handleProjectImport = vi.fn();
    const { renderProps } = makeProps({
      canExportProject: true,
      handleProjectExport,
      handleProjectImport,
    });
    render(<Sidebar {...renderProps} />);

    await user.click(screen.getByRole('button', { name: /导出配置包/ }));
    expect(handleProjectExport).toHaveBeenCalledTimes(1);

    const packageFile = new File(['zip'], 'project.zip', { type: 'application/zip' });
    await user.upload(screen.getByLabelText('导入配置包文件'), packageFile);
    expect(handleProjectImport).toHaveBeenCalledTimes(1);
  });

  it('commits only valid BPM values and clamps the minimum', async () => {
    const user = userEvent.setup();
    const { renderProps, setConfigMock } = makeProps();
    const { rerender } = render(<Sidebar {...renderProps} />);
    await expandSection(user, /同步与音乐/i);
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
    await expandSection(user, /音符与滚动/i);
    await expandSection(user, /轨道过滤/i);

    const stretch = screen.getByLabelText('音高间距');
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
    await expandSection(user, /波形叠加/i);

    expect(screen.getAllByText('构建中 2/4').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: '播放' }));
    expect(renderProps.togglePlay).toHaveBeenCalledTimes(1);
  });

  it('switches waveform mode tabs and updates shared waveform settings', async () => {
    const user = userEvent.setup();
    const { renderProps, setConfigMock } = makeProps({
      hasExternalAudio: true,
      audioFileName: 'audio.wav',
    });
    render(<Sidebar {...renderProps} />);
    await expandSection(user, /波形叠加/i);

    expect(screen.getByText('波形填充')).toBeInTheDocument();
    expect(screen.queryByText(/直接绘制混合波形线/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('波形线宽'), { target: { value: '2.5' } });
    expect(setConfigMock).toHaveBeenCalledTimes(1);
    let next = resolveUpdater(setConfigMock.mock.calls[0][0], renderProps.config);
    expect(next.waveformLineWidth).toBe(2.5);

    await user.click(screen.getByRole('button', { name: 'PCM' }));
    expect(setConfigMock).toHaveBeenCalledTimes(2);
    next = resolveUpdater(setConfigMock.mock.calls[1][0], renderProps.config);
    expect(next.waveformMode).toBe('pcm');
  });

  it('supports auto and manual peak sample rate input', async () => {
    const user = userEvent.setup();
    const { renderProps, setConfigMock } = makeProps({
      hasExternalAudio: true,
      audioFileName: 'audio.wav',
    });
    const { rerender } = render(<Sidebar {...renderProps} />);
    await expandSection(user, /波形叠加/i);

    await user.click(screen.getByRole('button', { name: '手动' }));
    expect(setConfigMock).toHaveBeenCalledTimes(1);
    let next = resolveUpdater(setConfigMock.mock.calls[0][0], renderProps.config);
    expect(next.waveformPeakSampleRate).toBe(960);

    rerender(<Sidebar {...renderProps} config={next} />);
    const sampleRateInput = screen.getByLabelText('波形峰值采样率');

    await user.clear(sampleRateInput);
    await user.type(sampleRateInput, '2048');
    fireEvent.blur(sampleRateInput);

    expect(setConfigMock).toHaveBeenCalledTimes(2);
    next = resolveUpdater(setConfigMock.mock.calls[1][0], next);
    expect(next.waveformPeakSampleRate).toBe(2048);

    await user.click(screen.getByRole('button', { name: '自动' }));
    expect(setConfigMock.mock.calls.length).toBeGreaterThanOrEqual(3);
    next = resolveUpdater(setConfigMock.mock.calls.at(-1)?.[0], next);
    expect(next.waveformPeakSampleRate).toBeNull();
  });

  it('maps the speed slider exponentially into the high-speed range', () => {
    const { renderProps, setConfigMock } = makeProps();
    render(<Sidebar {...renderProps} />);
    fireEvent.click(screen.getByRole('button', { name: /音符与滚动/i }));

    const speedSlider = screen.getByLabelText('速度');
    fireEvent.change(speedSlider, { target: { value: '1000' } });

    expect(setConfigMock).toHaveBeenCalledTimes(1);
    const updated = resolveUpdater(setConfigMock.mock.calls[0][0], renderProps.config);
    expect(updated.speed).toBe(100000);
  });
});
