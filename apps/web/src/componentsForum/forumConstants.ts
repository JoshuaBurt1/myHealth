// forumConstants.ts
import { Heart, Activity, Hash, Type, BarChart2, FileText } from 'lucide-react';
import React from 'react';

export const FORUM_SECTIONS = [
  { id: 'Personal Health', icon: React.createElement(Heart, { size: 18 }) },
  { id: 'Population Health', icon: React.createElement(Activity, { size: 18 }) },
  { id: 'Off Topic', icon: React.createElement(Hash, { size: 18 }) }
];

export const TABS = [
  { id: 'post', label: 'Post', icon: React.createElement(Type, { size: 16 }) },
  { id: 'poll', label: 'Poll', icon: React.createElement(BarChart2, { size: 16 }) },
  { id: 'petition', label: 'Petition', icon: React.createElement(FileText, { size: 16 }) }
];

export const HAZARD_TYPES = ["Food contamination", "Water contamination", "Biological hazard", "Chemical hazard", "Radiation", "Unsafe Area", "Medication side-effect", "Environmental event"];
export const HELP_TYPES = ["Volunteer event", "Paid-volunteer event", "Fundraiser event", "Donation event", "Blood donation event", "Vaccination clinic event", "Medical screening event", "Environmental event", "Sporting event"];
export const PUBLIC_TYPES = ["Community garden", "Fresh water fountain", "Bike/e-bike/scooter", "Shelter"];
export const TOPIC_TYPES = ["Fitness", "Diet", "Health product", "Medical", "Physiotherapy", "Mental health", "Cessation groups"];

export const HAZARD_COLORS: Record<string, string> = {
  "Food contamination": "#ef4444", "Water contamination": "#3333ff", "Biological hazard": "#84cc16",
  "Chemical hazard": "#eab308", "Radiation": "#a855f7", "Unsafe Area": "#0f172b",
  "Medication side-effect": "#ff99cc", "Environmental event": "#06b6d4"
};

export const HELP_COLORS: Record<string, string> = {
  "Volunteer event": "#f97316", "Paid-volunteer event": "#fbbf24", "Fundraiser event": "#db2777",
  "Donation event": "#059669", "Blood donation event": "#be123c", "Vaccination clinic event": "#2563eb",
  "Medical screening event": "#0891b2", "Environmental event": "#15803d", "Sporting event": "#6366f1"
};

export const PUBLIC_COLORS: Record<string, string> = {
  "Community garden": "#16a34a", "Fresh water fountain": "#3b82f6", "Bike/e-bike/scooter": "#64748b", "Shelter": "#d97706"
};

export const TOPIC_COLORS: Record<string, string> = {
  "Fitness": "#22c55e", "Diet": "#ea580c", "Health product": "#3b82f6",
  "Medical": "#ef4444", "Physiotherapy": "#14b8a6", "Mental health": "#8b5cf6", "Cessation groups": "#f59e0b"
};