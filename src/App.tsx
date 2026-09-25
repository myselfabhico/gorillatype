import { useState, useEffect, useCallback } from 'react';
import type { UserProfile, UserSettings, AppMode, TestRecord, KeystrokePoint, ThemeId, LanguageId } from './types';
import { getProfileCookie, getSettingsCookie, saveSettingsCookie, getThemeCookie, addTestRecordToProfile } from './utils/cookies';
import { Navbar } from './components/Navbar';
import { SettingsBar } from './components/SettingsBar';
import { TypingWorkspace } from './components/TypingWorkspace';
import { ResultsCard } from './components/ResultsCard';
import { ModesDrawer } from './components/ModesDrawer';
import { ThemeDrawer } from './components/ThemeDrawer';
import { LanguageModal } from './components/LanguageModal';
import { AuthModal } from './components/AuthModal';
import { TextPracticeMode } from './components/TextPracticeMode';
import { CustomMode } from './components/CustomMode';
import { GoalRing } from './components/GoalRing';
import { GoalModal } from './components/GoalModal';
import { VictoryOverlay } from './components/VictoryOverlay';
import { useDailyGoal } from './hooks/useDailyGoal';
import { soundManager } from './utils/sound';

export function App() {
  const [profile, setProfile] = useState<UserProfile>(() => getProfileCookie());
  const [settings, setSettings] = useState<UserSettings>(() => ({ ...getSettingsCookie(), theme: getThemeCookie() }));
  const [currentMode, setCurrentMode] = useState<AppMode>('typing-test');
  const [lastResult, setLastResult] = useState<TestRecord | null>(null);
  const [lastHistoryPoints, setLastHistoryPoints] = useState<KeystrokePoint[]>([]);
  const [customText, setCustomText] = useState('');
  // True while the user is in Custom Mode — either filling the custom form or
  // typing a launched custom-text test. Clicking Custom again reverts to normal.
  const [customActive, setCustomActive] = useState(false);
  const [isModesDrawerOpen, setIsModesDrawerOpen] = useState(false);
  const [isThemeDrawerOpen, setIsThemeDrawerOpen] = useState(false);
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSettingsBarOpen, setIsSettingsBarOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [backspaceLocked, setBackspaceLocked] = useState(false);
  const blocked = isModesDrawerOpen || isThemeDrawerOpen || isLanguageModalOpen || isAuthModalOpen || isGoalModalOpen;
  const testMode = customActive && customText ? 'custom' : 'typing-test';
  const testInProgress = currentMode === 'typing-test' && !lastResult;
  const dailyGoal = useDailyGoal({ testInProgress, soundEnabled: settings.websiteSfx });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  useEffect(() => {
    saveSettingsCookie(settings);
  }, [settings]);

  useEffect(() => {
    soundManager.setKeyboardSound(settings.keyboardSound);
    soundManager.setKeyboardVolume(settings.keyboardVolume);
  }, [settings.keyboardSound, settings.keyboardVolume]);

  const handleUpdateSettings = useCallback((newSettings: Partial<UserSettings>) => {
    setSettings((previous) => ({ ...previous, ...newSettings }));
  }, []);

  const handleSelectTheme = useCallback((theme: ThemeId) => handleUpdateSettings({ theme }), [handleUpdateSettings]);
  const handleSelectLanguage = useCallback((language: LanguageId) => handleUpdateSettings({ language }), [handleUpdateSettings]);

  const handleFinishTest = useCallback((record: TestRecord, historyPoints: KeystrokePoint[]) => {
    setLastResult(record);
    setLastHistoryPoints(historyPoints);
    setProfile(addTestRecordToProfile(record));
  }, []);

  const handleRestart = useCallback(() => {
    setLastResult(null);
    setLastHistoryPoints([]);
  }, []);

  const handleSelectMode = useCallback((mode: AppMode) => {
    setCustomText('');
    setCustomActive(mode === 'custom');
    setCurrentMode(mode);
    setIsModesDrawerOpen(false);
    handleRestart();
  }, [handleRestart]);

  const handleToggleCustom = useCallback(() => {
    setCustomActive((wasActive) => {
      if (wasActive) {
        // Revert: clear the custom text and go back to the normal typing test.
        setCustomText('');
        setCurrentMode('typing-test');
        handleRestart();
        return false;
      }
      setCurrentMode('custom');
      handleRestart();
      return true;
    });
  }, [handleRestart]);

  useEffect(() => {
    const handleGlobalKeys = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.repeat) return;
      if (event.key === 'Escape') {
        if (blocked || isSettingsBarOpen) {
          event.preventDefault();
          setIsModesDrawerOpen(false);
          setIsThemeDrawerOpen(false);
          setIsLanguageModalOpen(false);
          setIsAuthModalOpen(false);
          setIsSettingsBarOpen(false);
        }
        return;
      }
      if (blocked || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('textarea, select, [contenteditable="true"], input:not([aria-label="Typing input"])')) return;
      if (event.key === 'F4') {
        event.preventDefault();
        setIsThemeDrawerOpen(true);
      } else if (event.key === 'F1' && lastResult) {
        event.preventDefault();
        handleRestart();
      }
    };
    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, [blocked, isSettingsBarOpen, lastResult, handleRestart]);

  const modeTitles: Record<AppMode, string> = {
    'typing-test': 'Typing Test',
    'text-practice': 'Text Practice',
    custom: 'Custom Mode',
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-darkbg text-bodytext font-sans antialiased transition-colors duration-200">
      <div>
        <Navbar onOpenModes={() => setIsModesDrawerOpen(true)} onOpenTheme={() => setIsThemeDrawerOpen(true)} onOpenLanguage={() => setIsLanguageModalOpen(true)} onOpenAuth={() => setIsAuthModalOpen(true)} onOpenGoal={() => setIsGoalModalOpen(true)} goalActive={dailyGoal.goal !== null} goalCompleted={dailyGoal.goal?.completed === true} profile={profile} currentModeName={modeTitles[currentMode === 'typing-test' ? testMode : currentMode]} />
        <SettingsBar isOpen={isSettingsBarOpen} settings={settings} onUpdateSettings={handleUpdateSettings} onToggleCustom={handleToggleCustom} customActive={customActive} testLocked={backspaceLocked} />
        <main className="max-w-6xl mx-auto px-4 pt-4 pb-10 w-full">
          {lastResult ? (
            <ResultsCard record={lastResult} historyPoints={lastHistoryPoints} onRestart={handleRestart} />
          ) : (
            <>
              {currentMode === 'typing-test' && <TypingWorkspace settings={settings} onUpdateSettings={handleUpdateSettings} onFinishTest={handleFinishTest} onToggleSettingsBar={() => setIsSettingsBarOpen((previous) => !previous)} isSettingsOpen={isSettingsBarOpen} onOpenLanguageModal={() => setIsLanguageModalOpen(true)} customText={customText} mode={testMode} blocked={blocked} onTestActiveChange={(active) => setBackspaceLocked(active)} />}
              {currentMode === 'text-practice' && <TextPracticeMode settings={settings} />}
              {currentMode === 'custom' && <CustomMode onStartCustomTest={(text, duration) => {
                setCustomText(text.trim());
                setCustomActive(true); // stays in Custom Mode while the launched test runs
                handleUpdateSettings({ duration });
                setCurrentMode('typing-test');
                handleRestart();
              }} />}
            </>
          )}
        </main>
      </div>
      <div id="virtual-keyboard-root" className="w-full flex justify-center px-4 pb-6" />        <ModesDrawer isOpen={isModesDrawerOpen} onClose={() => setIsModesDrawerOpen(false)} currentMode={currentMode === 'typing-test' ? testMode : currentMode} onSelectMode={handleSelectMode} />
      <ThemeDrawer isOpen={isThemeDrawerOpen} onClose={() => setIsThemeDrawerOpen(false)} currentTheme={settings.theme} onSelectTheme={handleSelectTheme} />
      <LanguageModal isOpen={isLanguageModalOpen} onClose={() => setIsLanguageModalOpen(false)} currentLanguage={settings.language} onSelectLanguage={handleSelectLanguage} />
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} profile={profile} onUpdateProfile={setProfile} />
      {dailyGoal.goal && (
        <GoalRing
          goalMinutes={dailyGoal.goal.minutes}
          typedSeconds={dailyGoal.typedSeconds}
          running={dailyGoal.running}
          started={dailyGoal.started}
          completed={dailyGoal.goal.completed}
          onOpenGoal={() => setIsGoalModalOpen(true)}
        />
      )}
      {isGoalModalOpen && (
        <GoalModal
          goal={dailyGoal.goal}
          typedSeconds={dailyGoal.typedSeconds}
          onSetGoal={dailyGoal.setGoal}
          onClearGoal={dailyGoal.clearGoal}
          onClose={() => setIsGoalModalOpen(false)}
        />
      )}
      {dailyGoal.celebrating && dailyGoal.goal && (
        <VictoryOverlay goalMinutes={dailyGoal.goal.minutes} onDismiss={dailyGoal.dismissVictory} />
      )}
    </div>
  );
}

export default App;




