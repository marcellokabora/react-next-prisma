import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, publicProcedure, protectedProcedure } from '../trpc'
import { db } from '../db'

export const productRouter = router({
  list: publicProcedure
    .input(z.object({ category: z.string().optional() }).optional())
    .query(({ input }) =>
      db.product.findMany({
        where: input?.category ? { category: input.category } : undefined,
        orderBy: { createdAt: 'desc' },
      })
    ),

  categories: publicProcedure.query(async () => {
    const rows = await db.product.findMany({
      select: { category: true },
      distinct: ['category'],
    })
    return rows.map((r) => r.category)
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        price: z.number().positive(),
        category: z.string().min(1),
        description: z.string().optional(),
      })
    )
    .mutation(({ input, ctx }) =>
      db.product.create({ data: { ...input, authorEmail: ctx.user.email } })
    ),

  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) =>
      db.product.findUnique({ where: { id: input.id } })
    ),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1),
        price: z.number().positive(),
        category: z.string().min(1),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const product = await db.product.findUnique({ where: { id: input.id } })
      if (!product) throw new TRPCError({ code: 'NOT_FOUND' })
      if (product.authorEmail && product.authorEmail !== ctx.user.email) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You can only edit your own products.' })
      }
      const { id, ...data } = input
      return db.product.update({ where: { id }, data })
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const product = await db.product.findUnique({ where: { id: input.id } })
      if (!product) throw new TRPCError({ code: 'NOT_FOUND' })
      if (product.authorEmail && product.authorEmail !== ctx.user.email) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You can only delete your own products.' })
      }
      return db.product.delete({ where: { id: input.id } })
    }),
})
