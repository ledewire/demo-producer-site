import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { createMerchantClient } from '@/lib/ledewire'
import { LedewireError, AuthError } from '@ledewire/node'
import PricingRulesTable from './PricingRulesTable'
import AddRuleForm from './AddRuleForm'
import DomainsPanel from './DomainsPanel'

export default async function PricingRulesPage() {
  const { storeId } = await requireAuth()

  try {
    const client = await createMerchantClient()
    const [rules, domains] = await Promise.all([
      client.merchant.pricingRules.list(storeId),
      client.merchant.domains.list(storeId),
    ])

    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-bold text-gray-900">Pricing Rules</h1>

        <section className="space-y-4">
          <PricingRulesTable initialRules={rules} />
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Add Rule</h2>
            <AddRuleForm verifiedDomains={domains.filter((d) => d.status === 'verified')} />
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-800">Domains</h2>
          <p className="text-sm text-gray-500">
            Domains must be verified before you can create pricing rules for them. Add a domain
            below, then add the DNS TXT record shown to your DNS provider.
          </p>
          <DomainsPanel initialDomains={domains} />
        </section>
      </div>
    )
  } catch (err) {
    if (err instanceof AuthError) redirect('/login')
    if (err instanceof LedewireError) {
      return <p className="text-red-600 text-sm">API error: {err.message}</p>
    }
    throw err
  }
}
