import 'server-only'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const secretKey = process.env.SESSION_SECRET ?? 'dev-secret-change-in-production-32ch'
const encodedKey = new TextEncoder().encode(secretKey)

export type SessionPayload = {
    userId: number
    email: string
    expiresAt: Date
}

export async function encrypt(payload: SessionPayload) {
    return new SignJWT({ userId: payload.userId, email: payload.email })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(encodedKey)
}

export async function decrypt(session: string | undefined = '') {
    try {
        const { payload } = await jwtVerify(session, encodedKey, {
            algorithms: ['HS256'],
        })
        return payload as { userId: number; email: string }
    } catch {
        return null
    }
}

export async function createSession(userId: number, email: string) {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const token = await encrypt({ userId, email, expiresAt })
    const cookieStore = await cookies()

    cookieStore.set('session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        expires: expiresAt,
        sameSite: 'lax',
        path: '/',
    })
}

export async function deleteSession() {
    const cookieStore = await cookies()
    cookieStore.delete('session')
}

export async function getSession(): Promise<{ userId: number; email: string } | null> {
    const cookieStore = await cookies()
    const token = cookieStore.get('session')?.value
    if (!token) return null
    return decrypt(token)
}
