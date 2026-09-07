import { ref } from 'vue'
import { supabase } from '../utils/supabase'
import { usePurchasesStore } from '../stores/purchasesStore'

export function usePurchaseDownload() {
  const downloading = ref(false)
  const purchasesStore = usePurchasesStore()

  async function downloadPurchase({ orderId, productId }) {
    if (downloading.value) throw new Error('A download is already being prepared.')
    downloading.value = true
    let frame
    let form
    let buyerId
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Please sign in to download your purchase.')
      buyerId = session.user.id
      await purchasesStore.loadOwnership([productId], { force: true })
      if (purchasesStore.profileId !== buyerId) throw new Error('Your account changed. Refresh your purchases.')
      const headers = { Authorization: `Bearer ${session.access_token}` }
      const requestKey = crypto.randomUUID()
      const ticket = await $fetch('/api/purchases/download-tickets', {
        method: 'POST', headers, retry: 0,
        body: { order_id: orderId, product_id: productId, idempotency_key: requestKey },
      })
      frame = document.createElement('iframe')
      frame.name = `purchase-download-${requestKey}`
      frame.hidden = true
      frame.title = 'Secure product download'
      document.body.appendChild(frame)
      form = document.createElement('form')
      form.method = 'POST'
      form.action = '/api/purchases/download'
      form.target = frame.name
      form.hidden = true
      for (const [name, value] of Object.entries({ session_id: ticket.session_id, token: ticket.token })) {
        const input = document.createElement('input')
        input.type = 'hidden'; input.name = name; input.value = value
        form.appendChild(input)
      }
      document.body.appendChild(form)
      form.submit()
      form.remove()
      // Observe server authorization, not filesystem completion. Never +1 here.
      for (let attempt = 0; attempt < 45; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        const result = await $fetch('/api/purchases/download-status', {
          headers, query: { session_id: ticket.session_id }, retry: 0,
        })
        if (purchasesStore.profileId !== session.user.id) throw new Error('Your account changed. Refresh your purchases.')
        purchasesStore.applyDownload(productId, result.download)
        if (result.status === 'started') return result.download
        if (result.status !== 'pending') throw new Error(result.message || 'This download could not be started.')
      }
      throw new Error('The download is still being checked. Refresh My Purchases before trying again.')
    } catch (error) {
      const download = error?.data?.data?.download
      if (download && purchasesStore.profileId === buyerId) purchasesStore.applyDownload(productId, download)
      const failure = new Error(error?.data?.statusMessage || error?.data?.message || error?.message || 'Unable to start download.')
      failure.download = download
      throw failure
    } finally {
      downloading.value = false
      form?.remove()
      // Removing a frame early may cancel an Android/native attachment transfer.
      if (frame) setTimeout(() => frame.remove(), 300000)
    }
  }

  return { downloading, downloadPurchase }
}
