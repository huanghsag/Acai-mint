import { mnemonicToAccount } from '../account/account'
import { AddressType } from './interface'
import { decodeCBOR, getAddressKey, getAddressType } from './utils'
import * as bitcoin from 'bitcoinjs-lib'

describe('Shared utils', () => {
  it('getAddressType returns the right address type for an address', () => {
    const account = mnemonicToAccount({
      mnemonic:
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      opts: { index: 0, network: bitcoin.networks.regtest },
    })

    expect(getAddressType(account.nativeSegwit.address)).toBe(
      AddressType.P2WPKH
    )
    expect(getAddressType(account.nestedSegwit.address)).toBe(
      AddressType.P2SH_P2WPKH
    )
    expect(getAddressType(account.taproot.address)).toBe(AddressType.P2TR)
    expect(getAddressType(account.legacy.address)).toBe(AddressType.P2PKH)
    expect(getAddressType('Not an address')).toBeNull()
  })

  it('getAddressKey returns the right address key for an address', () => {
    const account = mnemonicToAccount({
      mnemonic:
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      opts: { index: 0, network: bitcoin.networks.regtest },
    })

    expect(getAddressKey(account.nativeSegwit.address)).toBe('nativeSegwit')
    expect(getAddressKey(account.nestedSegwit.address)).toBe('nestedSegwit')
    expect(getAddressKey(account.taproot.address)).toBe('taproot')
    expect(getAddressKey(account.legacy.address)).toBe('legacy')
    expect(getAddressKey('Not an address')).toBeNull()
  })

  it('decodeCBOR decodes a hex correctly', () => {
    const hex = 'b90002646e616d65646a6f686e63616765181e'
    const decoded = decodeCBOR(hex)
    expect(decoded).toEqual({ age: 30, name: 'john' })
  })

  it('decodeCBOR throws an error for invalid hex', () => {
    const hex = 'b90016765181e'
    expect(() => decodeCBOR(hex)).toThrow('Unexpected end of CBOR data')
  })
})
