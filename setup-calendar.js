#!/usr/bin/env node

import { CalendarService } from './dist/services/calendarService.js';
import dotenv from 'dotenv';

dotenv.config();

async function setupCalendarAuth() {
    console.log('🗓️ Setting up Google Calendar authentication...');
    
    const calendar = new CalendarService(
        process.env.GOOGLE_CALENDAR_CLIENT_ID,
        process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
        process.env.GOOGLE_CALENDAR_REDIRECT_URI
    );
    
    // Get the authorization URL
    const authUrl = calendar.getAuthUrl();
    
    console.log('\n📋 Follow these steps:');
    console.log('1. Open this URL in your browser:');
    console.log(`   ${authUrl}`);
    console.log('\n2. Sign in to your Google account');
    console.log('3. Grant permission to access your calendar');
    console.log('4. Copy the authorization code from the redirect URL');
    console.log('5. Run: node setup-calendar.js [CODE]');
    console.log('\nExample: node setup-calendar.js 4/0AX4XfWh...');
    
    // If code is provided, exchange it for tokens
    const code = process.argv[2];
    if (code) {
        try {
            console.log('\n🔄 Exchanging code for tokens...');
            const tokens = await calendar.getTokens(code);
            
            console.log('\n✅ Success! Add these to your .env file:');
            console.log(`GOOGLE_CALENDAR_ACCESS_TOKEN="${tokens.access_token}"`);
            if (tokens.refresh_token) {
                console.log(`GOOGLE_CALENDAR_REFRESH_TOKEN="${tokens.refresh_token}"`);
            }
            
            // Test the calendar access
            console.log('\n🧪 Testing calendar access...');
            calendar.setCredentials(tokens);
            const slots = await calendar.findAvailableSlots(7, 60);
            
            if (slots.length > 0) {
                console.log('✅ Calendar access working! Found available slots:');
                slots.slice(0, 3).forEach(slot => {
                    console.log(`   ${slot.dayOfWeek} ${slot.date} at ${slot.startTime}`);
                });
            } else {
                console.log('✅ Calendar access working, but no free slots found in next 7 days');
            }
            
        } catch (error) {
            console.error('❌ Error:', error.message);
        }
    }
}

setupCalendarAuth().catch(console.error);