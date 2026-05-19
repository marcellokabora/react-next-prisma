import 'server-only'
import { createHydrationHelpers } from '@trpc/react-query/rsc'
import { cache } from 'react'
import { createQueryClient } from './query-client'
import { appRouter } from '@/server/routers/_app'
import { createCallerFactory } from '@/server/trpc'
import type { AppRouter } from '@/server/routers/_app'

const createCaller = createCallerFactory(appRouter)
const getQueryClient = cache(createQueryClient)

export const { trpc, HydrateClient } = createHydrationHelpers<AppRouter>(
    createCaller({}),
    getQueryClient
)
