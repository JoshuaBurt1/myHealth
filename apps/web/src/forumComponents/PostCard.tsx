import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  doc, updateDoc, arrayRemove, arrayUnion, deleteDoc, 
  getDoc, addDoc, collection, serverTimestamp, increment, runTransaction 
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useLocation } from '../context/LocationContext';
import { PostReplies } from './PostReplies';
import type { Post } from './forum';
import { User, Trash2, MapPin, Edit3, ThumbsUp, ThumbsDown, Plus, X, CheckCircle } from 'lucide-react';

interface PostCardProps {
  post: Post;
}

export const PostCard: React.FC<PostCardProps> = ({ post }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [rootReplyLocation, setRootReplyLocation] = useState<[number, number] | null>(null);
  
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
  const hasSigned = post.signatures?.includes(userId);
  const hasConfirmed = post.confirm?.some(c => c.userId === userId);
  const userSelectedOption = post.userVotes?.[userId];
  const totalVotes = post.options?.reduce((acc, curr) => acc + curr.votes, 0) || 0;

  const handleDelete = async () => {
    if (window.confirm("Delete this entire post?")) {
      await deleteDoc(doc(db, 'myHealth_posts', post.id));
    }
  };

  const handleConfirmToggle = async () => {
    if (!user) return alert("Please log in to confirm!");

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
    if (!user) return;
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
      const newConfirm = { userId: user.uid, location: locToSave };
      await updateDoc(postRef, {
        confirm: arrayUnion(newConfirm)
      });
      setIsConfirmModalOpen(false);
      setCustomLat('');
      setCustomLng('');
    } catch (err) {
      console.error("Submit confirm failed:", err);
    }
  };

  const handleReaction = async (reactionType: 'like' | 'dislike') => {
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

  const handleVote = async (optionIndex: number) => {
    if (!user) return alert("Please log in to participate!");
    const postRef = doc(db, 'myHealth_posts', post.id);

    try {
      await runTransaction(db, async (transaction) => {
        const postDoc = await transaction.get(postRef);
        if (!postDoc.exists()) throw "Post missing";

        const postData = postDoc.data() as Post;
        const userVotes = postData.userVotes || {};
        const previousVoteIndex = userVotes[user.uid];

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

  const handleSignPetition = async () => {
    if (!user) return alert("Please log in to sign!");
    const postRef = doc(db, 'myHealth_posts', post.id);
    const signatures = post.signatures || [];
    
    try {
      if (signatures.includes(user.uid)) {
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

  const toggleReplies = () => setIsExpanded(!isExpanded);

  return (
    <>
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex gap-4">
        <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 shrink-0 mt-1">
          <User size={20} />
        </div>
            
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-2">
            <div className="text-xs flex flex-wrap items-center gap-1">
              <span className="font-bold text-slate-400">By </span>
              <button 
                onClick={() => navigate(`/profile/${post.authorId}`)} 
                className="font-bold text-indigo-400 hover:text-indigo-600 hover:underline transition-all"
              >
                {post.authorName}
              </button>
              <span className="font-bold text-slate-400 ml-1 flex items-center gap-1">
                • {post.createdAt?.seconds ? new Date(post.createdAt.seconds * 1000).toLocaleString() : '...'}
                {post.location && (
                  <span className="flex items-center text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded-full ml-1" title={`${post.location[0]}, ${post.location[1]}`}>
                    <MapPin size={10} className="mr-1"/> Location Attached
                  </span>
                )}
              </span>
            </div>
            
            <div className="flex gap-2 items-center">
              <button
                onClick={handleConfirmToggle}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  hasConfirmed 
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200 hover:bg-emerald-600' 
                    : 'bg-slate-100 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600'
                }`}
              >
                <CheckCircle size={14} />
                {hasConfirmed ? 'Confirmed' : 'Confirm'}
                {post.confirm && post.confirm.length > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] ${hasConfirmed ? 'bg-emerald-600' : 'bg-slate-200 text-slate-600'}`}>
                    {post.confirm.length}
                  </span>
                )}
              </button>

              {isAuthor && (
                <button onClick={handleDelete} className="text-red-300 hover:text-red-500 transition-colors">
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>

          <div className="space-y-1">
            {post.hazard && (
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  ⚠️ {post.hazard.type}
                </span>
                <span className="text-xs text-red-500 font-medium italic">
                  {post.hazard.value}
                </span>
              </div>
            )}
            <h2 className="text-xl font-semibold text-gray-900 leading-tight">
              {post.title}
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              {post.content}
            </p>
          </div>
          
          {post.type === 'poll' && post.options && (
            <div className="space-y-2 my-4">
              {post.options.map((opt, idx) => {
                const pct = totalVotes === 0 ? 0 : Math.round((opt.votes / totalVotes) * 100);
                const isSelected = userSelectedOption === idx;
                return (
                  <button key={idx} onClick={() => handleVote(idx)}
                    className={`relative w-full text-left p-3 rounded-xl border transition-all duration-300 overflow-hidden group
                      ${isSelected ? 'border-indigo-600 ring-2 ring-indigo-600/20' : 'border-slate-300 hover:border-indigo-400'}`}
                  >
                    <div className={`absolute inset-0 transition-all duration-700 ${isSelected ? 'bg-indigo-300/40' : 'bg-indigo-300/20'}`} style={{ width: `${pct}%` }} />
                    <div className="relative flex justify-between items-center text-sm font-bold">
                      <span className={isSelected ? 'text-indigo-950' : 'text-slate-800'}>{opt.text}</span>
                      <span className={`px-2 py-1 rounded-lg text-[11px] ${isSelected ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-900'}`}>{pct}%</span>
                    </div>
                  </button>
                );
              })}
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider px-1">
                {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
              </p>
            </div>
          )}

          {post.type === 'petition' && (
            <div className="my-4 p-4 bg-amber-50 rounded-xl border border-amber-100 flex items-center justify-between">
              <span className="font-black text-amber-900 text-lg flex items-center gap-2">
                <Edit3 size={18} /> {post.signatures?.length || 0} Signatures
              </span>
              <button
                onClick={handleSignPetition}
                className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${hasSigned ? 'bg-amber-200 text-amber-800' : 'bg-amber-500 text-white hover:scale-105'}`}
              >
                {hasSigned ? 'Signed ✓' : 'Add Signature'}
              </button>
            </div>
          )}

          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100">
            <button onClick={() => handleReaction('like')} className={`flex items-center gap-1 text-xs font-bold ${hasLiked ? 'text-indigo-600' : 'text-slate-400'}`}>
              <ThumbsUp size={16} className={hasLiked ? 'fill-indigo-600' : ''} /> {post.likes?.length || 0}
            </button>
            <button onClick={() => handleReaction('dislike')} className={`flex items-center gap-1 text-xs font-bold ${hasDisliked ? 'text-red-500' : 'text-slate-400'}`}>
              <ThumbsDown size={16} className={hasDisliked ? 'fill-red-500' : ''} /> {post.dislikes?.length || 0}
            </button>

            <div className="ml-auto flex items-center gap-3 text-xs font-bold text-slate-400">
              <button onClick={toggleReplies} className="hover:text-indigo-500">
                {isExpanded ? 'Hide Replies' : `Replies (${post.replyCount || 0})`}
              </button>
              <span>|</span>
              <button onClick={() => { setIsReplying(!isReplying); if (!isExpanded && !isReplying) toggleReplies(); }} className="hover:text-indigo-500 flex items-center gap-1">
                <Plus size={14}/> Add Reply
              </button>
            </div>
          </div>

          {isReplying && (
            <div className="flex gap-2 mt-3 animate-in fade-in zoom-in-95 duration-200 items-center">
              <input autoFocus className="flex-1 bg-slate-100 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400" placeholder="Write a reply..." value={replyContent} onChange={(e) => setReplyContent(e.target.value)} />
              <button 
                onClick={handleToggleRootReplyLocation}
                className={`p-2 rounded-xl transition-colors ${rootReplyLocation ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                title="Attach Location"
              >
                <MapPin size={18} />
              </button>
              <button onClick={handleAddRootReply} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold">Post</button>
              <button onClick={() => { setIsReplying(false); setReplyContent(''); setRootReplyLocation(null); }}><X size={16} className="text-slate-400" /></button>
            </div>
          )}

          {isExpanded && <div className="mt-3"><PostReplies postId={post.id} /></div>}
        </div>
      </div>

      {/* CONFIRMATION MODAL OVERLAY */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 relative shadow-2xl">
            <h3 className="font-bold text-xl text-slate-900 mb-1">Confirm Location</h3>
            <p className="text-xs text-slate-500 mb-6">Verify this report by logging your location.</p>
            
            <div className="space-y-3">
              <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${confirmOption === 'post' ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                <input 
                  type="radio" 
                  name="loc" 
                  className="accent-indigo-600"
                  checked={confirmOption === 'post'} 
                  onChange={() => setConfirmOption('post')} 
                  disabled={!post.location} 
                />
                <span className={`text-sm font-bold ${!post.location ? 'text-slate-400' : 'text-slate-700'}`}>
                  Original Post Location
                  <span className="block text-xs font-normal text-slate-500 mt-0.5">
                    {post.location ? `${post.location[0].toFixed(4)}, ${post.location[1].toFixed(4)}` : '(Not available)'}
                  </span>
                </span>
              </label>

              <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${confirmOption === 'current' ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                <input 
                  type="radio" 
                  name="loc" 
                  className="accent-indigo-600"
                  checked={confirmOption === 'current'} 
                  onChange={() => setConfirmOption('current')} 
                  disabled={!userLocation} 
                />
                <span className={`text-sm font-bold ${!userLocation ? 'text-slate-400' : 'text-slate-700'}`}>
                  My Current Location
                  <span className="block text-xs font-normal text-slate-500 mt-0.5">
                    {userLocation ? 'Uses your device GPS' : '(Enable permissions)'}
                  </span>
                </span>
              </label>

              <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${confirmOption === 'custom' ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                <input 
                  type="radio" 
                  name="loc" 
                  className="accent-indigo-600"
                  checked={confirmOption === 'custom'} 
                  onChange={() => setConfirmOption('custom')} 
                />
                <span className="text-sm font-bold text-slate-700">Custom Coordinates</span>
              </label>
            </div>

            {confirmOption === 'custom' && (
              <div className="mt-3 flex gap-2 animate-in slide-in-from-top-2">
                <input 
                  type="number" 
                  placeholder="Latitude" 
                  value={customLat} 
                  onChange={e => setCustomLat(e.target.value)} 
                  className="flex-1 border border-slate-200 bg-white rounded-xl p-3 outline-none focus:border-indigo-500 text-sm" 
                />
                <input 
                  type="number" 
                  placeholder="Longitude" 
                  value={customLng} 
                  onChange={e => setCustomLng(e.target.value)} 
                  className="flex-1 border border-slate-200 bg-white rounded-xl p-3 outline-none focus:border-indigo-500 text-sm" 
                />
              </div>
            )}

            <div className="flex gap-3 mt-8">
              <button onClick={() => setIsConfirmModalOpen(false)} className="flex-1 py-3 text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold transition-colors">Cancel</button>
              <button onClick={handleConfirmSubmit} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-colors">Submit</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};