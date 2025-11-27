import { IMessageSDK } from '@photon-ai/imessage-kit';
import { DatabaseService } from './services/databaseService.js';
import { CalendarService } from './services/calendarService.js';
import { AIService } from './services/aiService.js';
import { SchedulerService } from './services/schedulerService.js';
import { MessageParser } from './utils/messageParser.js';
import { Contact } from './types/index.js';
import dotenv from 'dotenv';

export class CoffeeNetworkingApp {
  private imessage: IMessageSDK;
  private database: DatabaseService;
  private calendar: CalendarService;
  private ai: AIService;
  private scheduler: SchedulerService;
  private myName: string;
  private myPhone: string;

  private isProcessingMessage = false;
  private pendingFollowUpResponses = new Map<string, boolean>(); // sender -> true when waiting for scheduling response
  private pendingContacts = new Map<string, Omit<Contact, 'id'>>(); // sender -> contact data (not saved yet)
  private pendingDraftMessages = new Map<string, string>(); // sender -> draft message
  private lastProcessedMessageId: string | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor() {
    dotenv.config();

    // Clear any pending interactions on startup
    this.pendingFollowUpResponses.clear();

    // Initialize services
    this.imessage = new IMessageSDK({
      debug: process.env.IMESSAGE_DEBUG === 'true',
      maxConcurrent: parseInt(process.env.IMESSAGE_MAX_CONCURRENT || '5')
    });

    this.database = new DatabaseService(process.env.DATABASE_PATH);
    
    this.calendar = new CalendarService(
      process.env.GOOGLE_CALENDAR_CLIENT_ID!,
      process.env.GOOGLE_CALENDAR_CLIENT_SECRET!,
      process.env.GOOGLE_CALENDAR_REDIRECT_URI!
    );

    // Set calendar credentials if available
    if (process.env.GOOGLE_CALENDAR_ACCESS_TOKEN) {
      const tokens: any = {
        access_token: process.env.GOOGLE_CALENDAR_ACCESS_TOKEN
      };
      if (process.env.GOOGLE_CALENDAR_REFRESH_TOKEN) {
        tokens.refresh_token = process.env.GOOGLE_CALENDAR_REFRESH_TOKEN;
      }
      this.calendar.setCredentials(tokens);
    }

    this.ai = new AIService(process.env.OPENAI_API_KEY || process.env.GOOGLE_AI_API_KEY || 'fallback-only');

    this.scheduler = new SchedulerService(async (contactId: number, message: string) => {
      await this.sendFollowUpReminder(contactId, message);
    });

    this.myName = process.env.MY_NAME || 'Your Name';
    this.myPhone = process.env.MY_PHONE || '+1234567890';

    this.validateEnvironment();
  }

  /**
   * Initialize the application
   */
  public async initialize(): Promise<void> {
    console.log('initializing coffee...');

    try {
      // Initialize database
      await this.database.initialize();

      console.log('coffee initialized');
      console.log(`coffee is ready to go`);

    } catch (error) {
      console.error('coffee failed:', error);
      throw error;
    }
  }

  /**
   * Gracefully shutdown and discard pending interactions
   */
  public async shutdown(): Promise<void> {
    console.log('exiting gracefully...');
    this.isShuttingDown = true;
    
    // Clear any pending follow-up responses
    this.pendingFollowUpResponses.clear();
    
    // Clear polling interval
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    
    console.log('coffee killed');
  }

  /**
   * Stop the application (alias for shutdown)
   */
  public async stop(): Promise<void> {
    await this.shutdown();
  }

  /**
   * Start monitoring iMessages using polling
   */
  public async startMonitoring(): Promise<void> {
    console.log('coffee is watching your messages...');
    console.log(`your phone number: ${this.myPhone}`);

    // Start polling for new messages every 3 seconds
    this.pollInterval = setInterval(async () => {
      await this.checkForNewMessages();
    }, 3000);

    // Initial check
    await this.checkForNewMessages();

    console.log('coffee checking for new messages every 3 seconds');
  }

  /**
   * Check for new messages from yourself
   */
  private async checkForNewMessages(): Promise<void> {
    if (this.isProcessingMessage) return;

    try {
      // gets 10 recent messages
      const result = await this.imessage.getMessages({ limit: 10 });
      
      if (result?.messages) {
        // Find messages from your phone number that have text content
        const recentSelfMessages = result.messages.filter(msg => 
          msg.sender === this.myPhone && msg.text && msg.text.trim()
        );
        
        if (recentSelfMessages.length > 0) {
          // Get the most recent message
          const latestMessage = recentSelfMessages[0];
          
          // Check if this is a new message we haven't processed
          // Also check if message is recent (within last 30 seconds) to avoid processing old messages on startup
          const messageTime = latestMessage ? new Date(latestMessage.date).getTime() : 0;
          const now = Date.now();
          const isRecentMessage = (now - messageTime) < 30000; // 30 seconds
          
          if (latestMessage && latestMessage.id !== this.lastProcessedMessageId && isRecentMessage) {
            console.log(`message date: ${latestMessage.date}`);
            console.log(`message id: ${latestMessage.id}`);
            console.log(`message text: "${latestMessage.text}"`);
            
            // Process this message
            this.isProcessingMessage = true;
            try {
              await this.handleDetectedMessage(latestMessage);
              this.lastProcessedMessageId = latestMessage.id;
            } finally {
              this.isProcessingMessage = false;
            }
          } else if (!this.lastProcessedMessageId && latestMessage) {
            // On first run, just set the last processed message to avoid processing old messages
            this.lastProcessedMessageId = latestMessage.id;
          }
        }
      }
    } catch (error) {
      console.error('error checking for messages:', error);
    }
  }

  /**
   * Handle a detected message from polling
   */
  private async handleDetectedMessage(message: any): Promise<void> {
    console.log(`\n------new message detected------`);
    console.log(`content: "${message.text}"`);
    console.log(`time: ${new Date().toLocaleString()}`);
    console.log(`message id: ${message.id}`);
    
    const messageText = message.text?.trim() || '';
    
    // Process the message using our existing logic
    try {
      await this.handleMessage({ ...message, text: messageText });
      console.log(`message processed successfully`);
    } catch (error) {
      console.error('failed to process message:', error);
      
      // Send error response
      try {
        const errorResponse = `Sorry, I had trouble processing your message "${messageText}". ` +
                            `Please try the format: "met [person] at [event]" ` +
                            `For example: \"met Benjamin Franklin at Penn\"`;
        await this.imessage.send(this.myPhone, errorResponse);
      } catch (sendError) {
        console.error('failed to send error response:', sendError);
      }
    }

    console.log(`message processing complete`);
  }

  /**
   * Handle incoming messages (legacy method - kept for compatibility)
   */
  private async handleMessage(message: any): Promise<void> {
    // This method is kept for backwards compatibility
    // The new polling approach uses handleDetectedMessage instead
    const messageText = message.text?.trim() || '';
    console.log(`processing message: ${messageText}`);

    // Check if this is a response to a scheduling question
    if (this.pendingFollowUpResponses.has(message.sender)) {
      await this.handleSchedulingResponse(message.sender, messageText);
      return;
    }

    // Check for various command types
    if (messageText.toLowerCase().trim() === 'cancel') {
      await this.handleCancelCommand(message.sender);
      return;
    }

    if (messageText.toLowerCase().includes('summary') || messageText.toLowerCase().includes('recent contacts')) {
      await this.handleSummaryRequest(message.sender);
      return;
    }

    // Try to parse as a "met someone" message
    const parsed = MessageParser.parseMessage(messageText);
    
    if (parsed.isValidMeeting) {
      await this.handleMeetingMessage(message.sender, parsed);
    } else {
      // Send help message for unrecognized format
      await this.sendHelpMessage(message.sender);
    }
  }

  /**
   * Handle "met someone" messages
   */
  private async handleMeetingMessage(sender: string, parsed: any): Promise<void> {
    console.log(`processing meeting: ${parsed.name} at ${parsed.event}`);

    try {
      // Extract contact info if available
      const contactInfo = MessageParser.extractContactInfo(parsed.context || '');

      // Create contact record (but don't save to DB yet)
      const contact: Omit<Contact, 'id'> = {
        name: parsed.name,
        event: parsed.event,
        metAt: new Date(),
        followUpStatus: 'pending'
      };
      
      if (parsed.context) contact.context = parsed.context;
      if (contactInfo.phone) contact.phoneNumber = contactInfo.phone;
      if (contactInfo.email) contact.email = contactInfo.email;

      // Store contact data temporarily (save to DB only after user confirms scheduling)
      this.pendingContacts.set(sender, contact);
      console.log(`prepared contact: ${parsed.name} (not saved yet)`);

      // Generate follow-up suggestions
      await this.generateFollowUpSuggestions(sender, contact);

    } catch (error) {
      console.error('error processing meeting:', error);
      await this.sendErrorMessage(sender, 'Sorry, I had trouble processing that meeting. Please try again.');
    }
  }

  /**
   * Generate and send follow-up suggestions
   */
  private async generateFollowUpSuggestions(sender: string, contact: Omit<Contact, 'id'>): Promise<void> {
    console.log('generating follow-up suggestions...');

    try {
      // Get calendar availability (with fallback)
      let timeSlotText = 'I have some time to meet this week';
      try {
        const availableSlots = await this.calendar.findAvailableSlots(14, 60);
        if (availableSlots.length > 0) {
          timeSlotText = `I'm free ${availableSlots.slice(0, 3).map(slot => 
            `${slot.dayOfWeek} ${slot.startTime}`
          ).join(', ')}`;
        }
      } catch (calendarError) {
        console.log('Calendar unavailable, using fallback time text');
      }

      // Generate optional topic sentence (only if meaningful context exists)
      let topicSentence: string | null = null;
      if (this.hasMeaningfulContext(contact.context)) {
        console.log('Context found, generating AI topic sentence...');
        try {
          topicSentence = await this.ai.generateTopicSentence(
            contact.name,
            contact.context!,
            contact.event
          );
        } catch (aiError) {
          console.log('AI unavailable, omitting topic sentence');
          topicSentence = null;
        }
      } else {
        console.log('No meaningful context, skipping AI call');
      }

      // Create the unified message
      const draftMessage = this.createUnifiedMessage(
        contact.name,
        contact.event,
        topicSentence,
        timeSlotText
      );

      // Store the draft message for later use
      this.pendingDraftMessages.set(sender, draftMessage);

      // Send suggestions to user
      const suggestionMessage = this.formatSuggestionMessage(contact, draftMessage);
      await this.imessage.send(sender, suggestionMessage);

      // Mark as waiting for scheduling response
      this.pendingFollowUpResponses.set(sender, true);

      // Auto-cleanup after 10 minutes
      setTimeout(() => {
        this.pendingFollowUpResponses.delete(sender);
      }, 10 * 60 * 1000);

    } catch (error) {
      console.error('error generating suggestions:', error);
      await this.sendErrorMessage(sender, 'I saved the contact but had trouble generating suggestions. Try asking for "summary" to see your contacts.');
    }
  }

  /**
   * Handle scheduling responses
   */
  private async handleSchedulingResponse(sender: string, response: string): Promise<void> {
    if (!this.pendingFollowUpResponses.has(sender)) return;

    console.log(`processing scheduling response: ${response}`);

    try {
      const contact = this.pendingContacts.get(sender);
      const draftMessage = this.pendingDraftMessages.get(sender);
      
      if (!contact || !draftMessage) {
        await this.sendErrorMessage(sender, 'Contact data not found. Please try again.');
        this.clearPendingData(sender);
        return;
      }

      // Handle cancel separately - this should clear pending data without saving
      if (response.toLowerCase().trim() === 'cancel') {
        await this.imessage.send(sender, 'Cancelled. Contact not saved.');
        this.clearPendingData(sender);
        return;
      }
      
      const schedulePreference = this.scheduler.parseSchedulingResponse(response);
      
      // Check if the response was invalid (defaulted to tomorrow)
      if (!this.scheduler.isValidSchedulingResponse(response)) {
        await this.imessage.send(sender, `Please respond with:\n- "now" - Send it immediately\n- "tomorrow" - Remind me tomorrow morning\n- "in X minutes/hours" - Remind me later\n- "no" - Don't set a reminder\n- "cancel" - Don't save contact`);
        return; // Keep pending state, don't clear
      }
      
      // Always save the contact to database (even for no reminder)
      const contactId = await this.database.addContact(contact);
      console.log(`saved contact: ${contact.name} (ID: ${contactId})`);
      
      if (schedulePreference.noReminder) {
        // Update contact status to completed since user chose no reminder
        await this.database.updateContact(contactId, { followUpStatus: 'completed' });
        await this.imessage.send(sender, `${contact.name} saved with no reminder set.`);
        this.clearPendingData(sender);
        return;
      }

      const reminderId = this.scheduler.scheduleBasedOnPreference(
        contactId,
        `Time to follow up with ${contact.name}. Here's your draft message:\n\n"${draftMessage}"\n\nReady to send?`,
        schedulePreference
      );

      if (reminderId) {
        const schedulingMessage = schedulePreference.sendNow
          ? `Here's your message for ${contact.name}:\n\n"${draftMessage}"\n\nCopy and send when ready`
          : schedulePreference.sendTomorrow
          ? `I'll remind you tomorrow morning (9:00 AM) to follow up with ${contact.name}`
          : schedulePreference.customDate
          ? `Reminder set for ${contact.name} at ${schedulePreference.customDate.toLocaleString()}`
          : `Reminder set for ${contact.name}`;

        await this.imessage.send(sender, schedulingMessage);

        // Update contact status
        const updateData: Partial<Contact> = {
          followUpStatus: schedulePreference.sendNow ? 'sent' : 'scheduled'
        };
        
        if (schedulePreference.customDate) {
          updateData.scheduledFollowUp = schedulePreference.customDate;
        }
        
        await this.database.updateContact(contactId, updateData);
      }

      this.clearPendingData(sender);

    } catch (error) {
      console.error('Error handling scheduling response:', error);
      await this.sendErrorMessage(sender, 'Sorry, I had trouble scheduling that reminder.');
      this.clearPendingData(sender);
    }
  }

  /**
   * Clear all pending data for a sender
   */
  private clearPendingData(sender: string): void {
    this.pendingFollowUpResponses.delete(sender);
    this.pendingContacts.delete(sender);
    this.pendingDraftMessages.delete(sender);
  }

  /**
   * Send follow-up reminder
   */
  private async sendFollowUpReminder(contactId: number, message: string): Promise<void> {
    try {
      const contact = await this.database.getContact(contactId);
      if (!contact) return;

      // Send reminder to yourself
      await this.imessage.send(this.myPhone, message);
      console.log(`Here's your reminder to follow up with ${contact.name}`);

    } catch (error) {
      console.error('Error sending follow-up reminder:', error);
    }
  }

  /**
   * Handle cancel command - discard current interaction
   */
  private async handleCancelCommand(sender: string): Promise<void> {
    try {
      // Clear any pending states
      const hadPending = this.pendingFollowUpResponses.has(sender);
      this.clearPendingData(sender);
      
      // Clear processing flag
      this.isProcessingMessage = false;
      
      if (hadPending) {
        await this.imessage.send(sender, 'Cancelled. Contact not saved.');
      } else {
        await this.imessage.send(sender, 'Ready for new contacts!');
      }
    } catch (error) {
      console.error('Error handling cancel command:', error);
      await this.sendErrorMessage(sender, 'Error processing cancel command.');
    }
  }

  /**
   * Handle summary requests
   */
  private async handleSummaryRequest(sender: string): Promise<void> {
    try {
      const summary = await this.database.getContactSummary(30);
      const summaryMessage = this.formatSummaryMessage(summary);
      await this.imessage.send(sender, summaryMessage);
    } catch (error) {
      console.error('Error getting summary:', error);
      await this.sendErrorMessage(sender, 'Sorry, I had trouble getting your contact summary.');
    }
  }

  /**
   * Convert 24-hour time to 12-hour format
   */
  private convert24to12(time24: string): string {
    const [hours, minutes] = time24.split(':');
    if (!hours || !minutes) return time24;
    const hour12 = parseInt(hours) % 12 || 12;
    const ampm = parseInt(hours) >= 12 ? 'PM' : 'AM';
    return `${hour12}:${minutes}${ampm}`;
  }

  /**
   * Check if context exists
   */
  private hasMeaningfulContext(context: string | undefined): boolean {
    if (!context || context.trim().length < 5) {
      return false;
    }
    const cleaned = context.trim().toLowerCase();
    return cleaned.length >= 10 && (cleaned.includes(' ') || cleaned.length > 15);
  }

  /**
   * Create the unified message format
   */
  private createUnifiedMessage(
    contactName: string,
    event: string,
    topicSentence: string | null,
    timeSlotText: string
  ): string {
    let message = `Hi ${contactName}! It was great meeting you at ${event}. Would you like to grab coffee sometime?`;
    
    if (topicSentence) {
      message += ` ${topicSentence}`;
    }
    
    message += ` ${timeSlotText}. Let me know what would work!`;
    
    return message;
  }

  /**
   * Format suggestion message
   */
  private formatSuggestionMessage(contact: Omit<Contact, 'id'>, draftMessage: string): string {
    let message = `You met ${contact.name} at ${contact.event}.\n\n`;
    
    message += `Draft message:\n"${draftMessage}"\n\n`;
    
    message += this.scheduler.generateSchedulingOptionsMessage(contact.name);
    
    return message;
  }

  /**
   * Format summary message
   */
  private formatSummaryMessage(summary: any): string {
    let message = `Your people list\n\n`;
    message += `Total people: ${summary.totalContacts}\n\n`;
    
    if (summary.recentContacts.length > 0) {
      message += `People:\n`;
      summary.recentContacts.forEach((contact: any) => {
        const date = new Date(contact.metAt).toLocaleDateString();
        message += `- ${contact.name} (${contact.event}) - ${date}\n`;
      });
    } else {
      message += `No people found.`;
    }
    
    return message;
  }

  /**
   * Send help message
   */
  private async sendHelpMessage(sender: string): Promise<void> {
    const helpMessage = `Wanna grab coffee?\n\n` +
      `To log someone you met, text me:\n` +
      `"met John at networking event, he works in tech"\n\n` +
      `Commands:\n` +
      `"summary" - List all contacts\n` +
      `"cancel" - Cancel current interaction\n\n` +
      `Reminder scheduling:\n` +
      `"now" - Send immediately\n` +
      `"tomorrow" - Remind tomorrow at 9 AM\n` +
      `"in 5 minutes" - For testing\n` +
      `"no" - No reminder`;
    
    await this.imessage.send(sender, helpMessage);
  }

  /**
   * Send error message
   */
  private async sendErrorMessage(sender: string, error: string): Promise<void> {
    await this.imessage.send(sender, `Error: ${error}`);
  }

  /**
   * Validate environment variables
   */
  private validateEnvironment(): void {
    const required = [
      // 'OPENAI_API_KEY', // Optional - fallback system works without it
      'GOOGLE_CALENDAR_CLIENT_ID',
      'GOOGLE_CALENDAR_CLIENT_SECRET',
      'GOOGLE_CALENDAR_REDIRECT_URI'
    ];

    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }


}