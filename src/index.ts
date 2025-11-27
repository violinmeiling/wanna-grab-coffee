#!/usr/bin/env node

import { CoffeeNetworkingApp } from './coffeeNetworkingApp.js';

/**
 * Main entry point for the Coffee Networking Assistant
 */
async function main() {
  const app = new CoffeeNetworkingApp();

  // Handle graceful shutdown
  const gracefulShutdown = async () => {
    console.log('\nstopping coffee...');
    await app.stop();
    console.log('coffee stopped');
    process.exit(0);
  };

  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);

  try {
    // Initialize the app
    await app.initialize();

    // Start monitoring messages
    await app.startMonitoring();

    console.log('coffee is running!');
    console.log('send yourself a message like: "met John at networking event, he works in tech"');
    console.log('press Ctrl+C to stop\n');

    // Keep the process running
    process.stdin.resume();

  } catch (error) {
    console.error('failed to start coffee:', error);
    console.error('\ntroubleshooting:');
    console.error('1. make sure you have Full Disk Access enabled in System Settings');
    console.error('2. check your .env file has all required API keys');
    console.error('3. ensure Google Calendar OAuth is set up');
    console.error('4. text meiling for help: (952) 594-4474');
    process.exit(1);
  }
}

// Run the app if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}