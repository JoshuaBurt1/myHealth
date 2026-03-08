import React from 'react';
import { X } from 'lucide-react';

interface PrivacyWrapperProps {
  fieldKey: string;
  isMe: boolean;
  hiddenOther: string[];
  toggleVisibilityOther: (fieldKey: string) => void;
  onDelete?: () => void;
  children: React.ReactNode;
}

const PrivacyWrapper: React.FC<PrivacyWrapperProps> = ({ 
  fieldKey, 
  isMe, 
  hiddenOther, 
  toggleVisibilityOther, 
  onDelete, 
  children 
}) => {
  const isHidden = hiddenOther.includes(fieldKey);

  // If we are viewing someone else's profile and they've hidden this field, return null
  if (!isMe && isHidden) return null;

  return (
    <div className="relative group pt-6 w-full">
      {isMe && (
        <div className="absolute top-0 right-1 flex gap-2 z-10 text-[10px] items-center">
          <button
            onClick={(e) => { 
              e.preventDefault(); 
              toggleVisibilityOther(fieldKey); 
            }}
            className={`font-semibold hover:opacity-75 transition-colors ${
              isHidden ? 'text-slate-400 line-through' : 'text-blue-600'
            }`}
          >
            {isHidden ? 'Hidden (Other)' : 'Vis (Other)'}
          </button>
          
          {onDelete && (
            <>
              <span className="text-slate-200">|</span>
              <button
                onClick={(e) => { 
                  e.preventDefault(); 
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