import 'server-only'
import { cache } from 'react'
import { appRouter } from '@/server/routers/_app'
import { createCallerFactory } from '@/server/trpc'

const createCaller = createCallerFactory(appRouter)

export const getCaller = cache(() => createCaller({}))
