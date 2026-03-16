// forum.ts

import React from 'react';

export type ModalMode = "post" | "poll" | "petition";

export type ForumSection = 'Personal Health' | 'Population Health' | 'Off Topic';

export interface TabItem {
  id: ModalMode;
  label: string;
  icon: React.ReactNode;
}

export interface ConfirmEntry {
  userId: string;
  location: [number, number];
  confirmTime: any;
}

export interface Reply { 
  id: string; 
  content: string; 
  authorId: string; 
  authorName: string; 
  createdAt: any; 
  lastUpdated?: any; 
  fullPath: string;
  parentId: string; 
  rootPostId: string; 
  level: number; 
  isDeleted?: boolean; 
  likes?: string[]; 
  dislikes?: string[]; 
  location?: [number, number]; 
}

export interface PollOption { 
  text: string; 
  votes: number; 
}

interface BasePost {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  content: string;
  createdAt: any;
  lastUpdated: any;
  likes: string[];
  dislikes: string[];
  replyCount: number;
  location?: [number, number];
  forumSection: ForumSection; 
  // Existing properties
  topic?: string; 
  help?: { type: string; value: string };
  public?: { type: string; value: string };
  hazard?: { type: string; value: string };
  confirm?: ConfirmEntry[]; 
  // Front-end Time-To-Live for Population Health help posts
  helpStartDate?: any;
  helpEndDate?: any;
}

export interface StandardPost extends BasePost {
  type: 'post';
}

export interface PollPost extends BasePost {
  type: 'poll';
  options: PollOption[];
  userVotes: Record<string, number>;
}

export interface PetitionPost extends BasePost {
  type: 'petition';
  signatures: string[];
}

export type Post = StandardPost | PollPost | PetitionPost;