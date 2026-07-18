export class Model<T extends Record<string, any>> {
    protected static table: string;
    protected static db: D1Database;

    static use(db: D1Database) {
        this.db = db;
        return this;
    }

    static async find<T>(this: any, id: string): Promise<T | null> {
        return this.db
            .prepare(`SELECT * FROM ${this.table} WHERE id = ?`)
            .bind(id)
            .first() as Promise<T | null>;
    }

    static async findBy<T>(this: any, column: string, value: any): Promise<T | null> {
        return this.db
            .prepare(`SELECT * FROM ${this.table} WHERE ${column} = ?`)
            .bind(value)
            .first() as Promise<T | null>;
    }

    static async all<T>(this: any): Promise<T[]> {
        const { results } = await this.db.prepare(`SELECT * FROM ${this.table}`).all();
        return results as T[];
    }

    static async sorted<T>(this: any, column: string, direction: 'ASC' | 'DESC' = 'DESC'): Promise<T[]> {
        const { results } = await this.db
            .prepare(`SELECT * FROM ${this.table} ORDER BY ${column} ${direction}`)
            .all();
        return results as T[];
    }

    static async where<T>(this: any, column: string, value: any): Promise<T[]> {
        const { results } = await this.db
            .prepare(`SELECT * FROM ${this.table} WHERE ${column} = ?`)
            .bind(value)
            .all();
        return results as T[];
    }

    static async create<T extends Record<string, any>>(this: any, data: T): Promise<T> {
        const columns = Object.keys(data);
        const placeholders = columns.map(() => '?').join(', ');
        await this.db
            .prepare(`INSERT INTO ${this.table} (${columns.join(', ')}) VALUES (${placeholders})`)
            .bind(...Object.values(data))
            .run();
        return data;
    }

    static async update(this: any, id: string, data: Record<string, any>) {
        const columns = Object.keys(data);
        const setClause = columns.map((c) => `${c} = ?`).join(', ');
        await this.db
            .prepare(`UPDATE ${this.table} SET ${setClause} WHERE id = ?`)
            .bind(...Object.values(data), id)
            .run();
    }

    static async updateWhere(this: any, where: Record<string, any>, data: Record<string, any>) {
        const whereColumns = Object.keys(where);
        const setColumns = Object.keys(data);
        const setClause = setColumns.map((c) => `${c} = ?`).join(', ');
        const whereClause = whereColumns.map((c) => `${c} = ?`).join(' AND ');
        await this.db
            .prepare(`UPDATE ${this.table} SET ${setClause} WHERE ${whereClause}`)
            .bind(...Object.values(data), ...Object.values(where))
            .run();
    }

    static async delete(this: any, id: string) {
        await this.db.prepare(`DELETE FROM ${this.table} WHERE id = ?`).bind(id).run();
    }

    static async deleteWhere(this: any, where: Record<string, any>) {
        const columns = Object.keys(where);
        const clause = columns.map((c) => `${c} = ?`).join(' AND ');
        await this.db.prepare(`DELETE FROM ${this.table} WHERE ${clause}`).bind(...Object.values(where)).run();
    }

    static async raw<T>(this: any, sql: string, ...params: any[]): Promise<T[]> {
        const { results } = await this.db.prepare(sql).bind(...params).all();
        return results as T[];
    }

    static async rawFirst<T>(this: any, sql: string, ...params: any[]): Promise<T | null> {
        return this.db.prepare(sql).bind(...params).first() as Promise<T | null>;
    }
}
