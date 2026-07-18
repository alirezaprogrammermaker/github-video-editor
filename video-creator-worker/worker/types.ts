export type Bindings = {
    DB: D1Database;
    AI: Ai;
};

export type Variables = {
    user: {
        id: string;
        email: string;
        role: string;
    };
};
