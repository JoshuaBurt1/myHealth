import React, { useState, useEffect } from 'react';
import { 
  collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, getDoc, updateDoc, 
  serverTimestamp, increment, arrayUnion, arrayRemove, collectionGroup, where 
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { useLocation } from '../context/LocationContext';
import { Trash2, X, ThumbsUp, ThumbsDown, CornerDownRight, MapPin } from 'lucide-react';
import type { Reply } from './forum';

const LEVEL_COLORS = ['border-indigo-200', 'border-blue-300', 'border-sky-300', 'border-cyan-200'];

const ReplyNode: React.FC<{ reply: Reply, allReplies: Reply[], postId: string }> = ({ reply, allReplies, postId }) => {
  const [isReplying, setIsReplying] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  
  const { userLocation } = useLocation();
  const [replyLocation, setReplyLocation] = useState<[number, number] | null>(null);

  const user = auth.currentUser;
  const navigate = useNavigate();
  
  const children = allReplies.filter(r => r.parentId === reply.id);
  const colorClass = LEVEL_COLORS[Math.min(reply.level, LEVEL_COLORS.length - 1)];

  const handleToggleLocation = () => {
    if (replyLocation) {
      setReplyLocation(null); 
    } else {
      if (!userLocation) {
        alert("Location not available. Please ensure permissions are granted.");
        return;
      }
      setReplyLocation(userLocation);
    }
  };

  const handleNestedReply = async () => {
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
        parentId: reply.id,
        rootPostId: postId,
        level: reply.level + 1,
        likes: [],
        dislikes: []
      };

      if (replyLocation) replyData.location = replyLocation;

      await addDoc(collection(db, `${reply.fullPath}/myHealth_replies`), replyData);

      await updateDoc(doc(db, 'myHealth_posts', postId), {
        replyCount: increment(1),
        lastUpdated: serverTimestamp() 
      });

      setReplyContent('');
      setReplyLocation(null);
      setIsReplying(false);
    } catch (err) {
      console.error("Error adding nested reply: ", err);
    }
  };

  const handleReplyReaction = async (reactionType: 'like' | 'dislike') => {
    if (!user) return alert("Please log in!");
    const replyRef = doc(db, reply.fullPath);

    const likes = reply.likes || [];
    const dislikes = reply.dislikes || [];
    const hasLiked = likes.includes(user.uid);
    const hasDisliked = dislikes.includes(user.uid);

    try {
      if (reactionType === 'like') {
        if (hasLiked) {
          await updateDoc(replyRef, { likes: arrayRemove(user.uid) });
        } else {
          await updateDoc(replyRef, { 
            likes: arrayUnion(user.uid),
            dislikes: hasDisliked ? arrayRemove(user.uid) : dislikes
          });
        }
      } else {
        if (hasDisliked) {
          await updateDoc(replyRef, { dislikes: arrayRemove(user.uid) });
        } else {
          await updateDoc(replyRef, { 
            dislikes: arrayUnion(user.uid),
            likes: hasLiked ? arrayRemove(user.uid) : likes
          });
        }
      }
    } catch (err) {
      console.error("Reaction failed:", err);
    }
  };

  const handleDeleteReply = async () => {
    if (!window.confirm("Are you sure you want to delete this reply?")) return;

    try {
      if (children.length > 0) {
        await updateDoc(doc(db, reply.fullPath), {
          content: 'REPLY REDACTED',
          isDeleted: true
        });
      } else {
        await deleteDoc(doc(db, reply.fullPath));
        await updateDoc(doc(db, 'myHealth_posts', postId), {
          replyCount: increment(-1)
        });
      }
    } catch (err) {
      console.error("Error deleting reply:", err);
    }
  };

  const hasLiked = reply.likes?.includes(user?.uid || '');
  const hasDisliked = reply.dislikes?.includes(user?.uid || '');

  return (
    <div className={`mt-2 ${reply.level > 0 ? `border-l-2 ${colorClass} pl-3 ml-2` : ''}`}>
      <div className={`p-3 rounded-xl w-full border ${reply.isDeleted ? 'bg-slate-100 border-slate-200' : 'bg-slate-50 border-slate-100'}`}>
        <div className="flex justify-between items-start mb-1">
          <div className="flex flex-wrap items-center gap-1 mb-1">
            <button 
              onClick={() => !reply.isDeleted && navigate(`/profile/${reply.authorId}`)}
              className={`font-bold text-xs transition-colors ${
                !reply.isDeleted 
                  ? 'text-indigo-400 hover:text-indigo-600 hover:underline' 
                  : 'text-slate-400 cursor-default'
              }`}
            >
              {reply.isDeleted ? '[Deleted User]' : reply.authorName}
            </button>
            
            {!reply.isDeleted && (
              <span className="font-bold text-slate-400 text-xs flex items-center gap-1">
                • {reply.createdAt?.seconds ? new Date(reply.createdAt.seconds * 1000).toLocaleString() : '...'}
                {reply.location && (
                  <span className="flex items-center text-emerald-500 ml-1" title={`${reply.location[0]}, ${reply.location[1]}`}>
                    <MapPin size={10} />
                  </span>
                )}
              </span>
            )}

            {reply.level > 0 && (
              <span className="text-[10px] text-slate-400 font-bold ml-1">
                (Lvl {reply.level})
              </span>
            )}
          </div>
          
          {user?.uid === reply.authorId && !reply.isDeleted && (
            <button 
              onClick={handleDeleteReply} 
              className="text-red-300 hover:text-red-500 transition-colors"
              title="Delete Reply"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
        
        <p className={`text-sm ${reply.isDeleted ? 'text-slate-400 italic' : 'text-slate-600'}`}>
          {reply.content}
        </p>
        
        {!reply.isDeleted && (
          <div className="flex items-center gap-3 mt-3 text-xs font-bold">
            <button 
              onClick={() => handleReplyReaction('like')}
              className={`flex items-center gap-1 ${hasLiked ? 'text-indigo-600' : 'text-slate-400 hover:text-indigo-500'}`}
            >
              <ThumbsUp size={14} className={hasLiked ? 'fill-indigo-600' : ''} />
              {reply.likes?.length || 0}
            </button>
            
            <button 
              onClick={() => handleReplyReaction('dislike')}
              className={`flex items-center gap-1 ${hasDisliked ? 'text-red-500' : 'text-slate-400 hover:text-red-400'}`}
            >
              <ThumbsDown size={14} className={hasDisliked ? 'fill-red-500' : ''} />
              {reply.dislikes?.length || 0}
            </button>

            {reply.level < 4 && (
              <button 
                onClick={() => setIsReplying(!isReplying)} 
                className="flex items-center gap-1 text-indigo-400 hover:text-indigo-600 transition-colors ml-2"
              >
                <CornerDownRight size={14} /> Reply
              </button>
            )}
          </div>
        )}
      </div>

      {isReplying && (
        <div className="flex gap-2 mt-2 ml-2 items-center">
          <input 
            autoFocus
            type="text"
            className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-sm outline-none focus:border-indigo-400"
            placeholder="Write a reply..."
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
          />
          <button 
            onClick={handleToggleLocation}
            className={`p-1.5 rounded-xl transition-colors ${replyLocation ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
            title="Attach Location"
          >
            <MapPin size={16} />
          </button>
          <button 
            onClick={handleNestedReply}
            className="bg-indigo-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm hover:bg-indigo-700"
          >
            Post
          </button>
          <button onClick={() => setIsReplying(false)} className="text-slate-400 hover:text-slate-600 p-1">
            <X size={16}/>
          </button>
        </div>
      )}

      <div className="replies-container">
        {children.map(child => (
          <ReplyNode key={child.id} reply={child} allReplies={allReplies} postId={postId} />
        ))}
      </div>
    </div>
  );
};

export const PostReplies: React.FC<{ postId: string }> = ({ postId }) => {
  const [replies, setReplies] = useState<Reply[]>([]);

  useEffect(() => {
    const q = query(
      collectionGroup(db, 'myHealth_replies'),
      where('rootPostId', '==', postId),
      orderBy('createdAt', 'asc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reps = snapshot.docs.map(doc => ({ 
        id: doc.id,
        fullPath: doc.ref.path,
        ...doc.data() 
      })) as Reply[];
      setReplies(reps);
    }, (err) => {
      console.error("Reply listener failed:", err);
    });
    
    return () => unsubscribe();
  }, [postId]);

  const rootReplies = replies.filter(r => r.level === 0);

  return (
    <div className="space-y-2 mb-2 w-full">
      {rootReplies.map(reply => (
        <ReplyNode key={reply.id} reply={reply} allReplies={replies} postId={postId} />
      ))}
    </div>
  );
};