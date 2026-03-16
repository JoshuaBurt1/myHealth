import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, serverTimestamp, arrayUnion, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { RefreshCw, Footprints } from 'lucide-react';

interface HealthSyncSectionProps {
  userId: string;
  isMe: boolean;
  steps: number; 
  lastSynced: Date | null;
  onSyncComplete: (newSteps: number, syncTime: Date, earnedGems: number) => void;
}

export const HealthSyncSection: React.FC<HealthSyncSectionProps> = ({ 
  userId, 
  isMe, 
  steps: initialSteps, 
  lastSynced: initialLastSynced,
  onSyncComplete
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [localSteps, setLocalSteps] = useState(initialSteps);
  const [localLastSynced, setLocalLastSynced] = useState<Date | null>(initialLastSynced);

  useEffect(() => {
    setLocalSteps(initialSteps);
    setLocalLastSynced(initialLastSynced);
  }, [initialSteps, initialLastSynced]);

  useEffect(() => {
    const handleNativeMessage = async (event: any) => {
      let data = event.data;
      try {
        if (typeof data === 'string') data = JSON.parse(data);
      } catch (e) { return; }

      if (data.type === 'HEALTH_CONNECT_RESULT') {
        const { payload } = data;
        const now = new Date();   
        setIsSyncing(false);

        if (payload.error) {
          console.error("Sync Error:", payload.error);
          return;
        }

        if (userId && (payload.today?.steps >= 0 || payload.yesterday?.steps >= 0 || payload.hr > 0)) {
          const profileDataRef = doc(db, 'users', userId, 'profile', 'user_data');
          const userRootRef = doc(db, 'users', userId);

          try {
            const profileSnap = await getDoc(profileDataRef);
            const profileData = profileSnap.exists() ? profileSnap.data() : {};
            
            const profileUpdates: any = {};
            let stepsArray = Array.isArray(profileData.steps) ? [...profileData.steps] : [];
            let stepRewards = profileData.stepRewards || {}; 
            let totalNewGems = 0;

            const processDayData = (dayData: { date: string, steps: number } | undefined) => {
                if (!dayData || dayData.steps < 0) return;

                // FIX: Match exact local date first. Fallback to includes for legacy data.
                const index = stepsArray.findIndex((entry: any) => 
                    (entry.date && entry.date === dayData.date) || 
                    (!entry.date && entry.dateTime && entry.dateTime.includes(dayData.date))
                );

                const isToday = dayData.date === payload.today?.date;
                const logTime = isToday ? new Date().toISOString() : `${dayData.date}T23:59:59.000Z`;

                if (index >= 0) {
                    // FIX: Overwrite unconditionally to correct the timezone lock bug.
                    // Add `date: dayData.date` explicitly for future lookups.
                    stepsArray[index] = {
                        date: dayData.date, 
                        value: String(dayData.steps),
                        dateTime: logTime
                    };
                } else {
                    stepsArray.push({ 
                        date: dayData.date, 
                        value: String(dayData.steps), 
                        dateTime: logTime 
                    });
                }

                const alreadyRewarded = stepRewards[dayData.date] || 0;
                const unrewardedSteps = dayData.steps - alreadyRewarded;

                if (unrewardedSteps >= 100) {
                    const earnedGems = Math.floor(unrewardedSteps / 100);
                    totalNewGems += earnedGems;
                    stepRewards[dayData.date] = alreadyRewarded + (earnedGems * 100);
                }
            };

            if (payload.yesterday) processDayData(payload.yesterday);
            if (payload.today) processDayData(payload.today);

            profileUpdates.steps = stepsArray; 
            profileUpdates.stepRewards = stepRewards;

            const newStepCount = payload.today?.steps || 0;
            setLocalSteps(newStepCount);
            setLocalLastSynced(now);
            
            onSyncComplete(newStepCount, now, totalNewGems);

            if (payload.hr > 0) {
              profileUpdates.hr = arrayUnion({ value: String(payload.hr), dateTime: new Date().toISOString() });
            }

            const rootUpdates: any = {
              daily_steps: payload.today?.steps || 0,
              last_step_update: serverTimestamp()
            };

            if (totalNewGems > 0) {
              rootUpdates.gems = increment(totalNewGems);
            }

            await setDoc(profileDataRef, profileUpdates, { merge: true });
            await setDoc(userRootRef, rootUpdates, { merge: true });

            if (totalNewGems > 0) {
              alert(`Sync successful! You earned ${totalNewGems} gems! 💎`);
            }
          } catch (err) {
            console.error("Firestore Write Error:", err);
          }
        }
      }
    };

    window.addEventListener('message', handleNativeMessage);
    document.addEventListener('message', handleNativeMessage);
    return () => {
      window.removeEventListener('message', handleNativeMessage);
      document.removeEventListener('message', handleNativeMessage);
    };
  }, [userId, onSyncComplete]);

  const syncWithGoogleFit = () => {
    setIsSyncing(true);
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SYNC_HEALTH_CONNECT' }));
    } else {
      setIsSyncing(false);
      alert("Health Connect sync is only available on the mobile app.");
    }
  };

  if (!isMe) return null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-orange-50/60 p-3 rounded-2xl border border-orange-100 gap-3">
        <div className="flex items-center gap-3">
            <div className="bg-orange-100 p-2.5 rounded-xl">
            <Footprints className="text-orange-500" size={20} />
            </div>
            <div>
            <h4 className="text-lg font-black text-slate-800 leading-none mb-1">{localSteps.toLocaleString()}</h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Steps</p>
            </div>
        </div>

        <div className="flex flex-col sm:items-end">
            <button 
            onClick={syncWithGoogleFit}
            disabled={isSyncing}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
                isSyncing 
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                : 'bg-white text-indigo-600 hover:bg-indigo-50 border border-indigo-100 active:scale-95'
            }`}
            >
            <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
            {isSyncing ? 'Syncing...' : 'Sync Fit'}
            </button>
            {localLastSynced && (
            <span className="mt-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                Synced: {localLastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            )}
        </div>
    </div>
  );
};