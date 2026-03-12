import React from 'react';

export type ModalMode = "post" | "poll" | "petition";

export interface TabItem {
  id: ModalMode;
  label: string;
  icon: React.ReactNode;
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

export interface Post { 
  id: string; 
  title?: string; 
  content: string; 
  authorId: string; 
  authorName: string; 
  createdAt: any; 
  lastUpdated?: any;
  type?: 'post' | 'poll' | 'petition'; 
  options?: PollOption[]; 
  userVotes?: Record<string, number>; 
  likes?: string[]; 
  dislikes?: string[];
  signatures?: string[]; 
  replyCount?: number; 
  location?: [number, number]; 
  hazard?: {type: string; value: string;}; 
}