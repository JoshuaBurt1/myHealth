//ForumScreen.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, doc, getDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useLocation } from '../context/LocationContext';
import { useNotifications } from '../context/NotificationContext';
import { MessageSquarePlus, Globe, Search, ChevronLeft, ChevronRight, MapPin, Bell } from 'lucide-react';

// Components & Types
import { ForumSkeleton } from '../componentsForum/ForumSkeleton';
import { PostCard } from '../componentsForum/PostCard';
import { CreatePostModal } from '../componentsForum/CreatePostModal';
import { ExpandableMap } from '../componentsForum/MapComponents';
import type { Post } from '../componentsForum/forum';

// Constants & Utils
import { 
  FORUM_SECTIONS, HAZARD_TYPES, HELP_TYPES, PUBLIC_TYPES, TOPIC_TYPES, TABS
} from '../componentsForum/forumConstants';
import { setupLeafletDefaults, zoomToRadius, radiusToZoom } from '../componentsForum/mapUtils';

setupLeafletDefaults();

const DropdownGroup = ({ label, items, current, setter, closer }: { label: string, items: string[], current: string, setter: (val: string) => void, closer: () => void }) => (
  <div className="mt-0">
    <div className="px-3 py-0 text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-2 mb-0">
      <span className="h-px flex-1 bg-slate-100"></span>
      {label}
      <span className="h-px flex-1 bg-slate-100"></span>
    </div>
    {items.map(item => (
      <button
        key={item}
        onClick={() => { setter(item); closer(); }}
        className={`w-full text-left px-3 py-1.5 text-sm rounded-lg transition-colors ${
          current === item ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-600 hover:bg-slate-50 font-medium'
        }`}
      >
        {item}
      </button>
    ))}
  </div>
);

const ForumScreen: React.FC = () => {
  const { userLocation, locationError } = useLocation();
  const { userData } = useNotifications();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const user = auth.currentUser;
  
  // App State
  const [activeSection, setActiveSection] = useState<string>('Personal Health');
  
  // Modal & UI State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'post' | 'poll' | 'petition'>('post');
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  // Post Content State
  const [postTitle, setPostTitle] = useState(''); 
  const [newPostContent, setNewPostContent] = useState('');
  const [pollContent, setPollContent] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [postLocation, setPostLocation] = useState<[number, number] | null>(null);

  // Hazards & Specific Section Modal Data
  const [hazardType, setHazardType] = useState('');
  const [hazardValue, setHazardValue] = useState('');
  const [postTopic, setPostTopic] = useState('');
  const [topicValue, setTopicValue] = useState('');
  const [helpType, setHelpType] = useState('');
  const [helpValue, setHelpValue] = useState('');
  const [publicType, setPublicType] = useState('');
  const [publicValue, setPublicValue] = useState('');
  const [popHealthCategory, setPopHealthCategory] = useState<'hazard' | 'help' | 'public'>('hazard');

  // Filtering & Pagination
  const [filterHazard, setFilterHazard] = useState('none');
  const [filterTopic, setFilterTopic] = useState('none');
  const [isHazardOpen, setIsHazardOpen] = useState(false);
  const [isTopicOpen, setIsTopicOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [radius, setRadius] = useState(20000); 
  const [currentPage, setCurrentPage] = useState(1);
  const [showTypes, setShowTypes] = useState({ post: true, poll: true, petition: true });
  const [showOnlyNew, setShowOnlyNew] = useState(false);

  // Population Health "help" type Post Deletion
  const [helpStartDate, setHelpStartDate] = useState('');
  const [helpEndDate, setHelpEndDate] = useState('');
  
  const POSTS_PER_PAGE = 10;
  const mapZoom = useMemo(() => radiusToZoom(radius), [radius]);

  // Window Resize Listeners
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isMobile) setIsFilterDrawerOpen(false);
  }, [isMobile]);

  // Unread Notifications Logic
  const unreadPostIds = useMemo(() => {
    if (!userData || !posts.length || !user) return [];

    return posts
      .filter((post) => {
        // RULE 1: It must be your post to show up as a notification bell
        if (post.authorId !== user.uid) return false;

        // RULE 2: Someone ELSE must have been the last person to update it
        if (!post.lastUpdatedBy || post.lastUpdatedBy === user.uid) return false;

        // RULE 3: Check against your personal "last read" ledger
        const lastReadEntry = userData[`last_read_post_${post.id}`];
        const postUpdatedMillis = post.lastUpdated?.toMillis() || 0;

        // If there is activity from someone else and you've NEVER read the post, it's unread
        if (!lastReadEntry) return true;

        // It's unread ONLY if the post was updated AFTER you last clicked it
        return postUpdatedMillis > lastReadEntry.toMillis();
      })
      .map((post) => post.id);
  }, [posts, userData, user?.uid]);

  // Data Fetching
  useEffect(() => {
    const q = query(collection(db, 'myHealth_posts'), orderBy('lastUpdated', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const now = new Date();
      const allPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Post[];
      
      // FRONTEND AUTO-DELETE: Check for expired "Help" posts
      allPosts.forEach(async (post) => {
        if (post.help && post.helpEndDate) {
          const expiry = post.helpEndDate.toDate ? post.helpEndDate.toDate() : new Date(post.helpEndDate);
          if (now > expiry) {
            console.log(`Post ${post.id} expired. Deleting...`);
            await deleteDoc(doc(db, 'myHealth_posts', post.id));
          }
        }
      });

      setPosts(allPosts);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeSection, filterHazard, filterTopic, searchQuery, radius, showTypes]);

  // Data Derivation
  const filteredPosts = useMemo(() => {
    return posts.filter(post => {
      if (!showTypes[post.type as keyof typeof showTypes]) return false;
      if (post.forumSection !== activeSection) return false;

      if (showOnlyNew && userData?.previous_login && post.createdAt) {
        if (post.createdAt.toMillis() <= userData.previous_login.toMillis()) return false;
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        if (!post.title.toLowerCase().includes(query) && 
            !post.content.toLowerCase().includes(query) &&
            !post.authorName.toLowerCase().includes(query)) return false;
      }

      if (activeSection === 'Population Health' && filterHazard !== 'none') {
        if (post.hazard?.type !== filterHazard && post.help?.type !== filterHazard && post.public?.type !== filterHazard) return false;
      } else if (activeSection === 'Personal Health' && filterTopic !== 'none') {
        if (post.topic !== filterTopic) return false;
      }

      if (userLocation && post.location && radius < 20000) {
        const [postLat, postLng] = post.location;
        const [userLat, userLng] = userLocation;
        const distInDegrees = Math.sqrt(Math.pow(postLat - userLat, 2) + Math.pow(postLng - userLng, 2));
        if (distInDegrees > radius * 0.009) return false;
      }
      return true;
    });
  }, [posts, showTypes, activeSection, searchQuery, filterHazard, filterTopic, userLocation, radius, showOnlyNew, userData]);

  const totalPages = Math.ceil(filteredPosts.length / POSTS_PER_PAGE);
  const paginatedPosts = filteredPosts.slice((currentPage - 1) * POSTS_PER_PAGE, currentPage * POSTS_PER_PAGE);

  const handleTogglePostLocation = () => {
    if (postLocation) {
      setPostLocation(null);
    } else {
      if (!userLocation) return alert("Location not available. Check permissions.");
      setPostLocation(userLocation);
    }
  };

  const handleMarkRead = async (postId: string) => {
    if (!user) return;
    
    // Find the post to verify authorship
    const post = posts.find(p => p.id === postId);
    
    // ONLY track reads for the user's own posts to drastically decrease write/read operations
    if (post && post.authorId !== user.uid) return;

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        [`last_read_post_${postId}`]: serverTimestamp()
      });
    } catch (err) {
      console.error("Error marking post as read:", err);
    }
  };

  const resetModal = () => {
    setPostTitle(''); setNewPostContent(''); setPollContent(''); setPollOptions(['', '']);
    setPostLocation(null); setHazardType(''); setHazardValue(''); setPostTopic('');
    setHelpType(''); setHelpValue(''); setPublicType(''); setPublicValue('');
    setIsModalOpen(false); setModalMode('post'); setHelpStartDate(''); setHelpEndDate('');
    setTopicValue(''); 
    setPopHealthCategory('hazard');
  };

  const handleCreate = async () => {
    if (!user) return alert("Please log in!");

    try {
      const profileSnap = await getDoc(doc(db, 'users', user.uid, 'profile', 'user_data'));
      const realName = profileSnap.exists() ? profileSnap.data().name : "Anonymous";

      const commonData: any = {
        authorId: user.uid, authorName: realName, createdAt: serverTimestamp(), lastUpdated: serverTimestamp(),
        lastUpdatedBy: user.uid, // Ensures creator doesn't get a bell
        forumSection: activeSection, likes: [], dislikes: [], replyCount: 0, location: postLocation || null
      };

      if (activeSection === 'Population Health') {
        if (popHealthCategory === 'hazard') {
          commonData.hazard = { type: hazardType, value: hazardValue.trim() };
          commonData.confirm = (postLocation || userLocation) ? [{ userId: user.uid, location: postLocation || userLocation, confirmTime: Timestamp.now() }] : [];
        } else if (popHealthCategory === 'help') {
          if (!helpStartDate || !helpEndDate) {
            return alert("Both Start and End times are required for Help events.");
          }
          const start = new Date(helpStartDate);
          const end = new Date(helpEndDate);
          if (end <= start) {
            return alert("The End time must be after the Start time.");
          }
          commonData.help = { type: helpType, value: helpValue.trim() };
          commonData.helpStartDate = Timestamp.fromDate(start);
          commonData.helpEndDate = Timestamp.fromDate(end);
        } else if (popHealthCategory === 'public') {
          commonData.public = { type: publicType, value: publicValue.trim() };
        }
      } else if (activeSection === 'Personal Health') {
        commonData.topic = postTopic || 'General';
        commonData.detail = topicValue.trim();
      }

      let finalPostData = { ...commonData };
      if (modalMode === 'post') {
        if (!newPostContent.trim() || !postTitle.trim()) return alert("Please fill out the title and content.");
        finalPostData = { ...finalPostData, type: 'post', title: postTitle.trim(), content: newPostContent.trim() };
      } else if (modalMode === 'poll') {
        if (!pollContent.trim() || pollOptions.some(opt => !opt.trim())) return alert("Please provide a question and fill all option fields.");
        finalPostData = { ...finalPostData, type: 'poll', title: postTitle.trim(), content: pollContent.trim(), options: pollOptions.map(text => ({ text: text.trim(), votes: 0 })), userVotes: {} };
      } else if (modalMode === 'petition') {
        if (!newPostContent.trim() || !postTitle.trim()) return alert("Please fill out the title and content.");
        finalPostData = { ...finalPostData, type: 'petition', title: postTitle.trim(), content: newPostContent.trim(), signatures: [] };
      }

      await addDoc(collection(db, 'myHealth_posts'), finalPostData);
      resetModal();
    } catch (err) {
      console.error("Error creating post:", err);
      alert("Something went wrong while publishing.");
    }
  };

  const renderFilterContent = () => (
    <div className="p-4 space-y-4">
      {/* SEARCH */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-600">Search Discussions</label>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-3 text-slate-400" />
          <input type="text" placeholder="Search posts..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-9 pr-4 outline-none focus:border-indigo-500 text-sm font-medium text-slate-700" />
        </div>
      </div>

      <label className="text-xs font-bold text-slate-600">Filter By Location</label>
      
      {/* REUSABLE EXPANDABLE MAP */}
      <div className={`transition-all duration-500 ease-in-out ${
        isMapExpanded && isMobile ? 'h-100' : 'h-auto'
      }`}>
        <ExpandableMap 
          userLocation={userLocation}
          mapZoom={mapZoom}
          activeSection={activeSection}
          filteredPosts={filteredPosts}
          radius={radius}
          isExpanded={isMapExpanded}
          onToggleExpand={() => setIsMapExpanded(!isMapExpanded)}
        />
      </div>

      {/* SHARED RANGE SLIDER */}
      <div className="space-y-4 mt-4">
        <div className="flex justify-between items-end">
          <label className="text-xs font-bold text-slate-600 flex items-center gap-2">
            <MapPin size={14} className="text-indigo-500" /> Nearby Range
          </label>
          <span className="text-sm font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">
            {radius >= 20000 ? "Global" : `${radius}km`}
          </span>
        </div>
        
        {userLocation ? (
          <input 
            type="range"
            min="2"
            max="18"
            step="1"
            value={radiusToZoom(radius)}
            onChange={(e) => {
              const zoom = parseInt(e.target.value);
              setRadius(zoomToRadius(zoom));
            }}
            className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600 scale-x-[-1]" 
          />
        ) : (
          <div className="text-[10px] font-bold text-amber-600 bg-amber-50 p-3 rounded-xl border border-amber-100">
            {locationError ? `Error: ${locationError}` : "Enable location to filter"}
          </div>
        )}
      </div>

      {/* POST TYPE CHECKBOXES */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-600">Post Types</label>
        <div className="flex gap-4">
          {(['post', 'poll', 'petition'] as const).map((type) => (
            <label key={type} className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={showTypes[type]} onChange={(e) => setShowTypes(prev => ({ ...prev, [type]: e.target.checked }))} className="rounded border-slate-300 text-indigo-600 w-3.5 h-3.5" />
              <span className="text-xs font-medium text-slate-700 capitalize">{type}</span>
            </label>
          ))}
        </div>
      </div>

      {/* DYNAMIC FILTERS */}
      {(activeSection === 'Population Health' || activeSection === 'Personal Health') && (
        <div className="space-y-3">
          <label className="text-xs font-bold text-slate-600 ml-1">Filter By Topic</label>
          <div className="relative">
            <button 
              onClick={() => activeSection === 'Population Health' ? setIsHazardOpen(!isHazardOpen) : setIsTopicOpen(!isTopicOpen)}
              className="w-full bg-white border border-slate-200 rounded-xl py-2.5 px-4 flex items-center justify-between text-sm font-semibold text-slate-700 shadow-sm hover:border-indigo-300 transition-all"
            >
              <span className="truncate">
                {activeSection === 'Population Health' 
                  ? (filterHazard === 'none' ? 'All Topics' : filterHazard)
                  : (filterTopic === 'none' ? 'All Topics' : filterTopic)}
              </span>
              <svg 
                className={`w-4 h-4 text-slate-400 transition-transform ${ (activeSection === 'Population Health' ? isHazardOpen : isTopicOpen) ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {(activeSection === 'Population Health' ? isHazardOpen : isTopicOpen) && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => { setIsHazardOpen(false); setIsTopicOpen(false); }} />
                
                <div className="relative z-20 w-full mt-2 bg-slate-50/50 border border-slate-100 rounded-2xl max-h-80 overflow-y-auto p-2 space-y-1 animate-in fade-in slide-in-from-top-2 duration-200">
                  
                  <button 
                    onClick={() => { setFilterHazard('none'); setFilterTopic('none'); setIsHazardOpen(false); setIsTopicOpen(false); }}
                    className="w-full text-left px-3 py-2 text-sm font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  >
                    All Topics
                  </button>

                  {activeSection === 'Population Health' ? (
                    <>
                      <DropdownGroup label="Hazards" items={HAZARD_TYPES} current={filterHazard} setter={setFilterHazard} closer={() => setIsHazardOpen(false)} />
                      <DropdownGroup label="Events" items={HELP_TYPES} current={filterHazard} setter={setFilterHazard} closer={() => setIsHazardOpen(false)} />
                      <DropdownGroup label="Public Access" items={PUBLIC_TYPES} current={filterHazard} setter={setFilterHazard} closer={() => setIsHazardOpen(false)} />
                    </>
                  ) : (
                    <DropdownGroup label="Categories" items={TOPIC_TYPES} current={filterTopic} setter={setFilterTopic} closer={() => setIsTopicOpen(false)} />
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <hr className="border-slate-100" />

      {isMobile && (
        <button
          onClick={() => setIsFilterDrawerOpen(false)}
          className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold mt-4 shadow-lg shadow-indigo-100 active:scale-[0.98] transition-transform"
        >
          Show {filteredPosts.length} Results
        </button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-8 p-4 bg-slate-50 min-h-screen pb-24 max-w-7xl mx-auto">
      {/* --- MAIN FEED --- */}
      <div className={`flex-1 max-w-2xl w-full mx-auto lg:mx-0 transition-all duration-300 ${
        isMapExpanded && !isMobile ? 'opacity-20 pointer-events-none blur-sm' : 'opacity-100'
      }`}>
        <header className="mb-6 flex flex-row items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl lg:text-4xl font-bold text-slate-900 tracking-tight">Health Forum</h1>
            <p className="text-slate-500 mt-1 text-sm lg:text-base">Engage with local health initiatives.</p>
          </div>
          
          <div className="flex flex-col items-end gap-2 shrink-0">
            <button 
              onClick={() => setIsModalOpen(true)} 
              className="flex items-center justify-center gap-2 bg-indigo-600 text-white w-28 sm:w-32 py-3 lg:px-6 rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 whitespace-nowrap order-1"
            >
              <MessageSquarePlus size={20} />
              <span className="text-sm sm:text-base">Create</span>
            </button>

            {/* Mobile-only filter button */}
            <button 
              onClick={() => setIsFilterDrawerOpen(true)} 
              className="lg:hidden flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 w-28 sm:w-32 py-3 rounded-2xl font-bold shadow-sm active:scale-95 transition-all order-2"
            >
              <Search size={20} className="text-indigo-600" />
              <span className="text-sm sm:text-base">Filter</span>
            </button>
          </div>
        </header>

        {/* SECTION TABS WITH NOTIFICATION BELLS */}
        <div className="flex gap-1 sm:gap-2 mb-6 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
          {FORUM_SECTIONS.map((section) => {
            // Check if any of the unread post IDs belong to this specific forum section
            const hasUnreadInSection = unreadPostIds.some(unreadId => {
              const post = posts.find(p => p.id === unreadId);
              return post?.forumSection === section.id;
            });

            return (
              <div key={section.id} className="relative flex-1">
                <button
                  onClick={() => { 
                    setActiveSection(section.id); 
                    setFilterHazard('none'); 
                    setFilterTopic('none'); 
                    setSearchQuery('');
                    setShowOnlyNew(false); 
                  }}
                  className={`w-full flex items-center justify-center gap-1.5 sm:gap-2 px-1 sm:px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                    activeSection === section.id && !showOnlyNew
                      ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100' 
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                  }`}
                >
                  <span className="shrink-0">{section.icon}</span>
                  <span className="hidden sm:inline">{section.id}</span>
                  <span className="inline sm:hidden">
                    {section.id === 'Personal Health' && 'Personal'}
                    {section.id === 'Population Health' && 'Population'}
                    {section.id === 'Off Topic' && 'Misc'}
                  </span>
                </button>

                {/* NOTIFICATION BELL */}
                {hasUnreadInSection && (
                  <div className="absolute -top-2 -right-1 z-20 flex items-center justify-center pointer-events-none">
                    <span className="absolute animate-ping inline-flex h-5 w-5 rounded-full bg-blue-400 opacity-75"></span>
                    <div className="relative bg-blue-600 rounded-full p-1 border-2 border-white shadow-lg">
                      <Bell size={10} className="text-white fill-white" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* POST FEED & PAGINATION */}
        <div className="space-y-4">
          {loading ? (
            <>
              {[1, 2, 3].map((n) => <ForumSkeleton key={n} />)}
            </>
          ) : paginatedPosts.length > 0 ? (
            <>
              {paginatedPosts.map((post) => (
                <PostCard 
                  key={post.id} 
                  post={post} 
                  isUnread={unreadPostIds.includes(post.id)} 
                  onMarkRead={() => handleMarkRead(post.id)} 
                />
              ))}
              {totalPages > 1 && (
                <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 mt-6">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="flex items-center gap-1 text-sm font-bold text-slate-600 disabled:opacity-30 hover:text-indigo-600 transition-colors">
                    <ChevronLeft size={16} /> Prev
                  </button>
                  <span className="text-sm font-bold text-slate-400">Page <span className="text-slate-800">{currentPage}</span> of {totalPages}</span>
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="flex items-center gap-1 text-sm font-bold text-slate-600 disabled:opacity-30 hover:text-indigo-600 transition-colors">
                    Next <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 bg-white rounded-3xl border border-slate-200">
              <p className="text-slate-500 font-medium">No posts found.</p>
              <button onClick={() => setIsModalOpen(true)} className="mt-4 text-indigo-600 font-bold hover:underline">Be the first to post</button>
            </div>
          )}
        </div>
      </div>

      {/* --- SIDEBAR & MOBILE DRAWER --- */}
      <div className={`transition-all duration-300 order-1 lg:order-2 ${
        isMapExpanded && isMobile ? 'w-full mb-8' : 'w-full lg:w-96'
      }`}>
        
        {/* Mobile Drawer Overlay */}
        <div 
          className={`fixed inset-0 z-100 bg-slate-900/40 backdrop-blur-sm transition-all duration-300 lg:hidden ${
            isFilterDrawerOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
          }`}
          onClick={() => setIsFilterDrawerOpen(false)} 
        />

        {/* Mobile Drawer Container */}
        <div className={`fixed inset-y-0 right-0 z-110 w-[90%] max-w-md bg-white shadow-2xl transform transition-transform duration-300 ease-in-out lg:hidden flex flex-col ${
          isFilterDrawerOpen ? 'translate-x-0' : 'translate-x-full'
        }`}>
          <div className="w-1.5 h-12 bg-slate-100 rounded-full absolute left-2 top-1/2 -translate-y-1/2" />
          <div className="p-6 border-b border-slate-50 flex justify-between items-center shrink-0">
            <div>
              <h2 className="text-xl font-black text-slate-800">Filter Discovery</h2>
              <p className="text-xs text-slate-500 mt-1">Refine your community view</p>
            </div>
            <button 
              onClick={() => setIsFilterDrawerOpen(false)} 
              className="p-2 bg-slate-100 rounded-full text-slate-500 hover:text-indigo-600 transition-colors active:scale-90"
            >
              <ChevronRight size={24} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            {renderFilterContent()}
          </div>
        </div>

        {/* Desktop Sidebar Container */}
        {!isMobile && (
          <div className="lg:sticky lg:top-4 space-y-4 h-fit max-h-[calc(100vh-2rem)] pr-2 custom-scrollbar">
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-50 bg-slate-50/50 shrink-0">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Globe size={14} className="text-indigo-500" /> Filter Discovery
                  </h3>
                </div>
                {renderFilterContent()}
            </div>
          </div>
        )}
      </div>
                
      {/* MODAL OVERLAY */}
      <CreatePostModal 
        isOpen={isModalOpen}
        onClose={resetModal}
        activeSection={activeSection}
        modalMode={modalMode}
        setModalMode={setModalMode}
        tabs={TABS}
        postTitle={postTitle}
        setPostTitle={setPostTitle}
        newPostContent={newPostContent}
        setNewPostContent={setNewPostContent}
        pollContent={pollContent}
        setPollContent={setPollContent}
        pollOptions={pollOptions}
        setPollOptions={setPollOptions}
        popHealthCategory={popHealthCategory}
        setPopHealthCategory={setPopHealthCategory}
        helpType={helpType}
        setHelpType={setHelpType}
        helpValue={helpValue}
        setHelpValue={setHelpValue}
        publicType={publicType}
        setPublicType={setPublicType}
        publicValue={publicValue}
        setPublicValue={setPublicValue}
        hazardType={hazardType}
        setHazardType={setHazardType}
        hazardValue={hazardValue}
        setHazardValue={setHazardValue}
        postTopic={postTopic}
        setPostTopic={setPostTopic}
        topicValue={topicValue}
        setTopicValue={setTopicValue}
        helpStartDate={helpStartDate}
        setHelpStartDate={setHelpStartDate}
        helpEndDate={helpEndDate}
        setHelpEndDate={setHelpEndDate}
        HAZARD_TYPES={HAZARD_TYPES}
        HELP_TYPES={HELP_TYPES}
        PUBLIC_TYPES={PUBLIC_TYPES}
        TOPIC_TYPES={TOPIC_TYPES}
        postLocation={postLocation}
        onToggleLocation={handleTogglePostLocation} 
        onCreate={handleCreate}
      />
    </div>
  );
};

export default ForumScreen;