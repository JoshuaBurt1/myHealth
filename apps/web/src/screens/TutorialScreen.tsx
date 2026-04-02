import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Activity, HeartPulse, MessageSquare, Users, Dumbbell, Settings, Image as ImageIcon } from 'lucide-react';

const TutorialScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { uid } = useParams<{ uid: string }>();
  
  const isRevisited = location.state?.revisited === true;
  const [countdown, setCountdown] = useState(isRevisited ? 0 : 33);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleContinue = () => {
    if (countdown === 0 && uid) {
      navigate(`/profile/${uid}`);
    } else if (countdown === 0) {
      navigate('/'); 
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-start justify-center p-0 md:p-4 md:pt-6">
      <div className="w-full max-w-5xl h-full md:h-auto bg-white md:rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="bg-slate-900 p-4 md:p-6 text-center shrink-0">
          <h1 className="text-2xl md:text-3xl font-black text-white leading-tight">Welcome to myHealth</h1>
          <p className="text-slate-400 text-sm font-medium">Quick guide to your health dashboard</p>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-10">
            
            {/* Left Column: Items 1, 2, 3 */}
            <div className="space-y-10">
              <div className="flex gap-4 items-start">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl shrink-0">
                  <Dumbbell size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg mb-1">1. Log Exercise</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">An indicator of general health showing if you are improving or declining.</p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="p-2.5 bg-orange-50 text-orange-600 rounded-xl shrink-0">
                  <Activity size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg mb-1">2. Log Vital Signs</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">An indicator of true health. It tells you if you are at risk of an adverse health event.</p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="p-2.5 bg-red-50 text-red-600 rounded-xl shrink-0">
                  <HeartPulse size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg mb-1">3. Risk Alerts</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">Your profile alerts you immediately if vital signs fall out of the normal range.</p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="p-2.5 bg-slate-100 text-slate-600 rounded-xl shrink-0">
                  <Settings size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg mb-1">4. Privacy Settings</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">Modify what information is available to public and group view at any time.</p>
                </div>
              </div>
            </div>

            {/* Right Column: Items 4, 5, 6 + Image */}
            <div className="flex flex-col gap-10">
              <div className="flex gap-4 items-start">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
                  <MessageSquare size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg mb-1">5. Community Forum</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">Discuss health topics. Aggregated data helps us identify public health concerns.</p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl shrink-0">
                  <Users size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg mb-1">6. Group Functions</h3>
                  <ul className="text-slate-500 text-xs space-y-1 mt-1 list-disc list-inside">
                    <li>Cohort comparisons • Group chat • AI assistance</li>
                  </ul>
                </div>
              </div>

              {/* Dashboard Preview - Specifically in Bottom Right */}
              <div className="mt-auto pt-4">
                <div className="w-full h-40 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400">
                  <ImageIcon size={28} className="mb-2 opacity-30" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">Interface Preview</span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col items-center shrink-0">
          <button
            onClick={handleContinue}
            disabled={countdown > 0}
            className={`w-full max-w-md py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${
              countdown > 0 
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xl transform hover:-translate-y-0.5'
            }`}
          >
            {countdown > 0 ? `Please Wait (${countdown}s)` : 'I Understand, Continue'}
          </button>
          {isRevisited && (
            <p className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Tutorial Mode • Timer Disabled
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default TutorialScreen;