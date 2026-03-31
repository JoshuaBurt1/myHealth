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
  compareExercise?: boolean;
  compareVitals?: boolean;
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
export type GroupTabType = 'messages' | 'schedule' | 'compareExercise' | 'compareVitals';

/**
 * Helper for searching users to add to groups
 */
export interface GroupSearchUser {
  uid: string;
  displayName: string;
  imageId: string | null;
}

export interface MedicationDef {
  name: string;
  dose: string;
  timePeriod: string;
  onset: string;
  duration: string;
  effect: string;
  contraindications: string;
  symptoms: string;
}

export const STANDARD_MEDICATIONS: MedicationDef[] = [
  { 
    name: 'Acetaminophen', 
    dose: '500mg', 
    timePeriod: 'Every 4-6 hours', 
    onset: '30-45 mins', 
    duration: '4-6 hours', 
    effect: 'Pain relief, fever reduction', 
    contraindications: 'Severe liver disease, hypersensitivity', 
    symptoms: 'Mild to moderate pain, fever' 
  },
  { 
    name: 'Morphine', 
    dose: '15mg', 
    timePeriod: 'Every 4 hours', 
    onset: '15-30 mins', 
    duration: '3-4 hours', 
    effect: 'Severe pain relief', 
    contraindications: 'Respiratory depression, acute asthma', 
    symptoms: 'Severe acute or chronic pain' 
  },
  { 
    name: 'Ondansetron', 
    dose: '4mg', 
    timePeriod: 'Every 8 hours', 
    onset: '30 mins', 
    duration: '8 hours', 
    effect: 'Prevents nausea and vomiting', 
    contraindications: 'Long QT syndrome, concurrent apomorphine use', 
    symptoms: 'Nausea, vomiting' 
  },
  { 
    name: 'Docusate Sodium', 
    dose: '100mg', 
    timePeriod: 'Once daily', 
    onset: '12-72 hours', 
    duration: 'Variable', 
    effect: 'Stool softener', 
    contraindications: 'Intestinal obstruction, acute abdominal pain', 
    symptoms: 'Constipation' 
  },
  { 
    name: 'Ibuprofen', 
    dose: '400mg', 
    timePeriod: 'Every 4-6 hours', 
    onset: '30-60 mins', 
    duration: '4-6 hours', 
    effect: 'Reduces inflammation, pain, and fever', 
    contraindications: 'Active peptic ulcer, severe heart failure', 
    symptoms: 'Inflammation, muscle ache, fever' 
  }
];