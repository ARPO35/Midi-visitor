import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
}

interface HSLA {
  h: number;
  s: number;
  l: number;
  a: number;
}

// Helpers
const parseColor = (str: string): HSLA => {
  const div = document.createElement('div');
  div.style.color = str;
  document.body.appendChild(div);
  const computed = window.getComputedStyle(div).color;
  document.body.removeChild(div);

  const match = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!match) return { h: 0, s: 0, l: 100, a: 1 };

  const r = parseInt(match[1]) / 255;
  const g = parseInt(match[2]) / 255;
  const b = parseInt(match[3]) / 255;
  const a = match[4] ? parseFloat(match[4]) : 1;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }

  return { h, s: s * 100, l: l * 100, a };
};

const hslaToString = ({ h, s, l, a }: HSLA) => {
  return `hsla(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%, ${a.toFixed(2).replace(/\.?0+$/, '')})`;
};

const PRESETS = [
  '#ffffff', '#000000', '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e',
  'rgba(255,255,255,0.1)', 'rgba(0,0,0,0.5)', 'rgba(20,20,20,0.8)', 'rgba(255,255,255,0.5)'
];

const ColorPicker: React.FC<ColorPickerProps> = ({ label, value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hsla, setHsla] = useState<HSLA>(parseColor(value));
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Sync logic if needed
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const update = (newHsla: Partial<HSLA>) => {
    const updated = { ...hsla, ...newHsla };
    setHsla(updated);
    onChange(hslaToString(updated));
  };

  return (
    <div className="relative mb-3" ref={popoverRef}>
      {/* Trigger */}
      <div className="flex items-center justify-between group">
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider group-hover:text-zinc-300 transition-colors">{label}</span>
        <button
          onClick={() => {
            setHsla(parseColor(value));
            setIsOpen(!isOpen);
          }}
          aria-label={`Open color picker for ${label}`}
          className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-md pl-2 pr-1 py-1 hover:border-zinc-600 transition-all"
        >
          <div 
             className="w-6 h-4 rounded-[2px] shadow-inner border border-white/10" 
             style={{ backgroundColor: value, backgroundImage: 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)', backgroundSize: '4px 4px', backgroundBlendMode: 'multiply' }}
          >
             <div className="w-full h-full" style={{backgroundColor: value}}></div>
          </div>
          <ChevronDown size={12} className={`text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Popover */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 z-[100] w-64 p-4 rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl backdrop-blur-3xl">
           {/* Sliders */}
           <div className="space-y-3 mb-4">
             
             {/* Hue */}
             <div className="space-y-1">
               <div className="flex justify-between text-[10px] text-zinc-400">
                 <label htmlFor="hue-slider">H</label> <span>{Math.round(hsla.h)}°</span>
               </div>
               <input 
                 id="hue-slider"
                 aria-label="Hue"
                 type="range" min="0" max="360" 
                 value={hsla.h} 
                 onChange={e => update({ h: parseFloat(e.target.value) })}
                 className="w-full h-3 rounded-full appearance-none cursor-pointer"
                 style={{ background: 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)' }}
               />
             </div>

             {/* Saturation */}
             <div className="space-y-1">
               <div className="flex justify-between text-[10px] text-zinc-400">
                 <label htmlFor="saturation-slider">S</label> <span>{Math.round(hsla.s)}%</span>
               </div>
               <input 
                 id="saturation-slider"
                 aria-label="Saturation"
                 type="range" min="0" max="100" 
                 value={hsla.s} 
                 onChange={e => update({ s: parseFloat(e.target.value) })}
                 className="w-full h-3 rounded-full appearance-none cursor-pointer"
                 style={{ background: `linear-gradient(to right, #808080, hsl(${hsla.h}, 100%, 50%))` }}
               />
             </div>

             {/* Lightness */}
             <div className="space-y-1">
               <div className="flex justify-between text-[10px] text-zinc-400">
                 <label htmlFor="lightness-slider">L</label> <span>{Math.round(hsla.l)}%</span>
               </div>
               <input 
                 id="lightness-slider"
                 aria-label="Lightness"
                 type="range" min="0" max="100" 
                 value={hsla.l} 
                 onChange={e => update({ l: parseFloat(e.target.value) })}
                 className="w-full h-3 rounded-full appearance-none cursor-pointer"
                 style={{ background: `linear-gradient(to right, #000, hsl(${hsla.h}, ${hsla.s}%, 50%), #fff)` }}
               />
             </div>

             {/* Alpha */}
             <div className="space-y-1">
               <div className="flex justify-between text-[10px] text-zinc-400">
                 <label htmlFor="alpha-slider">A</label> <span>{hsla.a.toFixed(2)}</span>
               </div>
               <div className="relative w-full h-3 rounded-full overflow-hidden">
                  <div className="absolute inset-0 w-full h-full" style={{ backgroundImage: 'linear-gradient(45deg, #444 25%, transparent 25%), linear-gradient(-45deg, #444 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #444 75%), linear-gradient(-45deg, transparent 75%, #444 75%)', backgroundSize: '6px 6px', backgroundColor: '#222' }}></div>
                  <input 
                    id="alpha-slider"
                    aria-label="Alpha Transparency"
                    type="range" min="0" max="1" step="0.01"
                    value={hsla.a} 
                    onChange={e => update({ a: parseFloat(e.target.value) })}
                    className="absolute inset-0 w-full h-full appearance-none cursor-pointer bg-transparent z-10"
                    style={{ background: `linear-gradient(to right, transparent, hsl(${hsla.h}, ${hsla.s}%, ${hsla.l}%))` }}
                  />
               </div>
             </div>

           </div>

           {/* Presets */}
           <div className="grid grid-cols-8 gap-1.5 pt-2 border-t border-zinc-800">
              {PRESETS.map((color, i) => (
                <button
                  key={i}
                  onClick={() => {
                    const parsed = parseColor(color);
                    setHsla(parsed);
                    onChange(color);
                  }}
                  aria-label={`Select preset color ${color}`}
                  className="w-5 h-5 rounded-md border border-zinc-700 hover:scale-110 hover:border-white transition-all shadow-sm"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
           </div>
        </div>
      )}
    </div>
  );
};

export default ColorPicker;