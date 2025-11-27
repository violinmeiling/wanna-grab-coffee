import { IMessageSDK } from '@photon-ai/imessage-kit'

console.log('🧪 Testing iMessage SDK quickstart...')

// Initialize SDK (works in both Node.js and Bun)
const sdk = new IMessageSDK({
    debug: true,
    maxConcurrent: 5
})

try {
    console.log('📬 Getting unread messages...')
    
    // Get unread messages
    const unread = await sdk.getUnreadMessages()
    console.log('🔍 Unread messages result:', unread)
    console.log('🔍 Type of unread:', typeof unread)
    console.log('🔍 Keys:', Object.keys(unread || {}))
    
    if (Array.isArray(unread)) {
        console.log(`Found ${unread.length} senders with unread messages`)
        
        // Find messages from yourself
        const selfMessages = unread.find(group => group.sender === '+19525944474')
        if (selfMessages) {
            console.log(`\n🔍 Found ${selfMessages.messages.length} unread messages from yourself:`)
            selfMessages.messages.forEach((msg, i) => {
                console.log(`  ${i + 1}. Full message object:`, JSON.stringify(msg, null, 2))
            })
        } else {
            console.log(`\n⚠️ No unread messages from yourself found`)
        }
        
        // Show a few other senders and try to read their text
        console.log(`\n📋 Checking if we can read text from other senders:`)
        unread.slice(1, 4).forEach(group => {
            if (group.sender !== '+19525944474' && group.messages.length > 0) {
                console.log(`\n${group.sender}: ${group.messages.length} messages`)
                console.log(`  Latest message:`, JSON.stringify(group.messages[0], null, 2))
            }
        })
    }

    // Test sending a message to yourself
    console.log(`📱 Sending test message to your phone: +19525944474`)
    await sdk.send('+19525944474', 'Test message from SDK quickstart!')
    console.log('✅ Message sent successfully!')

} catch (error) {
    console.error('❌ Error testing SDK:', error)
} finally {
    // Always close when done
    console.log('🔒 Closing SDK...')
    await sdk.close()
    console.log('✅ SDK test complete')
}