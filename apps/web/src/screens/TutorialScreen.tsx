import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Activity, HeartPulse, MessageSquare, Users, Dumbbell, Settings, X } from 'lucide-react';
import tutorialImage from '../assets/_tutorial.png';

const TutorialScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { uid } = useParams<{ uid: string }>();
  
  const isRevisited = location.state?.revisited === true;
  const [countdown, setCountdown] = useState(isRevisited ? 0 : 33);
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  // Prevent scrolling on the body when the image is full screen
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isFullscreen]);

  return (
    <>
      <div className="h-dvh md:min-h-screen bg-slate-50 flex items-center md:items-start justify-center p-0 md:p-4 md:pt-6 overflow-hidden md:overflow-auto">
        <div className="w-full max-w-5xl h-full md:h-auto max-h-dvh bg-white md:rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden">
          
          {/* Header */}
          <div className="bg-slate-900 p-3 md:p-6 text-center shrink-0">
            <h1 className="text-xl md:text-3xl font-black text-white leading-tight">Welcome to myHealth</h1>
            <p className="text-slate-400 text-xs md:text-sm font-medium">Quick guide to your health dashboard</p>
          </div>

          {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 pb-0 md:p-10">
            {/* Removed h-full from grid on mobile to prevent unnecessary stretching */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-3 md:gap-y-10">
                
                {/* Left Column: Items 1, 2, 3 + 4 (mobile) */}
                <div className="space-y-3 md:space-y-10">
                <div className="flex gap-3 md:gap-4 items-start">
                    <div className="p-1.5 md:p-2.5 bg-indigo-50 text-indigo-600 rounded-lg md:rounded-xl shrink-0">
                    <Dumbbell className="w-4 h-4 md:w-5.5 md:h-5.5" />
                    </div>
                    <div>
                    <h3 className="font-bold text-slate-800 text-[13px] md:text-lg mb-0.5 md:mb-1">1. Log Exercise</h3>
                    <p className="text-slate-500 text-[11px] md:text-sm leading-tight md:leading-relaxed">An indicator of general health showing if you are improving or declining.</p>
                    </div>
                </div>

                <div className="flex gap-3 md:gap-4 items-start">
                    <div className="p-1.5 md:p-2.5 bg-rose-50 text-rose-600 rounded-lg md:rounded-xl shrink-0">
                    <Activity className="w-4 h-4 md:w-5.5 md:h-5.5" />
                    </div>
                    <div>
                    <h3 className="font-bold text-slate-800 text-[13px] md:text-lg mb-0.5 md:mb-1">2. Log Vital Signs</h3>
                    <p className="text-slate-500 text-[11px] md:text-sm leading-tight md:leading-relaxed">An indicator of true health. It tells you if you are at risk of an adverse health event.</p>
                    </div>
                </div>

                <div className="flex gap-3 md:gap-4 items-start">
                    <div className="p-1.5 md:p-2.5 bg-orange-50 text-orange-600 rounded-lg md:rounded-xl shrink-0">
                    <HeartPulse className="w-4 h-4 md:w-5.5 md:h-5.5" />
                    </div>
                    <div>
                    <h3 className="font-bold text-slate-800 text-[13px] md:text-lg mb-0.5 md:mb-1">3. Risk Alerts</h3>
                    <p className="text-slate-500 text-[11px] md:text-sm leading-tight md:leading-relaxed">Your profile alerts you immediately if vital signs fall out of the normal range.</p>
                    </div>
                </div>

                <div className="flex gap-3 md:gap-4 items-start">
                  <div className="p-1.5 md:p-2.5 bg-slate-100 text-slate-600 rounded-lg md:rounded-xl shrink-0">
                    {/* Use className for size to make it responsive easily */}
                    <Settings className="w-4 h-4 md:w-5.5 md:h-5.5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-[13px] md:text-lg mb-0.5 md:mb-1">
                      4. Privacy Settings
                    </h3>
                    <p className="text-slate-500 text-[11px] md:text-sm leading-tight md:leading-relaxed">
                      Modify what information is available to public and group view at any time.
                    </p>
                  </div>
              </div>
                </div>

                {/* Right Column: Items 4 (desktop), 5, 6 + Image */}
                {/* Added h-fit for mobile to prevent flex-grow gaps */}
                <div className="flex flex-col gap-3 md:gap-10 h-fit md:h-full">
            
                <div className="flex gap-3 md:gap-4 items-start">
                    <div className="p-1.5 md:p-2.5 bg-purple-50 text-purple-600 rounded-lg md:rounded-xl shrink-0">
                    <MessageSquare className="w-4 h-4 md:w-5.5 md:h-5.5" />
                    </div>
                    <div>
                    <h3 className="font-bold text-slate-800 text-[13px] md:text-lg mb-0.5 md:mb-1">5. Community Forum</h3>
                    <p className="text-slate-500 text-[11px] md:text-sm leading-tight md:leading-relaxed">Discuss health topics. Aggregated data helps us identify public health concerns.</p>
                    </div>
                </div>

                <div className="flex gap-3 md:gap-4 items-start">
                    <div className="p-1.5 md:p-2.5 bg-emerald-50 text-emerald-600 rounded-lg md:rounded-xl shrink-0">
                    <Users className="w-4 h-4 md:w-5.5 md:h-5.5" />
                    </div>
                    <div>
                    <h3 className="font-bold text-slate-800 text-[13px] md:text-lg mb-0.5 md:mb-1">6. Group Functions</h3>
                    <ul className="text-slate-500 text-[10px] md:text-xs space-y-1 mt-0.5 md:mt-1 list-disc list-inside">
                        <li>Cohort comparisons • Group chat • AI assistance</li>
                    </ul>
                    </div>
                </div>

                    {/* Dashboard Preview */}
                    <div className="mt-2 md:mt-auto pt-2 md:pt-4"> 
                    <div 
                        className="relative w-full h-64 sm:h-72 md:h-56 rounded-xl md:rounded-2xl overflow-hidden border border-slate-200 cursor-default md:cursor-zoom-in transition-transform hover:opacity-100 md:hover:opacity-90"
                        onClick={() => { if (window.innerWidth >= 768) setIsFullscreen(true); }}
                        >
                        <img 
                        src={tutorialImage} 
                        alt="Dashboard Preview" 
                        className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-linear-to-t from-slate-900/10 to-transparent pointer-events-none" />
                    </div>
                    <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5 md:mt-2 text-center">
                        Dashboard Interface Preview <span className="hidden md:inline">(Click to expand)</span>
                    </p>
                </div>
            </div>
        </div>
        {/* New Centered Button Container */}
        <div className="mt-8 md:mt-12 flex justify-center w-full pb-8">
        <button
            onClick={handleContinue}
            disabled={countdown > 0}
            className={`w-full max-w-md py-3 md:py-4 rounded-xl font-bold text-sm md:text-lg transition-all flex items-center justify-center gap-2 ${
            countdown > 0 
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xl transform hover:-translate-y-0.5'
            }`}
        >
            {countdown > 0 ? `Please Wait (${countdown}s)` : 'I Understand'}
        </button>
        </div>

        {/* Fullscreen Image Overlay - Also incorporating the previous "blur" request */}
        {isFullscreen && (
            <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-white/10 backdrop-blur-md p-4 md:p-8 cursor-zoom-out"
            onClick={() => setIsFullscreen(false)}
            >
            <button 
                className="absolute top-6 right-6 p-2 text-slate-900/70 hover:text-slate-950 hover:bg-slate-100 rounded-full transition-colors"
                onClick={(e) => {
                e.stopPropagation();
                setIsFullscreen(false);
                }}
            >
                <X size={32} />
            </button>
            
            <img 
                src={tutorialImage} 
                alt="Dashboard Preview Fullscreen" 
                className="max-w-full max-h-full object-contain rounded-xl shadow-2xl cursor-default"
                onClick={(e) => e.stopPropagation()}
            />
            </div>
        )}
        </div>
      </div>
    </div>  
    </>
  );
};

export default TutorialScreen;