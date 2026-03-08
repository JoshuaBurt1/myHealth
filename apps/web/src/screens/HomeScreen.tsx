import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, limit, onSnapshot, orderBy } from 'firebase/firestore';
import { Vote, FileSignature, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ForumPost {
  id: string;
  title: string;
  type: 'poll' | 'petition' | 'discussion';
  createdAt: any;
}

const HomeScreen: React.FC = () => {
  const [activePoll, setActivePoll] = useState<ForumPost | null>(null);
  const [activePetition, setActivePetition] = useState<ForumPost | null>(null);

  useEffect(() => {
    // Reference the correct path from your rules: myHealth_posts
    const postsRef = collection(db, 'myHealth_posts');

    // Query for the latest Poll
    const pollQuery = query(
      postsRef, 
      where('type', '==', 'poll'), 
      orderBy('createdAt', 'desc'), 
      limit(1)
    );

    // Query for the latest Petition
    const petitionQuery = query(
      postsRef, 
      where('type', '==', 'petition'), 
      orderBy('createdAt', 'desc'), 
      limit(1)
    );

    const unsubPoll = onSnapshot(pollQuery, (snapshot) => {
      if (!snapshot.empty) {
        setActivePoll({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as ForumPost);
      } else {
        setActivePoll(null);
      }
    });

    const unsubPetition = onSnapshot(petitionQuery, (snapshot) => {
      if (!snapshot.empty) {
        setActivePetition({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as ForumPost);
      } else {
        setActivePetition(null);
      }
    });

    return () => {
      unsubPoll();
      unsubPetition();
    };
  }, []);

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Health Desk</h1>
        <p className="text-slate-600 mt-1">Welcome back! Here is what is going on locally and around the world.</p>
      </header>

      <div className="space-y-4">
        {/* Poll Alert */}
        {activePoll && (
          <Link to="/forum" className="flex items-center justify-between p-4 bg-indigo-50 border border-indigo-100 rounded-xl hover:bg-indigo-100 transition-colors">
            <div className="flex items-center gap-3">
              <Vote className="text-indigo-600" size={20} />
              <div>
                <p className="text-xs font-bold text-indigo-600 uppercase">Active Poll</p>
                <p className="text-sm font-semibold text-slate-800">{activePoll.title}</p>
              </div>
            </div>
            <ArrowRight size={16} className="text-indigo-400" />
          </Link>
        )}

        {/* Petition Alert */}
        {activePetition && (
          <Link to="/forum" className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-100 rounded-xl hover:bg-emerald-100 transition-colors">
            <div className="flex items-center gap-3">
              <FileSignature className="text-emerald-600" size={20} />
              <div>
                <p className="text-xs font-bold text-emerald-600 uppercase">New Petition</p>
                <p className="text-sm font-semibold text-slate-800">{activePetition.title}</p>
              </div>
            </div>
            <ArrowRight size={16} className="text-emerald-400" />
          </Link>
        )}
      </div>
    </div>
  );
};

export default HomeScreen;