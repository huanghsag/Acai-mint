import fetch from 'node-fetch'

export interface EsploraTx {
  txid: string
  version: number
  locktime: number
  vin: Array<{
    txid: string
    vout: number
    prevout: {
      scriptpubkey: string
      scriptpubkey_asm: string
      scriptpubkey_type: string
      scriptpubkey_address: string
      value: number
    }
    scriptsig: string
    scriptsig_asm: string
    witness: Array<string>
    is_coinbase: boolean
    sequence: number
  }>
  vout: Array<{
    scriptpubkey: string
    scriptpubkey_asm: string
    scriptpubkey_type: string
    scriptpubkey_address: string
    value: number
  }>
  size: number
  weight: number
  fee: number
  status: {
    confirmed: boolean
    block_height: number
    block_hash: string
    block_time: number
  }
}

export interface EsploraUtxo {
  txid: string
  vout: number
  status: {
    confirmed: boolean
    block_height?: number
    block_hash?: string
    block_time?: number
  }
  value: number
}

export class EsploraRpc {
  public esploraUrl: string

  constructor(url: string) {
    this.esploraUrl = url
  }

  async _call(method: string, params = []) {
    const requestData = {
      jsonrpc: '2.0',
      method: method,
      params: params,
      id: 1,
    }

    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
      cache: 'no-cache',
    }

    try {
      const response = await fetch(this.esploraUrl, requestOptions)
      const responseData = await response.json()

      if (typeof responseData === 'object' && responseData !== null) {
        const typedResponse = responseData as { error?: string, result?: any }
        if (typedResponse.error) {
          console.error('Esplora JSON-RPC Error:', typedResponse.error)
          throw new Error(typedResponse.error)
        }
        return typedResponse.result
      }
      
      throw new Error('Invalid response format')
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error('Request Timeout:', error)
        throw new Error('Request timed out')
      } else {
        console.error('Request Error:', error)
        throw error
      }
    }
  }

  async getTxInfo(txid: string) {
    return (await this._call('esplora_tx', [txid])) as EsploraTx
  }

  async getTxStatus(txid: string) {
    return await this._call('esplora_tx::status', [txid])
  }
  async getBlockTxids(hash: string): Promise<any> {
    return await this._call('esplora_block::txids', [hash])
  }

  async getTxHex(txid: string) {
    return await this._call('esplora_tx::hex', [txid])
  }

  async getTxRaw(txid: string) {
    return await this._call('esplora_tx::raw', [txid])
  }

  async getTxOutspends(txid: string) {
    return (await this._call('esplora_tx::outspends', [txid])) as Array<{
      spent: boolean
    }>
  }

  async getAddressTx(address: string) {
    return await this._call('esplora_address::txs', [address])
  }
  async getAddressTxInMempool(address: string) {
    return (await this._call('esplora_address::txs:mempool', [
      address,
    ])) as EsploraTx[]
  }
  async getAddressUtxo(address: string): Promise<EsploraUtxo[]> {
    const response = await this._call('esplora_address::utxo', [address])
    return response
  }
  async getFeeEstimates() {
    return await this._call('esplora_fee-estimates')
  }
}
