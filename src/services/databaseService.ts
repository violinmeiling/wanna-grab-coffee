import sqlite3 from 'sqlite3';
import { Contact, ContactSummary } from '../types/index.js';
import path from 'path';
import fs from 'fs/promises';

export class DatabaseService {
  private db: sqlite3.Database | null = null;
  private dbPath: string;

  constructor(dbPath: string = './data/coffee_network.db') {
    this.dbPath = dbPath;
  }

  /**
   * Initialize database connection and create tables
   */
  public async initialize(): Promise<void> {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.dbPath);
      await fs.mkdir(dir, { recursive: true });

      this.db = new sqlite3.Database(this.dbPath);
      
      // Create tables
      await this.runAsync(`
        CREATE TABLE IF NOT EXISTS contacts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          event TEXT NOT NULL,
          context TEXT,
          metAt DATETIME NOT NULL,
          phoneNumber TEXT,
          email TEXT,
          followUpStatus TEXT CHECK(followUpStatus IN ('pending', 'scheduled', 'sent', 'completed')) DEFAULT 'pending',
          scheduledFollowUp DATETIME,
          lastInteraction DATETIME,
          notes TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      console.log('database initialized');
    } catch (error) {
      console.error('error initializing database:', error);
      throw error;
    }
  }

  private runAsync(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }
      
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    });
  }

  private getAsync(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }
      
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  private allAsync(sql: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }
      
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Add a new contact
   */
  public async addContact(contact: Omit<Contact, 'id'>): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.runAsync(`
      INSERT INTO contacts (
        name, event, context, metAt, phoneNumber, email, 
        followUpStatus, scheduledFollowUp, lastInteraction, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      contact.name,
      contact.event,
      contact.context || null,
      contact.metAt.toISOString(),
      contact.phoneNumber || null,
      contact.email || null,
      contact.followUpStatus,
      contact.scheduledFollowUp?.toISOString() || null,
      contact.lastInteraction?.toISOString() || null,
      contact.notes || null
    ]);

    return result.lastID as number;
  }

  /**
   * Update a contact
   */
  public async updateContact(id: number, updates: Partial<Contact>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const setParts: string[] = [];
    const values: any[] = [];

    // Build dynamic update query
    Object.entries(updates).forEach(([key, value]) => {
      if (key === 'id') return; // Don't update ID
      
      setParts.push(`${key} = ?`);
      
      if (value instanceof Date) {
        values.push(value.toISOString());
      } else {
        values.push(value);
      }
    });

    setParts.push('updatedAt = CURRENT_TIMESTAMP');
    values.push(id);

    await this.runAsync(`
      UPDATE contacts 
      SET ${setParts.join(', ')} 
      WHERE id = ?
    `, values);
  }

  /**
   * Get contact by ID
   */
  public async getContact(id: number): Promise<Contact | null> {
    if (!this.db) throw new Error('Database not initialized');
    
    const row = await this.getAsync('SELECT * FROM contacts WHERE id = ?', [id]);
    
    return row ? this.rowToContact(row) : null;
  }

  /**
   * Get recent contacts summary
   */
  public async getContactSummary(days: number = 30): Promise<ContactSummary> {
    if (!this.db) throw new Error('Database not initialized');
    
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Get recent contacts directly
    const contacts = await this.allAsync(
      'SELECT * FROM contacts WHERE metAt >= ? ORDER BY metAt DESC LIMIT 10',
      [since.toISOString()]
    );

    // Get total count
    const totalResult = await this.getAsync('SELECT COUNT(*) as total FROM contacts');
    const totalContacts = totalResult?.total || 0;

    return {
      totalContacts,
      recentContacts: contacts.map(contact => ({
        name: contact.name,
        event: contact.event,
        metAt: contact.metAt,
        context: contact.context || undefined,
        followUpStatus: contact.followUpStatus
      }))
    };
  }



  /**
   * Convert database row to Contact object
   */
  private rowToContact(row: any): Contact {
    const contact: Contact = {
      id: row.id,
      name: row.name,
      event: row.event,
      metAt: new Date(row.metAt),
      followUpStatus: row.followUpStatus
    };
    
    if (row.context) contact.context = row.context;
    if (row.phoneNumber) contact.phoneNumber = row.phoneNumber;
    if (row.email) contact.email = row.email;
    if (row.scheduledFollowUp) contact.scheduledFollowUp = new Date(row.scheduledFollowUp);
    if (row.lastInteraction) contact.lastInteraction = new Date(row.lastInteraction);
    if (row.notes) contact.notes = row.notes;
    
    return contact;
  }

  /**
   * Close database connection
   */
  public async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            reject(err);
          } else {
            this.db = null;
            console.log('Database connection closed');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get database stats for debugging
   */
  public async getStats(): Promise<{
    totalContacts: number;
    recentContacts: number;
  }> {
    if (!this.db) throw new Error('Database not initialized');
    
    const totalResult = await this.getAsync('SELECT COUNT(*) as count FROM contacts');
    
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const recentResult = await this.getAsync('SELECT COUNT(*) as count FROM contacts WHERE metAt >= ?', [weekAgo.toISOString()]);
    
    return {
      totalContacts: totalResult?.count || 0,
      recentContacts: recentResult?.count || 0
    };
  }
}