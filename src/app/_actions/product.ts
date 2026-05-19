'use server'
import { z } from 'zod'
import { getCaller } from '@/trpc/server'
import { revalidatePath } from 'next/cache'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
import type { inferRouterInputs } from '@trpc/server'
import type { AppRouter } from '@/server/routers/_app'

type RouterInputs = inferRouterInputs<AppRouter>
// price comes from the form as a string; everything else is inferred from the router
type CreateProductData = Omit<RouterInputs['product']['create'], 'price'> & { price: string }

const createSchema = z.object({
    name: z.string().trim().min(1, 'Name is required.'),
    price: z
        .string()
        .min(1, 'Price is required.')
        .refine(
            (val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0,
            'Price must be a positive number.',
        )
        .transform((val) => parseFloat(val)),
    category: z.string().trim().min(1, 'Category is required.'),
    description: z
        .string()
        .trim()
        .max(50, 'Description must be 50 characters or fewer.')
        .optional(),
})

export type CreateProductState = {
    errors?: {
        name?: string
        price?: string
        category?: string
        description?: string
    }
    error?: string
    success?: boolean
}

export async function createProduct(
    _prev: CreateProductState,
    data: CreateProductData,
): Promise<CreateProductState> {
    const result = createSchema.safeParse({
        ...data,
        description: data.description || undefined, // '' → undefined
    })

    if (!result.success) {
        const errors: CreateProductState['errors'] = {}
        for (const issue of result.error.issues) {
            const field = issue.path[0] as keyof NonNullable<CreateProductState['errors']>
            if (field && !errors[field]) errors[field] = issue.message
        }
        return { errors }
    }

    try {
        const caller = getCaller()
        await sleep(1500)
        await caller.product.create(result.data)
        revalidatePath('/')
        return { success: true }
    } catch (err) {
        return { error: err instanceof Error ? err.message : 'Failed to add product.' }
    }
}

export async function deleteProduct(id: number): Promise<void> {
    const caller = getCaller()
    await sleep(1500)
    await caller.product.delete({ id })
    revalidatePath('/')
}
