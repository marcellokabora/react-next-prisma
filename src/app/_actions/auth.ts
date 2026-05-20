'use server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { redirect } from 'next/navigation'
import { db } from '@/server/db'
import { createSession, deleteSession } from '@/lib/session'

export type AuthState = {
    errors?: { email?: string; password?: string }
    error?: string
}

type AuthErrors = NonNullable<AuthState['errors']>

const loginSchema = z.object({
    email: z.string().email('Please enter a valid email.').trim(),
    password: z.string().min(1, 'Password is required.'),
})

const registerSchema = z.object({
    email: z.string().email('Please enter a valid email.').trim(),
    password: z
        .string()
        .min(8, 'Password must be at least 8 characters.')
        .regex(/[a-zA-Z]/, 'Password must contain at least one letter.')
        .regex(/[0-9]/, 'Password must contain at least one number.')
        .trim(),
})

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
    const result = loginSchema.safeParse({
        email: formData.get('email'),
        password: formData.get('password'),
    })

    if (!result.success) {
        const errors: AuthErrors = {}
        for (const issue of result.error.issues) {
            const field = issue.path[0] as keyof AuthErrors
            if (field && !errors[field]) errors[field] = issue.message
        }
        return { errors }
    }

    const { email, password } = result.data
    const user = await db.user.findUnique({ where: { email } })

    if (!user || !(await bcrypt.compare(password, user.hashedPassword))) {
        return { error: 'Invalid email or password.' }
    }

    await createSession(user.id, user.email)
    redirect('/')
}

export async function register(_prev: AuthState, formData: FormData): Promise<AuthState> {
    const result = registerSchema.safeParse({
        email: formData.get('email'),
        password: formData.get('password'),
    })

    if (!result.success) {
        const errors: AuthErrors = {}
        for (const issue of result.error.issues) {
            const field = issue.path[0] as keyof AuthErrors
            if (field && !errors[field]) errors[field] = issue.message
        }
        return { errors }
    }

    const { email, password } = result.data
    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
        return { errors: { email: 'An account with this email already exists.' } }
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const user = await db.user.create({ data: { email, hashedPassword } })

    await createSession(user.id, user.email)
    redirect('/')
}

export async function logout() {
    await deleteSession()
    redirect('/login')
}
