import React, { useState } from 'react';
import { doc, getDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserPlus, UserMinus, Loader2 } from 'lucide-react';

interface FollowButtonProps {
  targetUserId: string;
  targetUserName: string;
  isFollowingInitial: boolean;
  onFollowChange: (newCountDelta: number, isFollowing: boolean) => void;
}

const FollowButton: React.FC<FollowButtonProps> = ({ 
  targetUserId, 
  targetUserName, 
  isFollowingInitial,
  onFollowChange 
}) => {
  const [isFollowing, setIsFollowing] = useState(isFollowingInitial);
  const [loading, setLoading] = useState(false);
  const currentUserId = auth.currentUser?.uid;

  const handleToggleFollow = async () => {
    if (!currentUserId || targetUserId === currentUserId) return;
    
    setLoading(true);
    try {
      const batch = writeBatch(db);
      const followingRef = doc(db, 'users', currentUserId, 'following', targetUserId);
      const followersRef = doc(db, 'users', targetUserId, 'followers', currentUserId);

      if (isFollowing) {
        // --- UNFOLLOW ---
        batch.delete(followingRef);
        batch.delete(followersRef);
        onFollowChange(-1, false);
      } else {
        // --- FOLLOW ---
        // Fetch current user's name from their profile to avoid "User" fallback
        let myName = auth.currentUser?.displayName || "User";
        const myProfileRef = doc(db, 'users', currentUserId, 'profile', 'user_data');
        const myProfileSnap = await getDoc(myProfileRef);
        
        if (myProfileSnap.exists()) {
          myName = myProfileSnap.data().name || myName;
        }

        batch.set(followingRef, { 
          timestamp: serverTimestamp(), 
          name: targetUserName,
          uid: targetUserId 
        });
        
        batch.set(followersRef, { 
          timestamp: serverTimestamp(), 
          name: myName, 
          uid: currentUserId 
        });
        
        onFollowChange(1, true);
      }

      await batch.commit();
      setIsFollowing(!isFollowing);
    } catch (err) {
      console.error("Follow Toggle Error:", err);
      alert("Action failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button 
      onClick={handleToggleFollow}
      disabled={loading}
      className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
        isFollowing 
          ? 'bg-slate-200 text-slate-700 hover:bg-red-50 hover:text-red-600' 
          : 'bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 shadow-indigo-200'
      } ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
    >
      {loading ? (
        <Loader2 size={18} className="animate-spin" />
      ) : isFollowing ? (
        <><UserMinus size={18} /> Unfollow</>
      ) : (
        <><UserPlus size={18} /> Follow</>
      )}
    </button>
  );
};

export default FollowButton;