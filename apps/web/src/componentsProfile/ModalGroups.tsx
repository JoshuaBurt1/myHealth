import React, { useState, useEffect } from 'react';
import { X, Search, Plus, Minus, Users, User as UserIcon, Loader2, ChevronRight, LogOut, Trash2 } from 'lucide-react';
import { collection, query, orderBy, startAt, endAt, getDocs, doc, getDoc, addDoc, serverTimestamp, where, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';

interface SearchUser {
  uid: string;
  displayName: string;
  imageId: string | null;
}

interface Group {
  id: string;
  name: string;
  memberUids: string[];
  members: { userId: string; display_name: string }[];
  createdBy: string;
  adminId?: string;
}

interface ModalGroupsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ModalGroups: React.FC<ModalGroupsProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);

  // Create Group State
  const [groupName, setGroupName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<SearchUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch User's Groups
  useEffect(() => {
    if (!isOpen || !auth.currentUser) return;

    const groupsRef = collection(db, 'myHealth_groups');
    const q = query(groupsRef, where('memberUids', 'array-contains', auth.currentUser.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const groupsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Group[];
      setUserGroups(groupsData);
      setIsLoadingGroups(false);
    });

    return () => unsubscribe();
  }, [isOpen]);

  // Handle User Search (Debounced)
  useEffect(() => {
    const performSearch = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const usersRef = collection(db, 'users');
        const q = query(
          usersRef,
          orderBy('display_name'),
          startAt(searchQuery),
          endAt(searchQuery + '\uf8ff')
        );
        const snapshot = await getDocs(q);
        const results: SearchUser[] = [];

        for (const userDoc of snapshot.docs) {
          const userData = userDoc.data();
          const uid = userDoc.id;
          
          if (uid === auth.currentUser?.uid || selectedMembers.some(m => m.uid === uid)) continue;

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
            displayName: userData.display_name || 'Unknown User',
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
    if (!groupName.trim() || selectedMembers.length === 0 || !auth.currentUser) return;
    
    setIsSaving(true);
    try {
      // 1. Fetch current user's real display name from the users collection
      const userDocRef = doc(db, 'users', auth.currentUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      const creatorDisplayName = userDocSnap.exists() 
        ? userDocSnap.data().display_name 
        : (auth.currentUser.displayName || 'New Member');

      // 2. Construct the group data with the proper name
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
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'myHealth_groups'), groupData);
      
      setGroupName('');
      setSelectedMembers([]);
      setSearchQuery('');
    } catch (error) {
      console.error("Error saving group:", error);
      alert("Failed to create group. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleGroupClick = (groupId: string) => {
    onClose();
    navigate(`/group/${groupId}`);
  };

  const handleLeaveGroup = async (e: React.MouseEvent, group: Group) => {
    e.stopPropagation(); // Prevents navigating to group
    if (!auth.currentUser) return;

    if (window.confirm(`Are you sure you want to leave ${group.name}?`)) {
      try {
        const groupRef = doc(db, 'myHealth_groups', group.id);
        const updatedMemberUids = group.memberUids.filter(uid => uid !== auth.currentUser!.uid);
        const updatedMembers = group.members.filter(m => m.userId !== auth.currentUser!.uid);
        
        await updateDoc(groupRef, {
          memberUids: updatedMemberUids,
          members: updatedMembers
        });
      } catch (error) {
        console.error("Error leaving group:", error);
        alert("Failed to leave group.");
      }
    }
  };

  const handleDeleteGroup = async (e: React.MouseEvent, groupId: string) => {
    e.stopPropagation(); // Prevents navigating to group
    if (window.confirm("Are you sure you want to delete this group? This action cannot be undone.")) {
      try {
        await deleteDoc(doc(db, 'myHealth_groups', groupId));
      } catch (error) {
        console.error("Error deleting group:", error);
        alert("Failed to delete group.");
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[95vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-3 tracking-tight uppercase">
            <Users className="text-emerald-500" size={24} /> Group Management
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Two-column layout body */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          
          {/* LEFT COLUMN: MY GROUPS */}
          <div className="w-full md:w-1/2 flex flex-col border-r border-slate-100 bg-slate-50/30">
            <div className="p-5 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">My Groups</h3>
              <p className="text-sm text-slate-500">Manage and access your current groups</p>
            </div>
            
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {isLoadingGroups ? (
                <div className="flex justify-center p-8"><Loader2 className="animate-spin text-emerald-500" /></div>
              ) : userGroups.length === 0 ? (
                <div className="text-center p-12 text-slate-500 bg-white rounded-2xl border border-slate-100 shadow-sm">
                  <Users size={48} className="mx-auto mb-3 text-slate-300" />
                  <p>You aren't in any groups yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {userGroups.map(group => (
                    <div 
                      key={group.id} 
                      onClick={() => handleGroupClick(group.id)}
                      className="group p-4 bg-white border border-slate-200 hover:border-emerald-300 hover:shadow-md rounded-2xl cursor-pointer transition-all flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <h3 className="font-bold text-slate-800 mb-1">{group.name}</h3>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <Users size={12} /> {group.members.length} Members
                        </p>
                        <div className="flex flex-wrap gap-1 mt-2">
                           {group.members.slice(0, 3).map(m => (
                             <span key={m.userId} className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full text-slate-600 truncate max-w-20">
                               {m.display_name}
                             </span>
                           ))}
                           {group.members.length > 3 && <span className="text-[10px] text-slate-400">+{group.members.length - 3}</span>}
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex items-center gap-1 ml-2">
                        {group.adminId === auth.currentUser?.uid && (
                          <button 
                            onClick={(e) => handleDeleteGroup(e, group.id)} 
                            className="p-2 text-rose-300 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-colors opacity-0 group-hover:opacity-100" 
                            title="Delete Group"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                        <button 
                          onClick={(e) => handleLeaveGroup(e, group)} 
                          className="p-2 text-slate-300 hover:text-orange-500 hover:bg-orange-50 rounded-full transition-colors opacity-0 group-hover:opacity-100" 
                          title="Leave Group"
                        >
                          <LogOut size={18} />
                        </button>
                        <ChevronRight className="text-slate-300 group-hover:text-emerald-500 transition-colors ml-1" size={20} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: CREATE GROUP */}
          <div className="w-full md:w-1/2 flex flex-col bg-white">
            <div className="p-5 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">Create New Group</h3>
              <p className="text-sm text-slate-500">Form a group and invite members</p>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Group Name Input */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Group Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Team UofZ" 
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>

              {/* Add Members Search */}
              <div className="relative">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Add Members</label>
                <div className="relative">
                  <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Search users by name..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                  {isSearching && <Loader2 className="absolute right-3 top-3.5 text-slate-400 animate-spin" size={18} />}
                </div>

                {searchResults.length > 0 && (
                  <div className="absolute w-full mt-2 bg-white border border-slate-200 shadow-xl rounded-xl z-20 max-h-56 overflow-y-auto">
                    {searchResults.map(user => (
                      <div key={user.uid} className="flex items-center justify-between p-3 hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors">
                        <div className="flex items-center gap-3">
                          {user.imageId ? (
                            <img src={user.imageId} alt={user.displayName} className="w-8 h-8 rounded-full object-cover bg-slate-200" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><UserIcon size={14} className="text-slate-400" /></div>
                          )}
                          <span className="font-medium text-sm text-slate-700">{user.displayName}</span>
                        </div>
                        <button onClick={() => addMember(user)} className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-full transition-colors">
                          <Plus size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected Members */}
              {selectedMembers.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                    Selected Members ({selectedMembers.length})
                  </label>
                  <div className="space-y-2">
                    {selectedMembers.map(user => (
                      <div key={user.uid} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
                        <div className="flex items-center gap-3">
                          {user.imageId ? (
                            <img src={user.imageId} alt={user.displayName} className="w-10 h-10 rounded-full object-cover bg-slate-200 shadow-sm border border-white" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-slate-200 border border-white shadow-sm flex items-center justify-center"><UserIcon size={18} className="text-slate-400" /></div>
                          )}
                          <span className="font-semibold text-sm text-slate-700">{user.displayName}</span>
                        </div>
                        <button onClick={() => removeMember(user.uid)} className="p-2 bg-rose-50 text-rose-500 hover:bg-rose-100 rounded-full transition-colors">
                          <Minus size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Create Group Footer Action */}
            <div className="p-5 border-t border-slate-100 bg-slate-50/50">
              <button 
                onClick={handleSaveGroup}
                disabled={!groupName.trim() || selectedMembers.length === 0 || isSaving}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl shadow-sm transition-all flex justify-center items-center gap-2"
              >
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : "Save New Group"}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};