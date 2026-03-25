import React, { useState } from 'react';
import { doc, getDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserPlus, UserMinus, Loader2 } from 'lucide-react';

interface FollowButtonProps {
  targetUserId: string;
  targetUserName: string;
  isFollowing: boolean;
  onFollowChange: (newCountDelta: number, nextStatus: boolean) => void;
}

const FollowButton: React.FC<FollowButtonProps> = ({ 
  targetUserId, 
  targetUserName, 
  isFollowing,
  onFollowChange 
}) => {
  const [loading, setLoading] = useState(false);
  const currentUserId = auth.currentUser?.uid;

  const handleToggleFollow = async () => {
    if (!currentUserId || targetUserId === currentUserId || loading) return;
    
    setLoading(true);
    try {
      const batch = writeBatch(db);
      const followingRef = doc(db, 'users', currentUserId, 'following', targetUserId);
      const followersRef = doc(db, 'users', targetUserId, 'followers', currentUserId);

      if (isFollowing) {
        batch.delete(followingRef);
        batch.delete(followersRef);
        await batch.commit();
        onFollowChange(-1, false);
      } else {
        // Fetch current user's name
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
        
        await batch.commit();
        onFollowChange(1, true);
      }
      // Note: We removed setIsFollowing(!isFollowing) because 
      // the parent's onSnapshot will update the 'isFollowing' prop automatically.
    } catch (err) {
      console.error("Follow Toggle Error:", err);
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