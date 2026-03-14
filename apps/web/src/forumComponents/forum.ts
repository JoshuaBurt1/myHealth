import React from 'react';

export type ModalMode = "post" | "poll" | "petition";

// 1. Define literal types for your sections
export type ForumSection = 'Personal Health' | 'Population Health' | 'Off topic';

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

// 2. Base interface for shared properties
// IMPROVEMENT: By lifting optional `topic`, `hazard`, and `confirm` to the BasePost, 
// TypeScript won't throw errors when checking these properties across mixed Post arrays.
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
  
  // Properties that might exist depending on section, now accessible safely on any Post
  topic?: string; 
  hazard?: { type: string; value: string };
  confirm?: ConfirmEntry[]; 
}

// 3. Define the Discriminated Union cleanly
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