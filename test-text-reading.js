import { IMessageSDK } from '@photon-ai/imessage-kit'

console.log('🔍 Testing different ways to read message text...')

const sdk = new IMessageSDK({
    debug: true,
    maxConcurrent: 5
})

try {
    // Method 1: Check if there are other methods for reading messages
    console.log('\n📋 Available SDK methods:')
    console.log(Object.getOwnPropertyNames(sdk))
    console.log('\n📋 SDK prototype methods:')
    console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(sdk)))

    // Method 2: Try getting messages differently
    console.log('\n📬 Trying getUnreadMessages with detailed inspection...')
    const unread = await sdk.getUnreadMessages()
    
    if (Array.isArray(unread)) {
        const selfMessages = unread.find(group => group.sender === '+19525944474')
        if (selfMessages && selfMessages.messages.length > 0) {
            const msg = selfMessages.messages[0]
            console.log('\n🔍 Message properties:')
            console.log('Keys:', Object.keys(msg))
            console.log('Values:', Object.values(msg))
            console.log('Full object:', JSON.stringify(msg, null, 2))
            
            // Try accessing different text properties
            console.log('\n🔤 Trying different text fields:')
            console.log('text:', msg.text)
            console.log('message:', msg.message)
            console.log('content:', msg.content)
            console.log('body:', msg.body)
            console.log('attributedBody:', msg.attributedBody)
        }
    }

    // Method 3: Check if SDK has database access
    console.log('\n🗄️ Checking database access:')
    console.log('SDK database:', sdk.database)
    if (sdk.database) {
        console.log('Database methods:', Object.getOwnPropertyNames(sdk.database))
    }

} catch (error) {
    console.error('❌ Error:', error)
} finally {
    await sdk.close()
    console.log('\n✅ Test complete')
}