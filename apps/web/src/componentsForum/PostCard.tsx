//PostCard.tsx
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  doc, updateDoc, arrayRemove, arrayUnion, getDoc, collectionGroup, query, where, getDocs, writeBatch, deleteField,
  addDoc, collection, serverTimestamp, increment, runTransaction, Timestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useLocation } from '../context/LocationContext';
import { PostReplies } from './PostReplies';
import type { Post } from './forum';
import { User, Trash2, MapPin, Edit3, ThumbsUp, ThumbsDown, Plus, X, CheckCircle, Bell } from 'lucide-react';
import { HAZARD_COLORS, HELP_COLORS, PUBLIC_COLORS, TOPIC_COLORS } from './forumConstants';

interface PostCardProps {
  post: Post;
  isUnread?: boolean;
  onMarkRead?: () => void;
}

export const PostCard: React.FC<PostCardProps> = ({ post, isUnread, onMarkRead }) => {
  const [authorImageId, setAuthorImageId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null); 
  const [rootReplyLocation, setRootReplyLocation] = useState<[number, number] | null>(null);
  
  // Collapse State
  const [isPostVisible, setIsPostVisible] = useState(false);
  const [optimisticRead, setOptimisticRead] = useState(false);
  
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

  // Updated handleTogglePost to use the optimistic handler
  const handleTogglePost = () => {
    const newVisibility = !isPostVisible;
    setIsPostVisible(newVisibility);
    
    if (newVisibility) {
      setIsExpanded(true);
      handleMarkAsReadOptimistically(); 
    }
  };

  // If a post is genuinely updated again by someone else, clear the optimistic read
  useEffect(() => {
      setOptimisticRead(false);
  }, [post.lastUpdated]);

  // Derived visibility state for the Bell and Card styling
  const showBell = isUnread && !optimisticRead;

  const handleMarkAsReadOptimistically = () => {
      if (isUnread && onMarkRead) {
          setOptimisticRead(true);
          onMarkRead();
      }
  };

  useEffect(() => {
    const fetchAuthorImage = async () => {
      // We only return early if there is no authorId. 
      if (!post.authorId) return;

      try {
        const imgDocRef = doc(db, 'users', post.authorId, 'profile', 'image_data');
        const imgSnap = await getDoc(imgDocRef);
        if (imgSnap.exists()) {
          setAuthorImageId(imgSnap.data().imageId);
        }
      } catch (err) {
        // If rules block this for logged-out users, it will land here.
        console.error("Failed to fetch image for user:", post.authorId);
      }
    };

    fetchAuthorImage();
  }, [post.authorId]);

  const formatHelpDate = (ts: any) => {
    if (!ts) return null;
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleString([], { 
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    });
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [replyContent, isReplying]);

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
    
    if (!user) return;

    if (window.confirm("Delete this post?")) {
      try {
        const batch = writeBatch(db);

        // 1. Use collectionGroup to find ALL nested replies at once
        const allRepliesQuery = query(
          collectionGroup(db, 'myHealth_replies'),
          where('rootPostId', '==', post.id)
        );
        
        const repliesSnapshot = await getDocs(allRepliesQuery);
        
        // Add every nested reply found to the batch
        repliesSnapshot.forEach((replyDoc) => {
          batch.delete(replyDoc.ref);
        });

        // 2. Cleanup: Delete the read tracking fields from the user document
        const userRef = doc(db, 'users', user.uid);
        batch.update(userRef, {
          [`last_read_post_${post.id}`]: deleteField()
        });

        // 3. Delete the parent post document
        const postRef = doc(db, 'myHealth_posts', post.id);
        batch.delete(postRef);

        // 4. Commit everything
        if (repliesSnapshot.size > 498) {
          throw new Error("Too many replies to delete in one go. Please use a Cloud Function.");
        }

        await batch.commit();
        console.log(`Successfully purged post and ${repliesSnapshot.size} replies.`);
        
      } catch (err) {
        console.error("Error purging post data:", err);
        alert("Failed to delete post. " + (err instanceof Error ? err.message : ""));
      }
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
        lastUpdated: serverTimestamp(),
        lastUpdatedBy: user.uid
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

      // Sets lastUpdatedBy so you don't receive notifications for your own activity
      await updateDoc(doc(db, 'myHealth_posts', post.id), {
        replyCount: increment(1),
        lastUpdated: serverTimestamp(),
        lastUpdatedBy: user.uid
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
    
    // If we are opening the replies section and it has an unread notification, mark it as read
    if (!isExpanded) {
      handleMarkAsReadOptimistically();
    }
    setIsExpanded(!isExpanded);
  };

  return (
  <>
    <div className={`group relative bg-white rounded-xl sm:rounded-2xl border transition-all ${
      showBell ? 'border-blue-200 ring-1 ring-blue-100 shadow-md' : 'border-slate-100 shadow-sm'
    } flex flex-col hover:border-indigo-200`}>
      {/* LIGHT GREY HEADER (COLLAPSED VIEW) */}
      <div 
        className={`bg-white p-3 sm:p-4 cursor-pointer hover:bg-slate-100 transition-colors flex items-start gap-3 sm:gap-4 ${isPostVisible ? 'border-b border-slate-200 rounded-t-xl sm:rounded-t-2xl' : 'rounded-xl sm:rounded-2xl'}`}
        onClick={handleTogglePost}
      >
        <div className="flex flex-col items-center gap-1.5 shrink-0">
        {/* Clickable User Avatar */}
        <div 
          className="w-10 h-10 sm:w-11 sm:h-11 bg-indigo-100 border border-slate-200 rounded-full flex items-center justify-center text-indigo-600 shadow-sm hover:ring-2 ring-indigo-300 transition-all overflow-hidden cursor-pointer"
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

        {/* Date and Time Underneath */}
        <div className="flex flex-col items-center text-[9px] leading-tight text-slate-400 font-medium whitespace-nowrap">
          {post.createdAt?.seconds && (
            <>
              <span>
                {new Date(post.createdAt.seconds * 1000).toLocaleDateString(undefined, {
                  month: 'numeric',
                  day: 'numeric',
                  year: '2-digit'
                })}
              </span>
              <span>
                {new Date(post.createdAt.seconds * 1000).toLocaleTimeString(undefined, {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                })}
              </span>
            </>
          )}
        </div>
      </div>
        
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5 pt-0.5">
          <div className="flex items-center justify-between gap-2 w-full">
            <div className="flex items-center gap-2 text-[10px] sm:text-xs text-slate-500 whitespace-nowrap">
              
              {/* 1. BELL ICON FIRST - Now hooked up to the local showBell state */}
              {showBell && isAuthor && (
                <div className="absolute -top-2 -right-2 z-20 flex items-center justify-center">
                  {/* Outer pulsing ring */}
                  <span className="absolute animate-ping inline-flex h-6 w-6 rounded-full bg-blue-400 opacity-75"></span>
                  {/* Inner icon container */}
                  <div className="relative bg-blue-600 rounded-full p-1.5 border-2 border-white shadow-lg">
                    <Bell size={12} className="text-white fill-white" />
                  </div>
                </div>
              )}

              {/* 2. THEN THE TITLE (Add truncate here instead) */}
              <h2 className={"text-sm sm:text-base truncate leading-tight max-w-37.5 sm:max-w-75 font-bold text-slate-700"}>
                {post.title}
              </h2>
              <span className="font-bold text-slate-400">• By </span>
              <button 
                onClick={(e) => { e.stopPropagation(); navigate(`/profile/${post.authorId}`); }} 
                className="font-bold text-indigo-500 hover:text-indigo-700 hover:underline transition-all truncate max-w-30 sm:max-w-none"
              >
                {post.authorName}
              </button>
            </div>

            {/* Top Right: Confirm Button */}
            <div className="flex items-center shrink-0 relative">
              {post.forumSection === 'Population Health' && post.type === 'post' && post.hazard && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleConfirmToggle(e); }}
                  className={`group/confirm flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-bold transition-all duration-300 border transform active:scale-95 cursor-pointer ${
                    hasConfirmed 
                      ? 'bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-200' 
                      : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-500 hover:text-emerald-600 hover:shadow-lg hover:shadow-emerald-100 hover:ring-2 hover:ring-emerald-500 hover:ring-offset-2 hover:-translate-y-0.5'
                  }`}
                >
                  <CheckCircle 
                    size={14} 
                    className={`transition-transform duration-300 ${
                      hasConfirmed 
                        ? "text-white scale-110" 
                        : "text-emerald-500 group-hover/confirm:scale-125 group-hover/confirm:rotate-12"
                    }`} 
                  />
                  
                  <span className="hidden sm:inline tracking-tight">
                    {hasConfirmed ? 'Confirmed' : 'Confirm'}
                  </span>
                  
                  {confirms?.length > 0 && (
                    <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold transition-colors ${
                      hasConfirmed 
                        ? 'bg-white/20 text-white' 
                        : 'bg-slate-100 text-slate-500 group-hover/confirm:bg-emerald-500 group-hover/confirm:text-white'
                    }`}>
                      {confirms.length}
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* LINE 2: Badges, Help Dates (Inline), Map Pin */}
          <div className="flex items-center justify-between gap-2 w-full mt-auto min-h-6">
            
            {/* LEFT SIDE: All Badges & Indicators */}
            <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap flex-1">
              {/* Hazard Badge */}
              {post.hazard && (
                <div className="flex items-center gap-1 shrink-0">
                  <span 
                    style={{ 
                      backgroundColor: `${HAZARD_COLORS[post.hazard.type] || '#94a3b8'}15`, 
                      color: HAZARD_COLORS[post.hazard.type] || '#94a3b8' 
                    }}
                    className="text-[clamp(0.6rem,2vw,0.7rem)] font-bold px-2 py-0.5 rounded-full border border-current/10"
                  >
                    • ⚠️ {post.hazard.type}
                  </span>
                  <span className="text-[clamp(0.6rem,2vw,0.7rem)] font-medium opacity-80 truncate max-w-25 sm:max-w-none text-slate-500">
                    {post.hazard.value}
                  </span>
                </div>
              )}

              {/* Help Badge + Inline Dates */}
              {post.help && (
                <div className="flex items-center gap-2 shrink-0">
                  <span 
                    style={{ backgroundColor: `${HELP_COLORS[post.help.type] || '#94a3b8'}15`, color: HELP_COLORS[post.help.type] || '#94a3b8' }}
                    className="text-[clamp(0.6rem,2vw,0.7rem)] font-bold px-2 py-0.5 rounded-full border border-current/10"
                  >
                    🤝 {post.help.type}
                  </span>
                  {(post.helpStartDate || post.helpEndDate) && (
                    <span className="text-[10px] sm:text-xs font-medium text-slate-400 flex items-center gap-1 whitespace-nowrap">
                      🕒 {formatHelpDate(post.helpStartDate) || 'Now'} - {formatHelpDate(post.helpEndDate) || 'TBD'}
                    </span>
                  )}
                </div>
              )}

              {/* Public Badge */}
              {post.public && (
                <div className="flex items-center gap-1 shrink-0">
                  <span 
                    style={{ backgroundColor: `${PUBLIC_COLORS[post.public.type] || '#94a3b8'}15`, color: PUBLIC_COLORS[post.public.type] || '#94a3b8' }}
                    className="text-[clamp(0.6rem,2vw,0.7rem)] font-bold px-2 py-0.5 rounded-full border border-current/10"
                  >
                    📍 {post.public.type} 
                  </span>
                  <span className="text-[clamp(0.6rem,2vw,0.7rem)] font-medium opacity-80 truncate text-slate-500">
                    {post.public.value} 
                  </span>
                </div>
              )}

              {/* Topic Badge */}
              {post.topic && (
                <div className="flex items-center gap-1 shrink-0">
                  <span 
                    style={{ backgroundColor: `${TOPIC_COLORS[post.topic] || '#94a3b8'}15`, color: TOPIC_COLORS[post.topic] || '#94a3b8' }}
                    className="text-[clamp(0.6rem,2vw,0.7rem)] font-bold px-2 py-0.5 rounded-full border border-current/10"
                  >
                    📌 {post.topic} 
                  </span>
                  <span className="text-[clamp(0.6rem,2vw,0.7rem)] font-medium opacity-80 truncate text-slate-500">
                    {post.detail} 
                  </span>
                </div>
              )}

              {/* Map Pin Indicator */}
              {post.location && (
                <div className="flex items-center justify-center bg-emerald-50 border border-emerald-200 rounded-full w-5 h-5 ml-1 shrink-0">
                  <MapPin size={10} className="text-emerald-600 fill-emerald-600/20" />
                </div>
              )}
            </div>

            {/* RIGHT SIDE: Trash Action (Pinned to Bottom Right) */}
            <div className="flex items-center gap-2 shrink-0 ml-auto pl-2">
              {!isPostVisible && (
                <span className="text-[10px] text-slate-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity hidden sm:inline tracking-tight">
                  Click to expand
                </span>
              )}
              
              {isAuthor && (
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDelete(e); }} 
                  className="group/trash relative text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-full transition-all duration-200 hover:ring-2 hover:ring-red-500/20 hover:ring-offset-1 active:scale-90"
                  title="Delete Post"
                >
                  <Trash2 size={15} className="transition-transform group-hover/trash:scale-110" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* WHITE CONTENT AREA (EXPANDED VIEW) */}
      {isPostVisible && (
        <div className="p-4 sm:p-5 bg-white rounded-b-xl sm:rounded-b-2xl">
          {/* Post Content */}
          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap wrap-break-word">
            {renderTextWithLinks(post.content)}
          </p>
      
          {/* Poll Component */}
          {post.type === 'poll' && post.options && (
            <div className="space-y-2 my-4">
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
                      <span className={`shrink-0 px-2 py-1 rounded-lg text-[10px] sm:text-[11px] ${isSelected ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-900'}`}>{pct}%</span>
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
            <div className="my-4 p-3 sm:p-4 bg-amber-50 rounded-xl border border-amber-100 flex flex-wrap items-center justify-between gap-3">
              <span className="font-black text-amber-900 text-[clamp(0.9rem,3vw,1.125rem)] flex items-center gap-1.5 sm:gap-2 whitespace-nowrap">
                <Edit3 size={16} className="sm:w-4.5 sm:h-4.5" /> {post.signatures?.length || 0} Signatures
              </span>
              <button
                onClick={handleSignPetition}
                className={`px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap flex-1 sm:flex-none text-center ${hasSigned ? 'bg-amber-200 text-amber-800' : 'bg-amber-500 text-white hover:scale-105 shadow-sm hover:shadow-md'}`}
              >
                {hasSigned ? 'Signed ✓' : 'Add Signature'}
              </button>
            </div>
          )}

          {/* Action Bar */}
          <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-2 mt-4 pt-3 border-t border-slate-100">
            <button onClick={(e) => handleReaction(e, 'like')} className={`flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-bold ${hasLiked ? 'text-indigo-600' : 'text-slate-400 hover:text-indigo-500 transition-colors'}`}>
              <ThumbsUp size={14} className={`sm:w-4 sm:h-4 ${hasLiked ? 'fill-indigo-600' : ''}`} /> {post.likes?.length || 0}
            </button>
            <button onClick={(e) => handleReaction(e, 'dislike')} className={`flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-bold ${hasDisliked ? 'text-red-500' : 'text-slate-400 hover:text-red-500 transition-colors'}`}>
              <ThumbsDown size={14} className={`sm:w-4 sm:h-4 ${hasDisliked ? 'fill-red-500' : ''}`} /> {post.dislikes?.length || 0}
            </button>

            <div className="ml-auto flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs font-bold text-slate-400">
              <button onClick={toggleReplies} className="hover:text-indigo-500 transition-colors whitespace-nowrap">
                {isExpanded ? 'Hide Replies' : `Replies (${post.replyCount || 0})`}
              </button>
              <span className="hidden sm:inline">|</span>
              <button onClick={(e) => { e.stopPropagation(); setIsReplying(!isReplying); if (!isExpanded && !isReplying) setIsExpanded(true); }} className="hover:text-indigo-500 transition-colors flex items-center gap-1 whitespace-nowrap">
                <Plus size={12} className="sm:w-3 sm:h-3"/> Add Reply
              </button>
            </div>
          </div>

          {/* Reply Setup */}
          {isReplying && (
            <div className="flex flex-wrap sm:flex-nowrap gap-2 mt-4 items-start animate-in fade-in slide-in-from-top-2 duration-300" onClick={(e) => e.stopPropagation()}>
              <textarea
                ref={textareaRef}
                autoFocus
                rows={1}
                className="flex-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none focus:border-indigo-400 focus:bg-white transition-colors resize-none overflow-hidden min-h-10"
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
                <button onClick={handleAddRootReply} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm">Post</button>
                <button onClick={() => { setIsReplying(false); setReplyContent(''); setRootReplyLocation(null); }} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"><X size={16} className="text-slate-400" /></button>
              </div>
            </div>
          )}
          
          {/* Render PostReplies Block */}
          {isExpanded && (
            <div className="mt-4 animate-in fade-in slide-in-from-top-4 duration-500">
              <PostReplies postId={post.id} />
            </div>
          )}
        </div>
      )}
    </div>

    {/* CONFIRMATION MODAL OVERLAY */}
    {isConfirmModalOpen && (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setIsConfirmModalOpen(false)}>
        <div className="bg-white w-full max-w-sm rounded-3xl p-6 relative shadow-2xl animate-in fade-in zoom-in duration-200" onClick={(e) => e.stopPropagation()}>
          <h3 className="font-bold text-xl text-slate-900 mb-1">Confirm Location</h3>
          <p className="text-xs text-slate-500 mb-6">Verify this report by logging your location.</p>
          
          <div className="space-y-3">
            <label className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${confirmOption === 'post' ? 'bg-indigo-50 border-indigo-200 ring-2 ring-indigo-500/20' : 'bg-white border-slate-100 hover:border-slate-300'}`}>
              <input 
                type="radio" 
                name="confirmLoc" 
                className="accent-indigo-600 w-4 h-4"
                checked={confirmOption === 'post'} 
                onChange={() => setConfirmOption('post')}
              />
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-800">Post Location</span>
                <span className="text-[10px] text-slate-500">Use the location tagged in the original post.</span>
              </div>
            </label>

            {userLocation && (
              <label className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${confirmOption === 'current' ? 'bg-indigo-50 border-indigo-200 ring-2 ring-indigo-500/20' : 'bg-white border-slate-100 hover:border-slate-300'}`}>
                <input 
                  type="radio" 
                  name="confirmLoc" 
                  className="accent-indigo-600 w-4 h-4"
                  checked={confirmOption === 'current'} 
                  onChange={() => setConfirmOption('current')}
                />
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-800">My Current Location</span>
                  <span className="text-[10px] text-slate-500">Use your current GPS coordinates.</span>
                </div>
              </label>
            )}

            <label className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${confirmOption === 'custom' ? 'bg-indigo-50 border-indigo-200 ring-2 ring-indigo-500/20' : 'bg-white border-slate-100 hover:border-slate-300'}`}>
              <input 
                type="radio" 
                name="confirmLoc" 
                className="accent-indigo-600 w-4 h-4"
                checked={confirmOption === 'custom'} 
                onChange={() => setConfirmOption('custom')}
              />
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-800">Custom Coordinates</span>
                <span className="text-[10px] text-slate-500">Manually enter coordinates.</span>
              </div>
            </label>

            {confirmOption === 'custom' && (
              <div className="grid grid-cols-2 gap-3 pt-2 animate-in slide-in-from-top-2 duration-200">
                <input
                  type="number"
                  placeholder="Latitude"
                  value={customLat}
                  onChange={(e) => setCustomLat(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:bg-white transition-all"
                />
                <input
                  type="number"
                  placeholder="Longitude"
                  value={customLng}
                  onChange={(e) => setCustomLng(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:bg-white transition-all"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 mt-8">
            <button 
              onClick={() => setIsConfirmModalOpen(false)}
              className="flex-1 px-4 py-3 rounded-2xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleConfirmSubmit}
              className="flex-1 px-4 py-3 rounded-2xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95"
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  );
};