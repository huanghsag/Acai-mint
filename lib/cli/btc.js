"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.btcSend = void 0;
const tslib_1 = require("tslib");
const commander_1 = require("commander");
const btc = tslib_1.__importStar(require("../btc"));
const utxo = tslib_1.__importStar(require("../utxo"));
const wallet_1 = require("./wallet");
exports.btcSend = new commander_1.Command('send')
    .requiredOption('-p, --provider <provider>', 'Network provider type (regtest, bitcoin)')
    .requiredOption('-amt, --amount <amount>', 'amount you want to send')
    .requiredOption('-t, --to <to>', 'address you want to send to')
    .option('-feeRate, --feeRate <feeRate>', 'fee rate')
    /* @dev example call
    oyl btc send -p regtest -t bcrt1qzr9vhs60g6qlmk7x3dd7g3ja30wyts48sxuemv -amt 1000 -feeRate 2
  */
    .action(async (options) => {
    const wallet = new wallet_1.Wallet({ networkType: options.provider });
    const account = wallet.account;
    const provider = wallet.provider;
    const signer = wallet.signer;
    const { accountSpendableTotalUtxos } = await utxo.accountUtxos({
        account,
        provider,
    });
    console.log(await btc.send({
        utxos: accountSpendableTotalUtxos,
        toAddress: options.to,
        feeRate: options.feeRate,
        account,
        signer,
        provider,
        amount: options.amount,
    }));
});
//# sourceMappingURL=btc.js.map