import 'server-only'
import { cache } from 'react'
import { appRouter } from '@/server/routers/_app'
import { createCallerFactory } from '@/server/trpc'
import { getSession } from '@/lib/session'

const createCaller = createCallerFactory(appRouter)

export const getCaller = cache(async () => {
    const session = await getSession()
    return createCaller({ user: session ? { id: session.userId, email: session.email } : null })
})
