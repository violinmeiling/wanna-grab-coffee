export interface Contact {
  id?: number;
  name: string;
  event: string;
  context?: string;
  metAt: Date;
  phoneNumber?: string;
  email?: string;
  followUpStatus: 'pending' | 'scheduled' | 'sent' | 'completed';
  scheduledFollowUp?: Date;
  lastInteraction?: Date;
  notes?: string;
}

export interface AvailableTimeSlot {
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  dayOfWeek: string;
}

export interface ConversationTopics {
  topics: string[];
  commonInterests?: string[];
  industryConnections?: string[];
}

export interface FollowUpMessage {
  message: string;
  suggestedTimes: AvailableTimeSlot[];
  conversationTopics: ConversationTopics;
}

export interface ParsedMeetingMessage {
  name: string;
  event: string;
  context?: string | undefined;
  isValidMeeting: boolean;
}

export interface ScheduleOptions {
  sendNow: boolean;
  sendTomorrow: boolean;
  customDate?: Date;
  noReminder: boolean;
}

export interface LinkedInProfile {
  headline?: string;
  summary?: string;
  experience?: Array<{
    title: string;
    company: string;
    industry?: string;
  }>;
  skills?: string[];
  interests?: string[];
}

export interface ContactSummary {
  totalContacts: number;
  recentContacts: Array<{
    name: string;
    event: string;
    metAt: Date;
    context?: string | undefined;
    followUpStatus: string;
  }>;
}