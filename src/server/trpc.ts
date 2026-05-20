import { initTRPC, TRPCError } from '@trpc/server'

export type Context = {
    user: { id: number; email: string } | null
}

const t = initTRPC.context<Context>().create()

export const router = t.router
export const createCallerFactory = t.createCallerFactory

export const publicProcedure = t.procedure

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
    if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'You must be logged in.' })
    }
    return next({ ctx: { user: ctx.user } })
})
