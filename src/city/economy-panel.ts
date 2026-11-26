import { CityTime, minutesPerDay } from './districts.ts'
import { businesses, CoinLedger, offers, type Account, type EconomyState, type Payment } from './economy.ts'

/** Presents coin balances, inventory and the audit trail of city payments. */
export class EconomyPanel {
  private readonly total = document.querySelector('#city-coin-total')!
  private readonly accounts = document.querySelector('#city-accounts')!
  private readonly stock = document.querySelector('#city-stock')!
  private readonly payments = document.querySelector('#city-payments')!
  private readonly empty = document.querySelector<HTMLElement>('#city-payments-empty')!
  private readonly values = new Map<Account, HTMLElement>()
  private lastPayment: number | undefined

  /** Creates one balance field for each business and the treasury. */
  constructor() {
    const accounts: Account[] = ['treasury', ...businesses.map(business => CoinLedger.cashRegister(business))]
    for (const account of accounts) {
      const item = document.createElement('div')
      const title = document.createElement('dt')
      const value = document.createElement('dd')
      title.textContent = CoinLedger.name(account)
      item.append(title, value)
      this.accounts.append(item)
      this.values.set(account, value)
    }
  }

  /** Refreshes amounts and only redraws the history when a new payment arrives. */
  render(state: EconomyState) {
    const total = 'В обращении ' + CoinLedger.total(state.balances) + ' мон.'
    if (this.total.textContent !== total) this.total.textContent = total
    const stock = `Кофе: ${state.stock.cafe} порц. по ${offers.cafe.price} мон. · Обеды: ${state.stock.restaurant} порц. по ${offers.restaurant.price} мон.`
    if (this.stock.textContent !== stock) this.stock.textContent = stock
    for (const [account, field] of this.values) {
      const balance = state.balances[account] + ' мон.'
      if (field.textContent !== balance) field.textContent = balance
    }
    const latest = state.payments.at(-1)?.id
    if (latest === this.lastPayment) return
    this.lastPayment = latest
    this.empty.hidden = state.payments.length > 0
    this.payments.replaceChildren(...state.payments.slice(-40).reverse().map(payment => this.paymentRow(payment)))
  }

  /** Displays each recipient’s share, including any sales tax. */
  private paymentRow(payment: Payment) {
    const row = document.createElement('li')
    const time = document.createElement('time')
    const content = document.createElement('div')
    const title = document.createElement('strong')
    const details = document.createElement('p')
    const day = Math.floor(payment.minute / minutesPerDay) + 1
    time.textContent = `День ${day} · ${CityTime.format(payment.minute)}`
    const amount = payment.credits.reduce((sum, credit) => sum + credit.amount, 0)
    title.textContent = `${payment.reason} · ${amount} мон.`
    const recipients = payment.credits.map(credit => `${CoinLedger.name(credit.account)} (${credit.amount} мон.)`).join(', ')
    const failure = payment.status === 'paid' ? '' : 'Недостаточно монет. '
    details.textContent = `${failure}${CoinLedger.name(payment.from)} → ${recipients}`
    content.append(title, details)
    row.append(time, content)
    return row
  }
}
