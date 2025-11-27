import { ConversationTopics, FollowUpMessage, AvailableTimeSlot } from '../types/index.js';

export class AIService {
  private apiKey: string;
  private apiUrl = 'https://api.openai.com/v1/chat/completions';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Generate a single topic sentence if context is provided
   */
  public async generateTopicSentence(
    contactName: string,
    contactContext: string,
    event: string
  ): Promise<string | null> {
    // Only generate if there's meaningful context
    if (!contactContext || contactContext.trim().length < 10) {
      return null;
    }

    const prompt = `Based on: "${contactContext}"

Write one sentence starting with "I'd love to talk more with you about" for a coffee chat.

Example: "I'd love to talk more with you about your AI startup experience."`;

    try {
      const response = await this.callChat(prompt);
      return this.cleanMessageResponse(response);
    } catch (error) {
      console.error('Error generating topic sentence:', error);
      return null;
    }
  }
  /**
   * Call OpenAI API
   */
  private async callChat(prompt: string): Promise<string> {
    // If no valid API key, skip API call and use fallback
    if (this.apiKey === 'fallback-only' || !this.apiKey.startsWith('sk-') && !this.apiKey.startsWith('AIza')) {
      console.log(' no valid API key found, using fallback system only');
      throw new Error('No valid API key - using fallback');
    }

    console.log('calling openai API with GPT-3.5-turbo');
    console.log('API Key prefix:', this.apiKey.substring(0, 10) + '...');
    
    const requestBody = {
      model: 'gpt-3.5-turbo',
      messages: [{
        role: 'user',
        content: prompt
      }],
      max_tokens: 500,
      temperature: 0.7
    };
    
    console.log('request URL:', this.apiUrl);

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const responseText = await response.text();
        console.error('openai API error:', response.status, responseText);
        throw new Error(`openai API error: ${response.status} - ${responseText}`);
      }

      const data = await response.json() as any;
      const result = data.choices?.[0]?.message?.content || '';
      console.log('openai response success, text length:', result.length);
      return result;
    } catch (error) {
      console.error('openai API call failed:', error);
      throw error;
    }
  }  
  /**
   * Clean up the message response
   */
  private cleanMessageResponse(response: string): string {
    return response
      .replace(/^["']|["']$/g, '') // Remove quotes
      .replace(/^\s*Message:\s*/i, '') // Remove "Message:" prefix
      .trim();
  }

}