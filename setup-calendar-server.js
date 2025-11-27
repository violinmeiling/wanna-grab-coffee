#!/usr/bin/env node

import { CalendarService } from './dist/services/calendarService.js';
import dotenv from 'dotenv';
import http from 'http';
import url from 'url';

dotenv.config();

async function setupCalendarWithServer() {
    console.log('🗓️ Setting up Google Calendar authentication with local server...');
    
    const calendar = new CalendarService(
        process.env.GOOGLE_CALENDAR_CLIENT_ID,
        process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
        process.env.GOOGLE_CALENDAR_REDIRECT_URI
    );
    
    // Create a simple HTTP server to catch the OAuth callback
    const server = http.createServer(async (req, res) => {
        const parsedUrl = url.parse(req.url, true);
        
        if (parsedUrl.pathname === '/oauth/callback') {
            const code = parsedUrl.query.code;
            
            if (code) {
                try {
                    console.log('\n🔄 Exchanging code for tokens...');
                    const tokens = await calendar.getTokens(code);
                    
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(`
                        <html>
                            <body>
                                <h1>✅ Authentication Successful!</h1>
                                <p>You can close this tab and return to the terminal.</p>
                            </body>
                        </html>
                    `);
                    
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
                    
                    console.log('\n🎉 Setup complete! You can now restart your networking assistant.');
                    server.close();
                    
                } catch (error) {
                    res.writeHead(500, { 'Content-Type': 'text/html' });
                    res.end(`
                        <html>
                            <body>
                                <h1>❌ Authentication Failed</h1>
                                <p>Error: ${error.message}</p>
                            </body>
                        </html>
                    `);
                    console.error('❌ Error:', error.message);
                    server.close();
                }
            } else {
                res.writeHead(400, { 'Content-Type': 'text/html' });
                res.end(`
                    <html>
                        <body>
                            <h1>❌ No Authorization Code</h1>
                            <p>Please try the authentication flow again.</p>
                        </body>
                    </html>
                `);
                server.close();
            }
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not found');
        }
    });
    
    // Start the server
    server.listen(3000, () => {
        console.log('\n🌐 Local server started on http://localhost:3000');
        console.log('\n📋 Follow these steps:');
        console.log('1. Click this URL to authenticate:');
        
        const authUrl = calendar.getAuthUrl();
        console.log(`   ${authUrl}`);
        
        console.log('\n2. Sign in to your Google account');
        console.log('3. Grant permission to access your calendar');
        console.log('4. The browser will redirect and show success message');
        console.log('\n⏳ Waiting for authentication...');
    });
}

setupCalendarWithServer().catch(console.error);