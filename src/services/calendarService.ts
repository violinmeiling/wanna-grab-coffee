import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { AvailableTimeSlot } from '../types/index.js';

export class CalendarService {
  private oauth2Client: OAuth2Client;
  private calendar: any;

  constructor(
    clientId: string,
    clientSecret: string,
    redirectUri: string
  ) {
    this.oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

  /**
   * Set the access token for the OAuth2 client
   */
  public setCredentials(tokens: { access_token: string; refresh_token?: string }) {
    this.oauth2Client.setCredentials(tokens);
  }

  /**
   * Get OAuth2 authorization URL
   */
  public getAuthUrl(): string {
    const scopes = ['https://www.googleapis.com/auth/calendar.readonly'];
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  public async getTokens(code: string) {
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    return tokens;
  }

  /**
   * Find available time slots for coffee meetings
   * @param daysAhead How many days to look ahead (default: 14)
   * @param duration Duration of meeting in minutes (default: 60)
   * @returns Array of available time slots
   */
  public async findAvailableSlots(
    daysAhead: number = 14,
    duration: number = 60
  ): Promise<AvailableTimeSlot[]> {
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + daysAhead);

    try {
      const response = await this.calendar.events.list({
        calendarId: 'primary',
        timeMin: now.toISOString(),
        timeMax: endDate.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = response.data.items || [];
      const availableSlots: AvailableTimeSlot[] = [];

      // Generate time slots for each day
      for (let d = 1; d <= daysAhead; d++) {
        const currentDate = new Date(now);
        currentDate.setDate(currentDate.getDate() + d);
        
        // Skip weekends (optional - you can remove this if you want weekend meetings)
        const dayOfWeek = currentDate.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) continue;

        const daySlots = this.generateDaySlots(currentDate, events, duration);
        availableSlots.push(...daySlots);
      }

      return availableSlots.slice(0, 10); // Return top 10 slots
    } catch (error) {
      console.error('Error finding available slots:', error);
      return [];
    }
  }

  /**
   * Generate available time slots for a specific day
   */
  private generateDaySlots(
    date: Date,
    events: any[],
    duration: number
  ): AvailableTimeSlot[] {
    const slots: AvailableTimeSlot[] = [];
    const dayStart = new Date(date);
    dayStart.setHours(9, 0, 0, 0); // 9 AM

    const dayEnd = new Date(date);
    dayEnd.setHours(19, 0, 0, 0); // 7 PM

    // Filter events for this specific day
    const dayEvents = events.filter(event => {
      if (!event.start?.dateTime) return false;
      const eventDate = new Date(event.start.dateTime);
      return eventDate.toDateString() === date.toDateString();
    });

    // Sort events by start time
    dayEvents.sort((a, b) => 
      new Date(a.start.dateTime).getTime() - new Date(b.start.dateTime).getTime()
    );

    let currentTime = new Date(dayStart);

    for (const event of dayEvents) {
      const eventStart = new Date(event.start.dateTime);
      const eventEnd = new Date(event.end?.dateTime || event.start.dateTime);

      // Check if there's a gap before this event
      const gapDuration = eventStart.getTime() - currentTime.getTime();
      if (gapDuration >= duration * 60 * 1000) {
        // We have enough time for a meeting
        const slotEnd = new Date(Math.min(eventStart.getTime(), currentTime.getTime() + duration * 60 * 1000));
        
        slots.push({
          date: this.formatDate(currentTime),
          startTime: this.formatTime(currentTime),
          endTime: this.formatTime(slotEnd),
          dayOfWeek: this.getDayOfWeek(currentTime)
        });
      }

      // Move current time to after this event
      currentTime = new Date(Math.max(currentTime.getTime(), eventEnd.getTime()));
    }

    // Check for time after the last event
    if (currentTime.getTime() < dayEnd.getTime()) {
      const remainingTime = dayEnd.getTime() - currentTime.getTime();
      if (remainingTime >= duration * 60 * 1000) {
        const slotEnd = new Date(Math.min(dayEnd.getTime(), currentTime.getTime() + duration * 60 * 1000));
        
        slots.push({
          date: this.formatDate(currentTime),
          startTime: this.formatTime(currentTime),
          endTime: this.formatTime(slotEnd),
          dayOfWeek: this.getDayOfWeek(currentTime)
        });
      }
    }

    return slots;
  }

  private formatDate(date: Date): string {
    const isoString = date.toISOString();
    const parts = isoString.split('T');
    return parts[0] || isoString;
  }

  private formatTime(date: Date): string {
    const timeString = date.toTimeString();
    const parts = timeString.split(' ');
    const timePart = parts[0];
    return timePart ? timePart.substring(0, 5) : '00:00';
  }

  private getDayOfWeek(date: Date): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()] || 'Unknown';
  }

  /**
   * Get a human-readable description of available slots
   */
  public formatAvailableSlots(slots: AvailableTimeSlot[]): string {
    if (slots.length === 0) {
      return "No available time slots found in the next 2 weeks.";
    }

    const formatted = slots.slice(0, 5).map(slot => {
      const date = new Date(slot.date);
      const dateStr = date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'short', 
        day: 'numeric' 
      });
      
      // Convert 24h to 12h format
      const startTime = this.convert24to12(slot.startTime);
      
      return `${dateStr} at ${startTime}`;
    }).join(', ');

    return `Available times: ${formatted}`;
  }

  private convert24to12(time24: string): string {
    const [hours, minutes] = time24.split(':');
    
    if (!hours || !minutes) {
      return time24; // Return original if parsing fails
    }
    
    const hour24 = parseInt(hours);
    const hour12 = hour24 % 12 || 12;
    const ampm = hour24 >= 12 ? 'PM' : 'AM';
    return `${hour12}:${minutes} ${ampm}`;
  }
}