import { IMessageSDK } from '@photon-ai/imessage-kit'

console.log('🔍 Testing direct database access and getMessages...')

const sdk = new IMessageSDK({
    debug: true,
    maxConcurrent: 5
})

try {
    // Method 1: Try getMessages instead of getUnreadMessages
    console.log('\n📬 Testing getMessages method...')
    try {
        const messages = await sdk.getMessages()
        console.log('getMessages result type:', typeof messages)
        console.log('getMessages result:', messages)
    } catch (err) {
        console.log('getMessages error:', err.message)
    }

    // Method 2: Try getting messages with specific parameters
    console.log('\n📬 Testing getMessages with parameters...')
    try {
        // Try different parameter combinations
        const recent = await sdk.getMessages({ limit: 5 })
        console.log('Recent messages:', recent)
    } catch (err) {
        console.log('getMessages with params error:', err.message)
    }

    // Method 3: Direct database query
    console.log('\n🗄️ Testing direct database access...')
    const db = sdk.database?.db
    if (db) {
        console.log('Database info:')
        console.log('- Name:', db.name)
        console.log('- Open:', db.open)
        console.log('- Readonly:', db.readonly)
        
        try {
            // Query for recent messages with your phone number
            const query = `
                SELECT 
                    m.ROWID as id,
                    m.guid,
                    m.text,
                    m.date,
                    m.is_from_me,
                    m.is_read,
                    h.id as handle_id
                FROM message m
                LEFT JOIN handle h ON m.handle_id = h.ROWID
                WHERE h.id = '+19525944474'
                ORDER BY m.date DESC
                LIMIT 5
            `
            const stmt = db.prepare(query)
            const results = stmt.all()
            
            console.log(`\n🔍 Found ${results.length} messages from your number:`)
            results.forEach((row, i) => {
                console.log(`${i + 1}. Message:`, {
                    id: row.id,
                    text: row.text,
                    date: new Date((row.date / 1000000) + 978307200000), // Convert from Mac timestamp
                    is_from_me: row.is_from_me,
                    is_read: row.is_read
                })
            })
            
        } catch (dbErr) {
            console.log('Database query error:', dbErr.message)
        }
    }

} catch (error) {
    console.error('❌ Error:', error)
} finally {
    await sdk.close()
    console.log('\n✅ Test complete')
}