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
exports.getBrc20Data = exports.mainnetMnemonic = exports.regtestMnemonic = exports.Opts = exports.regtestOpts = exports.MAXIMUM_FEE = exports.maximumScriptBytes = exports.UTXO_DUST = void 0;
const bitcoin = __importStar(require("bitcoinjs-lib"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
exports.UTXO_DUST = 546;
exports.maximumScriptBytes = 520;
exports.MAXIMUM_FEE = 5000000;
exports.regtestOpts = {
    network: bitcoin.networks.regtest,
    index: 0,
    spendStrategy: {
        changeAddress: 'nativeSegwit',
        addressOrder: ['nativeSegwit', 'nestedSegwit', 'taproot', 'legacy'],
        utxoSortGreatestToLeast: true,
    },
};
exports.Opts = {
    network: bitcoin.networks.bitcoin,
    index: 0,
    spendStrategy: {
        changeAddress: 'nativeSegwit',
        addressOrder: ['nativeSegwit', 'nestedSegwit', 'taproot', 'legacy'],
        utxoSortGreatestToLeast: true,
    },
};
exports.regtestMnemonic = process.env.REGTEST1;
exports.mainnetMnemonic = process.env.MAINNET_MNEMONIC;
const getBrc20Data = ({ amount, tick, }) => ({
    mediaContent: `{"p":"brc-20","op":"transfer","tick":"${tick}","amt":"${amount}"}`,
    mediaType: 'text/plain',
});
exports.getBrc20Data = getBrc20Data;
//# sourceMappingURL=constants.js.map