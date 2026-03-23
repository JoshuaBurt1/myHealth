import { Timestamp } from 'firebase/firestore';

export interface GroupScheduleEvent {
  id: string;
  day: string;
  time: string;
  duration: number;
  type: 'group' | 'appointment' | 'practice' | 'other';
  title: string;
}

/**
 * Individual member object stored within a Group's members array
 */
export interface GroupMember {
  userId: string;
  display_name: string;
}

/**
 * Feature toggles for the group
 */
export interface GroupFeatures {
  zScoreCompare?: boolean;
}

/**
 * Main Group document structure as stored in 'myHealth_groups'
 */
export interface Group {
  id: string;
  name: string;
  memberUids: string[];
  members: GroupMember[];
  createdBy: string;
  adminId: string;
  createdAt: Timestamp | any;
  lastUpdated: Timestamp | any;
  lastUpdatedBy?: string;
  schedule?: GroupScheduleEvent[];
  features?: GroupFeatures; // Added features property
}

/**
 * Message document structure as stored in 'myHealth_groups/{groupId}/messages'
 */
export interface GroupMessage {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  createdAt: Timestamp | any;
}

/**
 * Tab types for the Group UI
 */
export type GroupTabType = 'messages' | 'schedule' | 'compare';

/**
 * Helper for searching users to add to groups
 */
export interface GroupSearchUser {
  uid: string;
  displayName: string;
  imageId: string | null;
}