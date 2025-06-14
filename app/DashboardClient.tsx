'use client'

import { useState, useEffect, useMemo, useTransition } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Chart as ChartJS, ArcElement, Tooltip, Legend, Title } from 'chart.js'
import { Pie } from 'react-chartjs-2'
import type { Subscription } from './actions'
import { signIn, signUp } from './actions'
import type { User } from '@supabase/supabase-js'

ChartJS.register(ArcElement, Tooltip, Legend, Title)

const EXCHANGE_RATE_USD_TO_RUB = 90.0

type Props = {
  user: User | null
  initialSubscriptions: Subscription[]
  saveSubscriptionAction: (formData: FormData) => Promise<{ error?: string; success?: boolean } | undefined>
  deleteSubscriptionAction: (id: string) => Promise<{ error?: string; success?: boolean } | undefined>
  signOutAction: () => Promise<void>
}

function AuthForm() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null)
  const [isPending, startTransition] = useTransition()
  const supabase = createClient()

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      setMessage(null)
      const action = isSignUp ? signUp : signIn
      const result = await action(formData)

      if (result) {
        if ('error' in result && result.error) {
          setMessage({ type: 'error', text: result.error })
        } else if ('message' in result && result.message) {
          setMessage({ type: 'success', text: result.message })
        }
      }
    })
  }

  const handleOAuth = async (provider: 'google' | 'github') => {
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${location.origin}/auth/callback` },
    })
  }

  return (
    <div className="border border-gray-200 rounded-lg p-6 bg-white shadow-sm max-w-sm mx-auto">
      <h2 className="text-xl font-semibold mb-4 text-center">
        {isSignUp ? 'Создать аккаунт' : 'Войти в систему'}
      </h2>

      <form action={handleSubmit} className="space-y-4 mb-4">
        <input
          name="email"
          type="email"
          placeholder="your@email.com"
          className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
          disabled={isPending}
        />
        <input
          name="password"
          type="password"
          placeholder="••••••••"
          className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
          minLength={6}
          disabled={isPending}
        />
        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Загрузка...' : (isSignUp ? 'Зарегистрироваться' : 'Войти')}
        </button>
      </form>
      
      {message && (
        <p className={`mb-4 text-center text-sm ${message.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
          {message.text}
        </p>
      )}
      
      <div className="text-center text-sm">
        <button 
          onClick={() => { setIsSignUp(!isSignUp); setMessage(null); }} 
          className="text-blue-600 hover:underline"
          disabled={isPending}
        >
          {isSignUp ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
        </button>
      </div>
      
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">или</span>
        </div>
      </div>

      <div className="space-y-2">
        <button 
          onClick={() => handleOAuth('google')} 
          disabled={isPending} 
          className="w-full flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 p-3 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          Войти через Google
        </button>
        <button 
          onClick={() => handleOAuth('github')} 
          disabled={isPending} 
          className="w-full flex items-center justify-center gap-2 bg-gray-800 text-white p-3 rounded-lg hover:bg-gray-900 disabled:opacity-50 transition-colors"
        >
          Войти через GitHub
        </button>
      </div>
    </div>
  )
}

export default function DashboardClient({
  user,
  initialSubscriptions,
  saveSubscriptionAction,
  deleteSubscriptionAction,
  signOutAction,
}: Props) {
  const supabase = createClient()
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(initialSubscriptions)
  const [form, setForm] = useState<Partial<Subscription>>({
    start_date: new Date().toISOString().slice(0, 10),
    period: 30,
  })
  const [isClient, setIsClient] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [, setUpdateTrigger] = useState(0)

  // Client-side mounting and realtime setup
  useEffect(() => {
    setIsClient(true)

    if (user) {
      // Set up realtime subscription
      const channel = supabase
        .channel('realtime-subscriptions')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'subscriptions',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              setSubscriptions(prev => [payload.new as Subscription, ...prev])
            } else if (payload.eventType === 'UPDATE') {
              setSubscriptions(prev => 
                prev.map(s => s.id === payload.new.id ? payload.new as Subscription : s)
              )
            } else if (payload.eventType === 'DELETE') {
              setSubscriptions(prev => prev.filter(s => s.id !== payload.old.id))
            }
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [user, supabase])

  // Auto-update trigger for days remaining
  useEffect(() => {
    const interval = setInterval(() => {
      setUpdateTrigger(prev => prev + 1)
    }, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [])

  if (!user) {
    return <AuthForm />
  }

  // Calculations
  const totalUsdCost = useMemo(() => {
    return subscriptions.reduce((sum, s) => sum + s.amount, 0)
  }, [subscriptions])

  const totalRubCost = useMemo(() => {
    return totalUsdCost * EXCHANGE_RATE_USD_TO_RUB
  }, [totalUsdCost])

  const chartDataForCurrentMonth = useMemo(() => {
    if (!isClient) {
      return { labels: [], datasets: [{ data: [] }] }
    }

    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()
    const firstDayCurrentMonth = new Date(currentYear, currentMonth, 1)
    const firstDayNextMonth = new Date(currentYear, currentMonth + 1, 1)

    const currentMonthSubscriptions: { title: string; amount: number }[] = []

    subscriptions.forEach(s => {
      const startDate = new Date(s.start_date)
      let paymentDate = new Date(startDate)

      while (paymentDate.getTime() < firstDayNextMonth.getTime()) {
        if (paymentDate.getTime() >= firstDayCurrentMonth.getTime()) {
          currentMonthSubscriptions.push({ title: s.title, amount: s.amount })
          break
        }
        paymentDate.setDate(paymentDate.getDate() + s.period)
      }
    })

    const labels = currentMonthSubscriptions.map(sub => sub.title)
    const data = currentMonthSubscriptions.map(sub => sub.amount)

    const backgroundColor = [
      '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', 
      '#9966FF', '#FF9F40', '#FF6B6B', '#4ECDC4'
    ]

    return {
      labels,
      datasets: [{
        label: 'Расходы за текущий месяц (USD)',
        data,
        backgroundColor: backgroundColor.slice(0, data.length),
        borderColor: backgroundColor.slice(0, data.length).map(color => color + 'CC'),
        borderWidth: 1,
      }]
    }
  }, [subscriptions, isClient])

  const pieChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Расходы на подписки за текущий месяц (USD)',
      },
    },
  }

  const daysLeft = (s: Subscription) =>
    Math.ceil(
      (new Date(s.start_date).getTime() + s.period * 86_400_000 - Date.now()) /
        86_400_000,
    )

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    const formData = new FormData(e.currentTarget)
    const form = e.currentTarget
    
    startTransition(async () => {
      const result = await saveSubscriptionAction(formData)
      if (result?.error) {
        console.error('Failed to save subscription:', result.error)
        alert(`Ошибка при сохранении: ${result.error}`)
      } else {
        setForm({
          start_date: new Date().toISOString().slice(0, 10),
          period: 30,
        })
        form.reset()
      }
    })
  }

  const handleDelete = async (id: string) => {
    if (confirm('Удалить эту подписку?')) {
      startTransition(async () => {
        const result = await deleteSubscriptionAction(id)
        if (result?.error) {
          console.error('Failed to delete subscription:', result.error)
          alert(`Ошибка при удалении: ${result.error}`)
        }
        // В случае успеха, UI обновится автоматически благодаря revalidatePath на сервере
        // и/или realtime подписке.
      })
    }
  }

  const handleSignOut = async () => {
    startTransition(async () => {
      try {
        await signOutAction()
      } catch (error) {
        console.error('Failed to sign out:', error)
      }
    })
  }

  return (
    <div>
      {/* User info and sign out */}
      <div className="flex justify-between items-center mb-6 p-4 bg-gray-50 rounded-lg">
        <span className="text-sm text-gray-600">
          Добро пожаловать, <strong>{user.email}</strong>
        </span>
        <button
          onClick={handleSignOut}
          disabled={isPending}
          className="text-sm text-gray-600 hover:text-gray-800 hover:underline disabled:opacity-50"
        >
          Выйти
        </button>
      </div>

      {/* Total cost summary */}
      {subscriptions.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <h2 className="text-xl font-semibold mb-2 text-green-900">
            Общая стоимость подписок:
          </h2>
          <p className="text-lg text-green-800">USD: ${totalUsdCost.toFixed(2)}</p>
          <p className="text-lg text-green-800">
            RUB: {totalRubCost.toFixed(2)} ₽ (по курсу {EXCHANGE_RATE_USD_TO_RUB} USD/RUB)
          </p>
        </div>
      )}

      {/* Chart */}
      {isClient && chartDataForCurrentMonth.datasets[0].data.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h2 className="text-xl font-semibold mb-2 text-blue-900">
            Распределение расходов за текущий месяц:
          </h2>
          <div className="w-full max-w-md mx-auto">
            <Pie options={pieChartOptions} data={chartDataForCurrentMonth} />
          </div>
        </div>
      )}

      {/* Add/Edit form */}
      <form onSubmit={handleSave} className="space-y-4 mb-6 border border-gray-200 rounded-lg p-4 bg-white">
        <h3 className="text-lg font-semibold">
          {form.id ? 'Редактировать подписку' : 'Добавить новую подписку'}
        </h3>
        
        {form.id && <input type="hidden" name="id" value={form.id} />}
        
        <input
          name="title"
          type="text"
          placeholder="Название подписки"
          className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          defaultValue={form.title || ''}
          required
          disabled={isPending}
        />
        
        <input
          name="amount"
          type="number"
          step="0.01"
          placeholder="Сумма (USD)"
          className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          defaultValue={form.amount || ''}
          required
          disabled={isPending}
        />
        
        <input
          name="startDate"
          type="date"
          className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          defaultValue={form.start_date || new Date().toISOString().slice(0, 10)}
          required
          disabled={isPending}
        />
        
        <input
          name="period"
          type="number"
          placeholder="Период в днях"
          className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          defaultValue={form.period || 30}
          required
          disabled={isPending}
        />
        
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? 'Сохраняем...' : (form.id ? 'Обновить' : 'Добавить')}
          </button>
          
          {form.id && (
            <button
              type="button"
              onClick={() => setForm({
                start_date: new Date().toISOString().slice(0, 10),
                period: 30,
              })}
              disabled={isPending}
              className="px-4 py-3 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Отмена
            </button>
          )}
        </div>
      </form>

      {/* Subscriptions table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-3 text-left font-semibold">Название</th>
              <th className="p-3 text-left font-semibold">Сумма</th>
              <th className="p-3 text-left font-semibold">Дней до оплаты</th>
              <th className="p-3 text-left font-semibold">Действия</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-6 text-center text-gray-500">
                  Нет подписок. Добавьте первую подписку выше.
                </td>
              </tr>
            ) : (
              subscriptions.map(s => (
                <tr
                  key={s.id}
                  className="border-t border-gray-200 hover:bg-gray-50 cursor-pointer"
                  onClick={() => setForm({
                    ...s,
                    start_date: s.start_date.split('T')[0], // Ensure date format
                  })}
                >
                  <td className="p-3">{s.title}</td>
                  <td className="p-3">${s.amount.toFixed(2)}</td>
                  <td className="p-3">
                    <span className={daysLeft(s) <= 7 ? 'text-red-600 font-semibold' : ''}>
                      {daysLeft(s)}
                    </span>
                  </td>
                  <td className="p-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(s.id)
                      }}
                      disabled={isPending}
                      className="text-red-600 hover:text-red-800 disabled:opacity-50 text-sm"
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}