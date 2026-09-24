import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { X, Cookie, Award, Trash2, Check, History, Zap } from 'lucide-react';
import type { UserProfile } from '../types';
import { saveProfileCookie, DEFAULT_PROFILE } from '../utils/cookies';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onUpdateProfile: (profile: UserProfile) => void;
}

const AVATARS = ['🦍', '🏎️', '⚡', '🚀', '💻', '🎯', '👑', '🦄', '🐱', '🦊', '🐉', '🤖', '🦅', '🔥'];

export const AuthModal: FC<AuthModalProps> = ({ isOpen, ...props }) => {
  return isOpen ? <ProfileEditor {...props} /> : null;
};

const ProfileEditor: FC<Omit<AuthModalProps, 'isOpen'>> = ({ onClose, profile, onUpdateProfile }) => {
  const [username, setUsername] = useState(profile.username);
  const [selectedAvatar, setSelectedAvatar] = useState(profile.avatar);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (!savedSuccess) return;
    const timer = setTimeout(onClose, 1000);
    return () => clearTimeout(timer);
  }, [savedSuccess, onClose]);

  const handleSave = () => {
    const updated: UserProfile = { ...profile, username: username.trim() || 'GorillaTypist', avatar: selectedAvatar };
    saveProfileCookie(updated);
    onUpdateProfile(updated);
    setSavedSuccess(true);
  };

  const handleResetHistory = () => {
    if (confirm('Reset your local stats and test history?')) {
      const resetProfile: UserProfile = { ...DEFAULT_PROFILE, id: profile.id, username: profile.username, avatar: profile.avatar };
      saveProfileCookie(resetProfile);
      onUpdateProfile(resetProfile);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="profile-title" className="relative w-full max-w-xl bg-darkcard border-2 border-darkborder rounded-2xl p-6 sm:p-7 shadow-2xl z-10 text-bodytext max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-darkborder">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-accentmuted text-accent"><Cookie className="w-5 h-5" /></div>
            <div><h3 id="profile-title" className="text-lg font-bold">Local Cookie Profile</h3><p className="text-xs text-mutedtext">No login needed • Stored in this browser's cookies</p></div>
          </div>
          <button onClick={onClose} aria-label="Close profile" className="p-1.5 rounded-lg bg-darkbg hover:bg-darkborder text-mutedtext hover:text-bodytext"><X className="w-4 h-4" /></button>
        </div>
        <div className="mt-5 space-y-4">
          <div>
            <span className="text-xs font-semibold text-mutedtext uppercase tracking-wider block mb-2">Choose Avatar</span>
            <div className="flex flex-wrap gap-2">{AVATARS.map((avatar, index) => <button key={avatar} onClick={() => setSelectedAvatar(avatar)} aria-label={`Avatar ${index + 1}`} aria-pressed={selectedAvatar === avatar} className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center border transition-all ${selectedAvatar === avatar ? 'bg-accentmuted border-accent scale-110 shadow-md' : 'bg-darkbg border-darkborder hover:border-mutedtext'}`}>{avatar}</button>)}</div>
          </div>
          <div>
            <label htmlFor="profile-name" className="text-xs font-semibold text-mutedtext uppercase tracking-wider block mb-2">Nickname / Typist Tag</label>
            <div className="flex items-center gap-2">
              <input id="profile-name" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={24} className="w-full min-w-0 bg-darkbg border border-darkborder focus:border-accent rounded-xl px-4 py-2.5 text-sm font-semibold outline-none" placeholder="Enter nickname..." />
              <button onClick={handleSave} disabled={savedSuccess} className="px-5 py-2.5 bg-accent hover:bg-accenthover text-black font-extrabold rounded-xl text-xs flex items-center gap-1.5 shrink-0 shadow-md">{savedSuccess ? <Check className="w-4 h-4" /> : <Zap className="w-4 h-4" />}<span>{savedSuccess ? 'Saved!' : 'Save'}</span></button>
            </div>
          </div>
        </div>
        <div className="mt-6 pt-5 border-t border-darkborder">
          <h4 className="text-xs font-bold uppercase tracking-wider text-mutedtext mb-3 flex items-center gap-1.5"><Award className="w-4 h-4 text-accent" />Local Statistics</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              ['Personal Best', profile.bestWpm],
              ['Average WPM', profile.averageWpm],
              ['Avg Accuracy', `${profile.averageAccuracy}%`],
              ['Tests Taken', profile.testsCompleted],
            ].map(([label, value]) => <div key={label} className="p-3 bg-darkbg rounded-xl border border-darkborder text-center"><span className="text-2xl font-black font-mono text-accent block">{value}</span><span className="text-[11px] text-mutedtext font-medium">{label}</span></div>)}
          </div>
        </div>
        <div className="mt-6 pt-5 border-t border-darkborder">
          <div className="flex items-center justify-between mb-3 gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-mutedtext flex items-center gap-1.5"><History className="w-4 h-4 text-accent" />Recent Test Log ({profile.history.length})</h4>
            {profile.history.length > 0 && <button onClick={handleResetHistory} className="text-[11px] text-wrongred hover:underline flex items-center gap-1"><Trash2 className="w-3 h-3" />Clear Stats</button>}
          </div>
          <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
            {profile.history.length === 0 ? <div className="p-4 text-center text-xs text-mutedtext bg-darkbg rounded-xl border border-darkborder">No tests saved yet. Complete a test to record your stats!</div> : profile.history.slice(0, 10).map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-darkbg rounded-lg border border-darkborder text-xs">
                <div className="flex items-center gap-2"><span className="font-mono font-bold text-accent text-sm">{item.wpm} WPM</span><span className="text-mutedtext">({item.accuracy}%)</span></div>
                <div className="flex items-center gap-3 text-mutedtext text-[11px]"><span className="capitalize">{item.language}</span><span>{new Date(item.date).toLocaleDateString()}</span></div>
              </div>
            ))}
          </div>
        </div>
        <div className="pt-4 border-t border-darkborder mt-6 flex justify-end"><button onClick={onClose} className="px-5 py-2 bg-darkbg hover:bg-darkborder rounded-xl text-xs font-bold">Close</button></div>
      </div>
    </div>
  );
};
