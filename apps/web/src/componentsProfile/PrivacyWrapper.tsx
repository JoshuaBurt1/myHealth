import React from 'react';
import { X, Eye, EyeOff } from 'lucide-react';

interface PrivacyWrapperProps {
  fieldKey: string;
  isMe: boolean;
  hiddenOther: string[];
  toggleVisibilityOther: (fieldKey: string) => void;
  onDelete?: () => void;
  children: React.ReactNode;
  hideControls?: boolean; 
}

const PrivacyWrapper: React.FC<PrivacyWrapperProps> = ({ 
  fieldKey, 
  isMe, 
  hiddenOther, 
  toggleVisibilityOther, 
  onDelete, 
  children,
  hideControls = false 
}) => {
  const isHidden = hiddenOther.includes(fieldKey);

  if (!isMe && isHidden) return null;

  return (
    /* Added 'z-0' to ensure the wrapper doesn't accidentally 
       jump over a modal backdrop (usually z-40 or z-50) 
    */
    <div className={`relative group w-full transition-all duration-200 ${hideControls ? 'pt-0' : 'pt-6'} z-0`}>
      
      {/* Strictly conditional: if hideControls is true, 
          these elements are completely removed from the DOM.
      */}
      {isMe && !hideControls && (
        <div className="absolute top-0 right-1 flex gap-2 z-10 text-[10px] items-center animate-in fade-in zoom-in-95 duration-200 pointer-events-auto">
          <button
            type="button"
            onClick={(e) => { 
              e.preventDefault(); 
              e.stopPropagation();
              toggleVisibilityOther(fieldKey); 
            }}
            className={`flex items-center gap-1 font-bold hover:opacity-75 transition-colors ${
              isHidden ? 'text-slate-400' : 'text-blue-600'
            }`}
          >
            {isHidden ? <EyeOff size={10} /> : <Eye size={10} />}
            {isHidden ? 'Hidden' : 'Visible'}
          </button>
          
          {onDelete && (
            <>
              <span className="text-slate-200">|</span>
              <button
                type="button"
                onClick={(e) => { 
                  e.preventDefault(); 
                  e.stopPropagation();
                  onDelete(); 
                }}
                className="text-slate-400 hover:text-red-500 transition-colors p-0.5"
                title="Delete Field"
              >
                <X size={12} strokeWidth={3} />
              </button>
            </>
          )}
        </div>
      )}
      {children}
    </div>
  );
};

export default PrivacyWrapper;