// GroupMngScreen.tsx
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Search, Plus, Minus, Users, User as UserIcon, Loader2, ChevronRight, LogOut, Trash2, Bell, Activity, BarChart2 } from 'lucide-react';
import { writeBatch, collection, query, getDocs, doc, getDoc, addDoc, serverTimestamp, where, updateDoc, collectionGroup, limit, setDoc, deleteField } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { useNotifications } from '../context/NotificationContext';
import { type Group, type GroupSearchUser as SearchUser } from './componentsGroupScreen/group';

export const GroupMngScreen: React.FC = () => {
  const navigate = useNavigate();
  const { userData, userGroups } = useNotifications();

  // Tab State
  const [activeTab, setActiveTab] = useState<'my-groups' | 'create-group'>('my-groups');

  // Existing State
  const [groupName, setGroupName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<SearchUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [optimisticReadIds, setOptimisticReadIds] = useState<Set<string>>(new Set());

  // Split Compare Features
  const [enableCompareExercise, setEnableCompareExercise] = useState(false);
  const [enableCompareVitals, setEnableCompareVitals] = useState(false);

  const isLoadingGroups = userGroups === null || userData === null;

  const handleGroupClick = (groupId: string) => {
    setOptimisticReadIds(prev => new Set(prev).add(groupId));    
    if (auth.currentUser) {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      setDoc(userRef, { 
        [`last_read_group_${groupId}`]: serverTimestamp() 
      }, { merge: true }).catch(() => {});
    }
    navigate(`/group/${groupId}`);
  };

  const handleProfileClick = (uid: string) => {
    navigate(`/profile/${uid}`);
  };

  // Self-cleaning logic (delete old users/documentId/last_read_group files)
  useEffect(() => {
    if (!auth.currentUser || !userData || !userGroups) return;

    const cleanupOrphanedGroupFields = async () => {
      try {
        const userRef = doc(db, 'users', auth.currentUser!.uid);
        const updates: Record<string, any> = {};
        let needsCleanup = false;

        const lastReadKeys = Object.keys(userData).filter(key => 
          key.startsWith('last_read_group_')
        );

        lastReadKeys.forEach(key => {
          const groupIdFromField = key.replace('last_read_group_', '');
          
          const isStillMember = userGroups.some((g: Group) => g.id === groupIdFromField);

          if (!isStillMember) {
            updates[key] = deleteField();
            needsCleanup = true;
          }
        });

        if (needsCleanup) {
          await updateDoc(userRef, updates);
          console.log("Successfully scrubbed orphaned group fields.");
        }
      } catch (err) {
        console.error("Error during group field cleanup:", err);
      }
    };

    cleanupOrphanedGroupFields();
  }, [userData, userGroups]); 
  
  // Handle User Search
  useEffect(() => {
    const performSearch = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const lowerTerm = searchQuery.toLowerCase();
        
        const q = query(
          collectionGroup(db, 'profile'),
          where('name_lowercase', '>=', lowerTerm),
          where('name_lowercase', '<=', lowerTerm + '\uf8ff'),
          limit(10)
        );
        
        const snapshot = await getDocs(q);
        const results: SearchUser[] = [];

        for (const userDoc of snapshot.docs) {
          const fetchedUserData = userDoc.data();
          const uid = userDoc.ref.parent.parent?.id;
          
          if (!uid || uid === auth.currentUser?.uid || selectedMembers.some(m => m.uid === uid)) continue;
          if (results.some(r => r.uid === uid)) continue;

          let imageId = null;
          try {
            const imgDocRef = doc(db, 'users', uid, 'profile', 'image_data');
            const imgSnap = await getDoc(imgDocRef);
            if (imgSnap.exists()) {
              imageId = imgSnap.data().imageId;
            }
          } catch (imgErr) {
            console.error("Failed to fetch image for user:", uid);
          }

          results.push({
            uid,
            displayName: fetchedUserData.name || fetchedUserData.display_name || 'Unknown User',
            imageId
          });
        }
        setSearchResults(results);
      } catch (error) {
        console.error("Error searching users:", error);
      } finally {
        setIsSearching(false);
      }
    };

    const timer = setTimeout(() => performSearch(), 400);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedMembers]);
  
  const addMember = (user: SearchUser) => {
    setSelectedMembers(prev => [...prev, user]);
    setSearchQuery('');
    setSearchResults([]);
  };

  const removeMember = (uid: string) => {
    setSelectedMembers(prev => prev.filter(m => m.uid !== uid));
  };

  const handleSaveGroup = async () => {
    if (!groupName.trim() || !auth.currentUser) return;
    
    setIsSaving(true);
    try {
      const userDocRef = doc(db, 'users', auth.currentUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      const creatorDisplayName = userDocSnap.exists() 
        ? userDocSnap.data().display_name 
        : (auth.currentUser.displayName || 'New Member');

      const groupData = {
        name: groupName,
        memberUids: [auth.currentUser.uid, ...selectedMembers.map(m => m.uid)],
        members: [
          { userId: auth.currentUser.uid, display_name: creatorDisplayName }, 
          ...selectedMembers.map(m => ({
            userId: m.uid,
            display_name: m.displayName
          }))
        ],
        createdBy: auth.currentUser.uid,
        adminId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        features: {
          compareExercise: enableCompareExercise,
          compareVitals: enableCompareVitals
        }
      };

      await addDoc(collection(db, 'myHealth_groups'), groupData);
      
      setGroupName('');
      setSelectedMembers([]);
      setSearchQuery('');
      setActiveTab('my-groups');
    } catch (error) {
      console.error("Error saving group:", error);
      alert("Failed to create group. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteGroup = async (e: React.MouseEvent, groupId: string) => {
    e.stopPropagation();
    if (window.confirm("Delete this group? This cannot be undone.")) {
      try {
        await purgeGroupData(groupId);
      } catch (error) {
        console.error("Error deleting group:", error);
        alert("Failed to delete group.");
      }
    }
  };

  const handleLeaveGroup = async (e: React.MouseEvent, group: Group) => {
    e.stopPropagation();
    if (!auth.currentUser) return;
    if (window.confirm(`Are you sure you want to leave ${group.name}?`)) {
      try {
        const currentUid = auth.currentUser.uid;
        const updatedMemberUids = group.memberUids.filter(uid => uid !== currentUid);
        const updatedMembers = group.members.filter(m => m.userId !== currentUid);
        if (updatedMemberUids.length === 0) {
          await purgeGroupData(group.id);
        } else {
          const groupRef = doc(db, 'myHealth_groups', group.id);
          const updatePayload: any = {
            memberUids: updatedMemberUids,
            members: updatedMembers
          };
          if (group.adminId === currentUid && updatedMemberUids.length > 0) {
            updatePayload.adminId = updatedMemberUids[0];
          }
          await updateDoc(groupRef, updatePayload);
        }
      } catch (error) {
        console.error("Error leaving group:", error);
        alert("Failed to leave group.");
      }
    }
  };

  const purgeGroupData = async (groupId: string) => {
    const batch = writeBatch(db);
    const groupRef = doc(db, 'myHealth_groups', groupId);
    const messagesRef = collection(db, 'myHealth_groups', groupId, 'messages');
    const messagesSnapshot = await getDocs(messagesRef);
    messagesSnapshot.forEach((msgDoc) => {
      batch.delete(msgDoc.ref);
    });
    batch.delete(groupRef);
    await batch.commit();
  };
    
  return (
    <div className="max-w-7xl mx-auto p-0 md:p-6 bg-slate-50 min-h-screen pb-20 relative">
      <div className="contents md:flex md:flex-col md:flex-1 md:bg-white md:rounded-3xl md:shadow-sm md:border md:border-slate-100 md:mt-2 md:overflow-hidden">
        <div className="h-20 md:h-24 border-b border-slate-100 flex items-center shrink-0 bg-white md:rounded-t-3xl">
          <div className="w-20 md:w-24 flex justify-center border-r border-slate-100 h-full items-center">
            <button 
              onClick={() => navigate(-1)} 
              className="flex md:hidden p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors"
              title="Go Back"
            >
              <ArrowLeft size={28} />
            </button>
          </div>

          <div className="flex-1 px-6 md:px-8 flex flex-col justify-center">
            <h2 className="text-xl md:text-2xl font-black text-slate-800 flex items-center gap-3 tracking-tight">
              {activeTab === 'my-groups' ? (
                <><Users className="text-emerald-500" size={28} /> My Groups</>
              ) : (
                <><Plus className="text-emerald-500" size={28} /> Create New Group</>
              )}
            </h2>
            <p className="hidden md:block text-slate-500 text-sm mt-0.5">
              {activeTab === 'my-groups'
                ? 'Manage and access your current groups'
                : 'Form a group and invite members'}
            </p>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-20 md:w-24 border-r border-slate-100 flex flex-col items-center py-6 gap-8 bg-white shrink-0">
            <button 
              onClick={() => setActiveTab('my-groups')}
              className="flex flex-col items-center gap-1.5 w-full group outline-none"
            >
              <div className={`p-3 rounded-2xl transition-all duration-200 ${
                activeTab === 'my-groups' 
                  ? 'bg-emerald-100 text-emerald-600 shadow-sm' 
                  : 'text-slate-400 group-hover:bg-slate-50'
              }`}>
                <Users size={24} />
              </div>
              <span className={`text-[10px] md:text-xs font-bold text-center ${
                activeTab === 'my-groups' ? 'text-emerald-600' : 'text-slate-500'
              }`}>
                My Groups
              </span>
            </button>

            <button 
              onClick={() => setActiveTab('create-group')}
              className="flex flex-col items-center gap-1.5 w-full group outline-none"
            >
              <div className={`p-3 rounded-2xl transition-all duration-200 ${
                activeTab === 'create-group' 
                  ? 'bg-emerald-100 text-emerald-600 shadow-sm' 
                  : 'text-slate-400 group-hover:bg-slate-50'
              }`}>
                <Plus size={24} />
              </div>
              <span className={`text-[10px] md:text-xs font-bold text-center leading-tight ${
                activeTab === 'create-group' ? 'text-emerald-600' : 'text-slate-500'
              }`}>
                Create<br/>Group
              </span>
            </button>
          </div>

          <div className="flex-1 bg-slate-50/30 overflow-y-auto">
            {activeTab === 'my-groups' ? (
              <div className="p-4 md:p-8">
                {isLoadingGroups ? (
                  <div className="flex justify-center p-12">
                    <Loader2 className="animate-spin text-emerald-500" size={32} />
                  </div>
                ) : userGroups.length === 0 ? (
                  <div className="text-center p-12 text-slate-500 bg-white rounded-3xl border border-slate-100 shadow-sm max-w-lg mx-auto mt-10">
                    <Users size={48} className="mx-auto mb-4 text-slate-200" />
                    <p className="text-lg font-medium text-slate-600">No groups found</p>
                    <p className="text-sm mt-1 text-slate-400">You haven't joined or created any groups yet.</p>
                    <button 
                      onClick={() => setActiveTab('create-group')}
                      className="mt-6 px-6 py-2.5 bg-emerald-50 text-emerald-600 font-bold rounded-xl hover:bg-emerald-100 transition-colors"
                    >
                      Create your first group
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-5xl">
                    {userGroups.map((group: Group) => {
                      const updatedTime = group.lastUpdated?.toMillis() || 0;
                      // @ts-ignore
                      const readTime = userData?.[`last_read_group_${group.id}`]?.toMillis() || 0;
                      const isOptimisticallyRead = optimisticReadIds.has(group.id);
                      const isUnread = updatedTime > readTime && !isOptimisticallyRead;

                      return (
                        <div 
                          key={group.id}
                          onClick={() => handleGroupClick(group.id)}
                          className={`group p-5 bg-white border rounded-2xl cursor-pointer transition-all flex items-center justify-between ${
                            isUnread 
                              ? 'border-emerald-300 ring-2 ring-emerald-50 shadow-md' 
                              : 'border-slate-200 shadow-sm hover:border-emerald-300 hover:shadow-md'
                          }`}
                        >
                          <div className="flex-1 min-w-0 pr-4">
                            <div className="flex items-center gap-2">
                              {isUnread && (
                                <div className="relative flex shrink-0 items-center justify-center">
                                  <span className="absolute animate-ping inline-flex h-3 w-3 rounded-full bg-emerald-400 opacity-75"></span>
                                  <div className="relative bg-emerald-500 rounded-full p-1 border border-white shadow-sm">
                                    <Bell size={10} className="text-white fill-white" />
                                  </div>
                                </div>
                              )}
                              <h3 className={`truncate text-lg ${isUnread ? 'font-black text-emerald-900' : 'font-bold text-slate-800'}`}>
                                {group.name}
                              </h3>
                            </div>

                            <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-1.5">
                              <Users size={14} className="text-slate-400" /> {group.members.length} Members
                            </p>

                            <div className="flex flex-wrap gap-1.5 mt-3">
                                {group.members.slice(0, 4).map(m => (
                                  <span 
                                    key={m.userId} 
                                    onClick={(e) => { e.stopPropagation(); handleProfileClick(m.userId); }}
                                    className="text-[11px] font-medium bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 px-2.5 py-1 rounded-full text-slate-600 truncate max-w-25 transition-colors"
                                  >
                                    {m.display_name}
                                  </span>
                                ))}
                                {group.members.length > 4 && <span className="text-[11px] font-medium text-slate-400 py-1">+{group.members.length - 4} more</span>}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {group.adminId === auth.currentUser?.uid && (
                              <button 
                                onClick={(e) => handleDeleteGroup(e, group.id)} 
                                className="p-2.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-colors md:opacity-0 md:group-hover:opacity-100" 
                                title="Delete Group"
                              >
                                <Trash2 size={20} />
                              </button>
                            )}
                            <button 
                              onClick={(e) => handleLeaveGroup(e, group)} 
                              className="p-2.5 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded-full transition-colors md:opacity-0 md:group-hover:opacity-100" 
                              title="Leave Group"
                            >
                              <LogOut size={20} />
                            </button>
                            <ChevronRight className="text-slate-300 group-hover:text-emerald-500 transition-transform group-hover:translate-x-1 ml-1" size={24} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex justify-center items-start p-4 md:p-8">
                <div className="w-full max-w-2xl flex flex-col bg-white border border-slate-200 shadow-sm rounded-3xl overflow-hidden">
                  
                  <div className="p-6 md:p-8 space-y-8">
                    {/* Input: Group Name & Features */}
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Group Identity</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Project Alpha" 
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-700 text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      />
                      
                      {/* NEW: Split Compare Feature Toggles */}
                      <div className="mt-4 flex flex-col gap-3 ml-1">
                        <div className="flex items-center gap-3">
                          <input 
                            type="checkbox" 
                            id="exerciseCompareCheck"
                            checked={enableCompareExercise}
                            onChange={(e) => setEnableCompareExercise(e.target.checked)}
                            className="w-5 h-5 text-emerald-500 rounded border-slate-300 focus:ring-emerald-500 focus:ring-offset-1 cursor-pointer"
                          />
                          <label htmlFor="exerciseCompareCheck" className="text-sm font-semibold text-slate-600 flex items-center gap-2 cursor-pointer select-none">
                            <Activity size={16} className="text-emerald-500" /> Group Exercise Comparisons
                          </label>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <input 
                            type="checkbox" 
                            id="vitalsCompareCheck"
                            checked={enableCompareVitals}
                            onChange={(e) => setEnableCompareVitals(e.target.checked)}
                            className="w-5 h-5 text-emerald-500 rounded border-slate-300 focus:ring-amber-500 focus:ring-offset-1 cursor-pointer"
                          />
                          <label htmlFor="vitalsCompareCheck" className="text-sm font-semibold text-slate-600 flex items-center gap-2 cursor-pointer select-none">
                            <BarChart2 size={16} className="text-emerald-500" /> Group Vitals Comparisons
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Input: Search Members */}
                    <div className="relative">
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Invite Members</label>
                      <div className="relative">
                        <Search className="absolute left-4 top-4 text-slate-400" size={20} />
                        <input 
                          type="text" 
                          placeholder="Search by name..." 
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-4 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                        />
                        {isSearching && <Loader2 className="absolute right-4 top-4 text-emerald-500 animate-spin" size={20} />}
                      </div>

                      {/* Search Results Dropdown */}
                      {searchResults.length > 0 && (
                        <div className="mt-2 bg-white rounded-2xl border border-slate-200 shadow-xl divide-y divide-slate-50 overflow-hidden absolute w-full z-20">
                          {searchResults.map(user => (
                            <div key={user.uid} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                              <div className="flex items-center gap-3">
                                <div 
                                  className="flex items-center gap-3 cursor-pointer group/name"
                                  onClick={() => handleProfileClick(user.uid)}
                                >
                                  {user.imageId ? (
                                    <img src={user.imageId} alt="" className="w-10 h-10 rounded-full object-cover bg-slate-100" />
                                  ) : (
                                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                                      <UserIcon size={18} />
                                    </div>
                                  ) }
                                  <span className="font-semibold text-slate-700 group-hover/name:text-emerald-600 transition-colors">{user.displayName}</span>
                                </div>
                              </div>
                              <button 
                                onClick={() => addMember(user)}
                                className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-full transition-all"
                              >
                                <Plus size={20} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Selected Members List */}
                    {selectedMembers.length > 0 && (
                      <div className="pt-4">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Selected ({selectedMembers.length})</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {selectedMembers.map(user => (
                            <div key={user.uid} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                              <div className="flex items-center gap-3 truncate">
                                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 font-bold text-xs">
                                  {user.displayName.charAt(0)}
                                </div>
                                <span className="font-medium text-slate-700 truncate text-sm">{user.displayName}</span>
                              </div>
                              <button onClick={() => removeMember(user.uid)} className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg">
                                <Minus size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Form Footer */}
                  <div className="p-6 md:p-8 bg-slate-50/80 border-t border-slate-100">
                    <button 
                      onClick={handleSaveGroup}
                      disabled={!groupName.trim() || isSaving}
                      className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white font-black py-4 rounded-2xl shadow-lg shadow-emerald-500/20 transition-all flex justify-center items-center gap-2 text-lg active:scale-[0.98]"
                    >
                      {isSaving ? <Loader2 size={24} className="animate-spin" /> : "Save Group"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};