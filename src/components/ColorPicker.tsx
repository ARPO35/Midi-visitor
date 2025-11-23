import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Image as ImageIcon, PaintBucket, Zap } from 'lucide-react';

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

// --- Helpers ---

const hslaToString = ({ h, s, l, a }: HSLA) => {
  return `hsla(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%, ${a.toFixed(2).replace(/\.?0+$/, '')})`;
};

const parseColor = (str: string): HSLA => {
  if (str.startsWith('linear-gradient') || str.startsWith('url')) {
    return { h: 0, s: 0, l: 0, a: 1 }; 
  }

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

const PRESETS = [
  '#ffffff', '#000000', '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e',
  'rgba(255,255,255,0.1)', 'rgba(0,0,0,0.5)', 'rgba(20,20,20,0.8)', 'rgba(255,255,255,0.5)'
];

type Mode = 'solid' | 'gradient' | 'image';

const ColorPicker: React.FC<ColorPickerProps> = ({ label, value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  
  const initialMode = value.startsWith('linear-gradient') ? 'gradient' : value.startsWith('url') ? 'image' : 'solid';
  const [mode, setMode] = useState<Mode>(initialMode);
  const [hsla, setHsla] = useState<HSLA>(parseColor(value));
  const [gradAngle, setGradAngle] = useState(180);
  const [gradColor1, setGradColor1] = useState('#000000');
  const [gradColor2, setGradColor2] = useState('#ffffff');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const updateSolid = (newHsla: Partial<HSLA>) => {
    const updated = { ...hsla, ...newHsla };
    setHsla(updated);
    if (mode === 'solid') {
      onChange(hslaToString(updated));
    }
  };

  const updateGradient = (angle: number, c1: string, c2: string) => {
    const str = `linear-gradient(${angle}deg, ${c1}, ${c2})`;
    onChange(str);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      onChange(`url('${url}') center / cover no-repeat`);
    }
  };

  return (
    <div className="relative mb-3" ref={popoverRef}>
      {/* Trigger */}
      <div className="flex items-center justify-between group">
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider group-hover:text-zinc-300 transition-colors">{label}</span>
        <button
          onClick={() => {
            const currentMode = value.startsWith('linear-gradient') ? 'gradient' : value.startsWith('url') ? 'image' : 'solid';
            setMode(currentMode);
            if (currentMode === 'solid') setHsla(parseColor(value));
            setIsOpen(!isOpen);
          }}
          aria-label={`Pick color for ${label}`} // 修复 A11y
          className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-md pl-2 pr-1 py-1 hover:border-zinc-600 transition-all"
        >
          <div 
             className="w-6 h-4 rounded-[2px] shadow-inner border border-white/10 overflow-hidden" 
          >
             <div className="w-full h-full" style={{
               background: value,
               backgroundColor: value.includes('url') ? '#000' : undefined
             }}></div>
          </div>
          <ChevronDown size={12} className={`text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Popover */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 z-[100] w-64 p-4 rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl backdrop-blur-3xl">
           
           {/* Mode Tabs */}
           <div className="flex p-1 bg-zinc-900 rounded-lg mb-4 gap-1">
             {[
               { id: 'solid', icon: <PaintBucket size={12} />, label: "Solid Color" },
               { id: 'gradient', icon: <Zap size={12} />, label: "Gradient" },
               { id: 'image', icon: <ImageIcon size={12} />, label: "Image" }
             ].map((tab) => (
               <button
                 key={tab.id}
                 onClick={() => {
                   setMode(tab.id as Mode);
                   if (tab.id === 'solid') onChange(hslaToString(hsla));
                   if (tab.id === 'gradient') updateGradient(gradAngle, gradColor1, gradColor2);
                 }}
                 aria-label={tab.label} // 修复 A11y
                 className={`flex-1 py-1.5 flex items-center justify-center rounded text-xs transition-all ${
                   mode === tab.id ? 'bg-zinc-700 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'
                 }`}
               >
                 {tab.icon}
               </button>
             ))}
           </div>

           {/* SOLID MODE */}
           {mode === 'solid' && (
             <>
               <div className="space-y-3 mb-4">
                 {/* Sliders */}
                 {['h', 's', 'l'].map((chan) => (
                   <div key={chan} className="space-y-1">
                     <div className="flex justify-between text-[10px] text-zinc-400 uppercase">
                       <span>{chan}</span> 
                       <span>{Math.round(hsla[chan as keyof HSLA])}{chan === 'h' ? '°' : '%'}</span>
                     </div>
                     <input 
                       type="range" min="0" max={chan === 'h' ? 360 : 100} 
                       value={hsla[chan as keyof HSLA]} 
                       aria-label={`Color ${chan === 'h' ? 'Hue' : chan === 's' ? 'Saturation' : 'Lightness'}`} // 修复 A11y
                       onChange={e => updateSolid({ [chan]: parseFloat(e.target.value) })}
                       className="w-full h-2 rounded-full appearance-none cursor-pointer bg-zinc-800 accent-zinc-400"
                       style={
                          chan === 'h' ? { background: 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)' } :
                          chan === 's' ? { background: `linear-gradient(to right, #808080, hsl(${hsla.h}, 100%, 50%))` } :
                          { background: `linear-gradient(to right, #000, hsl(${hsla.h}, ${hsla.s}%, 50%), #fff)` }
                       }
                     />
                   </div>
                 ))}
                 
                 {/* Alpha */}
                 <div className="space-y-1">
                   <div className="flex justify-between text-[10px] text-zinc-400 uppercase">
                     <span>A</span> <span>{hsla.a.toFixed(2)}</span>
                   </div>
                   <div className="relative w-full h-2 rounded-full overflow-hidden bg-zinc-800">
                      <div className="absolute inset-0 w-full h-full" style={{ backgroundImage: 'linear-gradient(45deg, #444 25%, transparent 25%, linear-gradient(-45deg, #444 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #444 75%), linear-gradient(-45deg, transparent 75%, #444 75%)', backgroundSize: '6px 6px', backgroundColor: '#222' }}></div>
                      <input 
                        type="range" min="0" max="1" step="0.01"
                        value={hsla.a} 
                        aria-label="Alpha Transparency" // 修复 A11y
                        onChange={e => updateSolid({ a: parseFloat(e.target.value) })}
                        className="absolute inset-0 w-full h-full appearance-none cursor-pointer bg-transparent z-10 accent-white"
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
                        setHsla(parseColor(color));
                        onChange(color);
                      }}
                      aria-label={`Select color ${color}`} // 修复 A11y
                      className="w-5 h-5 rounded border border-zinc-700 hover:scale-110 hover:border-white transition-all shadow-sm"
                      style={{ backgroundColor: color }}
                    />
                  ))}
               </div>
             </>
           )}

           {/* GRADIENT MODE */}
           {mode === 'gradient' && (
             <div className="space-y-4">
               <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500">Angle</span>
                  <input 
                    type="number" 
                    aria-label="Gradient Angle" // 修复 A11y
                    value={gradAngle} 
                    onChange={(e) => {
                      const a = Number(e.target.value);
                      setGradAngle(a);
                      updateGradient(a, gradColor1, gradColor2);
                    }}
                    className="w-12 bg-zinc-800 border border-zinc-700 rounded text-xs px-1 text-right text-zinc-300"
                  />
               </div>
               <input 
                  type="range" min="0" max="360" 
                  aria-label="Gradient Angle Slider" // 修复 A11y
                  value={gradAngle}
                  onChange={(e) => {
                    const a = Number(e.target.value);
                    setGradAngle(a);
                    updateGradient(a, gradColor1, gradColor2);
                  }}
                  className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-400"
                />

               <div className="flex gap-2 items-center">
                 <div className="flex-1 space-y-1">
                    <div className="text-[10px] text-zinc-500">Start</div>
                    <input 
                      type="color" 
                      aria-label="Gradient Start Color" // 修复 A11y
                      value={gradColor1}
                      onChange={(e) => {
                        setGradColor1(e.target.value);
                        updateGradient(gradAngle, e.target.value, gradColor2);
                      }}
                      className="w-full h-8 rounded cursor-pointer bg-transparent border border-zinc-700"
                    />
                 </div>
                 <div className="flex-1 space-y-1">
                    <div className="text-[10px] text-zinc-500">End</div>
                    <input 
                      type="color" 
                      aria-label="Gradient End Color" // 修复 A11y
                      value={gradColor2}
                      onChange={(e) => {
                        setGradColor2(e.target.value);
                        updateGradient(gradAngle, gradColor1, e.target.value);
                      }}
                      className="w-full h-8 rounded cursor-pointer bg-transparent border border-zinc-700"
                    />
                 </div>
               </div>
             </div>
           )}

           {/* IMAGE MODE */}
           {mode === 'image' && (
             <div className="space-y-4 text-center">
               <div className="border border-dashed border-zinc-700 rounded-lg p-4 hover:bg-white/5 transition-colors relative group cursor-pointer">
                 <ImageIcon className="mx-auto mb-2 text-zinc-500" size={24} />
                 <span className="text-[10px] text-zinc-400 uppercase block">Select Image</span>
                 <input 
                   type="file" 
                   accept="image/*" 
                   aria-label="Upload Image Background" // 修复 A11y
                   onChange={handleImageUpload}
                   className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                 />
               </div>
               <div className="text-[10px] text-zinc-600">
                 Supports JPG, PNG, GIF, WEBP
               </div>
             </div>
           )}
        </div>
      )}
    </div>
  );
};

export default ColorPicker;