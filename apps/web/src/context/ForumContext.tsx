// src/context/ForumContext.tsx
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { Post } from '../componentsForum/forum';

interface ForumContextType {
  posts: Post[];
  loading: boolean;
}

const ForumContext = createContext<ForumContextType | undefined>(undefined);

export const ForumProvider = ({ children }: { children: ReactNode }) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'myHealth_posts'), orderBy('lastUpdated', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const now = new Date();
      const allPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Post[];
      
      allPosts.forEach(async (post) => {
        if (post.help && post.helpEndDate) {
          const expiry = post.helpEndDate.toDate ? post.helpEndDate.toDate() : new Date(post.helpEndDate);
          if (now > expiry) {
            console.log(`System: Post ${post.id} expired. Cleaning up...`);
            await deleteDoc(doc(db, 'myHealth_posts', post.id));
            try {
              await deleteDoc(doc(db, 'myHealth_news', post.id));
            } catch (e) {
              console.error("News cleanup failed:", e);
            }
          }
        }
      });

      setPosts(allPosts);
      setLoading(false);
    }, (error) => {
      console.error("Forum Listener Error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <ForumContext.Provider value={{ posts, loading }}>
      {children}
    </ForumContext.Provider>
  );
};

export const useForum = () => {
  const context = useContext(ForumContext);
  if (!context) throw new Error("useForum must be used within a ForumProvider");
  return context;
};