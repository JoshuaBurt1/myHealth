// forumComponents/CreatePostModal.tsx
import React from 'react';
import { X, Plus, MapPin } from 'lucide-react';

interface Tab {
  id: string;
  icon: React.ReactNode;
  label: string;
}

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSection: string;
  modalMode: 'post' | 'poll' | 'petition';
  setModalMode: (mode: 'post' | 'poll' | 'petition') => void;
  tabs: Tab[];
  // Input States
  postTitle: string;
  setPostTitle: (val: string) => void;
  newPostContent: string;
  setNewPostContent: (val: string) => void;
  // Poll States
  pollContent: string;
  setPollContent: (val: string) => void;
  pollOptions: string[];
  setPollOptions: (options: string[]) => void;
  // Category States
  hazardType: string;
  setHazardType: (val: string) => void;
  hazardValue: string;
  setHazardValue: (val: string) => void;
  postTopic: string;
  setPostTopic: (val: string) => void;
  topicValue: string;
  setTopicValue: (val: string) => void;
  // Constants (or pass these in as props)
  HAZARD_TYPES: string[];
  TOPIC_TYPES: string[];
  // Actions
  postLocation: [number, number] | null;
  onToggleLocation: () => void;
  onCreate: () => void;
}

export const CreatePostModal = ({ 
  isOpen, 
  onClose, 
  activeSection,
  modalMode,
  setModalMode,
  tabs,
  postTitle,
  setPostTitle,
  newPostContent,
  setNewPostContent,
  pollContent,
  setPollContent,
  pollOptions,
  setPollOptions,
  hazardType,
  setHazardType,
  hazardValue,
  setHazardValue,
  postTopic,
  setPostTopic,
  topicValue,
  setTopicValue,
  HAZARD_TYPES,
  TOPIC_TYPES,
  postLocation,
  onToggleLocation,
  onCreate
}: CreatePostModalProps) => {
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white w-full max-w-md rounded-3xl p-6 relative shadow-2xl overflow-y-auto max-h-[90vh]">
        
        {/* TABS */}
        <div className="flex gap-2 mb-6 p-1 bg-slate-100 rounded-2xl">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setModalMode(tab.id as 'post' | 'poll' | 'petition')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-bold transition-all ${
                modalMode === tab.id ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {/* TITLE INPUT */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Title</label>
            <input 
              autoFocus
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-indigo-500 font-bold text-slate-800 text-lg"
              placeholder={modalMode === 'petition' ? "Petition Title" : modalMode === 'poll' ? "Poll Topic" : "Post Title"}
              value={postTitle}
              onChange={(e) => setPostTitle(e.target.value)}
            />
          </div>

          {/* POLL MODE CONTENT */}
          {modalMode === 'poll' ? (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Content</label>
                <input 
                  className="w-full bg-indigo-50/30 border border-slate-200 p-4 rounded-2xl outline-none focus:border-indigo-500 font-normal text-slate-600"
                  placeholder="Ask a question..."
                  value={pollContent}
                  onChange={(e) => setPollContent(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                {pollOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2 group">
                    <input 
                      className="flex-1 border border-slate-200 p-3 rounded-xl outline-none focus:border-indigo-500 text-sm font-normal text-slate-600 bg-white"
                      placeholder={`Option ${i + 1}`}
                      value={opt}
                      onChange={(e) => {
                        const newOpts = [...pollOptions];
                        newOpts[i] = e.target.value;
                        setPollOptions(newOpts);
                      }}
                    />
                    {pollOptions.length > 2 && (
                      <button 
                        onClick={() => setPollOptions(pollOptions.filter((_, index) => index !== i))}
                        className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <X size={18} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {pollOptions.length < 5 && (
                <button 
                  onClick={() => setPollOptions([...pollOptions, ''])} 
                  className="text-indigo-600 text-xs font-bold flex items-center gap-1 mt-1"
                >
                  <Plus size={14} /> Add Option
                </button>
              )}
            </div>
          ) : (
            /* STANDARD POST / PETITION CONTENT */
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Content</label>
              <textarea 
                className="w-full border border-slate-200 bg-slate-50 rounded-xl p-3 outline-none min-h-32 resize-none font-normal text-slate-600 leading-relaxed"
                placeholder={modalMode === 'petition' ? "Describe the goal..." : "What's on your mind?"}
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
              />
            </div>
          )}

          {/* DYNAMIC SECTION INPUTS */}
          {activeSection === 'Population Health' && (
            <div className="space-y-1 animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Hazard Reporting</label>
              <div className="flex flex-col gap-2 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                <select 
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-600"
                  value={hazardType}
                  onChange={(e) => setHazardType(e.target.value)}
                >
                  <option value="">Select hazard type...</option>
                  {HAZARD_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                </select>
                <input 
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-600"
                  placeholder="Specific details..."
                  value={hazardValue}
                  onChange={(e) => setHazardValue(e.target.value)}
                />
              </div>
            </div>
          )}

          {activeSection === 'Personal Health' && (
            <div className="space-y-1 animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Topic Category</label>
                <div className="flex flex-col gap-2 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                <select 
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-600 outline-none focus:border-indigo-500 capitalize"
                value={postTopic}
                onChange={(e) => setPostTopic(e.target.value)}
                >
                <option value="">Select a topic...</option>
                {TOPIC_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                </select>
                <input 
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-600"
                    placeholder="Specific details..."
                    value={topicValue}
                    onChange={(e) => setTopicValue(e.target.value)}
                />
                </div>
            </div>
          )}

          {/* LOCATION ATTACHMENT */}
          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-3">
            <div className="flex items-center gap-2 text-sm text-slate-600 font-bold">
              <MapPin size={18} className={postLocation ? "text-emerald-500" : "text-slate-400"} />
              {postLocation ? "Location Attached" : "Attach Location"}
            </div>
            <button 
              onClick={onToggleLocation}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold ${postLocation ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}
            >
              {postLocation ? "Remove" : "Add"}
            </button>
          </div>
        </div>

        {/* FOOTER BUTTONS */}
        <div className="flex gap-3 mt-8">
          <button onClick={onClose} className="flex-1 py-3 text-slate-500 bg-slate-100 rounded-xl font-bold">Cancel</button>
          <button onClick={onCreate} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700">
            Publish
          </button>
        </div>
      </div>
    </div>
  );
};