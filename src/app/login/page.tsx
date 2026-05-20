import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import AuthForm from './_components/AuthForm'

export default async function LoginPage() {
  const session = await getSession()
  if (session) redirect('/')

  return <AuthForm />
}
