import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CityEconomy, CoinLedger } from '../src/city/economy.ts'
import { minutesPerDay, profiles } from '../src/city/districts.ts'
import { CitySimulation } from '../src/city/simulation.ts'

test('purchases split the price between the venue and the treasury and consume stock only when paid', () => {
  const economy = CityEconomy.start()
  const wallet = CoinLedger.wallet(1)
  const opening = economy.balances[wallet]
  const total = CoinLedger.total(economy.balances)
  assert.equal(CityEconomy.sell(economy, 'restaurant', 720, 1), true)
  assert.equal(economy.balances[wallet], opening - 7)
  assert.equal(economy.balances['business:restaurant'], 61)
  assert.equal(economy.balances.treasury, 181)
  assert.equal(economy.stock.restaurant, 11)
  assert.equal(CoinLedger.total(economy.balances), total)

  economy.balances[wallet] = 2
  const before = structuredClone(economy.balances)
  assert.equal(CityEconomy.sell(economy, 'cafe', 721, 1), false)
  assert.deepEqual(economy.balances, before)
  assert.equal(economy.stock.cafe, 12)
  assert.equal(economy.payments.at(-1).status, 'insufficient-funds')
})

test('each completed shift has one wage payment, including a treasury-funded police shift', () => {
  const city = new CitySimulation()
  city.advance(21 * 60 - 420)
  const { economy } = city.snapshot()
  const wages = economy.payments.filter(payment => payment.reason === 'Зарплата за смену')
  assert.equal(wages.length, profiles.length)
  for (const profile of profiles) {
    const payment = wages.find(payment => payment.credits[0].account === CoinLedger.wallet(profile.id))
    assert.equal(payment.minute, profile.job.end)
    assert.equal(payment.status, 'paid')
    assert.equal(payment.credits[0].amount, profile.job.wage)
    assert.equal(payment.from, profile.job.building === 'police' ? 'treasury' : CoinLedger.cashRegister(profile.job.building))
  }
  assert.equal(economy.payments.filter(payment => payment.reason === 'Обед').length, 8)
  assert.equal(economy.payments.filter(payment => payment.reason === 'Кофе').length, 8)
})

test('multiple sim days conserve coins, and old saves resume without replaying earlier purchases', () => {
  const city = new CitySimulation()
  const opening = CoinLedger.total(city.snapshot().economy.balances)
  for (let day = 0; day < 15; day++) {
    city.advance(minutesPerDay)
    const { economy } = city.snapshot()
    assert.equal(CoinLedger.total(economy.balances), opening)
    assert.ok(Object.values(economy.balances).every(balance => balance >= 0))
    if (day === 1) assert.ok(economy.payments.some(payment => payment.reason === 'Закупка у склада' && payment.status === 'paid'))
  }
  const state = city.snapshot()
  const migrated = new CitySimulation({ minute: state.minute, residents: state.residents, events: state.events })
  const next = migrated.snapshot()
  assert.equal(next.minute, state.minute)
  assert.deepEqual(next.residents, state.residents)
  assert.deepEqual(next.economy, CityEconomy.start())
})
