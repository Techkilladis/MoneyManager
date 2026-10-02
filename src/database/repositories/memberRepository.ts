// Member Repository
import { openDatabase, mapMemberRow, generateId, now } from '../db';
import { Member } from '../schema';

export interface CreateMemberInput {
  name: string;
  color?: string | null;
  isDefault?: boolean;
}

export interface UpdateMemberInput {
  name?: string;
  color?: string | null;
}

export const memberRepository = {
  // Create a new member
  async create(input: CreateMemberInput): Promise<Member> {
    const database = await openDatabase();
    const id = generateId();
    const timestamp = now();
    
    await database.runAsync(
      `INSERT INTO members (id, name, color, isDefault, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, input.name, input.color || null, input.isDefault ? 1 : 0, timestamp, timestamp]
    );
    
    const row = await database.getFirstAsync(
      'SELECT * FROM members WHERE id = ?',
      [id]
    );
    
    return mapMemberRow(row!);
  },
  
  // Get member by ID
  async getById(id: string): Promise<Member | null> {
    const database = await openDatabase();
    const row = await database.getFirstAsync(
      'SELECT * FROM members WHERE id = ?',
      [id]
    );
    
    return row ? mapMemberRow(row) : null;
  },
  
  // Get member by name
  async getByName(name: string): Promise<Member | null> {
    const database = await openDatabase();
    const row = await database.getFirstAsync(
      'SELECT * FROM members WHERE name = ?',
      [name]
    );
    
    return row ? mapMemberRow(row) : null;
  },
  
  // Update member
  async update(id: string, input: UpdateMemberInput): Promise<Member | null> {
    const database = await openDatabase();
    
    const updates: string[] = [];
    const values: any[] = [];
    
    if (input.name !== undefined) {
      updates.push('name = ?');
      values.push(input.name);
    }
    if (input.color !== undefined) {
      updates.push('color = ?');
      values.push(input.color);
    }
    
    if (updates.length === 0) {
      return this.getById(id);
    }
    
    updates.push('updatedAt = ?');
    values.push(now());
    values.push(id);
    
    await database.runAsync(
      `UPDATE members SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    
    return this.getById(id);
  },
  
  // Delete member (only if no transactions reference it)
  async delete(id: string): Promise<boolean> {
    const database = await openDatabase();
    
    // Check if any transactions use this member
    const txCount = await database.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM transactions WHERE memberId = ?',
      [id]
    );
    
    if ((txCount?.count || 0) > 0) {
      throw new Error('Cannot delete member with existing transactions');
    }
    
    const result = await database.runAsync(
      'DELETE FROM members WHERE id = ?',
      [id]
    );
    
    return result.changes > 0;
  },
  
  // List all members
  async list(): Promise<Member[]> {
    const database = await openDatabase();
    const rows = await database.getAllAsync(
      'SELECT * FROM members ORDER BY isDefault DESC, name ASC'
    );
    
    return rows.map(mapMemberRow);
  },
  
  // Get all members (alias for list)
  async getAll(): Promise<Member[]> {
    return this.list();
  },
  
  // Get default members
  async getDefaults(): Promise<Member[]> {
    const database = await openDatabase();
    const rows = await database.getAllAsync(
      'SELECT * FROM members WHERE isDefault = 1 ORDER BY name ASC'
    );
    
    return rows.map(mapMemberRow);
  },
};