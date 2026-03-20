// PostCard.tsx
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  doc, updateDoc, arrayRemove, arrayUnion, deleteDoc, 
  getDoc, addDoc, collection, serverTimestamp, increment, runTransaction, Timestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useLocation } from '../context/LocationContext';
import { PostReplies } from './PostReplies';
import type { Post } from './forum';
import { User, Trash2, MapPin, Edit3, ThumbsUp, ThumbsDown, Plus, X, CheckCircle } from 'lucide-react';
import { HAZARD_COLORS, HELP_COLORS, PUBLIC_COLORS, TOPIC_COLORS } from './forumConstants';

interface PostCardProps {
  post: Post;
}

export const PostCard: React.FC<PostCardProps> = ({ post }) => {
  const [authorImageId, setAuthorImageId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null); 
  const [rootReplyLocation, setRootReplyLocation] = useState<[number, number] | null>(null);
  
  // Collapse State
  const [isPostVisible, setIsPostVisible] = useState(false);
  
  // Confirm Modal State
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmOption, setConfirmOption] = useState<'post' | 'current' | 'custom'>('post');
  const [customLat, setCustomLat] = useState('');
  const [customLng, setCustomLng] = useState('');

  const { userLocation } = useLocation();
  const navigate = useNavigate();
  const user = auth.currentUser;

  const userId = user?.uid || '';
  const isAuthor = userId === post.authorId;
  const hasLiked = post.likes?.includes(userId);
  const hasDisliked = post.dislikes?.includes(userId);

  // --- SAFE ACCESSORS FOR UNION TYPES ---
  const signatures = post.type === 'petition' ? post.signatures || [] : [];
  const hasSigned = signatures.includes(userId);
  
  const confirms = post.type === 'post' ? post.confirm || [] : [];
  const hasConfirmed = confirms.some(c => c.userId === userId);
  
  const userVotes = post.type === 'poll' ? post.userVotes || {} : {};
  const userSelectedOption = userVotes[userId];
  
  const options = post.type === 'poll' ? post.options || [] : [];
  const totalVotes = options.reduce((acc, curr) => acc + curr.votes, 0);

  useEffect(() => {
    const fetchAuthorImage = async () => {
      try {
        // Fetch the specific post author's image data
        const imgDocRef = doc(db, 'users', post.authorId, 'profile', 'image_data');
        const imgSnap = await getDoc(imgDocRef);
        if (imgSnap.exists()) {
          setAuthorImageId(imgSnap.data().imageId);
        }
      } catch (err) {
        console.error("Failed to fetch image for user:", post.authorId);
      }
    };

    if (post.authorId) {
      fetchAuthorImage();
    }
  }, [post.authorId]);

  const formatHelpDate = (ts: any) => {
    if (!ts) return null;
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleString([], { 
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    });
  };

  const renderTextWithLinks = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    
    return parts.map((part, i) => 
      urlRegex.test(part) ? (
        <a 
          key={i} 
          href={part} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-indigo-600 hover:underline break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      ) : part
    );
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Delete this entire post?")) {
      await deleteDoc(doc(db, 'myHealth_posts', post.id));
    }
  };

  const handleConfirmToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return alert("Please log in to confirm!");
    if (post.type !== 'post') return;

    if (hasConfirmed) {
      try {
        const postRef = doc(db, 'myHealth_posts', post.id);
        await runTransaction(db, async (transaction) => {
          const postDoc = await transaction.get(postRef);
          if (!postDoc.exists()) throw new Error("Post missing");
          const currentConfirms = postDoc.data().confirm || [];
          const updatedConfirms = currentConfirms.filter((c: any) => c.userId !== user.uid);
          transaction.update(postRef, { confirm: updatedConfirms });
        });
      } catch (err) {
        console.error("Remove confirm failed:", err);
      }
    } else {
      setConfirmOption(post.location ? 'post' : (userLocation ? 'current' : 'custom'));
      setIsConfirmModalOpen(true);
    }
  };

  const handleConfirmSubmit = async () => {
    if (!user || post.type !== 'post') return;
    let locToSave: [number, number] | null = null;

    if (confirmOption === 'post' && post.location) {
      locToSave = post.location;
    } else if (confirmOption === 'current' && userLocation) {
      locToSave = userLocation;
    } else if (confirmOption === 'custom') {
      const lat = parseFloat(customLat);
      const lng = parseFloat(customLng);
      if (!isNaN(lat) && !isNaN(lng)) locToSave = [lat, lng];
    }

    if (!locToSave) return alert("Please provide a valid location to confirm.");

    try {
      const postRef = doc(db, 'myHealth_posts', post.id);
      const newConfirm = { 
        userId: user.uid, 
        location: locToSave,
        confirmTime: Timestamp.now()
      };      
      await updateDoc(postRef, {
        confirm: arrayUnion(newConfirm),
        lastUpdated: serverTimestamp() 
      });
      
      setIsConfirmModalOpen(false);
      setCustomLat('');
      setCustomLng('');
    } catch (err) {
      console.error("Submit confirm failed:", err);
    }
  };

  const handleReaction = async (e: React.MouseEvent, reactionType: 'like' | 'dislike') => {
    e.stopPropagation();
    if (!user) return alert("Please log in!");
    const postRef = doc(db, 'myHealth_posts', post.id);

    const likes = post.likes || [];
    const dislikes = post.dislikes || [];
    
    try {
      if (reactionType === 'like') {
        if (hasLiked) {
          await updateDoc(postRef, { likes: arrayRemove(user.uid) });
        } else {
          await updateDoc(postRef, { 
            likes: arrayUnion(user.uid),
            dislikes: hasDisliked ? arrayRemove(user.uid) : dislikes
          });
        }
      } else {
        if (hasDisliked) {
          await updateDoc(postRef, { dislikes: arrayRemove(user.uid) });
        } else {
          await updateDoc(postRef, { 
            dislikes: arrayUnion(user.uid),
            likes: hasLiked ? arrayRemove(user.uid) : likes
          });
        }
      }
    } catch (err) {
      console.error("Reaction failed:", err);
    }
  };

  const handleVote = async (e: React.MouseEvent, optionIndex: number) => {
    e.stopPropagation();
    if (!user || post.type !== 'poll') return alert("Please log in to participate!");
    const postRef = doc(db, 'myHealth_posts', post.id);

    try {
      await runTransaction(db, async (transaction) => {
        const postDoc = await transaction.get(postRef);
        if (!postDoc.exists()) throw "Post missing";

        const postData = postDoc.data() as any; 
        const currentVotes = postData.userVotes || {};
        const previousVoteIndex = currentVotes[user.uid];

        if (previousVoteIndex === optionIndex) return; 

        const updatedOptions = [...(postData.options || [])];

        if (previousVoteIndex !== undefined && updatedOptions[previousVoteIndex]) {
          updatedOptions[previousVoteIndex] = {
            ...updatedOptions[previousVoteIndex],
            votes: Math.max(0, updatedOptions[previousVoteIndex].votes - 1)
          };
        }

        if (updatedOptions[optionIndex]) {
          updatedOptions[optionIndex] = {
            ...updatedOptions[optionIndex],
            votes: (updatedOptions[optionIndex].votes || 0) + 1
          };
        }

        transaction.update(postRef, {
          options: updatedOptions,
          [`userVotes.${user.uid}`]: optionIndex
        });
      });
    } catch (err) {
      console.error("Vote Transaction failed:", err);
    }
  };

  const handleSignPetition = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || post.type !== 'petition') return alert("Please log in to sign!");
    const postRef = doc(db, 'myHealth_posts', post.id);
    
    try {
      if (hasSigned) {
        await updateDoc(postRef, { signatures: arrayRemove(user.uid) }); 
      } else {
        await updateDoc(postRef, { signatures: arrayUnion(user.uid) });
      }
    } catch (err) {
      console.error("Signature failed:", err);
    }
  };

  const handleToggleRootReplyLocation = () => {
    if (rootReplyLocation) {
      setRootReplyLocation(null);
    } else {
      if (!userLocation) return alert("Location not available. Check permissions.");
      setRootReplyLocation(userLocation);
    }
  };

  const handleAddRootReply = async () => {
    if (!user) return alert("Please log in!");
    if (!replyContent.trim()) return;

    try {
      const profileRef = doc(db, 'users', user.uid, 'profile', 'user_data');
      const profileSnap = await getDoc(profileRef);
      const realName = profileSnap.exists() ? profileSnap.data().name : "Anonymous";

      const replyData: any = {
        content: replyContent,
        authorId: user.uid,
        authorName: realName,
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        parentId: post.id,
        rootPostId: post.id,
        level: 0,
        likes: [],
        dislikes: []
      };

      if (rootReplyLocation) {
        replyData.location = rootReplyLocation;
      }

      await addDoc(collection(db, 'myHealth_posts', post.id, 'myHealth_replies'), replyData);

      await updateDoc(doc(db, 'myHealth_posts', post.id), {
        replyCount: increment(1),
        lastUpdated: serverTimestamp() 
      });

      setIsExpanded(true);
      setReplyContent('');
      setRootReplyLocation(null);
      setIsReplying(false);
    } catch (err) {
      console.error("Error adding reply: ", err);
    }
  };

  const toggleReplies = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [replyContent]);

  return (
    <>
      <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-100 shadow-sm flex flex-col transition-all hover:border-indigo-200">
        
        {/* LIGHT GREY HEADER (COLLAPSED VIEW) */}
        <div 
          className={`bg-slate-50 p-2 sm:p-3 cursor-pointer hover:bg-slate-100 transition-colors flex items-center gap-2 sm:gap-3 ${isPostVisible ? 'border-b border-slate-200 rounded-t-xl sm:rounded-t-2xl' : 'rounded-xl sm:rounded-2xl'}`}
          onClick={() => setIsPostVisible(!isPostVisible)}
        >
          {/* Clickable User Avatar */}
          <div 
            className="w-10 h-10 sm:w-10 sm:h-10 bg-indigo-100 border border-slate-200 rounded-full flex items-center justify-center text-indigo-600 shrink-0 shadow-sm hover:ring-2 ring-indigo-300 transition-all z-10 overflow-hidden"
            onClick={(e) => { e.stopPropagation(); navigate(`/profile/${post.authorId}`); }}
            title="View Profile"
          >
            {authorImageId ? (
              <img 
                src={authorImageId} 
                alt={post.authorName} 
                className="w-full h-full object-cover"
              />
            ) : (
              <User size={20} className="sm:w-5 sm:h-5" />
            )}
          </div>

          <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5 sm:gap-1">
            {/* Top Line: Meta Data & Actions */}
            <div className="flex items-center justify-between gap-2 w-full">
              <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-slate-500 overflow-hidden whitespace-nowrap">
                {/* User Name & Date */}
                <span className="font-bold text-slate-400">By </span>
                <button 
                  onClick={() => navigate(`/profile/${post.authorId}`)} 
                  className="font-bold text-indigo-400 hover:text-indigo-600 hover:underline transition-all truncate max-w-35 sm:max-w-none"
                >{post.authorName}
                </button>
                <span className="shrink-0">• {post.createdAt?.seconds ? new Date(post.createdAt.seconds * 1000).toLocaleDateString() : ''}</span>
                
                {/* Badges moved to Header */}
                {post.hazard && (
                  <div className="flex items-center gap-1 shrink-0">
                    <span 
                      style={{ 
                        backgroundColor: `${HAZARD_COLORS[post.hazard.type] || '#94a3b8'}15`, 
                        color: HAZARD_COLORS[post.hazard.type] || '#94a3b8' 
                      }}
                      className="text-[clamp(0.6rem,2vw,0.7rem)] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                    >
                      • ⚠️ {post.hazard.type}
                    </span>
                    <span className="text-[clamp(0.6rem,2vw,0.7rem)] font-medium opacity-80 truncate max-w-15 sm:max-w-none">
                      {post.hazard.value}
                    </span>
                  </div>
                )}

                {post.help && (
                    <div className="flex flex-col gap-0.5 sm:gap-1">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span 
                          style={{ backgroundColor: `${HELP_COLORS[post.help.type] || '#94a3b8'}15`, color: HELP_COLORS[post.help.type] || '#94a3b8' }}
                          className="text-[clamp(0.6rem,2vw,0.7rem)] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                        >
                          🤝 {post.help.type}
                        </span>
                        <span className="text-[clamp(0.6rem,2vw,0.7rem)] font-medium opacity-80 truncate max-w-15 sm:max-w-none">
                          {post.help.value}
                        </span>
                      </div>
                      {(post.helpStartDate || post.helpEndDate) && (
                        <span className="text-[10px] sm:text-xs font-medium text-slate-500 mt-0.5 flex items-center gap-1">
                          🕒 {formatHelpDate(post.helpStartDate) || 'Now'} {' - '} {formatHelpDate(post.helpEndDate) || 'TBD'}
                        </span>
                      )}
                    </div>
                  )}
                
                  {post.public && (
                      <>
                        <span 
                          style={{ backgroundColor: `${PUBLIC_COLORS[post.public.type] || '#94a3b8'}15`, color: PUBLIC_COLORS[post.public.type] || '#94a3b8' }}
                          className="text-[clamp(0.6rem,2vw,0.7rem)] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                        >
                          📍 {post.public.type} 
                        </span>
                        <span className="text-[clamp(0.6rem,2vw,0.7rem)] font-medium opacity-80 truncate max-w-15 sm:max-w-none">
                          {post.public.value} 
                        </span>
                      </>
                    )}
                {post.topic && (
                  <>
                  <span 
                    style={{ backgroundColor: `${TOPIC_COLORS[post.topic] || '#94a3b8'}15`, color: TOPIC_COLORS[post.topic] || '#94a3b8' }}
                    className="text-[clamp(0.6rem,2vw,0.7rem)] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                  >
                    📌 {post.topic} 
                  </span>
                  </>
                )}
                {/* Map Pin Indicator */}
                {post.location && (
                  <div 
                    className="flex items-center justify-center bg-emerald-50 border border-emerald-200 rounded-full w-5 h-5 sm:w-6 sm:h-6 ml-1"
                    title="Location Attached"
                  >
                    <MapPin 
                      size={12} 
                      className="text-emerald-600 fill-emerald-600/20 shrink-0" 
                    />
                  </div>
                )}
              </div>

              {/* Actions: Confirm / Trash */}
              <div className="flex items-center gap-1.5 shrink-0 pl-1">
                {post.forumSection === 'Population Health' && post.type === 'post' && post.hazard && (
                  <button
                    onClick={handleConfirmToggle}
                    className={`flex items-center gap-1 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-lg text-[9px] sm:text-[10px] font-bold transition-all duration-200 whitespace-nowrap border-2 group active:scale-95 ${
                      hasConfirmed 
                        ? 'bg-emerald-500 text-white border-emerald-400 shadow-[0_4px_12px_-2px_rgba(16,185,129,0.4)] hover:bg-emerald-600 hover:shadow-[0_6px_16px_-2px_rgba(16,185,129,0.5)]' 
                        : 'bg-slate-200 text-slate-600 border-transparent hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700 hover:shadow-md hover:-translate-y-0.5'
                    }`}
                  >
                    <CheckCircle 
                      size={10} 
                      className={`shrink-0 transition-transform duration-200 ${!hasConfirmed && 'group-hover:scale-110 group-hover:rotate-12'}`} 
                    />
                    <span className="hidden sm:inline">{hasConfirmed ? 'Confirmed' : 'Confirm'}</span>
                    {confirms.length > 0 && <span className="ml-0.5">{confirms.length}</span>}
                  </button>
                )}
              </div>
            </div>

            {/* Bottom Line: Title */}
            <div className="flex items-center justify-between gap-3 w-full">
              <h2 className="text-sm sm:text-base font-semibold text-gray-900 truncate">
                {post.title}
              </h2>

              <div className="flex items-center gap-2 shrink-0">
                {!isPostVisible && (
                  <span className="text-[10px] text-slate-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity hidden sm:inline">
                    Click to expand
                  </span>
                )}
                {isAuthor && (
                  <button onClick={handleDelete} className="text-slate-300 hover:text-red-500 transition-colors p-1"
                    title="Delete Post"
                  >
                    <Trash2 size={16} className="sm:w-4.5 sm:h-4.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* WHITE CONTENT AREA (EXPANDED VIEW) */}
        {isPostVisible && (
          <div className="p-3 sm:p-5 bg-white rounded-b-xl sm:rounded-b-2xl">
            {/* Post Content */}
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap wrap-break-word">
              {renderTextWithLinks(post.content)}
            </p>
        
            {/* Poll Component */}
            {post.type === 'poll' && post.options && (
              <div className="space-y-2 my-3 sm:my-4">
                {post.options.map((opt, idx) => {
                  const pct = totalVotes === 0 ? 0 : Math.round((opt.votes / totalVotes) * 100);
                  const isSelected = userSelectedOption === idx;
                  return (
                    <button key={idx} onClick={(e) => handleVote(e, idx)}
                      className={`relative w-full text-left p-2 sm:p-3 rounded-xl border transition-all duration-300 overflow-hidden group
                        ${isSelected ? 'border-indigo-600 ring-2 ring-indigo-600/20' : 'border-slate-300 hover:border-indigo-400'}`}
                    >
                      <div className={`absolute inset-0 transition-all duration-700 ${isSelected ? 'bg-indigo-300/40' : 'bg-indigo-300/20'}`} style={{ width: `${pct}%` }} />
                      <div className="relative flex justify-between items-center text-xs sm:text-sm font-bold gap-2">
                        <span className={isSelected ? 'text-indigo-950' : 'text-slate-800'}>{opt.text}</span>
                        <span className={`shrink-0 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-lg text-[10px] sm:text-[11px] ${isSelected ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-900'}`}>{pct}%</span>
                      </div>
                    </button>
                  );
                })}
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider px-1">
                  {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
                </p>
              </div>
            )}

            {/* Petition Component */}
            {post.type === 'petition' && (
              <div className="my-3 sm:my-4 p-3 sm:p-4 bg-amber-50 rounded-xl border border-amber-100 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
                <span className="font-black text-amber-900 text-[clamp(0.9rem,3vw,1.125rem)] flex items-center gap-1.5 sm:gap-2 whitespace-nowrap">
                  <Edit3 size={16} className="sm:w-4.5 sm:h-4.5" /> {post.signatures?.length || 0} Signatures
                </span>
                <button
                  onClick={handleSignPetition}
                  className={`px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap flex-1 sm:flex-none text-center ${hasSigned ? 'bg-amber-200 text-amber-800' : 'bg-amber-500 text-white hover:scale-105'}`}
                >
                  {hasSigned ? 'Signed ✓' : 'Add Signature'}
                </button>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-2 mt-3 pt-2 sm:mt-4 sm:pt-3 border-t border-slate-100">
              <button onClick={(e) => handleReaction(e, 'like')} className={`flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-bold ${hasLiked ? 'text-indigo-600' : 'text-slate-400'}`}>
                <ThumbsUp size={14} className={`sm:w-4 sm:h-4 ${hasLiked ? 'fill-indigo-600' : ''}`} /> {post.likes?.length || 0}
              </button>
              <button onClick={(e) => handleReaction(e, 'dislike')} className={`flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-bold ${hasDisliked ? 'text-red-500' : 'text-slate-400'}`}>
                <ThumbsDown size={14} className={`sm:w-4 sm:h-4 ${hasDisliked ? 'fill-red-500' : ''}`} /> {post.dislikes?.length || 0}
              </button>

              <div className="ml-auto flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs font-bold text-slate-400">
                <button onClick={toggleReplies} className="hover:text-indigo-500 whitespace-nowrap">
                  {isExpanded ? 'Hide Replies' : `Replies (${post.replyCount || 0})`}
                </button>
                <span className="hidden sm:inline">|</span>
                <button onClick={(e) => { e.stopPropagation(); setIsReplying(!isReplying); if (!isExpanded && !isReplying) setIsExpanded(true); }} className="hover:text-indigo-500 flex items-center gap-1 whitespace-nowrap">
                  <Plus size={12} className="sm:w-3 sm:h-3"/> Add Reply
                </button>
              </div>
            </div>

            {/* Reply Setup */}
            {isReplying && (
              <div className="flex flex-wrap sm:flex-nowrap gap-2 mt-3 items-start" onClick={(e) => e.stopPropagation()}>
                <textarea
                  ref={textareaRef}
                  autoFocus
                  rows={1}
                  className="flex-1 w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs sm:text-sm outline-none focus:border-indigo-400 resize-none overflow-hidden min-h-9"
                  placeholder="Write a reply..."
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                />
                <div className="flex items-center gap-2 pt-1 w-full sm:w-auto justify-end">
                  <button 
                    onClick={handleToggleRootReplyLocation}
                    className={`p-1.5 sm:p-2 rounded-xl transition-colors ${rootReplyLocation ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                    title="Attach Location"
                  >
                    <MapPin size={16} className="sm:w-4.5 sm:h-4.5" />
                  </button>
                  <button onClick={handleAddRootReply} className="bg-indigo-600 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold">Post</button>
                  <button onClick={() => { setIsReplying(false); setReplyContent(''); setRootReplyLocation(null); }}><X size={16} className="text-slate-400" /></button>
                </div>
              </div>
            )}
            
            {/* Render PostReplies Block */}
            {isExpanded && <div className="mt-3"><PostReplies postId={post.id} /></div>}
          </div>
        )}
      </div>

      {/* CONFIRMATION MODAL OVERLAY */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 sm:p-6 relative shadow-2xl">
            <h3 className="font-bold text-lg sm:text-xl text-slate-900 mb-1">Confirm Location</h3>
            <p className="text-[10px] sm:text-xs text-slate-500 mb-4 sm:mb-6">Verify this report by logging your location.</p>
            
            <div className="space-y-2 sm:space-y-3">
              <label className={`flex items-center gap-3 p-2.5 sm:p-3 rounded-xl border cursor-pointer transition-colors ${confirmOption === 'post' ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                <input 
                  type="radio" 
                  name="loc" 
                  className="accent-indigo-600 w-4 h-4"
                  checked={confirmOption === 'post'} 
                  onChange={() => setConfirmOption('post')} 
                  disabled={!post.location} 
                />
                <span className={`text-xs sm:text-sm font-bold ${!post.location ? 'text-slate-400' : 'text-slate-700'}`}>
                  Original Post Location
                  <span className="block text-[10px] sm:text-xs font-normal text-slate-500 mt-0.5">
                    {post.location ? `${post.location[0].toFixed(4)}, ${post.location[1].toFixed(4)}` : '(Not available)'}
                  </span>
                </span>
              </label>

              <label className={`flex items-center gap-3 p-2.5 sm:p-3 rounded-xl border cursor-pointer transition-colors ${confirmOption === 'current' ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                <input 
                  type="radio" 
                  name="loc" 
                  className="accent-indigo-600 w-4 h-4"
                  checked={confirmOption === 'current'} 
                  onChange={() => setConfirmOption('current')} 
                  disabled={!userLocation} 
                />
                <span className={`text-xs sm:text-sm font-bold ${!userLocation ? 'text-slate-400' : 'text-slate-700'}`}>
                  My Current Location
                  <span className="block text-[10px] sm:text-xs font-normal text-slate-500 mt-0.5">
                    {userLocation ? 'Uses your device GPS' : '(Enable permissions)'}
                  </span>
                </span>
              </label>

              <label className={`flex items-center gap-3 p-2.5 sm:p-3 rounded-xl border cursor-pointer transition-colors ${confirmOption === 'custom' ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                <input 
                  type="radio" 
                  name="loc" 
                  className="accent-indigo-600 w-4 h-4"
                  checked={confirmOption === 'custom'} 
                  onChange={() => setConfirmOption('custom')} 
                />
                <span className="text-xs sm:text-sm font-bold text-slate-700">Custom Coordinates</span>
              </label>
            </div>

            {confirmOption === 'custom' && (
              <div className="mt-3 flex w-full gap-2 animate-in slide-in-from-top-2">
                <input 
                  type="number" 
                  placeholder="Lat" 
                  value={customLat} 
                  onChange={e => setCustomLat(e.target.value)} 
                  className="w-1/2 min-w-0 border border-slate-200 bg-white rounded-xl p-2 sm:p-2.5 outline-none focus:border-indigo-500 text-xs sm:text-sm" 
                />
                <input 
                  type="number" 
                  placeholder="Lng" 
                  value={customLng} 
                  onChange={e => setCustomLng(e.target.value)} 
                  className="w-1/2 min-w-0 border border-slate-200 bg-white rounded-xl p-2 sm:p-2.5 outline-none focus:border-indigo-500 text-xs sm:text-sm" 
                />
              </div>
            )}

            <div className="flex gap-2 sm:gap-3 mt-6 sm:mt-8">
              <button onClick={() => setIsConfirmModalOpen(false)} className="flex-1 py-2.5 sm:py-3 text-[10px] sm:text-xs text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold transition-colors">Cancel</button>
              <button onClick={handleConfirmSubmit} className="flex-1 py-2.5 sm:py-3 bg-indigo-600 text-[10px] sm:text-xs text-white rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-colors">Submit</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};