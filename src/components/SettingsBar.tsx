import type { ChangeEvent, FC } from 'react';
import { Volume2, VolumeX, Eye, EyeOff, BarChart2, Edit3, SlidersHorizontal, MousePointer, KeyboardMusic, Delete } from 'lucide-react';
import type { UserSettings, KeyboardSoundId, FontSize } from '../types';
import { KEYBOARD_SOUND_OPTIONS, soundManager } from '../utils/sound';

interface SettingsBarProps {
  isOpen: boolean;
  settings: UserSettings;
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
  /** Toggles Custom Mode: enters it when off, reverts to the normal typing test when on. */
  onToggleCustom?: () => void;
  /** True while the app is in Custom Mode (form open or a custom-text test running). */
  customActive?: boolean;
  /** True while a typing test is running — the Backspace toggle cannot be changed mid-test. */
  testLocked?: boolean;
}

export const SettingsBar: FC<SettingsBarProps> = ({ isOpen, settings, onUpdateSettings, onToggleCustom, customActive = false, testLocked = false }) => {
  if (!isOpen) return null;
  const fontSizes: FontSize[] = ['xs', 'sm', 'md', 'lg', 'xl'];
  const durations = [15, 30, 60, 120, 180, 240, 300, 420, 600, 1200, 1800];
  const pillClass = (active: boolean) => `px-2.5 py-1 rounded text-xs font-medium transition-all ${active ? 'bg-accent text-black font-bold shadow-sm' : 'text-mutedtext hover:text-bodytext hover:bg-darkborder'}`;
  const toggleClass = (active: boolean) => `p-1.5 rounded-lg border text-xs font-medium flex items-center gap-1 transition-all ${active ? 'bg-accentmuted border-accent text-accent' : 'bg-darkbg border-darkborder text-mutedtext hover:text-bodytext'}`;

  const handleSoundChange = (id: KeyboardSoundId) => {
    soundManager.setKeyboardSound(id);
    onUpdateSettings({ keyboardSound: id });
    if (id !== 'mute') soundManager.playKey();
  };

  const handleVolumeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const volume = Number(event.target.value) / 100;
    onUpdateSettings({ keyboardVolume: volume });
    if (settings.keyboardSound !== 'mute') {
      soundManager.setKeyboardVolume(volume);
      soundManager.playKey();
    }
  };

  return (
    <div className="w-full bg-darkcard border-y border-darkborder py-3.5 px-4 mb-5 transition-all animate-fade-in shadow-inner">
      <div className="max-w-6xl mx-auto flex flex-col gap-3.5 text-xs text-bodytext">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-darkborder">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-mutedtext font-semibold uppercase tracking-wider text-[11px] flex items-center gap-1"><SlidersHorizontal className="w-3.5 h-3.5 text-accent" />Keyboard Shortcuts:</span>
            <div className="flex items-center gap-2 flex-wrap">{[['F1', 'Restart'], ['F2', 'Timer'], ['F3', 'Difficulty'], ['F4', 'Theme'], ['Tab', 'Quick Focus']].map(([key, label]) => <span key={key} className="flex items-center gap-1.5"><kbd className="px-2 py-0.5 bg-darkbg border border-darkborder rounded text-accent font-mono font-bold text-[11px] shadow-sm">{key}</kbd><span className="text-mutedtext text-[11px]">{label}</span></span>)}</div>
          </div>
          <span className="text-[11px] text-mutedtext italic hidden md:inline">Saved automatically in cookies</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-mutedtext font-medium flex items-center gap-1"><KeyboardMusic className="w-3.5 h-3.5 text-accent" />Keyboard sounds:</span>
            <div className="flex flex-wrap items-center gap-1 bg-darkbg p-1 rounded-lg border border-darkborder">{KEYBOARD_SOUND_OPTIONS.map((option) => <button key={option.id} onClick={() => handleSoundChange(option.id)} aria-pressed={settings.keyboardSound === option.id} className={pillClass(settings.keyboardSound === option.id)} title={`Keyboard sound: ${option.label}`}>{option.label}</button>)}</div>
            <input type="range" min={0} max={100} step={5} value={Math.round(settings.keyboardVolume * 100)} onChange={handleVolumeChange} style={{ accentColor: 'var(--color-accent)' }} className="w-24 cursor-pointer" aria-label="Keyboard sounds volume" title="Keyboard sounds volume" />
            <span className="font-mono text-[11px] text-mutedtext w-9 text-right" aria-hidden="true">{Math.round(settings.keyboardVolume * 100)}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-mutedtext font-medium">Font Size:</span>
            <div className="flex items-center gap-1 bg-darkbg p-1 rounded-lg border border-darkborder">{fontSizes.map((size) => <button key={size} onClick={() => onUpdateSettings({ fontSize: size })} aria-pressed={settings.fontSize === size} className={`${pillClass(settings.fontSize === size)} uppercase`} title={`Text size ${size}`}>{size}</button>)}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-mutedtext font-medium">Test Time (mins):</span>
            <div className="flex items-center gap-1 bg-darkbg p-1 rounded-lg border border-darkborder flex-wrap">{durations.map((duration) => <button key={duration} onClick={() => onUpdateSettings({ duration })} aria-pressed={settings.duration === duration} className={`${pillClass(settings.duration === duration)} font-mono`} title={`${duration} seconds duration`}>{duration / 60}</button>)}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-mutedtext font-medium">Backspace:</span>
            <button
              onClick={() => { if (!testLocked) onUpdateSettings({ backspaceEnabled: !settings.backspaceEnabled }); }}
              aria-pressed={settings.backspaceEnabled}
              aria-disabled={testLocked}
              className={`${toggleClass(settings.backspaceEnabled)} ${testLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={testLocked ? 'Backspace setting is locked while a test is running' : settings.backspaceEnabled ? 'Backspace is enabled — click to disable fixing mistakes' : 'Backspace is disabled — mistakes cannot be erased'}
            >
              <Delete className="w-4 h-4" />{settings.backspaceEnabled ? 'On' : 'Off'}
            </button>
            {testLocked && <span className="text-[11px] text-mutedtext italic" title="The Backspace setting cannot change while a test is running">locked during test</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-mutedtext font-medium">Website SFX:</span>
            <button onClick={() => onUpdateSettings({ websiteSfx: !settings.websiteSfx })} aria-pressed={settings.websiteSfx} className={toggleClass(settings.websiteSfx)} title="Website sounds: UI clicks, word correct/incorrect chimes, test finish and goal victory">{settings.websiteSfx ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}{settings.websiteSfx ? 'On' : 'Off'}</button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-mutedtext font-medium">Display:</span>
            <button onClick={() => onUpdateSettings({ showChart: !settings.showChart })} aria-pressed={settings.showChart} className={toggleClass(settings.showChart)} title="Toggle Performance Chart"><BarChart2 className="w-4 h-4" />Chart</button>
            <button onClick={() => onUpdateSettings({ showTimer: !settings.showTimer })} aria-pressed={settings.showTimer} className={toggleClass(settings.showTimer)} title="Toggle Countdown Timer Visibility">{settings.showTimer ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}Timer</button>
            <button onClick={() => onUpdateSettings({ showCaret: !settings.showCaret })} aria-pressed={settings.showCaret} className={toggleClass(settings.showCaret)} title="Toggle Caret"><MousePointer className="w-4 h-4" />Caret</button>
            {onToggleCustom && <button onClick={onToggleCustom} aria-pressed={customActive} className={toggleClass(customActive)} title={customActive ? 'Custom Mode is active — click to revert to the normal typing test' : 'Switch to Custom Mode: type your own text'}><Edit3 className="w-4 h-4" />Custom</button>}
          </div>
        </div>
      </div>
    </div>
  );
};
