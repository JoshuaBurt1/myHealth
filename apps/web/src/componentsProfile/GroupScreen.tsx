// GroupScreen.tsx

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  doc, updateDoc, collection, query, orderBy, onSnapshot, 
  addDoc, setDoc, serverTimestamp, getDocs, where, limit, 
  collectionGroup, getDoc, writeBatch, arrayRemove, arrayUnion
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { 
  ArrowLeft, Send, Users, Loader2, CalendarDays, Info, Trophy,
  MessageSquare, ShieldCheck, Activity, TrendingUp, Apple, Dumbbell,
  X, Clock, Settings, LogOut, Search, Plus, Minus, User as UserIcon, Database, ListFilter
} from 'lucide-react';

import type { Group, GroupMessage as Message, GroupTabType as TabType, GroupSearchUser as SearchUser } from './componentsGroupScreen/group';
import { GroupSchedule, type GroupScheduleEvent } from './componentsGroupScreen/GroupSchedule';
import { 
  VITAL_KEY_MAP, 
  BLOODTEST_KEY_MAP,
  SYMPTOM_KEY_MAP,
  DIET_KEY_MAP,
  MICRONUTRIENT_KEY_MAP, 
  STRENGTH_KEY_MAP,
  SPEED_KEY_MAP, 
  PLYO_KEY_MAP, 
  ENDURANCE_KEY_MAP, 
  YOGA_KEY_MAP, 
  MOBILITY_KEY_MAP, 
  PHYSIO_KEY_MAP
} from './profileConstants'; 

import { 
  calcMean, 
  calcStdDev, calcZScore, type CategoryComparison 
} from './compareUtils';
import { GroupCompareZScore } from './componentsGroupScreen/GroupCompareZScore';
import { ManageDataSourceModal } from './componentsGroupScreen/ManageDataSourceModal';
import { ManageDataFieldsModal } from './componentsGroupScreen/ManageDataFieldsModal';
import { GroupCompareTrend } from './componentsGroupScreen/GroupCompareTrend';
import { AllTimeRanking } from './componentsGroupScreen/AllTimeRanking';
import { extractDetailedValues } from './compareUtils';
import { getAiDoctorResponse } from '../services/aiDoctorService';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const getUserColor = (userId: string) => {
  const colors = [
    'text-emerald-600 bg-emerald-100 border-emerald-200',
    'text-blue-600 bg-blue-100 border-blue-200',
    'text-purple-600 bg-purple-100 border-purple-200',
    'text-rose-600 bg-rose-100 border-rose-200',
    'text-amber-600 bg-amber-100 border-amber-200',
    'text-indigo-600 bg-indigo-100 border-indigo-200',
    'text-cyan-600 bg-cyan-100 border-cyan-200',
    'text-fuchsia-600 bg-fuchsia-100 border-fuchsia-200'
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

export const GroupScreen: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  
  const [group, setGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  
  const [activeTab, setActiveTab] = useState<TabType | 'schedule' | 'compareVitals' |'compareDiet' | 'compareExercise'>('messages');
  const [scheduleEvents, setScheduleEvents] = useState<GroupScheduleEvent[]>([]);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  const [isGroupSettingsOpen, setIsGroupSettingsOpen] = useState(false);
  const [isAdminSettingsOpen, setIsAdminSettingsOpen] = useState(false);
  const [isManagingMembers, setIsManagingMembers] = useState(false);
  const [isDataSourceModalOpen, setIsDataSourceModalOpen] = useState(false);
  const [isDataFieldsModalOpen, setIsDataFieldsModalOpen] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  type CompareViewMode = 'zscore' | 'delta' | 'allTime';
  const [compareView, setCompareView] = useState<CompareViewMode>('zscore');
  const [vitalsData, setVitalsData] = useState<CategoryComparison[] | null>(null);
  const [dietData, setDietData] = useState<CategoryComparison[] | null>(null);
  const [exerciseData, setExerciseData] = useState<CategoryComparison[] | null>(null);
  
  const [isCalculatingStats, setIsCalculatingStats] = useState(false);
  const [memberProfilesMap, setMemberProfilesMap] = useState<Record<string, any>>({}); //active alert
  const [isAiResponding, setIsAiResponding] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const AI_DOCTOR_UID = 'vMnnZIs6xYhVqT9KgTvrnF7Ehvg2';
  
  const scrollToBottom = () => {
    setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const getMemberDisplayName = (userId: string) => {
    const member = group?.members.find(m => m.userId === userId);
    return member ? member.display_name : 'Unknown User';
  };

  const processedAlertsRef = useRef<Set<string>>(new Set());

  const formatFirestoreTimestamp = (ts: any) => {
    if (!ts || !ts.seconds) return 'recently';
    return new Date(ts.seconds * 1000).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  useEffect(() => {
    if (activeTab === 'messages' && messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, activeTab]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user || !groupId) return;

    const updateReadReceipt = async () => {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, { [`last_read_group_${groupId}`]: serverTimestamp() }, { merge: true });
    };
    updateReadReceipt();
  }, [groupId]);

  useEffect(() => {
    const currentUid = auth.currentUser?.uid;
    if (!groupId || !currentUid) return;

    const groupRef = doc(db, 'myHealth_groups', groupId);

    const unsubscribeGroup = onSnapshot(groupRef, (groupSnap) => {
      if (groupSnap.exists()) {
        const data = { id: groupSnap.id, ...groupSnap.data() } as Group;

        if (!data.memberUids.includes(currentUid)) {
          navigate('/');
          return;
        }

        setGroup(data);
        if (data.schedule) setScheduleEvents(data.schedule);
      } else {
        navigate('/');
      }
    });

    const messagesRef = collection(db, 'myHealth_groups', groupId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribeMessages = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Message));

      setMessages(msgs);
      setIsLoading(false);
    });

    return () => {
      unsubscribeGroup();
      unsubscribeMessages();
    };

  }, [groupId, navigate]);

  // Alert Engine for AI doctor
  useEffect(() => {
    if (!group || !group.memberUids.length) return;

    const unsubscribes = group.memberUids.map(uid => {
      const userDocRef = doc(db, 'users', uid, 'profile', 'user_data');
      return onSnapshot(userDocRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setMemberProfilesMap(prev => ({ ...prev, [uid]: data }));
        } else {
          setMemberProfilesMap(prev => ({ ...prev, [uid]: {} }));
        }
      });
    });

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [group?.memberUids]);

  // User Search
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
          limit(5)
        );
        
        const snapshot = await getDocs(q);
        const results: SearchUser[] = [];

        for (const userDoc of snapshot.docs) {
          const fetchedUserData = userDoc.data();
          const uid = userDoc.ref.parent.parent?.id;
          
          if (!uid || group?.memberUids.includes(uid)) continue;

          let imageId = null;
          try {
            const imgDocRef = doc(db, 'users', uid, 'profile', 'image_data');
            const imgSnap = await getDoc(imgDocRef);
            if (imgSnap.exists()) imageId = imgSnap.data().imageId;
          } catch (e) {}

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
  }, [searchQuery, group?.memberUids]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSendMessage();
    }
  };
const handleSendMessage = async (e?: React.FormEvent) => {
  if (e) e.preventDefault();
  const user = auth.currentUser;
  if (!newMessage.trim() || !groupId || !user || !group) return;

  const messageText = newMessage.trim();
  setIsSending(true);

  try {
    const groupRef = doc(db, 'myHealth_groups', groupId);
    const messagesRef = collection(db, 'myHealth_groups', groupId, 'messages');
    const userRef = doc(db, 'users', user.uid);

    // 1. user's message and their data
    const messagePromise = addDoc(messagesRef, {
      text: messageText,
      authorId: user.uid,
      authorName: getMemberDisplayName(user.uid),
      createdAt: serverTimestamp()
    });

    const groupUpdatePromise = updateDoc(groupRef, {
      lastUpdated: serverTimestamp(),
      lastUpdatedBy: user.uid
    });

    const userUpdatePromise = setDoc(userRef, {
      last_login: serverTimestamp(),
      [`last_read_group_${groupId}`]: serverTimestamp()
    }, { merge: true });

    await Promise.all([messagePromise, groupUpdatePromise, userUpdatePromise]);
    setNewMessage('');

    // AI Doctor trigger
    if (group.memberUids.includes(AI_DOCTOR_UID) && user.uid !== AI_DOCTOR_UID) {
      
      const rawProfile = memberProfilesMap[user.uid] || {};
      
      // get alerts from each user to be used to format the AI doctor response
      const alertList: any[] = rawProfile.activeAlerts || (rawProfile.activeAlert ? [rawProfile.activeAlert] : []);
      const formattedAlerts = alertList.map(a => {
        const timeStr = formatFirestoreTimestamp(a.onset);
        return `${a.type} (detected ${timeStr})`;
      }).join(', ');

      const userCohortStats: any = {};
      const extractStats = (data: CategoryComparison[] | null, category: string) => {
        if (!data) return;
        data.forEach(metric => {
          const memberStat = metric.members.find(m => m.userId === user.uid);
          if (memberStat) userCohortStats[`${category}_${metric.metricName}`] = memberStat;
        });
      };

      extractStats(vitalsData, 'Vitals');
      extractStats(dietData, 'Diet');
      extractStats(exerciseData, 'Exercise');

      const cleanHealthSummary: Record<string, any> = {
        'Active Alerts Summary': formattedAlerts || 'None',
        'Active Alerts': alertList 
      };

      // 1. Define Map Groups
      const healthMaps = {
        Vital: VITAL_KEY_MAP,
        Blood: BLOODTEST_KEY_MAP,
        Symptom: SYMPTOM_KEY_MAP,
        Diet: DIET_KEY_MAP,
        Micro: MICRONUTRIENT_KEY_MAP
      };

      const performanceMaps = {
        Strength: STRENGTH_KEY_MAP,
        Speed: SPEED_KEY_MAP,
        Plyo: PLYO_KEY_MAP,
        Endurance: ENDURANCE_KEY_MAP,
        Yoga: YOGA_KEY_MAP,
        Mobility: MOBILITY_KEY_MAP,
        Physio: PHYSIO_KEY_MAP
      };

      // 2. Processing helper
      const processProfileMap = (mapGroup: Record<string, Record<string, string>>) => {
        Object.entries(mapGroup).forEach(([categoryLabel, map]) => {
          Object.entries(map).forEach(([readableName, dbKey]) => {
            const extracted = extractDetailedValues(rawProfile, dbKey);
            if (extracted?.length > 0) {
              cleanHealthSummary[`[${categoryLabel}] ${readableName}`] = extracted[extracted.length - 1].value;
              const history = extracted.slice(Math.max(0, extracted.length - 6), extracted.length - 1).map(item => item.value);
              if (history.length > 0) {
                cleanHealthSummary[`[${categoryLabel} History] ${readableName}`] = history;
              }
            }
          });
        });
      };

      processProfileMap(healthMaps);
      processProfileMap(performanceMaps);

      setIsAiResponding(true);

      getAiDoctorResponse(
        messageText,
        getMemberDisplayName(user.uid),
        cleanHealthSummary,
        userCohortStats
      )
        .then(async (aiReply) => {
          if (aiReply) {
            await addDoc(collection(db, 'myHealth_groups', group.id, 'messages'), {
              text: aiReply,
              authorId: AI_DOCTOR_UID,
              authorName: 'AI Doctor',
              createdAt: serverTimestamp(),
              alertMetadata: alertList.map(a => `${a.type}_${a.onset?.seconds}`)
            });
          }
        })
        .catch(err => console.error("Error getting AI response:", err))
        .finally(() => setIsAiResponding(false)); 
    }
  } catch (error) {
    console.error("Error sending message:", error);
  } finally {
    setIsSending(false);
  }
};

  // Z-Score calculation
  useEffect(() => {
    if (!group) return;

    const needsVitals = activeTab === 'compareVitals' && !vitalsData && group.features?.compareVitals;
    const needsDiet = activeTab === 'compareDiet' && !dietData && group.features?.compareDiet;
    const needsExercise = activeTab === 'compareExercise' && !exerciseData && group.features?.compareExercise;
    
    if (!needsExercise && !needsVitals && !needsDiet) return; 

    let isMounted = true;

    const fetchAndProcessStats = async () => {
      setIsCalculatingStats(true);
      try {
        const participatingMembers = group.members.filter(m => {
          const isUserOptedOut = (group as any).optedOutDataUids?.includes(m.userId);
          const isAdminExcluded = (group as any).adminExcludedUids?.includes(m.userId);
          return !isUserOptedOut && !isAdminExcluded;
        });

        // Fetch User Docs
        const memberDataSnapshots = await Promise.all(
          participatingMembers.map(m => getDoc(doc(db, 'users', m.userId, 'profile', 'user_data')))
        );

        const memberProfiles = participatingMembers.map((m, i) => ({
          userId: m.userId,
          displayName: m.display_name,
          data: memberDataSnapshots[i].exists() ? memberDataSnapshots[i].data() : {}
        }));

        const processMetrics = (keyMap: Record<string, string>): CategoryComparison[] => {
          const results: CategoryComparison[] = [];
          const activeFields = (group as any).activeDataFields; 
          
          Object.entries(keyMap).forEach(([name, key]) => {
            if (activeFields && !activeFields.includes(key)) return;

            const rawMembers = memberProfiles.map(mp => {
              const details = extractDetailedValues(mp.data, key);
              const vals = details.map(d => d.value);
              
              const recent = vals.length > 0 ? vals[vals.length - 1] : null;
              const previous = vals.length > 1 ? vals[vals.length - 2] : null;
              const avg = vals.length > 0 ? calcMean(vals) : null;
              
              // Delta Velocity
              const velocity = (recent !== null && previous !== null) ? (recent - previous) : null;

              // All-Time Records
              let allTimeHigh: number | null = null;
              let allTimeHighDate: string | null = null;
              let allTimeLow: number | null = null;
              let allTimeLowDate: string | null = null;

              if (details.length > 0) {
                const sorted = [...details].sort((a, b) => b.value - a.value);
                allTimeHigh = sorted[0].value;
                allTimeHighDate = sorted[0].date || null;
                allTimeLow = sorted[sorted.length - 1].value;
                allTimeLowDate = sorted[sorted.length - 1].date || null;
              }

              return { ...mp, recent, avg, velocity, allTimeHigh, allTimeHighDate, allTimeLow, allTimeLowDate };
            });

            // Distributions
            const validRecents = rawMembers.map(m => m.recent).filter(v => v !== null) as number[];
            const validAvgs = rawMembers.map(m => m.avg).filter(v => v !== null) as number[];
            const validVelocities = rawMembers.map(m => m.velocity).filter(v => v !== null) as number[];

            if (validRecents.length === 0 && validAvgs.length === 0) return;

            const recentMean = calcMean(validRecents);
            const recentSd = calcStdDev(validRecents, recentMean);
            
            const avgMean = calcMean(validAvgs);
            const avgSd = calcStdDev(validAvgs, avgMean);

            const trendMean = calcMean(validVelocities);
            const trendSd = calcStdDev(validVelocities, trendMean);

            const members = rawMembers.map(m => ({
              userId: m.userId,
              displayName: m.displayName,
              recentValue: m.recent,
              avgValue: m.avg,
              
              recentZScore: m.recent !== null ? calcZScore(m.recent, recentMean, recentSd) : null,
              avgZScore: m.avg !== null ? calcZScore(m.avg, avgMean, avgSd) : null,
              recentVsAvgZScore: m.recent !== null ? calcZScore(m.recent, avgMean, avgSd) : null,
              
              trendDelta: m.velocity,
              trendZScore: m.velocity !== null ? calcZScore(m.velocity, trendMean, trendSd) : null,

              allTimeHigh: m.allTimeHigh,
              allTimeHighDate: m.allTimeHighDate,
              allTimeLow: m.allTimeLow,
              allTimeLowDate: m.allTimeLowDate
            }));

            if (members.some(m => m.recentValue !== null || m.avgValue !== null)) {
              results.push({ metricName: name, metricKey: key, members });
            }
          });
          return results;
        };

        if (isMounted) {
          if (needsVitals) {
            const allVitalKeys = {
              ...VITAL_KEY_MAP,
              ...BLOODTEST_KEY_MAP,
              ...SYMPTOM_KEY_MAP,
            };
            setVitalsData(processMetrics(allVitalKeys));
          }
          if (needsDiet) {
            const allDietKeys = {
              ...DIET_KEY_MAP,
              ...MICRONUTRIENT_KEY_MAP
            };
            setDietData(processMetrics(allDietKeys));
          }
          if (needsExercise) {
            const allExerciseKeys = {
              ...STRENGTH_KEY_MAP,
              ...SPEED_KEY_MAP,
              ...PLYO_KEY_MAP,
              ...ENDURANCE_KEY_MAP,
              ...YOGA_KEY_MAP,
              ...MOBILITY_KEY_MAP,
              ...PHYSIO_KEY_MAP
            };
            setExerciseData(processMetrics(allExerciseKeys));
          }
        }
      } catch (err) {
        console.error("Error processing group stats:", err);
      } finally {
        if (isMounted) setIsCalculatingStats(false);
      }
    };

    fetchAndProcessStats();

    return () => { isMounted = false; };
  }, [
    activeTab, 
    group,
    vitalsData,
    dietData,
    exerciseData,
    (group as any)?.optedOutDataUids, 
    (group as any)?.adminExcludedUids, 
    (group as any)?.activeDataFields
  ]);

  // AI DOCTOR trigger
  useEffect(() => {
    if (!group || !memberProfilesMap || messages.length === 0) return;

    const hasAiDoctor = group.memberUids.includes(AI_DOCTOR_UID);
    if (!hasAiDoctor) return;

    Object.entries(memberProfilesMap).forEach(([_uid, profile]) => {
      const alertList: any[] = profile.activeAlerts || (profile.activeAlert ? [profile.activeAlert] : []);
      if (alertList.length === 0) return;

      const newAlerts = alertList.filter(alert => {
        const alertId = `${alert.type}_${alert.onset?.seconds}`;
        
        if (processedAlertsRef.current.has(alertId)) return false;

        const isAlreadyInChat = messages.some(msg => 
          msg.authorId === AI_DOCTOR_UID && 
          msg.alertMetadata?.includes(alertId)
        );

        return !isAlreadyInChat;
      });

      if (newAlerts.length > 0) {
        const userName = profile.name || profile.display_name || 'Member';
        
        newAlerts.forEach(a => processedAlertsRef.current.add(`${a.type}_${a.onset?.seconds}`));

        const alertDescriptions = newAlerts.map(a => 
          `${a.type} starting from ${formatFirestoreTimestamp(a.onset)}`
        ).join(' and ');

        const consolidatedMessage = `Hi ${userName}, I notice active alerts for: ${alertDescriptions}. How are you feeling?`;

        // Add the document with the data for AI doctor to process
        addDoc(collection(db, 'myHealth_groups', group.id, 'messages'), {
          text: consolidatedMessage,
          authorId: AI_DOCTOR_UID,
          authorName: 'AI Doctor',
          createdAt: serverTimestamp(),
          alertMetadata: newAlerts.map(a => `${a.type}_${a.onset?.seconds}`) 
        }).catch(err => {
          console.error("Error sending AI alert:", err);
          newAlerts.forEach(a => processedAlertsRef.current.delete(`${a.type}_${a.onset?.seconds}`));
        });
      }
    });
  }, [group, memberProfilesMap, messages]);

  const handleToggleDataSharing = async () => {
    if (!group || !groupId || !auth.currentUser) return;
    
    const currentUid = auth.currentUser.uid;
    const isOptedOut = (group as any).optedOutDataUids?.includes(currentUid);
    const groupRef = doc(db, 'myHealth_groups', groupId);
    
    try {
      if (isOptedOut) {
        await updateDoc(groupRef, { optedOutDataUids: arrayRemove(currentUid) });
      } else {
        await updateDoc(groupRef, { optedOutDataUids: arrayUnion(currentUid) });
      }
    } catch (err) {
      console.error("Error updating sharing preferences:", err);
    }
  };

  const handleAddGroupEvent = (eventData: Omit<GroupScheduleEvent, 'id'>) => {
      const newEvent: GroupScheduleEvent = {
          id: Date.now().toString(),
          ...eventData
      };
      handleSaveGroupSchedule([...scheduleEvents, newEvent]);
  };

  const handleRemoveGroupEvent = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      handleSaveGroupSchedule(scheduleEvents.filter(ev => ev.id !== id));
  };

  // Add member to group
  const handleAddMember = async (user: SearchUser) => {
    if (!group || !groupId) return;
    try {
      const groupRef = doc(db, 'myHealth_groups', groupId);
      await updateDoc(groupRef, {
        memberUids: [...group.memberUids, user.uid],
        members: [...group.members, { userId: user.uid, display_name: user.displayName }]
      });
      setSearchQuery('');
    } catch (err) {
      console.error("Error adding member:", err);
    }
  };

  const handleRemoveMember = async (uid: string) => {
    if (!group || !groupId) return;
    if (uid === group.adminId) {
        alert("Cannot remove the admin. Transfer admin rights first.");
        return;
    }
    try {
      const groupRef = doc(db, 'myHealth_groups', groupId);
      await updateDoc(groupRef, {
        memberUids: group.memberUids.filter(id => id !== uid),
        members: group.members.filter(m => m.userId !== uid)
      });
    } catch (err) {
      console.error("Error removing member:", err);
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

  const handleSaveGroupSchedule = async (updatedEvents: GroupScheduleEvent[]) => {
    setIsSavingSchedule(true);
    try {
        const groupRef = doc(db, 'myHealth_groups', groupId!);
        await updateDoc(groupRef, { schedule: updatedEvents });
        setScheduleEvents(updatedEvents);
    } catch (err) {
        console.error("Failed to update group schedule", err);
    } finally {
        setIsSavingSchedule(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'compareExercise' && compareView === 'allTime') {
      setCompareView('zscore');
    }
  }, [activeTab, compareView]);

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="animate-spin text-emerald-500" size={40} />
    </div>
  );

  if (!group) return null;

  const isAdmin = auth.currentUser?.uid === group.adminId;
  const isSharingData = !((group as any).optedOutDataUids || []).includes(auth.currentUser?.uid || '');
  const hasFeatures = !!group.features;

  return (
    <div className="w-full md:max-w-7xl mx-auto p-0 md:p-6 bg-white md:bg-slate-50 min-h-screen pb-20 relative">
      
      {/* Modals */}
      {isDataSourceModalOpen && (
        <ManageDataSourceModal group={group} onClose={() => setIsDataSourceModalOpen(false)} />
      )}
      {isDataFieldsModalOpen && (
        <ManageDataFieldsModal group={group} onClose={() => setIsDataFieldsModalOpen(false)} />
      )}
      
      <div className="contents md:flex md:flex-col md:flex-1 md:bg-white md:rounded-3xl md:shadow-sm md:border md:border-slate-100 md:mt-2 md:overflow-hidden">
        
        <div className="h-20 md:h-24 border-b border-slate-100 flex items-center shrink-0 bg-white md:rounded-t-3xl w-full">
          
          <div className="w-20 md:w-24 flex justify-center border-r border-slate-100 h-full items-center">
            <button 
              onClick={() => navigate(-1)} 
              className="flex md:hidden p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors"
              title="Go Back"
            >
              <ArrowLeft size={28} />
            </button>
          </div>

          <div className="flex-1 h-full px-4 md:px-6 flex justify-between items-center min-w-0 gap-4">
    
            <div className="shrink-0 flex flex-col justify-center min-w-0">
              <h2 className="text-lg md:text-2xl font-black text-slate-800 flex items-center gap-2 tracking-tight min-w-0">
                <Users className="text-emerald-500 shrink-0 w-6 h-6 md:w-8 md:h-8" /> 
                <span className="whitespace-nowrap truncate">{group.name}</span>
              </h2>
              <p className="text-[10px] md:text-xs text-slate-400 font-medium">{group.memberUids.length} members</p>
            </div>

            {/* Horizontal member dashboard (desktop) */}
            <div className="hidden md:flex flex-1 gap-2 overflow-x-auto items-center min-w-0 h-full py-2 custom-scrollbar">
              {group.members.map((member) => {
                const colorClasses = getUserColor(member.userId);
                const isCreator = member.userId === group.adminId;
                
                return (
                  <div 
                    key={member.userId} 
                    onClick={() => navigate(`/profile/${member.userId}`)}
                    className={`shrink-0 flex items-center gap-2 border rounded-full px-3 py-1.5 cursor-pointer hover:shadow-md transition-all ${colorClasses}`}
                  >
                    <div className="w-6 h-6 rounded-full bg-white/50 flex items-center justify-center font-bold text-[10px] relative shrink-0">
                      {member.display_name.charAt(0).toUpperCase()}
                      {isCreator && (
                        <div className="absolute -top-1 -right-1 bg-white rounded-full">
                          <ShieldCheck size={10} className="text-emerald-500 fill-white" />
                        </div>
                      )}
                    </div>
                    <span className="text-xs font-bold whitespace-nowrap">{member.display_name}</span>
                  </div>
                );
              })}
            </div>

            {/* Info Toggle */}
            <button 
              onClick={() => setShowSidebar(!showSidebar)}
              className={`p-2 rounded-full transition-colors shrink-0 ml-2 ${showSidebar ? 'bg-emerald-100 text-emerald-600' : 'hover:bg-slate-100 text-slate-500'}`}
            >
              <Info className="w-6 h-6 md:w-7 md:h-7" />
            </button>
          </div>
        </div>

        {/* BODY (Sidebar + Content) */}
      <div className="flex flex-1 overflow-hidden relative">
          
        {/* LEFT VERTICAL TAB BAR (Sidebar) */}
        <nav className="w-20 md:w-24 bg-white border-r border-slate-200 flex flex-col items-center py-6 shrink-0 z-20 shadow-[4px_0_15px_-10px_rgba(0,0,0,0.05)]">
          <div className="flex flex-col gap-4 w-full px-3">
            <button 
              onClick={() => setActiveTab('messages')}
              className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all ${
                activeTab === 'messages' ? 'bg-emerald-100 text-emerald-600 shadow-sm' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
              }`}
            >
              <MessageSquare size={24} className="mb-1" />
              <span className="text-[10px] font-bold">Chat</span>
            </button>
            
            <button 
              onClick={() => setActiveTab('schedule')}
              className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all ${
                activeTab === 'schedule' ? 'bg-emerald-100 text-emerald-600 shadow-sm' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
              }`}
            >
              <CalendarDays size={24} className="mb-1" />
              <span className="text-[10px] font-bold">Schedule</span>
            </button>
            {group?.features?.compareVitals && (
              <button 
                onClick={() => setActiveTab('compareVitals')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all ${
                  activeTab === 'compareVitals' ? 'bg-emerald-100 text-emerald-600 shadow-sm' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                }`}
              >
                <Activity size={24} className="mb-1" />
                <span className="text-[10px] font-bold">Vitals</span>
              </button>
            )}

            {group?.features?.compareDiet && (
              <button 
                onClick={() => setActiveTab('compareDiet')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all ${
                  activeTab === 'compareDiet' ? 'bg-emerald-100 text-emerald-600 shadow-sm' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                }`}
              >
                <Apple size={24} className="mb-1" />
                <span className="text-[10px] font-bold">Nutrition</span>
              </button>
            )}
            
            {group?.features?.compareExercise && (
              <button 
                onClick={() => setActiveTab('compareExercise')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all ${
                  activeTab === 'compareExercise' ? 'bg-emerald-100 text-emerald-600 shadow-sm' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                }`}
              >
                <Dumbbell size={24} className="mb-1" />
                <span className="text-[10px] font-bold">Exercise</span>
              </button>
            )}
          </div>
        </nav>

          {/* MAIN CONTENT AREA */}
          <main className="flex-1 flex overflow-hidden w-full relative">
            
            <div className="flex-1 flex flex-col min-w-0 bg-slate-50 md:bg-transparent h-full">
              
              {/* MESSAGES TAB */}
              {activeTab === 'messages' && (
                <section className="flex-1 flex flex-col min-h-0"> 
                  <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth">
                    <div className="max-w-4xl mx-auto w-full space-y-6">
                      {messages.length === 0 ? (
                        <div className="text-center py-20 text-slate-400">
                          <MessageSquare size={48} className="mx-auto mb-4 opacity-20" />
                          <p className="font-medium">The conversation starts here.</p>
                        </div>
                      ) : (
                        messages.map((msg) => {
                          const isMine = msg.authorId === auth.currentUser?.uid;
                          const colorClasses = getUserColor(msg.authorId);
                          const textColor = colorClasses.split(' ')[0];
                          
                          return (
                            <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                              {!isMine && (
                                <button 
                                  onClick={() => navigate(`/profile/${msg.authorId}`)}
                                  className={`text-xs font-bold mb-1 ml-2 hover:underline ${textColor}`}
                                >
                                  {getMemberDisplayName(msg.authorId)}
                                </button>
                              )}
                              
                              <div className="flex items-end gap-2 group max-w-[85%]">
                                <div className={`px-4 py-2.5 rounded-2xl shadow-sm text-sm ${
                                  isMine 
                                    ? 'bg-emerald-600 text-white rounded-tr-none' 
                                    : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none'
                                }`}>
                                  {msg.text}
                                </div>
                                
                                <span className="text-[10px] text-slate-400 whitespace-nowrap mb-1 shrink-0">
                                  {msg.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}

                      {/* AI RESPONSE INDICATOR */}
                      {isAiResponding && (
                        <div className="flex flex-col items-start animate-pulse pb-4">
                          <span className="text-xs font-bold mb-1 ml-2 text-slate-400">
                            AI Doctor
                          </span>
                          <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-slate-400 italic text-sm rounded-tl-none shadow-sm">
                            <Loader2 size={14} className="animate-spin text-emerald-500" />
                            AI Doctor is responding...
                          </div>
                        </div>
                      )}

                      <div ref={messagesEndRef} />
                    </div>
                  </div>

                  <div className="shrink-0 p-4 bg-white border-t border-slate-200 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.05)]">
                    <div className="max-w-4xl mx-auto">
                      <form onSubmit={handleSendMessage} className="relative flex items-center">
                        <input
                          type="text"
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder="Message the group..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-5 pr-14 py-3.5 shadow-inner focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                        />
                        <button 
                          type="submit" 
                          disabled={!newMessage.trim() || isSending}
                          className="absolute right-2 p-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:bg-slate-300 transition-colors shadow-sm"
                        >
                          {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                        </button>
                      </form>
                    </div>
                  </div>
                </section>
              )}

              {/* SCHEDULE TAB */}
              {activeTab === 'schedule' && (
                <GroupSchedule 
                  scheduleEvents={scheduleEvents}
                  onAddEvent={handleAddGroupEvent}
                  onRemoveEvent={handleRemoveGroupEvent}
                  isSavingSchedule={isSavingSchedule}
                />
              )}

              {/* COMPARE TABS (EXERCISE & VITALS) */}
              {(activeTab === 'compareVitals' || activeTab === 'compareDiet' || activeTab === 'compareExercise') && (
              <section className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 md:p-6 bg-slate-50">
                <div className="max-w-5xl mx-auto w-full">
                  
                  {/* View Toggle Header */}
                  {!isCalculatingStats && ((activeTab === 'compareVitals' && vitalsData) || (activeTab === 'compareDiet' && dietData) || (activeTab === 'compareExercise' && exerciseData)) && (
                    <div className="flex items-center justify-center mb-8">
                      <div className="bg-slate-200/50 p-1.5 rounded-2xl flex items-center shadow-inner border border-slate-200 overflow-x-auto">
                        <button 
                          onClick={() => setCompareView('zscore')}
                          className={`px-4 md:px-6 py-2 rounded-xl text-sm font-bold transition-all duration-200 flex items-center gap-2 whitespace-nowrap ${
                            compareView === 'zscore' 
                            ? 'bg-white text-blue-600 shadow-md transform scale-105' 
                            : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          <Activity size={18} /> Z-Score
                        </button>
                        <button 
                          onClick={() => setCompareView('delta')}
                          className={`px-4 md:px-6 py-2 rounded-xl text-sm font-bold transition-all duration-200 flex items-center gap-2 whitespace-nowrap ${
                            compareView === 'delta' 
                            ? 'bg-white text-purple-600 shadow-md transform scale-105' 
                            : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          <TrendingUp size={18} /> Trend Delta
                        </button>
                        
                        {/* RESTRICTED: Only show All-Time if it's the Exercise tab */}
                        {activeTab === 'compareExercise' && (
                          <button 
                            onClick={() => setCompareView('allTime')}
                            className={`px-4 md:px-6 py-2 rounded-xl text-sm font-bold transition-all duration-200 flex items-center gap-2 whitespace-nowrap ${
                              compareView === 'allTime' 
                              ? 'bg-white text-amber-600 shadow-md transform scale-105' 
                              : 'text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            <Trophy size={18} /> All-Time
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {isCalculatingStats ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                      <Loader2 className={`animate-spin mb-4 ${activeTab === 'compareExercise' ? 'text-emerald-500' : 'text-emerald-500'}`} size={40} />
                      <p className="font-medium text-sm">Calculating group statistics...</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      
                      {activeTab === 'compareVitals' && vitalsData && (
                        <>
                          {compareView === 'zscore' && <GroupCompareZScore data={{ exercises: [], vitals: vitalsData }} />}
                          {compareView === 'delta' && <GroupCompareTrend data={{ exercises: [], vitals: vitalsData }} />}
                        </>
                      )}

                      {activeTab === 'compareDiet' && dietData && (
                        <>
                          {compareView === 'zscore' && <GroupCompareZScore data={{ exercises: [], vitals: dietData }} />}
                          {compareView === 'delta' && <GroupCompareTrend data={{ exercises: [], vitals: dietData }} />}
                        </>
                      )}

                      {activeTab === 'compareExercise' && exerciseData && (
                        <>
                          {compareView === 'zscore' && <GroupCompareZScore data={{ exercises: exerciseData, vitals: [] }} />}
                          {compareView === 'delta' && <GroupCompareTrend data={{ exercises: exerciseData, vitals: [] }} />}
                          {compareView === 'allTime' && <AllTimeRanking data={{ exercises: exerciseData, vitals: [] }} />}
                        </>
                      )}
                    </div>
                  )}
                  </div>
                </section>
              )}
            </div>
          </main>

          {showSidebar && (
            <aside className="absolute inset-0 z-50 flex h-full w-full flex-col shrink-0 overflow-y-auto bg-white animate-in slide-in-from-right-full duration-300 md:relative md:inset-auto md:w-80 md:border-l md:border-slate-200 md:shadow-none">
              
              {/* Sidebar Header */}
              <div className="p-4 md:p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center sticky top-0 z-10 w-full min-w-0">
                <div className="min-w-0">
                  <h2 className="font-bold text-slate-800 truncate">Group Amenities</h2>
                  <p className="text-xs text-slate-500 truncate">Manage your squad goals</p>
                </div>
                <button 
                  className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors shrink-0" 
                  onClick={() => setShowSidebar(false)}
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-4 md:p-6 space-y-8 flex-1 w-full min-w-0">
                
                <div className="lg:hidden"> 
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Users size={14} /> Team Members
                  </h3>
                  <div className="grid grid-cols-1 gap-2 w-full">
                    {group.members.map((member) => {
                      const colorClasses = getUserColor(member.userId);
                      const isCreator = member.userId === group.adminId;
                      
                      return (
                        <div 
                          key={member.userId}
                          onClick={() => navigate(`/profile/${member.userId}`)}
                          className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer hover:shadow-sm transition-all min-w-0 ${colorClasses}`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-white/50 flex items-center justify-center font-bold text-xs shrink-0 relative">
                              {member.display_name.charAt(0).toUpperCase()}
                              {isCreator && (
                                <ShieldCheck size={12} className="absolute -top-1 -right-1 text-emerald-500 fill-white" />
                              )}
                            </div>
                            <span className="font-bold text-sm text-slate-700 truncate min-w-0">
                              {member.display_name}
                            </span>
                          </div>
                          {isCreator && (
                            <span className="shrink-0 text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md uppercase ml-2">
                              Admin
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Upcoming events section */}
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <CalendarDays size={14} /> Upcoming Today
                  </h3>
                  <div className="space-y-3 w-full">
                    {scheduleEvents.filter(e => e.day === DAYS[new Date().getDay() - 1 === -1 ? 6 : new Date().getDay() - 1]).length > 0 ? (
                      scheduleEvents
                        .filter(e => e.day === DAYS[new Date().getDay() - 1 === -1 ? 6 : new Date().getDay() - 1])
                        .map(ev => (
                          <div key={ev.id} className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl relative overflow-hidden group min-w-0">
                            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                            <p className="text-sm font-bold text-slate-700 truncate min-w-0">{ev.title}</p>
                            <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1 mt-1 shrink-0">
                              <Clock size={12} /> {ev.time} ({ev.duration}h)
                            </p>
                          </div>
                        ))
                    ) : (
                      <p className="text-xs text-slate-400 italic">No events scheduled for today.</p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="pb-10 md:pb-0">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Actions</h3>
                  <div className="space-y-2">
                    
                    {/* Group settings */}
                    <button 
                      onClick={() => setIsGroupSettingsOpen(!isGroupSettingsOpen)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition-colors ${
                        isGroupSettingsOpen ? 'bg-slate-50 text-emerald-600' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Settings size={18} className="shrink-0" /> <span className="truncate">Group Settings</span>
                    </button>

                    {isGroupSettingsOpen && (
                      <div className="mt-2 p-4 bg-slate-50 rounded-2xl border border-slate-100 animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col pr-4">
                            <span className="text-sm font-semibold text-slate-700">Share My Data</span>
                            <span className="text-[10px] text-slate-500 leading-tight mt-0.5">
                              Include my data in group comparisons (Z-Score & Trends)
                            </span>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer shrink-0">
                            <input 
                              type="checkbox" 
                              className="sr-only peer"
                              checked={isSharingData}
                              onChange={handleToggleDataSharing}
                            />
                            <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                          </label>
                        </div>
                      </div>
                    )}

                    {/* Admin settings */}
                    {isAdmin && (
                      <>
                        <button 
                          onClick={() => setIsAdminSettingsOpen(!isAdminSettingsOpen)}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition-colors ${
                            isAdminSettingsOpen ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <ShieldCheck size={18} className="shrink-0" /> 
                          <span className="truncate">Admin Settings</span>
                        </button>

                        {isAdminSettingsOpen && (
                          <div className="mt-2 p-2 bg-slate-50/50 rounded-2xl border border-slate-100 animate-in fade-in slide-in-from-top-2 space-y-1">
                            
                            {/* Manage members */}
                            <div>
                              <button 
                                onClick={() => setIsManagingMembers(!isManagingMembers)}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-xl transition-colors ${
                                  isManagingMembers ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-white border border-transparent hover:border-slate-200 shadow-sm'
                                }`}
                              >
                                <Users size={16} /> Manage Members
                              </button>
                              
                              {/* Manage members search UI to add to current group */}
                              {isManagingMembers && (
                                <div className="mt-2 p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                                  <div className="relative mb-3">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input type="text" placeholder="Search for users..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
                                  </div>

                                  <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                                    {isSearching && <div className="p-2 text-center"><Loader2 className="animate-spin mx-auto text-slate-400" size={16} /></div>}
                                    {searchResults.map(user => (
                                      <div key={user.uid} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg group">
                                        <div className="flex items-center gap-2 truncate pr-2">
                                          <div className="w-6 h-6 shrink-0 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
                                            {user.imageId ? <img src={`/api/images/${user.imageId}`} alt="" /> : <UserIcon size={12} className="text-slate-400" />}
                                          </div>
                                          <span className="text-xs font-medium text-slate-700 truncate">{user.displayName}</span>
                                        </div>
                                        <button onClick={() => handleAddMember(user)} className="p-1 hover:bg-indigo-100 text-indigo-600 rounded-md shrink-0">
                                          <Plus size={14} />
                                        </button>
                                      </div>
                                    ))}
                                  </div>

                                  <div className="mt-3 pt-3 border-t border-slate-100">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Current Members</p>
                                    <div className="space-y-1">
                                      {group.members.map(member => (
                                        <div key={member.userId} className="flex items-center justify-between p-1.5 hover:bg-slate-50 rounded-lg">
                                          <span className="text-xs text-slate-600 truncate pr-2">{member.display_name} {member.userId === group.adminId && '(Admin)'}</span>
                                          {member.userId !== group.adminId && (
                                            <button onClick={() => handleRemoveMember(member.userId)} className="text-rose-400 hover:text-rose-600 hover:bg-rose-50 p-1 rounded-md shrink-0">
                                              <Minus size={14} />
                                            </button>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Manage data source */}
                            <button 
                              onClick={() => setIsDataSourceModalOpen(true)}
                              disabled={!hasFeatures}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-white border border-transparent hover:border-slate-200 shadow-sm rounded-xl transition-colors disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:border-transparent disabled:shadow-none"
                            >
                              <Database size={16} /> Manage Data Source
                            </button>

                            {/* Manage data fields */}
                            <button 
                              onClick={() => setIsDataFieldsModalOpen(true)}
                              disabled={!hasFeatures}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-white border border-transparent hover:border-slate-200 shadow-sm rounded-xl transition-colors disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:border-transparent disabled:shadow-none"
                            >
                              <ListFilter size={16} /> Manage Data Fields
                            </button>

                          </div>
                        )}
                      </>
                    )}

                    <hr className="my-2 border-slate-100" />
                    
                    <button 
                      onClick={(e) => handleLeaveGroup(e, group)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                    >
                      <LogOut size={18} className="shrink-0" /> <span className="truncate">Leave Group</span>
                    </button>
                  </div>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
};