import React from 'react';

export type ModalMode = "post" | "poll" | "petition";

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
  islikes?: string[]; 
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
}

// Specific Types
export interface StandardPost extends BasePost {
  type: 'post';
  hazard?: { type: string; value: string };
  confirm?: ConfirmEntry[]; // Only exists here
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

// The Union Type
export type Post = StandardPost | PollPost | PetitionPost;