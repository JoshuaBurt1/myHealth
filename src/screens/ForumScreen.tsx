import React, { useState, useEffect } from 'react';
import { 
  collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, getDoc, updateDoc, 
  serverTimestamp, increment, runTransaction, arrayUnion, arrayRemove, collectionGroup, where 
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { 
  MessageSquarePlus, User, Trash2, X, BarChart2, Plus, Type, 
  ThumbsUp, ThumbsDown, CornerDownRight, FileText, Edit3 
} from 'lucide-react';

type ModalMode = "post" | "poll" | "petition";

interface TabItem {
  id: ModalMode;
  label: string;
  icon: React.ReactNode;
}

const tabs: TabItem[] = [
  { id: 'post', label: 'Post', icon: <Type size={16} /> },
  { id: 'poll', label: 'Poll', icon: <BarChart2 size={16} /> },
  { id: 'petition', label: 'Petition', icon: <FileText size={16} /> }
];

interface Reply { id: string; content: string; authorId: string; authorName: string; createdAt: any; lastUpdated?: any; fullPath: string;
  parentId: string; rootPostId: string; level: number; isDeleted?: boolean; likes?: string[]; islikes?: string[]; dislikes?: string[]; }

interface PollOption {
  text: string; votes: number; }

interface Post { id: string; title?: string; content: string; authorId: string; authorName: string; createdAt: any; lastUpdated?: any;
  type?: 'post' | 'poll' | 'petition'; options?: PollOption[]; userVotes?: Record<string, number>; likes?: string[]; dislikes?: string[];
  signatures?: string[]; replyCount?: number; }

const LEVEL_COLORS = ['border-indigo-200', 'border-blue-300', 'border-sky-300', 'border-cyan-200'];

const ReplyNode: React.FC<{ reply: Reply, allReplies: Reply[], postId: string }> = ({ reply, allReplies, postId }) => {
  const [isReplying, setIsReplying] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const user = auth.currentUser;
  const navigate = useNavigate();
  
  const children = allReplies.filter(r => r.parentId === reply.id);
  const colorClass = LEVEL_COLORS[Math.min(reply.level, LEVEL_COLORS.length - 1)];

  const handleNestedReply = async () => {
    if (!user) return alert("Please log in!");
    if (!replyContent.trim()) return;

    try {
      const profileRef = doc(db, 'users', user.uid, 'profile', 'user_data');
      const profileSnap = await getDoc(profileRef);
      const realName = profileSnap.exists() ? profileSnap.data().name : "Anonymous";

      await addDoc(collection(db, `${reply.fullPath}/myHealth_replies`), {
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
      });

      await updateDoc(doc(db, 'myHealth_posts', postId), {
        replyCount: increment(1),
        lastUpdated: serverTimestamp() 
      });

      setReplyContent('');
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
              <span className="font-bold text-slate-400 text-xs">
                • {reply.createdAt?.seconds ? new Date(reply.createdAt.seconds * 1000).toLocaleString() : '...'}
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
        <div className="flex gap-2 mt-2 ml-2">
          <input 
            autoFocus
            type="text"
            className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-sm outline-none focus:border-indigo-400"
            placeholder="Write a reply..."
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
          />
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

const PostReplies: React.FC<{ postId: string }> = ({ postId }) => {
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

const ForumScreen: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'post' | 'poll' | 'petition'>('post');
  
  const [expandedPosts, setExpandedPosts] = useState<Record<string, boolean>>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  
  const [postTitle, setPostTitle] = useState(''); // New Title state
  const [newPostContent, setNewPostContent] = useState('');
  const [pollContent, setPollContent] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);

  const navigate = useNavigate();
  const user = auth.currentUser;

  useEffect(() => {
    const q = query(collection(db, 'myHealth_posts'), orderBy('lastUpdated', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Post[];
      setPosts(postsData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const toggleReplies = (postId: string) => {
    setExpandedPosts(prev => ({ ...prev, [postId]: !prev[postId] }));
  };

  const handleCreate = async () => {
    if (!user) return alert("Please log in!");
    
    try {
      const profileRef = doc(db, 'users', user.uid, 'profile', 'user_data');
      const profileSnap = await getDoc(profileRef);
      const realName = profileSnap.exists() ? profileSnap.data().name : "Anonymous";

      const commonData = {
        authorId: user.uid,
        authorName: realName,
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        likes: [],
        dislikes: [],
        replyCount: 0,
      };

      if (modalMode === 'post') {
        if (!newPostContent.trim() || !postTitle.trim()) return alert("Please fill out the title and content.");
        await addDoc(collection(db, 'myHealth_posts'), {
          ...commonData,
          title: postTitle,
          content: newPostContent,
          type: 'post',
        });
      } else if (modalMode === 'poll') {
        if (!pollContent.trim() || pollOptions.some(opt => !opt.trim())) {
            return alert("Please provide a question and fill all option fields.");
        }
        
        await addDoc(collection(db, 'myHealth_posts'), {
          ...commonData,
          title: postTitle,
          content: pollContent,
          type: 'poll',
          options: pollOptions.map(text => ({ text, votes: 0 })),
          userVotes: {} 
        });
      } else if (modalMode === 'petition') {
        if (!newPostContent.trim() || !postTitle.trim()) return alert("Please fill out the title and content.");
        await addDoc(collection(db, 'myHealth_posts'), {
          ...commonData,
          title: postTitle,
          content: newPostContent,
          type: 'petition',
          signatures: [],
        });
      }

      resetModal();
    } catch (err) {
      console.error("Error:", err);
    }
  };

  const handleAddRootReply = async (postId: string) => {
    if (!user) return alert("Please log in!");
    if (!replyContent.trim()) return;

    try {
      const profileRef = doc(db, 'users', user.uid, 'profile', 'user_data');
      const profileSnap = await getDoc(profileRef);
      const realName = profileSnap.exists() ? profileSnap.data().name : "Anonymous";

      await addDoc(collection(db, 'myHealth_posts', postId, 'myHealth_replies'), {
        content: replyContent,
        authorId: user.uid,
        authorName: realName,
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        parentId: postId,
        rootPostId: postId,
        level: 0,
        likes: [],
        dislikes: []
      });

      await updateDoc(doc(db, 'myHealth_posts', postId), {
        replyCount: increment(1),
        lastUpdated: serverTimestamp() 
      });

      setExpandedPosts(prev => ({ ...prev, [postId]: true }));
      setReplyContent('');
      setReplyingTo(null);
    } catch (err) {
      console.error("Error adding reply: ", err);
    }
  };

  const handleReaction = async (post: Post, reactionType: 'like' | 'dislike') => {
    if (!user) return alert("Please log in!");
    const postRef = doc(db, 'myHealth_posts', post.id);

    const likes = post.likes || [];
    const dislikes = post.dislikes || [];
    const hasLiked = likes.includes(user.uid);
    const hasDisliked = dislikes.includes(user.uid);

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

  const handleVote = async (postId: string, optionIndex: number) => {
    if (!user) return alert("Please log in to participate!");
    const postRef = doc(db, 'myHealth_posts', postId);

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

  const handleSignPetition = async (postId: string, signatures: string[] = []) => {
    if (!user) return alert("Please log in to sign!");
    const postRef = doc(db, 'myHealth_posts', postId);
    
    try {
      if (signatures.includes(user.uid)) {
        await updateDoc(postRef, { signatures: arrayRemove(user.uid) }); // Allows unsigning
      } else {
        await updateDoc(postRef, { signatures: arrayUnion(user.uid) });
      }
    } catch (err) {
      console.error("Signature failed:", err);
    }
  };

  const resetModal = () => {
    setPostTitle('');
    setNewPostContent('');
    setPollContent('');
    setPollOptions(['', '']);
    setIsModalOpen(false);
    setModalMode('post');
  };

  const handleDelete = async (postId: string) => {
    if (window.confirm("Delete this entire post?")) {
      await deleteDoc(doc(db, 'myHealth_posts', postId));
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;

  return (
  <div className="max-w-2xl mx-auto p-4 pb-24">
    <h1 className="text-2xl font-bold mb-6 text-slate-800">Community Forum</h1>

    <div className="space-y-4">
      {posts.map((post) => {
        const userId = user?.uid || '';
        const isAuthor = userId === post.authorId;
        const isExpanded = expandedPosts[post.id];
        
        // Unified State Helpers
        const hasLiked = post.likes?.includes(userId);
        const hasDisliked = post.dislikes?.includes(userId);
        const hasSigned = post.signatures?.includes(userId);
        const userSelectedOption = post.userVotes?.[userId];
        const totalVotes = post.options?.reduce((acc, curr) => acc + curr.votes, 0) || 0;

        return (
          <div key={post.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex gap-4">
            {/* 1. Avatar */}
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 shrink-0 mt-1">
              <User size={20} />
            </div>
            
            <div className="flex-1 min-w-0">
              {/* 2. Header: Author & Delete */}
              <div className="flex items-start justify-between mb-2">
                <div className="text-xs flex flex-wrap items-center gap-1">
                  <span className="font-bold text-slate-400">By </span>
                  <button 
                    onClick={() => navigate(`/profile/${post.authorId}`)} 
                    className="font-bold text-indigo-400 hover:text-indigo-600 hover:underline transition-all"
                  >
                    {post.authorName}
                  </button>
                  <span className="font-bold text-slate-400 ml-1">
                    • {post.createdAt?.seconds ? new Date(post.createdAt.seconds * 1000).toLocaleString() : '...'}
                  </span>
                </div>
                {isAuthor && (
                  <button onClick={() => handleDelete(post.id)} className="text-red-300 hover:text-red-500 transition-colors">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              {/* 3. Common Body: Title & Content (Used by Posts, Polls, and Petitions) */}
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-gray-900 leading-tight">
                  {post.title}
                </h2>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {post.content}
                </p>
              </div>
              
              {/* 4. Type-Specific Logic */}
              
              {/* Poll UI */}
              {post.type === 'poll' && post.options && (
                <div className="space-y-2 my-4">
                  {post.options.map((opt, idx) => {
                    const pct = totalVotes === 0 ? 0 : Math.round((opt.votes / totalVotes) * 100);
                    const isSelected = userSelectedOption === idx;
                    return (
                      <button key={idx} onClick={() => handleVote(post.id, idx)}
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

              {/* Petition UI */}
              {post.type === 'petition' && (
                <div className="my-4 p-4 bg-amber-50 rounded-xl border border-amber-100 flex items-center justify-between">
                  <span className="font-black text-amber-900 text-lg flex items-center gap-2">
                    <Edit3 size={18} /> {post.signatures?.length || 0} Signatures
                  </span>
                  <button
                    onClick={() => handleSignPetition(post.id, post.signatures)}
                    className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${hasSigned ? 'bg-amber-200 text-amber-800' : 'bg-amber-500 text-white hover:scale-105'}`}
                  >
                    {hasSigned ? 'Signed ✓' : 'Add Signature'}
                  </button>
                </div>
              )}

              {/* 5. Engagement Bar */}
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100">
                <button onClick={() => handleReaction(post, 'like')} className={`flex items-center gap-1 text-xs font-bold ${hasLiked ? 'text-indigo-600' : 'text-slate-400'}`}>
                  <ThumbsUp size={16} className={hasLiked ? 'fill-indigo-600' : ''} /> {post.likes?.length || 0}
                </button>
                <button onClick={() => handleReaction(post, 'dislike')} className={`flex items-center gap-1 text-xs font-bold ${hasDisliked ? 'text-red-500' : 'text-slate-400'}`}>
                  <ThumbsDown size={16} className={hasDisliked ? 'fill-red-500' : ''} /> {post.dislikes?.length || 0}
                </button>

                <div className="ml-auto flex items-center gap-3 text-xs font-bold text-slate-400">
                  <button onClick={() => toggleReplies(post.id)} className="hover:text-indigo-500">
                    {isExpanded ? 'Hide Replies' : `Replies (${post.replyCount || 0})`}
                  </button>
                  <span>|</span>
                  <button onClick={() => { setReplyingTo(replyingTo === post.id ? null : post.id); if (!isExpanded) toggleReplies(post.id); }} className="hover:text-indigo-500 flex items-center gap-1">
                    <Plus size={14}/> Add Reply
                  </button>
                </div>
              </div>

              {/* 6. Reply Input & List */}
              {replyingTo === post.id && (
                <div className="flex gap-2 mt-3 animate-in fade-in zoom-in-95 duration-200">
                  <input autoFocus className="flex-1 bg-slate-100 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400" placeholder="Write a reply..." value={replyContent} onChange={(e) => setReplyContent(e.target.value)} />
                  <button onClick={() => handleAddRootReply(post.id)} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold">Post</button>
                  <button onClick={() => { setReplyingTo(null); setReplyContent(''); }}><X size={16} className="text-slate-400" /></button>
                </div>
              )}

              {isExpanded && <div className="mt-3"><PostReplies postId={post.id} /></div>}
            </div>
          </div>
        );
      })}
    </div>

      <button onClick={() => setIsModalOpen(true)} className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center hover:scale-105 transition-transform z-40">
        <MessageSquarePlus size={24} />
      </button>
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white w-full max-w-md rounded-3xl p-6 relative shadow-2xl">
              
              {/* 1. Optimized Tab Switcher */}
              <div className="flex gap-2 mb-6 p-1 bg-slate-100 rounded-2xl">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setModalMode(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-bold transition-all ${
                      modalMode === tab.id ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>

              <div className="space-y-4">
                {/* 2. Consolidated Title Input (Bold) */}
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

                {/* 3. Conditional Content (Regular Weight) */}
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
                              onClick={() => {
                                const newOpts = pollOptions.filter((_, index) => index !== i);
                                setPollOptions(newOpts);
                              }}
                              className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                              title="Remove option"
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
                        className="text-indigo-600 text-xs font-bold flex items-center gap-1 mt-1 hover:text-indigo-700 transition-colors"
                      >
                        <Plus size={14} /> Add Option
                      </button>
                    )}
                  </div>
                ) : (
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
              </div>

              {/* 4. Action Buttons */}
              <div className="flex gap-3 mt-8">
                <button onClick={resetModal} className="flex-1 py-3 text-slate-500 bg-slate-100 rounded-xl font-bold">Cancel</button>
                <button onClick={handleCreate} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all">
                  Create {modalMode.charAt(0).toUpperCase() + modalMode.slice(1)}
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

export default ForumScreen;