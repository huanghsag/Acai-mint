"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Provider = void 0;
const sandshrew_1 = require("../rpclient/sandshrew");
const esplora_1 = require("../rpclient/esplora");
const ord_1 = require("../rpclient/ord");
const bitcoin = __importStar(require("bitcoinjs-lib"));
const __1 = require("..");
const alkanes_1 = require("../rpclient/alkanes");
class Provider {
    constructor({ url, projectId, network, networkType, version = 'v1', apiProvider, }) {
        let isTestnet;
        let isRegtest;
        switch (network) {
            case bitcoin.networks.testnet:
                isTestnet = true;
            case bitcoin.networks.regtest:
                isRegtest = true;
        }
        const masterUrl = [url, version, projectId].filter(Boolean).join('/');
        this.alkanes = new alkanes_1.AlkanesRpc(masterUrl);
        this.sandshrew = new sandshrew_1.SandshrewBitcoinClient(masterUrl);
        this.esplora = new esplora_1.EsploraRpc(masterUrl);
        this.ord = new ord_1.OrdRpc(masterUrl);
        this.api = apiProvider;
        this.network = network;
        this.networkType = networkType;
        this.url = masterUrl;
    }
    async pushPsbt({ psbtHex, psbtBase64, }) {
        if (!psbtHex && !psbtBase64) {
            throw new Error('Please supply psbt in either base64 or hex format');
        }
        if (psbtHex && psbtBase64) {
            throw new Error('Please select one format of psbt to broadcast');
        }
        let psbt;
        if (psbtHex) {
            psbt = bitcoin.Psbt.fromHex(psbtHex, {
                network: this.network,
            });
        }
        if (psbtBase64) {
            psbt = bitcoin.Psbt.fromBase64(psbtBase64, {
                network: this.network,
            });
        }
        let extractedTx;
        try {
            extractedTx = psbt.extractTransaction();
        }
        catch (error) {
            throw new Error('Transaction could not be extracted do to invalid Psbt.');
        }
        const txId = extractedTx.getId();
        const rawTx = extractedTx.toHex();
        const [result] = await this.sandshrew.bitcoindRpc.testMemPoolAccept([rawTx]);
        if (!result.allowed) {
            throw new Error(result['reject-reason']);
        }
        await this.sandshrew.bitcoindRpc.sendRawTransaction(rawTx);
        await (0, __1.waitForTransaction)({
            txId,
            sandshrewBtcClient: this.sandshrew,
        });
        const txInMemPool = await this.sandshrew.bitcoindRpc.getMemPoolEntry(txId);
        const fee = txInMemPool.fees['base'] * 10 ** 8;
        return {
            txId,
            rawTx,
            size: txInMemPool.vsize,
            weight: txInMemPool.weight,
            fee: fee,
            satsPerVByte: (fee / (txInMemPool.weight / 4)).toFixed(2),
        };
    }
}
exports.Provider = Provider;
//# sourceMappingURL=provider.js.map