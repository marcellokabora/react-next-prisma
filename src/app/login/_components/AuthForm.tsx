'use client'
import { useActionState, useState } from 'react'
import { login, register, type AuthState } from '@/app/_actions/auth'

export default function AuthForm() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [loginState, loginAction, isLoginPending] = useActionState<AuthState, FormData>(login, {})
  const [registerState, registerAction, isRegisterPending] = useActionState<AuthState, FormData>(register, {})

  const state = mode === 'login' ? loginState : registerState
  const action = mode === 'login' ? loginAction : registerAction
  const isPending = mode === 'login' ? isLoginPending : isRegisterPending

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full max-w-sm p-8 space-y-6">
        {/* Logo / title */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-gray-900">Product Catalog</h1>
          <p className="text-sm text-gray-500">
            {mode === 'login' ? 'Sign in to your account' : 'Create a new account'}
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex rounded-lg bg-gray-100 p-1 gap-1">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
              mode === 'login' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
              mode === 'register' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Register
          </button>
        </div>

        {/* Form */}
        <form action={action} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                state?.errors?.email ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {state?.errors?.email && (
              <p className="text-red-500 text-xs">{state.errors.email}</p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              placeholder={mode === 'register' ? 'Min 8 chars, 1 letter, 1 number' : '••••••••'}
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                state?.errors?.password ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {state?.errors?.password && (
              <p className="text-red-500 text-xs">{state.errors.password}</p>
            )}
          </div>

          {state?.error && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg py-2 text-sm transition-colors"
          >
            {isPending
              ? mode === 'login' ? 'Signing in…' : 'Creating account…'
              : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  )
}
