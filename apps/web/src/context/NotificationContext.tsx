import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';

const NotificationContext = createContext<any>(null);

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const [userData, setUserData] = useState<any>(null);
  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [userGroups, setUserGroups] = useState<any[]>([]);

  useEffect(() => {
    // Only run if a user is logged in
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (!user) {
        setUserData(null);
        setUserPosts([]);
        setUserGroups([]);
        return;
      }

      // ONE listener for User Doc (Captures previous_login and last_read_post_ID)
      const unsubUser = onSnapshot(doc(db, 'users', user.uid), (s) => setUserData(s.data()));

      // ONE listener for Posts (Only posts authored by the user for Navbar notifications)
      const qPosts = query(collection(db, 'myHealth_posts'), where('authorId', '==', user.uid));
      const unsubPosts = onSnapshot(qPosts, (s) => setUserPosts(s.docs.map(d => ({ id: d.id, ...d.data() }))));

      // ONE listener for Groups
      const qGroups = query(collection(db, 'myHealth_groups'), where('memberUids', 'array-contains', user.uid));
      const unsubGroups = onSnapshot(qGroups, (s) => {
        const groups = s.docs.map(d => ({ id: d.id, ...d.data() }));
        setUserGroups(groups.sort((a: any, b: any) => (b.lastUpdated?.toMillis() || 0) - (a.lastUpdated?.toMillis() || 0)));
      });

      return () => { unsubUser(); unsubPosts(); unsubGroups(); };
    });

    return () => unsubscribeAuth();
  }, []);

  return (
    <NotificationContext.Provider value={{ userData, userPosts, userGroups }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);