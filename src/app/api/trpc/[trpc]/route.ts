import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from '@/server/routers/_app'
import { getSession } from '@/lib/session'
import type { Context } from '@/server/trpc'

const handler = async (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: async (): Promise<Context> => {
      const session = await getSession()
      return { user: session ? { id: session.userId, email: session.email } : null }
    },
  })

export { handler as GET, handler as POST }
