"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EsploraRpc = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
class EsploraRpc {
    constructor(url) {
        this.esploraUrl = url;
    }
    async _call(method, params = []) {
        const requestData = {
            jsonrpc: '2.0',
            method: method,
            params: params,
            id: 1,
        };
        const requestOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData),
            cache: 'no-cache',
        };
        try {
            const response = await (0, node_fetch_1.default)(this.esploraUrl, requestOptions);
            const responseData = await response.json();
            if (typeof responseData === 'object' && responseData !== null) {
                const typedResponse = responseData;
                if (typedResponse.error) {
                    console.error('Esplora JSON-RPC Error:', typedResponse.error);
                    throw new Error(typedResponse.error);
                }
                return typedResponse.result;
            }
            throw new Error('Invalid response format');
        }
        catch (error) {
            if (error.name === 'AbortError') {
                console.error('Request Timeout:', error);
                throw new Error('Request timed out');
            }
            else {
                console.error('Request Error:', error);
                throw error;
            }
        }
    }
    async getTxInfo(txid) {
        return (await this._call('esplora_tx', [txid]));
    }
    async getTxStatus(txid) {
        return await this._call('esplora_tx::status', [txid]);
    }
    async getBlockTxids(hash) {
        return await this._call('esplora_block::txids', [hash]);
    }
    async getTxHex(txid) {
        return await this._call('esplora_tx::hex', [txid]);
    }
    async getTxRaw(txid) {
        return await this._call('esplora_tx::raw', [txid]);
    }
    async getTxOutspends(txid) {
        return (await this._call('esplora_tx::outspends', [txid]));
    }
    async getAddressTx(address) {
        return await this._call('esplora_address::txs', [address]);
    }
    async getAddressTxInMempool(address) {
        return (await this._call('esplora_address::txs:mempool', [
            address,
        ]));
    }
    async getAddressUtxo(address) {
        const response = await this._call('esplora_address::utxo', [address]);
        return response;
    }
    async getFeeEstimates() {
        return await this._call('esplora_fee-estimates');
    }
}
exports.EsploraRpc = EsploraRpc;
//# sourceMappingURL=esplora.js.map