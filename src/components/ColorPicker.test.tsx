import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import ColorPicker from './ColorPicker';

describe('ColorPicker', () => {
  it('emits hsla values when editing the solid sliders', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<ColorPicker label="Background" value="#ff0000" onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Change color for Background' }));
    fireEvent.change(screen.getByLabelText('Color H Slider'), { target: { value: '120' } });

    expect(onChange).toHaveBeenLastCalledWith('hsla(120, 100%, 50%, 1)');
  });

  it('switches to gradient mode with the default gradient string', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<ColorPicker label="Background" value="#000000" onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Change color for Background' }));
    await user.click(screen.getByRole('button', { name: 'Gradient' }));

    expect(onChange).toHaveBeenLastCalledWith('linear-gradient(180deg, #000000 0%, #ffffff 100%)');
  });

  it('supports adding and editing gradient stops', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<ColorPicker label="Background" value="#000000" onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Change color for Background' }));
    await user.click(screen.getByRole('button', { name: 'Gradient' }));
    await user.click(screen.getByRole('button', { name: 'Add Gradient Stop' }));

    fireEvent.change(screen.getByLabelText('Gradient Stop Position'), { target: { value: '25' } });
    fireEvent.change(screen.getByLabelText('Gradient Stop Color'), { target: { value: '#ff0000' } });

    expect(onChange).toHaveBeenLastCalledWith(
      'linear-gradient(180deg, #000000 0%, #ff0000 25%, #ffffff 100%)'
    );
  });

  it('hydrates multi-stop gradients from value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <ColorPicker
        label="Background"
        value="linear-gradient(120deg, #111111 0%, #333333 40%, #ffffff 100%)"
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Change color for Background' }));
    expect(screen.getByText('Stops (3/8)')).toBeInTheDocument();
    expect(screen.getByLabelText('Gradient Angle')).toHaveValue(120);
  });

  it('uploads image backgrounds as url strings', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<ColorPicker label="Background" value="#000000" onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Change color for Background' }));
    await user.click(screen.getByRole('button', { name: 'Image' }));

    const input = screen.getByLabelText('Upload Background Image');
    const file = new File(['image'], 'wallpaper.png', { type: 'image/png' });

    await user.upload(input, file);

    expect(URL.createObjectURL).toHaveBeenCalledWith(file);
    expect(onChange).toHaveBeenLastCalledWith("url('blob:mock') center / cover no-repeat");
  });

  it('delegates image uploads to the parent callback when provided', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onImageSelected = vi.fn(() => "url('blob:parent') center / cover no-repeat");
    vi.mocked(URL.createObjectURL).mockClear();

    render(
      <ColorPicker
        label="Background"
        value="#000000"
        onChange={onChange}
        onImageSelected={onImageSelected}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Change color for Background' }));
    await user.click(screen.getByRole('button', { name: 'Image' }));

    const file = new File(['image'], 'wallpaper.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText('Upload Background Image'), file);

    expect(onImageSelected).toHaveBeenCalledWith(file);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenLastCalledWith("url('blob:parent') center / cover no-repeat");
  });
});
