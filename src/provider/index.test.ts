import { networks } from 'bitcoinjs-lib'
import { Provider } from '.'
import * as dotenv from 'dotenv'

dotenv.config()

describe('Provider', () => {
  it('should instantiate a new provider with the specified api url', () => {
    const provider = new Provider({
      url: 'https://mainnet.sandshrew.io',
      projectId: 'testid0',
      network: networks.bitcoin,
      networkType: 'mainnet',
    })
    expect(provider).toBeDefined()
    expect(provider.ord.ordUrl).toBe('https://mainnet.sandshrew.io/v1/testid0')
    expect(provider.esplora.esploraUrl).toBe(
      'https://mainnet.sandshrew.io/v1/testid0'
    )
    expect(provider.sandshrew.apiUrl).toBe(
      'https://mainnet.sandshrew.io/v1/testid0'
    )
    expect(provider.alkanes.alkanesUrl).toBe(
      'https://mainnet.sandshrew.io/v1/testid0'
    )
  })
})
