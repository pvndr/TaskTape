import { useState, useRef } from 'react';

const TAPE_COLORS = [
  { id: 'tape-cream', name: 'Cream', bg: 'bg-tape-cream', border: 'border-kraft-border' },
  { id: 'tape-red', name: 'Red', bg: 'bg-tape-red', border: 'border-red-300' },
  { id: 'tape-mustard', name: 'Mustard', bg: 'bg-tape-mustard', border: 'border-amber-400' },
  { id: 'tape-teal', name: 'Teal', bg: 'bg-tape-teal', border: 'border-teal-300' },
  { id: 'tape-sage', name: 'Sage', bg: 'bg-tape-sage', border: 'border-emerald-300' }
];

export default function AddBar({ onAddTask, onFocusChange, onScanPhoto }) {
  const [title, setTitle] = useState('');
  const [selectedColor, setSelectedColor] = useState('tape-cream');
  const fileInputRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    onAddTask({
      title: trimmed,
      color: selectedColor
    });

    setTitle('');
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onScanPhoto?.(file);
    // Reset input so the same file can be re-selected if desired
    e.target.value = '';
  };

  return (
    <div className="shrink-0 sticky bottom-0 left-0 right-0 z-30 bg-kraft/95 backdrop-blur-md border-t border-kraft-border/40 pb-safe pt-2 px-3 shadow-lg">
      {/* Hidden file input for camera snap or photo upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      <form onSubmit={handleSubmit} className="max-w-md mx-auto flex flex-col gap-2">
        {/* Color picker swatches */}
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-kraft-dark/70 font-sans">
            Tape Color
          </span>
          <div className="flex items-center gap-2">
            {TAPE_COLORS.map((color) => {
              const isSelected = selectedColor === color.id;
              return (
                <button
                  key={color.id}
                  type="button"
                  onClick={() => setSelectedColor(color.id)}
                  title={color.name}
                  aria-label={`Select ${color.name} tape`}
                  className={`w-6 h-5 rounded-xs transition-transform ${color.bg} ${color.border} border shadow-xs ${
                    isSelected
                      ? 'scale-115 ring-2 ring-kraft-dark ring-offset-1 ring-offset-kraft'
                      : 'opacity-85 hover:opacity-100 hover:scale-105'
                  }`}
                />
              );
            })}
          </div>
        </div>

        {/* Input box, Camera Scan Button, and Tape Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Snap or upload spiral notepad photo"
            aria-label="Scan handwritten notepad"
            className="min-h-[40px] min-w-[40px] px-2.5 rounded-lg bg-white/70 hover:bg-white text-kraft-dark border border-kraft-border/60 hover:border-kraft-dark/40 active:scale-95 transition-all shadow-xs shrink-0 flex items-center justify-center text-lg cursor-pointer"
          >
            <span role="img" aria-hidden="true">
              📷
            </span>
          </button>

          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onFocus={() => onFocusChange?.(true)}
            onBlur={() => onFocusChange?.(false)}
            placeholder="Write on a new strip..."
            // Ensure font size is at least 16px to prevent iOS auto-zoom
            className="flex-1 min-h-[40px] text-[16px] px-3.5 py-2 rounded-lg bg-white/80 border border-kraft-border/60 text-kraft-dark placeholder:text-kraft-dark/45 focus:outline-none focus:ring-2 focus:ring-kraft-dark/50 focus:bg-white transition-all shadow-inner font-hand text-xl"
          />

          <button
            type="submit"
            disabled={!title.trim()}
            className="min-h-[40px] px-4 py-2 rounded-lg bg-kraft-dark text-tape-cream font-sans font-semibold text-sm transition-all hover:bg-kraft-dark/90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs shrink-0 cursor-pointer"
          >
            Stick
          </button>
        </div>
      </form>
    </div>
  );
}
