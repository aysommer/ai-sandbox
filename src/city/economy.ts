import { buildings, profiles } from './districts.ts'

export const businesses = ['office', 'cafe', 'restaurant', 'garage', 'station', 'stockroom'] as const
type Business = typeof businesses[number]
export type Merchant = 'cafe' | 'restaurant'
export type Account = 'treasury' | `resident:${number}` | `business:${Business}`
type Credit = { account: Account; amount: number }
export type Payment = {
  id: number
  minute: number
  reason: string
  from: Account
  credits: Credit[]
  status: 'paid' | 'insufficient-funds'
}
export type EconomyState = {
  balances: Record<Account, number>
  stock: Record<Merchant, number>
  payments: Payment[]
  nextPaymentId: number
}

export const offers = {
  cafe: { label: 'Кофе', price: 4, dayStock: 12 },
  restaurant: { label: 'Обед', price: 7, dayStock: 12 },
} as const

/** Clears transfers atomically and retains a bounded payment history. */
export class CoinLedger {
  /** Returns the wallet key for a city resident. */
  static wallet(id: number): Account {
    return `resident:${id}`
  }

  /** Returns the cash account key for a city business. */
  static cashRegister(business: Business): Account {
    return `business:${business}`
  }

  /** Sums all coins across residents, cash registers and the city treasury. */
  static total(balances: EconomyState['balances']) {
    return Object.values(balances).reduce((sum, balance) => sum + balance, 0)
  }

  /** Resolves an account key to its visible owner. */
  static name(account: Account) {
    if (account === 'treasury') return 'Казна'
    if (account.startsWith('resident:')) return profiles.find(profile => profile.id === Number(account.slice(9)))?.name ?? account
    const id = account.slice(9) as Business
    return buildings[id].label
  }

  /** Debits and credits a payment together, including any split tax. */
  static pay(state: EconomyState, minute: number, from: Account, credits: Credit[], reason: string) {
    const accounts = state.balances
    const amount = credits.reduce((sum, credit) => sum + credit.amount, 0)
    if (!credits.length || !Object.hasOwn(accounts, from) || !Number.isSafeInteger(amount) ||
      credits.some(credit => !Object.hasOwn(accounts, credit.account) || credit.account === from ||
        !Number.isSafeInteger(credit.amount) || credit.amount <= 0)) {
      throw new RangeError('Invalid city payment')
    }

    const paid = accounts[from] >= amount
    if (paid) {
      accounts[from] -= amount
      for (const credit of credits) accounts[credit.account] += credit.amount
    }
    state.payments.push({
      id: state.nextPaymentId++, minute, reason, from, credits,
      status: paid ? 'paid' : 'insufficient-funds',
    })
    if (state.payments.length > 120) state.payments.shift()
    return paid
  }
}

/** Sets the initial coin supply and runs wages, sales and stock purchases. */
export class CityEconomy {
  /** Seeds the finite currency supply when founding a city or upgrading a pre-economy save. */
  static start(): EconomyState {
    const balances: EconomyState['balances'] = {
      treasury: 180,
      'business:office': 55,
      'business:cafe': 55,
      'business:restaurant': 55,
      'business:garage': 55,
      'business:station': 55,
      'business:stockroom': 55,
    }
    for (const profile of profiles) balances[CoinLedger.wallet(profile.id)] = 28
    return { balances, stock: { cafe: 12, restaurant: 12 }, payments: [], nextPaymentId: 1 }
  }

  /** Pays a completed shift in proportion to minutes worked. The police are funded by the treasury. */
  static payShift(state: EconomyState, minute: number, id: number, worked: number) {
    const profile = profiles[id - 1]
    const duration = profile.job.end - profile.job.start
    const amount = Math.floor(profile.job.wage * Math.min(worked, duration) / duration)
    if (amount <= 0) return
    const employer = profile.job.building
    const from = employer === 'police' ? 'treasury' : CoinLedger.cashRegister(employer)
    CoinLedger.pay(state, minute, from, [{ account: CoinLedger.wallet(id), amount }], 'Зарплата за смену')
  }

  /** Restocks a venue from the warehouse and charges one coin per unit. */
  static restock(state: EconomyState, merchant: Merchant, minute: number) {
    const amount = offers[merchant].dayStock - state.stock[merchant]
    if (amount <= 0) return
    const paid = CoinLedger.pay(state, minute, CoinLedger.cashRegister(merchant),
      [{ account: CoinLedger.cashRegister('stockroom'), amount }], 'Закупка у склада')
    if (paid) state.stock[merchant] += amount
  }

  /** Sells one item and sends one coin of the listed price to the treasury. */
  static sell(state: EconomyState, merchant: Merchant, minute: number, resident: number) {
    if (state.stock[merchant] <= 0) return false
    const offer = offers[merchant]
    const paid = CoinLedger.pay(state, minute, CoinLedger.wallet(resident),
      [{ account: CoinLedger.cashRegister(merchant), amount: offer.price - 1 }, { account: 'treasury', amount: 1 }], offer.label)
    if (paid) state.stock[merchant]--
    return paid
  }
}
