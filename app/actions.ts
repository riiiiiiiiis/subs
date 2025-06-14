'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

export type Subscription = {
  id: string
  title: string
  amount: number
  start_date: string
  period: number
  user_id: string
  created_at: string
}

export async function getSubscriptions(): Promise<Subscription[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return []
  }

  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching subscriptions:', error)
    return []
  }

  return data || []
}

export async function saveSubscription(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'Пользователь не авторизован' }
  }

  const id = formData.get('id') as string
  const subscriptionData = {
    title: formData.get('title') as string,
    amount: parseFloat(formData.get('amount') as string),
    start_date: formData.get('startDate') as string,
    period: parseInt(formData.get('period') as string),
    user_id: user.id,
  }

  // Basic validation
  if (!subscriptionData.title || !subscriptionData.amount || !subscriptionData.start_date || !subscriptionData.period) {
    return { error: 'Все поля обязательны для заполнения' }
  }

  let error
  if (id) {
    // Update existing subscription
    ({ error } = await supabase
      .from('subscriptions')
      .update(subscriptionData)
      .eq('id', id)
      .eq('user_id', user.id)) // Ensure user can only update their own subscriptions
  } else {
    // Create new subscription
    ({ error } = await supabase
      .from('subscriptions')
      .insert(subscriptionData))
  }

  if (error) {
    console.error('Save subscription error:', error)
    return { error: 'Не удалось сохранить подписку' }
  }

  revalidatePath('/')
  return { success: true }
}

export async function deleteSubscription(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'Пользователь не авторизован' }
  }

  if (!id) {
    return { error: 'Необходим ID для удаления' }
  }

  const { error } = await supabase
    .from('subscriptions')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id) // Ensure user can only delete their own subscriptions

  if (error) {
    console.error('Error deleting subscription:', error)
    return { error: 'Не удалось удалить подписку' }
  }

  revalidatePath('/')
  return { success: true }
}

export async function signIn(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    console.error('Sign in error:', error)
    return { error: 'Неверные учетные данные' }
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signUp(formData: FormData) {
  const headersList = await headers()
  const origin = headersList.get('origin')
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  })

  if (error) {
    console.error('Sign up error:', error)
    return { error: 'Не удалось зарегистрировать пользователя. Возможно, он уже существует.' }
  }

  return { message: 'Проверьте почту для подтверждения регистрации!' }
}

export async function signOut() {
  const supabase = await createClient()
  const { error } = await supabase.auth.signOut()
  
  if (error) {
    console.error('Error signing out:', error)
    throw new Error('Failed to sign out')
  }
  
  redirect('/')
}