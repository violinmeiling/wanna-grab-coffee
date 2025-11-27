import { ParsedMeetingMessage } from '../types/index.js';

export class MessageParser {
  private static readonly NAME_STOPWORDS = [
    'at', 'from', 'the', 'a', 'an', 'in', 'on', 'with', 'during', 'after', 'before'
  ];

  /**
   * Parse message in the exact format: "met [NAME] at [EVENT], [CONTEXT]"
   * If no comma and context, context is undefined (no OpenAI call)
   */
  public static parseMessage(text: string): ParsedMeetingMessage {
    const cleanedText = text.trim();
    
    // Exact pattern: "met [NAME] at [EVENT], [CONTEXT]" or "met [NAME] at [EVENT]"
    const pattern = /^met\s+([A-Za-z\s]+?)\s+at\s+([^,]+?)(?:,\s*(.+))?$/i;
    const match = cleanedText.match(pattern);
    
    if (!match) {
      return {
        name: '',
        event: '',
        context: undefined,
        isValidMeeting: false
      };
    }
    
    const [, rawName, rawEvent, rawContext] = match;
    
    if (!rawName || !rawEvent) {
      return {
        name: '',
        event: '',
        context: undefined,
        isValidMeeting: false
      };
    }
    
    // Clean up the name
    const name = this.cleanName(rawName);
    
    if (!this.isValidName(name)) {
      return {
        name: '',
        event: '',
        context: undefined,
        isValidMeeting: false
      };
    }
    
    // Event is everything after "at" and before comma (or end)
    const event = rawEvent.trim();
    
    // Context only exists if there's a comma and content after it
    const context = rawContext ? rawContext.trim() : undefined;
    
    return {
      name,
      event,
      context,
      isValidMeeting: true
    };
  }

  private static cleanName(name: string): string {
    return name
      .trim()
      .replace(/\s+/g, ' ')
      .split(' ')
      .filter(word => !this.NAME_STOPWORDS.includes(word.toLowerCase()))
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private static isValidName(name: string): boolean {
    // Name should be 1-3 words, each 2+ characters
    const words = name.split(' ');
    return words.length >= 1 && 
           words.length <= 3 && 
           words.every(word => word.length >= 2 && /^[A-Za-z]+$/.test(word));
  }



  /**
   * Extract potential phone numbers or emails from the context
   */
  public static extractContactInfo(context: string): { phone?: string; email?: string } {
    const result: { phone?: string; email?: string } = {};

    // Simple phone number extraction (US format)
    const phoneMatch = context.match(/(\+?1[-.\s]?)?(\([0-9]{3}\)|[0-9]{3})[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/);
    if (phoneMatch) {
      result.phone = phoneMatch[0];
    }

    // Simple email extraction
    const emailMatch = context.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    if (emailMatch) {
      result.email = emailMatch[0];
    }

    return result;
  }
}