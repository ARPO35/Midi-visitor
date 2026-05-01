import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { DEFAULT_CONFIG } from '../src/constants';
import { exportProjectPackage } from '../src/services/projectPackage';
import type { AudioLoadResult } from '../src/types';
import type { VisualConfig } from '../src/types';

type MidiFixture = {
  header: { tempos: Array<{ bpm: number }> };
  duration: number;
  tracks: Array<{
    name: string;
    instrument: { name: string };
    channel: number;
    notes: Array<{
      midi: number;
      time: number;
      duration: number;
      velocity: number;
      name: string;
    }>;
  }>;
};

type SidebarMockProps = {
  isPlaying: boolean;
  fileName: string | null;
  audioFileName: string | null;
  currentTime: number;
  waveformBuildProgress: { status: string };
  config: VisualConfig;
  setConfig: React.Dispatch<React.SetStateAction<VisualConfig>>;
  togglePlay: () => void;
  stopPlayback: () => void;
  handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleAudioUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  canExportProject: boolean;
  handleProjectExport: () => void;
  handleProjectImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleColorImageSelected: (field: keyof VisualConfig, file: File) => string;
};

type WaveformBuilderInstance = {
  startBuild: ReturnType<typeof vi.fn>;
  cancelBuild: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
};

const midiFixture: MidiFixture = {
  header: { tempos: [{ bpm: 128 }] },
  duration: 12,
  tracks: [
    {
      name: 'Lead',
      instrument: { name: 'Piano' },
      channel: 0,
      notes: [
        { midi: 60, time: 0.25, duration: 0.5, velocity: 0.8, name: 'C4' },
        { midi: 62, time: 1.5, duration: 0.4, velocity: 0.7, name: 'D4' },
      ],
    },
  ],
};

const audioLoadResult: AudioLoadResult = {
  fileName: 'backing.wav',
  objectUrl: 'blob:backing',
  duration: 12,
  sampleRate: 48_000,
  channelCount: 2,
  totalSamples: 576_000,
  channelBuffers: [new ArrayBuffer(8), new ArrayBuffer(8)],
};

const mocks = vi.hoisted(() => {
  const audioEngine = {
    setVolume: vi.fn(),
    resume: vi.fn().mockResolvedValue(undefined),
    loadAudioFile: vi.fn(),
    clearAudio: vi.fn(),
    setMidiSynthEnabled: vi.fn(),
    pauseMedia: vi.fn(),
    seekMedia: vi.fn(),
    playMedia: vi.fn(),
    playNote: vi.fn(),
    get mediaCurrentTime() {
      return 0;
    },
    get mediaPaused() {
      return true;
    },
    get mediaDuration() {
      return 0;
    },
  };

  const waveformBuilder = vi.fn().mockImplementation(function (this: WaveformBuilderInstance) {
    this.startBuild = vi.fn();
    this.cancelBuild = vi.fn();
    this.dispose = vi.fn();
  });

  const midi = vi.fn();

  return { audioEngine, waveformBuilder, midi };
});

vi.mock('../src/services/audio', () => ({
  audioEngine: mocks.audioEngine,
}));

vi.mock('../src/services/waveformBuilder', () => ({
  WaveformBuilder: mocks.waveformBuilder,
}));

vi.mock('@tonejs/midi', () => ({
  Midi: mocks.midi,
}));

vi.mock('../src/components/Sidebar', () => ({
  default: (props: SidebarMockProps) => (
    <aside>
      <div data-testid="play-state">{props.isPlaying ? 'playing' : 'paused'}</div>
      <div data-testid="midi-file">{props.fileName ?? ''}</div>
      <div data-testid="audio-file">{props.audioFileName ?? ''}</div>
      <div data-testid="current-time">{props.currentTime}</div>
      <div data-testid="waveform-status">{props.waveformBuildProgress.status}</div>
      <div data-testid="audio-offset">{props.config.audioOffsetMs}</div>
      <div data-testid="global-bg">{props.config.globalBgColor}</div>
      <div data-testid="waveform-mode">{props.config.waveformMode}</div>
      <div data-testid="waveform-peak-sample-rate">
        {props.config.waveformPeakSampleRate === null ? 'auto' : props.config.waveformPeakSampleRate}
      </div>
      <button type="button" onClick={props.togglePlay}>
        toggle play
      </button>
      <button type="button" onClick={props.stopPlayback}>
        stop playback
      </button>
      <button
        type="button"
        onClick={() =>
          props.setConfig((prev) => ({
            ...prev,
            startDelay: 2,
          }))
        }
      >
        set start delay
      </button>
      <button
        type="button"
        onClick={() =>
          props.setConfig((prev) => ({
            ...prev,
            audioOffsetMs: prev.audioOffsetMs + 1000,
          }))
        }
      >
        bump offset
      </button>
      <button
        type="button"
        onClick={() =>
          props.setConfig((prev) => ({
            ...prev,
            waveformMode: 'pcm',
          }))
        }
      >
        set pcm mode
      </button>
      <button
        type="button"
        onClick={() =>
          props.setConfig((prev) => ({
            ...prev,
            waveformMode: 'peak',
          }))
        }
      >
        set peak mode
      </button>
      <button
        type="button"
        onClick={() =>
          props.setConfig((prev) => ({
            ...prev,
            waveformPeakSampleRate: 960,
          }))
        }
      >
        set manual peak sample rate
      </button>
      <button
        type="button"
        onClick={() =>
          props.setConfig((prev) => ({
            ...prev,
            showWaveform: !prev.showWaveform,
          }))
        }
      >
        toggle waveform
      </button>
      <input aria-label="Upload MIDI File" type="file" onChange={props.handleFileUpload} />
      <input aria-label="Upload Audio File" type="file" onChange={props.handleAudioUpload} />
      <button type="button" disabled={!props.canExportProject} onClick={props.handleProjectExport}>
        export project
      </button>
      <input aria-label="Import Project Package" type="file" onChange={props.handleProjectImport} />
      <button
        type="button"
        onClick={() => {
          const imageValue = props.handleColorImageSelected(
            'globalBgColor',
            new File(['image'], 'wallpaper.png', { type: 'image/png' })
          );
          props.setConfig((prev) => ({
            ...prev,
            globalBgColor: imageValue,
          }));
        }}
      >
        set image background
      </button>
    </aside>
  ),
}));

describe('App', () => {
  beforeEach(() => {
    mocks.midi.mockImplementation(function () {
      return midiFixture;
    });
    mocks.audioEngine.loadAudioFile.mockResolvedValue(audioLoadResult);
    mocks.audioEngine.playMedia.mockResolvedValue(undefined);
    mocks.audioEngine.resume.mockResolvedValue(undefined);
    mocks.audioEngine.pauseMedia.mockClear();
    mocks.audioEngine.seekMedia.mockClear();
    mocks.audioEngine.playNote.mockClear();
    mocks.audioEngine.setVolume.mockClear();
    mocks.audioEngine.setMidiSynthEnabled.mockClear();
    mocks.audioEngine.clearAudio.mockClear();
    mocks.waveformBuilder.mockClear();
  });

  it('recognizes MIDI drag-and-drop regardless of extension case', async () => {
    const { container } = render(<App />);

    const file = new File([new ArrayBuffer(8)], 'SONG.MID', { type: 'audio/midi' });
    fireEvent.drop(container.firstElementChild as HTMLElement, {
      dataTransfer: { files: [file] },
    });

    await waitFor(() => {
      expect(screen.getByTestId('midi-file')).toHaveTextContent('SONG.MID');
    });

    expect(mocks.midi).toHaveBeenCalledTimes(1);
  });

  it('keeps playback paused when external audio play rejects', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.upload(screen.getByLabelText('Upload MIDI File'), new File(['midi'], 'song.mid'));
    await waitFor(() => expect(screen.getByTestId('midi-file')).toHaveTextContent('song.mid'));

    mocks.audioEngine.playMedia.mockRejectedValueOnce(new Error('playback blocked'));
    await user.upload(
      screen.getByLabelText('Upload Audio File'),
      new File(['audio'], 'backing.wav', { type: 'audio/wav' })
    );

    await waitFor(() => expect(screen.getByTestId('audio-file')).toHaveTextContent('backing.wav'));

    await user.click(screen.getByRole('button', { name: 'toggle play' }));

    await waitFor(() => {
      expect(screen.getByTestId('play-state')).toHaveTextContent('paused');
    });
    expect(mocks.audioEngine.playMedia).toHaveBeenCalledTimes(1);
    expect(mocks.audioEngine.pauseMedia).toHaveBeenCalledTimes(1);
  });

  it('treats start delay as negative pre-roll before MIDI and audio start', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.upload(screen.getByLabelText('Upload MIDI File'), new File(['midi'], 'song.mid'));
    await waitFor(() => expect(screen.getByTestId('midi-file')).toHaveTextContent('song.mid'));

    await user.click(screen.getByRole('button', { name: 'set start delay' }));
    await waitFor(() => expect(screen.getByTestId('current-time')).toHaveTextContent('-2'));

    await user.upload(
      screen.getByLabelText('Upload Audio File'),
      new File(['audio'], 'backing.wav', { type: 'audio/wav' })
    );
    await waitFor(() => expect(screen.getByTestId('audio-file')).toHaveTextContent('backing.wav'));

    mocks.audioEngine.playMedia.mockClear();
    mocks.audioEngine.seekMedia.mockClear();

    await user.click(screen.getByRole('button', { name: 'toggle play' }));

    await waitFor(() => expect(screen.getByTestId('play-state')).toHaveTextContent('playing'));
    expect(screen.getByTestId('current-time')).toHaveTextContent('-2');
    expect(mocks.audioEngine.seekMedia).toHaveBeenLastCalledWith(0);
    expect(mocks.audioEngine.playMedia).not.toHaveBeenCalled();
  });

  it('disables MIDI sine output while external audio is loaded', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.upload(
      screen.getByLabelText('Upload Audio File'),
      new File(['audio'], 'backing.wav', { type: 'audio/wav' })
    );

    await waitFor(() => expect(screen.getByTestId('audio-file')).toHaveTextContent('backing.wav'));
    expect(mocks.audioEngine.setMidiSynthEnabled).toHaveBeenLastCalledWith(false);
  });

  it('re-syncs external audio immediately when audio offset changes during playback', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.upload(screen.getByLabelText('Upload MIDI File'), new File(['midi'], 'song.mid'));
    await waitFor(() => expect(screen.getByTestId('midi-file')).toHaveTextContent('song.mid'));

    await user.upload(
      screen.getByLabelText('Upload Audio File'),
      new File(['audio'], 'backing.wav', { type: 'audio/wav' })
    );
    await waitFor(() => expect(screen.getByTestId('audio-file')).toHaveTextContent('backing.wav'));

    mocks.audioEngine.seekMedia.mockClear();

    await user.click(screen.getByRole('button', { name: 'toggle play' }));
    await waitFor(() => expect(screen.getByTestId('play-state')).toHaveTextContent('playing'));

    await user.click(screen.getByRole('button', { name: 'bump offset' }));

    await waitFor(() => {
      expect(screen.getByTestId('audio-offset')).toHaveTextContent('1000');
    });
    expect(mocks.audioEngine.seekMedia).toHaveBeenLastCalledWith(1);
  });

  it('starts peak cache builds by default and cancels them when switching to pcm mode', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.upload(
      screen.getByLabelText('Upload Audio File'),
      new File(['audio'], 'backing.wav', { type: 'audio/wav' })
    );
    await waitFor(() => expect(screen.getByTestId('audio-file')).toHaveTextContent('backing.wav'));

    const builder = mocks.waveformBuilder.mock.instances[0] as WaveformBuilderInstance;
    expect(builder.startBuild).toHaveBeenCalledTimes(1);
    expect(builder.startBuild).toHaveBeenLastCalledWith(
      expect.objectContaining({
        peaksPerSecond: [3840, 1920, 960, 480, 240, 120, 60, 30],
      })
    );

    await user.click(screen.getByRole('button', { name: 'set pcm mode' }));

    await waitFor(() => expect(screen.getByTestId('waveform-mode')).toHaveTextContent('pcm'));
    expect(builder.cancelBuild).toHaveBeenCalledTimes(1);
  });

  it('rebuilds the peak cache when the manual peak sample rate changes', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.upload(
      screen.getByLabelText('Upload Audio File'),
      new File(['audio'], 'backing.wav', { type: 'audio/wav' })
    );
    await waitFor(() => expect(screen.getByTestId('audio-file')).toHaveTextContent('backing.wav'));

    const builder = mocks.waveformBuilder.mock.instances[0] as WaveformBuilderInstance;
    builder.startBuild.mockClear();
    builder.cancelBuild.mockClear();

    await user.click(screen.getByRole('button', { name: 'set manual peak sample rate' }));

    await waitFor(() => expect(screen.getByTestId('waveform-peak-sample-rate')).toHaveTextContent('960'));
    expect(builder.cancelBuild).toHaveBeenCalledTimes(1);
    expect(builder.startBuild).toHaveBeenCalledTimes(1);
    expect(builder.startBuild).toHaveBeenLastCalledWith(
      expect.objectContaining({
        peaksPerSecond: [960],
      })
    );
  });

  it('exports the current project package and triggers a zip download', async () => {
    const user = userEvent.setup();
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    render(<App />);

    expect(screen.getByRole('button', { name: 'export project' })).toBeDisabled();

    await user.upload(screen.getByLabelText('Upload MIDI File'), new File(['midi'], 'song.mid'));
    await waitFor(() => expect(screen.getByTestId('midi-file')).toHaveTextContent('song.mid'));

    await user.click(screen.getByRole('button', { name: 'set image background' }));
    await waitFor(() => expect(screen.getByTestId('global-bg')).toHaveTextContent('blob:mock'));

    await user.click(screen.getByRole('button', { name: 'export project' }));

    await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1));
    expect(URL.createObjectURL).toHaveBeenLastCalledWith(expect.any(Blob));
  });

  it('imports a project package through the existing MIDI and audio load paths', async () => {
    const user = userEvent.setup();
    const packageBlob = await exportProjectPackage({
      config: {
        ...DEFAULT_CONFIG,
        audioOffsetMs: 750,
        waveformMode: 'pcm',
      },
      midiFile: new File(['midi'], 'package.mid', { type: 'audio/midi' }),
      audioFile: new File(['audio'], 'package.wav', { type: 'audio/wav' }),
      imageAssets: [],
    });
    render(<App />);

    await user.upload(
      screen.getByLabelText('Import Project Package'),
      new File([packageBlob], 'project.zip', { type: 'application/zip' })
    );

    await waitFor(() => {
      expect(screen.getByTestId('midi-file')).toHaveTextContent('package.mid');
      expect(screen.getByTestId('audio-file')).toHaveTextContent('backing.wav');
      expect(screen.getByTestId('audio-offset')).toHaveTextContent('750');
      expect(screen.getByTestId('waveform-mode')).toHaveTextContent('pcm');
    });
    expect(mocks.midi).toHaveBeenCalledTimes(1);
    expect(mocks.audioEngine.loadAudioFile).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'package.wav' })
    );
    expect(mocks.audioEngine.pauseMedia).toHaveBeenCalled();
    expect(mocks.audioEngine.seekMedia).toHaveBeenLastCalledWith(0.75);
  });
});
