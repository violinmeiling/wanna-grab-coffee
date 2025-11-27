import * as cron from 'node-cron';
import { ScheduleOptions } from '../types/index.js';

interface ScheduledReminder {
  id: string;
  contactId: number;
  message: string;
  scheduledFor: Date;
  status: 'pending' | 'sent' | 'cancelled';
  task?: cron.ScheduledTask | undefined;
}

export class SchedulerService {
  private reminders: Map<string, ScheduledReminder> = new Map();
  private onReminderCallback: ((contactId: number, message: string) => Promise<void>) | undefined;

  constructor(onReminderCallback?: (contactId: number, message: string) => Promise<void>) {
    this.onReminderCallback = onReminderCallback;
    
    // Clean up completed reminders every hour
    cron.schedule('0 * * * *', () => {
      this.cleanupCompletedReminders();
    });
  }

  /**
   * Schedule a follow-up reminder
   */
  public scheduleReminder(
    contactId: number,
    message: string,
    scheduledFor: Date,
    options?: { immediate?: boolean }
  ): string {
    const reminderId = this.generateReminderId(contactId);

    // Cancel any existing reminder for this contact
    this.cancelReminder(reminderId);

    if (options?.immediate) {
      // Send immediately
      this.executeReminder(contactId, message);
      return reminderId;
    }

    const cronPattern = this.dateToCronPattern(scheduledFor);
    
    const task = cron.schedule(cronPattern, async () => {
      await this.executeReminder(contactId, message);
      const reminder = this.reminders.get(reminderId);
      if (reminder) {
        reminder.status = 'sent';
        reminder.task?.stop();
        reminder.task = undefined;
      }
    }, {
      scheduled: false,
      timezone: 'America/New_York' // Adjust to your timezone
    });

    const reminder: ScheduledReminder = {
      id: reminderId,
      contactId,
      message,
      scheduledFor,
      status: 'pending',
      task
    };

    this.reminders.set(reminderId, reminder);
    task.start();

    console.log(`Reminder scheduled for ${scheduledFor.toLocaleString()}`);
    return reminderId;
  }

  /**
   * Schedule based on user preference
   */
  public scheduleBasedOnPreference(
    contactId: number,
    message: string,
    preference: ScheduleOptions
  ): string {
    let scheduledFor: Date;

    if (preference.sendNow) {
      return this.scheduleReminder(contactId, message, new Date(), { immediate: true });
    } else if (preference.sendTomorrow) {
      scheduledFor = this.getTomorrowMorning();
    } else if (preference.customDate) {
      scheduledFor = preference.customDate;
    } else if (preference.noReminder) {
      console.log('No reminder requested');
      return '';
    } else {
      // Default to tomorrow morning
      scheduledFor = this.getTomorrowMorning();
    }

    return this.scheduleReminder(contactId, message, scheduledFor);
  }

  /**
   * Parse user response to determine scheduling preference
   */
  /**
   * Check if the response is a valid scheduling option
   */
  public isValidSchedulingResponse(response: string): boolean {
    const lowerResponse = response.toLowerCase().trim();

    // Valid responses
    if (lowerResponse.includes('now') || lowerResponse.includes('immediately') || lowerResponse.includes('send it')) {
      return true;
    }

    if (lowerResponse.includes('tomorrow') || lowerResponse.includes('morning')) {
      return true;
    }

    if (lowerResponse.includes('no') || lowerResponse.includes('never')) {
      return true;
    }

    // Check for valid time patterns
    const dateMatch = this.extractDateFromResponse(lowerResponse);
    if (dateMatch) {
      return true;
    }

    return false;
  }

  public parseSchedulingResponse(response: string): ScheduleOptions {
    const lowerResponse = response.toLowerCase().trim();

    if (lowerResponse.includes('now') || lowerResponse.includes('immediately') || lowerResponse.includes('send it')) {
      return { sendNow: true, sendTomorrow: false, noReminder: false };
    }

    if (lowerResponse.includes('tomorrow') || lowerResponse.includes('morning')) {
      return { sendNow: false, sendTomorrow: true, noReminder: false };
    }

    if (lowerResponse.includes('no') || lowerResponse.includes('never')) {
      return { sendNow: false, sendTomorrow: false, noReminder: true };
    }

    // Try to parse specific date/time
    const dateMatch = this.extractDateFromResponse(lowerResponse);
    if (dateMatch) {
      return { sendNow: false, sendTomorrow: false, customDate: dateMatch, noReminder: false };
    }

    // Default to tomorrow (but this should only happen for invalid responses now)
    return { sendNow: false, sendTomorrow: true, noReminder: false };
  }

  /**
   * Extract date from user response (simple parsing)
   */
  private extractDateFromResponse(response: string): Date | undefined {
    const now = new Date();

    // Check for "in X hours/days"
    const inMatch = response.match(/in (\d+) (hour|day)s?/);
    if (inMatch) {
      const amount = parseInt(inMatch[1] || '0');
      const unit = inMatch[2];
      const target = new Date(now);

      if (unit === 'hour') {
        target.setHours(target.getHours() + amount);
      } else {
        target.setDate(target.getDate() + amount);
      }

      return target;
    }

    // Check for "in X minutes" pattern (for testing)
    const minutesMatch = response.match(/in\s+(\d+)\s+(?:minutes?|mins?)/);
    if (minutesMatch && minutesMatch[1]) {
      const minutes = parseInt(minutesMatch[1]);
      const target = new Date(now);
      target.setMinutes(target.getMinutes() + minutes);
      return target;
    }

    // Check for day names
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayMatch = dayNames.find(day => response.includes(day));
    if (dayMatch) {
      const targetDay = dayNames.indexOf(dayMatch);
      const currentDay = now.getDay();
      let daysUntil = targetDay - currentDay;
      if (daysUntil <= 0) daysUntil += 7; // Next week

      const target = new Date(now);
      target.setDate(target.getDate() + daysUntil);
      target.setHours(9, 0, 0, 0); // 9 AM
      return target;
    }

    return undefined;
  }

  /**
   * Cancel a scheduled reminder
   */
  public cancelReminder(reminderId: string): boolean {
    const reminder = this.reminders.get(reminderId);
    if (reminder && reminder.status === 'pending') {
      reminder.task?.stop();
      reminder.task = undefined;
      reminder.status = 'cancelled';
      this.reminders.delete(reminderId);
      console.log(`Reminder ${reminderId} cancelled`);
      return true;
    }
    return false;
  }

  /**
   * Get all pending reminders
   */
  public getPendingReminders(): ScheduledReminder[] {
    return Array.from(this.reminders.values()).filter(r => r.status === 'pending');
  }

  /**
   * Get reminders for a specific contact
   */
  public getContactReminders(contactId: number): ScheduledReminder[] {
    return Array.from(this.reminders.values()).filter(r => r.contactId === contactId);
  }

  /**
   * Execute a reminder (send the follow-up prompt)
   */
  private async executeReminder(contactId: number, message: string): Promise<void> {
    console.log(`Executing reminder for contact ${contactId}`);
    
    if (this.onReminderCallback) {
      try {
        await this.onReminderCallback(contactId, message);
      } catch (error) {
        console.error('Error executing reminder:', error);
      }
    } else {
      console.log(`Reminder message: ${message}`);
    }
  }

  /**
   * Convert Date to cron pattern
   */
  private dateToCronPattern(date: Date): string {
    const minute = date.getMinutes();
    const hour = date.getHours();
    const day = date.getDate();
    const month = date.getMonth() + 1;
    
    // Run once at the specified time
    return `${minute} ${hour} ${day} ${month} *`;
  }

  /**
   * Get tomorrow morning (9 AM)
   */
  private getTomorrowMorning(): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    return tomorrow;
  }

  /**
   * Generate unique reminder ID
   */
  private generateReminderId(contactId: number): string {
    return `reminder_${contactId}_${Date.now()}`;
  }

  /**
   * Clean up completed reminders
   */
  private cleanupCompletedReminders(): void {
    const toDelete: string[] = [];
    
    this.reminders.forEach((reminder, id) => {
      if (reminder.status !== 'pending') {
        toDelete.push(id);
      }
    });

    toDelete.forEach(id => this.reminders.delete(id));
    
    if (toDelete.length > 0) {
      console.log(`🧹 Cleaned up ${toDelete.length} completed reminders`);
    }
  }

  /**
   * Generate scheduling options message
   */
  public generateSchedulingOptionsMessage(contactName: string): string {
    return `When would you like me to remind you to send it?\n\n` +
           `Reply with:\n` +
           `- "now" - Send it immediately\n` +
           `- "tomorrow" - Remind me tomorrow morning\n` +
           `- "Friday" - Remind me on a specific day\n` +
           `- "in 2 hours" - Remind me in X hours\n` +
           `- "in 5 minutes" - Remind me in X minutes\n` +
           `- "no" - Don't set a reminder`;
  }

  /**
   * Cleanup all reminders (for app shutdown)
   */
  public destroy(): void {
    this.reminders.forEach(reminder => {
      if (reminder.task) {
        reminder.task.stop();
      }
    });
    this.reminders.clear();
  }
}