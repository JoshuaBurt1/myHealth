// FollowButton.tsx

import React, { useState, useEffect } from 'react';
import { doc, getDoc, writeBatch, serverTimestamp, onSnapshot, deleteDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserPlus, UserMinus, Loader2, Clock } from 'lucide-react';

interface FollowButtonProps {
  targetUserId: string;
  targetUserName: string;
  isFollowing: boolean;
}

const FollowButton: React.FC<FollowButtonProps> = ({ 
  targetUserId, 
  targetUserName, 
  isFollowing,
}) => {
  const [loading, setLoading] = useState(false);
  const [isRequested, setIsRequested] = useState(false);
  const currentUserId = auth.currentUser?.uid;

  // Listen for a follower request from the current user to the target
  useEffect(() => {
    if (!currentUserId || !targetUserId || isFollowing) {
      setIsRequested(false);
      return;
    }

    const requestRef = doc(db, 'users', targetUserId, 'follow_requests', currentUserId);
    const unsub = onSnapshot(requestRef, (docSnap) => {
      setIsRequested(docSnap.exists());
    });

    return () => unsub();
  }, [currentUserId, targetUserId, isFollowing]);

  const handleToggleFollow = async () => {
    if (!currentUserId || targetUserId === currentUserId || loading) return;
    
    setLoading(true);
    try {
      // CASE 1: Currently following -> unfollow
      if (isFollowing) {
        const batch = writeBatch(db);
        batch.delete(doc(db, 'users', currentUserId, 'following', targetUserId));
        batch.delete(doc(db, 'users', targetUserId, 'followers', currentUserId));
        await batch.commit();
      } 
      // CASE 2: Request is pending -> cancel request
      else if (isRequested) {
        await deleteDoc(doc(db, 'users', targetUserId, 'follow_requests', currentUserId));
      } 
      // CASE 3: Not following -> check settings & follow/request
      else {
        // Fetch target user's privacy settings
        const settingsRef = doc(db, 'users', targetUserId, 'myHealth_privacy', 'settings');
        const settingsSnap = await getDoc(settingsRef);
        const automaticFollow = settingsSnap.exists() ? settingsSnap.data().automaticFollow : true;

        if (automaticFollow) {
          // Perform immediate follow
          const batch = writeBatch(db);
          let myName = auth.currentUser?.displayName || "User";
          const myProfileSnap = await getDoc(doc(db, 'users', currentUserId, 'profile', 'user_data'));
          if (myProfileSnap.exists()) myName = myProfileSnap.data().name || myName;

          batch.set(doc(db, 'users', currentUserId, 'following', targetUserId), { 
            timestamp: serverTimestamp(), name: targetUserName, uid: targetUserId 
          });
          batch.set(doc(db, 'users', targetUserId, 'followers', currentUserId), { 
            timestamp: serverTimestamp(), name: myName, uid: currentUserId 
          });
          
          await batch.commit();
        } else {
          // Create a follow request instead
          let myName = auth.currentUser?.displayName || "User";
          const myProfileSnap = await getDoc(doc(db, 'users', currentUserId, 'profile', 'user_data'));
          if (myProfileSnap.exists()) myName = myProfileSnap.data().name || myName;

          await setDoc(doc(db, 'users', targetUserId, 'follow_requests', currentUserId), {
            uid: currentUserId,
            name: myName,
            timestamp: serverTimestamp()
          });
        }
      }
    } catch (err) {
      console.error("Follow Action Error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (isRequested && !isFollowing) {
    return (
      <button 
        onClick={handleToggleFollow}
        disabled={loading}
        className="w-full py-3 rounded-xl font-bold bg-amber-50 text-amber-700 border-2 border-amber-100 hover:bg-amber-100 transition-all flex items-center justify-center gap-2"
      >
        {loading ? <Loader2 size={18} className="animate-spin" /> : (
          <>
            <Clock size={18} />
            <span>Follow Request Sent</span>
          </>
        )}
      </button>
    );
  }

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
        <>
          <UserMinus size={18} /> 
          <span>Unfollow</span>
        </>
      ) : (
        <>
          <UserPlus size={18} /> 
          <span>Follow</span>
        </>
      )}
    </button>
  );
};

export default FollowButton;