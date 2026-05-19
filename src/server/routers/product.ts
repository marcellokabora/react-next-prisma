import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
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

  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        price: z.number().positive(),
        category: z.string().min(1),
        description: z.string().optional(),
      })
    )
    .mutation(({ input }) => db.product.create({ data: input })),

  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) =>
      db.product.findUnique({ where: { id: input.id } })
    ),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => db.product.delete({ where: { id: input.id } })),
})
