import { createClient } from '@/utils/supabase/server'
import { getSubscriptions, saveSubscription, signOut, deleteSubscription } from './actions'
import DashboardClient from './DashboardClient'

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const subscriptions = user ? await getSubscriptions() : []

  return (
    <main className="max-w-xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">📅 Подписки</h1>
      <DashboardClient 
        user={user} 
        initialSubscriptions={subscriptions}
        saveSubscriptionAction={saveSubscription}
        deleteSubscriptionAction={deleteSubscription}
        signOutAction={signOut}
      />
    </main>
  )
}