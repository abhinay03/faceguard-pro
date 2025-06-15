import { neon } from '@netlify/neon';

const sql = neon();

export async function createUser(name) {
    const [user] = await sql`
        INSERT INTO users (name)
        VALUES (${name})
        RETURNING id, name, created_at
    `;
    return user;
}

export async function saveFaceEncoding(userId, encoding, profilePicture) {
    const [faceEncoding] = await sql`
        INSERT INTO face_encodings (user_id, encoding, profile_picture)
        VALUES (${userId}, ${encoding}, ${profilePicture})
        RETURNING id
    `;
    return faceEncoding;
}

export async function getAllFaceEncodings() {
    const encodings = await sql`
        SELECT u.id as user_id, u.name, fe.encoding, fe.profile_picture
        FROM users u
        JOIN face_encodings fe ON u.id = fe.user_id
        ORDER BY fe.created_at DESC
    `;
    return encodings;
}

export async function logLoginAttempt(userId, success, confidence) {
    const [log] = await sql`
        INSERT INTO login_history (user_id, success, confidence)
        VALUES (${userId}, ${success}, ${confidence})
        RETURNING id
    `;
    
    if (success) {
        await sql`
            UPDATE users
            SET last_login = CURRENT_TIMESTAMP
            WHERE id = ${userId}
        `;
    }
    
    return log;
}

export async function getUserProfile(userId) {
    const [user] = await sql`
        SELECT u.id, u.name, u.created_at, u.last_login,
               fe.profile_picture,
               COUNT(lh.id) as total_logins,
               COUNT(CASE WHEN lh.success THEN 1 END) as successful_logins
        FROM users u
        LEFT JOIN face_encodings fe ON u.id = fe.user_id
        LEFT JOIN login_history lh ON u.id = lh.user_id
        WHERE u.id = ${userId}
        GROUP BY u.id, u.name, u.created_at, u.last_login, fe.profile_picture
    `;
    return user;
} 