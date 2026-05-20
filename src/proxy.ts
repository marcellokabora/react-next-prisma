import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const secretKey = process.env.SESSION_SECRET ?? 'dev-secret-change-in-production-32ch'
const encodedKey = new TextEncoder().encode(secretKey)

const PUBLIC_PATHS = ['/login']

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl

    if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
        return NextResponse.next()
    }

    const token = request.cookies.get('session')?.value

    if (!token) {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    try {
        await jwtVerify(token, encodedKey, { algorithms: ['HS256'] })
        return NextResponse.next()
    } catch {
        return NextResponse.redirect(new URL('/login', request.url))
    }
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|api/trpc).*)'],
}
