import { useState, useEffect } from 'react';
import { compressAndPrepareImage } from '../lib/imageCompression';
import {
  extractTasksFromNotepadImage,
  getGeminiApiKey,
  setGeminiApiKey,
  VALID_TAPE_COLORS
} from '../lib/geminiVision';

const COLOR_BG_MAP = {
  'tape-cream': 'bg-tape-cream border-kraft-border/60 text-kraft-dark',
  'tape-red': 'bg-tape-red border-red-300 text-kraft-dark',
  'tape-mustard': 'bg-tape-mustard border-amber-400 text-kraft-dark',
  'tape-teal': 'bg-tape-teal border-teal-300 text-kraft-dark',
  'tape-sage': 'bg-tape-sage border-emerald-300 text-kraft-dark'
};

export default function NotepadScanModal({
  isOpen,
  imageFile,
  onClose,
  onStickBatch
}) {
  const [status, setStatus] = useState('compressing'); // 'compressing' | 'scanning' | 'review' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [compressedBase64, setCompressedBase64] = useState('');
  const [tasks, setTasks] = useState([]);
  const [keyInput, setKeyInput] = useState('');

  // When modal opens with a file, start process
  useEffect(() => {
    if (!isOpen || !imageFile) return;

    let isMounted = true;
    setStatus('compressing');
    setErrorMessage('');
    setErrorCode('');
    setTasks([]);

    (async () => {
      try {
        const compressed = await compressAndPrepareImage(imageFile);
        if (!isMounted) return;

        setPreviewUrl(compressed.previewUrl);
        setCompressedBase64(compressed.base64);

        setStatus('scanning');
        const extracted = await extractTasksFromNotepadImage(compressed.base64, compressed.mimeType);
        if (!isMounted) return;

        if (extracted.length === 0) {
          setStatus('error');
          setErrorMessage("No pending tasks were found on this page. Make sure the handwriting is clear and well-lit.");
        } else {
          setTasks(extracted);
          setStatus('review');
        }
      } catch (err) {
        if (!isMounted) return;
        console.error('Handwriting scan failed:', err);
        setStatus('error');
        setErrorCode(err?.code || '');
        setErrorMessage(err?.message || 'Failed to scan notebook photo.');
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [isOpen, imageFile]);

  if (!isOpen) return null;

  const handleRetryWithKey = async (e) => {
    e.preventDefault();
    const cleanKey = keyInput.trim();
    if (!cleanKey) return;

    setGeminiApiKey(cleanKey);
    setStatus('scanning');
    setErrorMessage('');
    setErrorCode('');

    try {
      const extracted = await extractTasksFromNotepadImage(compressedBase64, 'image/jpeg', cleanKey);
      if (extracted.length === 0) {
        setStatus('error');
        setErrorMessage("No pending tasks were found on this page. Make sure the handwriting is clear and well-lit.");
      } else {
        setTasks(extracted);
        setStatus('review');
      }
    } catch (err) {
      console.error('Scan retry failed:', err);
      setStatus('error');
      setErrorCode(err?.code || '');
      setErrorMessage(err?.message || 'Failed to scan notebook photo.');
    }
  };

  const handleToggleTask = (id) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t))
    );
  };

  const handleTitleChange = (id, newTitle) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, title: newTitle } : t))
    );
  };

  const handleCycleColor = (id) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const currentIndex = VALID_TAPE_COLORS.indexOf(t.color);
        const nextColor = VALID_TAPE_COLORS[(currentIndex + 1) % VALID_TAPE_COLORS.length];
        return { ...t, color: nextColor };
      })
    );
  };

  const handleRemoveTask = (id) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleAddTask = () => {
    const nextColor = VALID_TAPE_COLORS[tasks.length % VALID_TAPE_COLORS.length];
    setTasks((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        title: '',
        color: nextColor,
        selected: true
      }
    ]);
  };

  const selectedCount = tasks.filter((t) => t.selected && t.title.trim()).length;

  const handleConfirmStick = () => {
    const toStick = tasks
      .filter((t) => t.selected && t.title.trim())
      .map((t) => ({
        title: t.title.trim(),
        color: t.color
      }));

    if (toStick.length > 0) {
      onStickBatch(toStick);
    }
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="scan-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
    >
      <div className="relative w-full max-w-lg max-h-[90vh] bg-kraft rounded-2xl shadow-2xl border-2 border-kraft-border/80 flex flex-col overflow-hidden">
        {/* Header Tape Strip */}
        <div className="pt-4 pb-3 px-4 border-b border-black/10 bg-tape-cream/90 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-2">
            <span className="text-xl" role="img" aria-label="camera">
              📸
            </span>
            <h2
              id="scan-modal-title"
              className="font-hand text-2xl font-bold text-kraft-dark tracking-wide"
            >
              Notepad To-Do Scanner
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close scanner"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center text-kraft-dark/60 hover:text-kraft-dark font-bold text-lg rounded-full hover:bg-black/5 transition-all cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 font-sans">
          {/* Status 1: Compressing or Scanning */}
          {(status === 'compressing' || status === 'scanning') && (
            <div className="py-10 px-4 text-center space-y-4">
              {previewUrl && (
                <div className="relative w-40 h-40 mx-auto rounded-xl overflow-hidden border-2 border-dashed border-kraft-dark/30 shadow-md">
                  <img
                    src={previewUrl}
                    alt="Scanned notebook"
                    className="w-full h-full object-cover filter contrast-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-amber-400/20 to-transparent animate-pulse" />
                </div>
              )}

              <div className="space-y-2">
                <div className="inline-block px-4 py-1.5 bg-tape-mustard torn-tape tape-shadow transform -rotate-1">
                  <p className="font-hand text-xl font-bold text-kraft-dark">
                    {status === 'compressing'
                      ? 'Prepping photo...'
                      : 'Deciphering handwriting & to-dos...'}
                  </p>
                </div>
                <p className="text-xs text-kraft-dark/70 font-medium">
                  {status === 'compressing'
                    ? 'Scaling for high-speed analysis...'
                    : 'Reading cursive, checkboxes & notebook lines...'}
                </p>
              </div>
            </div>
          )}

          {/* Status 2: Error or Missing API Key */}
          {status === 'error' && (
            <div className="space-y-4 py-4">
              <div className="p-4 rounded-xl bg-amber-100/70 border border-amber-300/80 text-kraft-dark space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">💡</span>
                  <p className="text-sm font-bold text-amber-950">
                    {errorCode === 'MISSING_API_KEY' || errorCode === 'INVALID_API_KEY'
                      ? 'Gemini Vision Key Needed'
                      : 'Unable to decipher notes'}
                  </p>
                </div>
                <p className="text-xs text-kraft-dark/80 leading-relaxed">
                  {errorMessage}
                </p>
              </div>

              {(errorCode === 'MISSING_API_KEY' || errorCode === 'INVALID_API_KEY') && (
                <form onSubmit={handleRetryWithKey} className="space-y-3 p-4 bg-white/70 rounded-xl border border-kraft-border/60">
                  <label htmlFor="gemini-key-input" className="block text-xs font-bold text-kraft-dark">
                    Paste your Google Gemini API Key:
                  </label>
                  <input
                    id="gemini-key-input"
                    type="password"
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full text-sm px-3 py-2 rounded-lg bg-white border border-kraft-border/80 text-kraft-dark focus:outline-none focus:ring-2 focus:ring-kraft-dark/40 shadow-inner"
                  />
                  <div className="flex items-center justify-between text-[11px] text-kraft-dark/70">
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-semibold text-amber-900 hover:text-amber-950"
                    >
                      Get a free key at Google AI Studio ↗
                    </a>
                  </div>

                  <button
                    type="submit"
                    disabled={!keyInput.trim()}
                    className="w-full min-h-[40px] px-4 py-2 rounded-lg bg-kraft-dark text-tape-cream text-xs font-bold font-sans hover:bg-kraft-dark/90 active:scale-95 disabled:opacity-40 transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>Save Key & Decipher Notepad</span>
                    <span>✨</span>
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Status 3: Review Detected Tasks */}
          {status === 'review' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-sans text-kraft-dark/80 px-1">
                <span className="font-bold">
                  {tasks.length} to-dos found on your page
                </span>
                <span className="text-[11px] text-kraft-dark/60">
                  Tap text to edit · Tap tape icon to change color
                </span>
              </div>

              <div className="space-y-2 max-h-[50vh] overflow-y-auto px-1 py-1">
                {tasks.map((task, idx) => {
                  const colorClass = COLOR_BG_MAP[task.color] || COLOR_BG_MAP['tape-cream'];
                  return (
                    <div
                      key={task.id}
                      className={`flex items-center gap-2 p-2 rounded-lg torn-tape border ${colorClass} tape-shadow transition-all ${
                        !task.selected ? 'opacity-40 grayscale-50' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={task.selected}
                        onChange={() => handleToggleTask(task.id)}
                        aria-label={`Include task ${task.title || idx + 1}`}
                        className="w-5 h-5 accent-kraft-dark rounded cursor-pointer shrink-0 ml-1"
                      />

                      {/* Color cycler button */}
                      <button
                        type="button"
                        onClick={() => handleCycleColor(task.id)}
                        title="Click to cycle tape color"
                        aria-label="Cycle tape color"
                        className="shrink-0 w-6 h-5 rounded-xs border border-black/20 shadow-xs cursor-pointer hover:scale-110 transition-transform flex items-center justify-center text-[10px]"
                      >
                        🎨
                      </button>

                      {/* Editable Task Title */}
                      <input
                        type="text"
                        value={task.title}
                        onChange={(e) => handleTitleChange(task.id, e.target.value)}
                        placeholder="Task description..."
                        disabled={!task.selected}
                        className="flex-1 min-w-0 bg-transparent border-b border-transparent hover:border-black/20 focus:border-black/40 focus:outline-none font-hand text-lg md:text-xl font-bold text-kraft-dark px-1"
                      />

                      {/* Remove button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveTask(task.id)}
                        title="Remove task"
                        aria-label="Remove task"
                        className="p-1 rounded text-kraft-dark/50 hover:text-red-700 hover:bg-black/10 transition-all shrink-0 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Add custom extra task button */}
              <button
                type="button"
                onClick={handleAddTask}
                className="w-full py-2 border border-dashed border-kraft-dark/40 rounded-lg text-xs font-bold text-kraft-dark/70 hover:text-kraft-dark hover:bg-black/5 transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>+ Add another strip</span>
              </button>
            </div>
          )}
        </div>

        {/* Modal Action Footer */}
        <div className="p-3 bg-tape-cream/90 border-t border-black/10 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-semibold text-kraft-dark/70 hover:text-kraft-dark hover:bg-black/5 transition-all cursor-pointer"
          >
            Cancel
          </button>

          {status === 'review' && (
            <button
              type="button"
              onClick={handleConfirmStick}
              disabled={selectedCount === 0}
              className="min-h-[40px] px-4 py-2 rounded-lg bg-kraft-dark text-tape-cream text-xs font-bold font-sans hover:bg-kraft-dark/90 active:scale-95 disabled:opacity-40 transition-all shadow-md cursor-pointer flex items-center gap-1.5"
            >
              <span>Stick {selectedCount} to Board</span>
              <span>✨</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
