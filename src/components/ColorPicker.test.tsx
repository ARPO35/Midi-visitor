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

    expect(onChange).toHaveBeenLastCalledWith('linear-gradient(180deg, #000000, #ffffff)');
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
});
