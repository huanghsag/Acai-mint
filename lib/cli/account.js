"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.signPsbt = exports.generateMnemonicCommand = exports.mnemonicToAccountCommand = exports.privateKeysCommand = void 0;
const tslib_1 = require("tslib");
const commander_1 = require("commander");
const __1 = require("..");
const bitcoin = tslib_1.__importStar(require("bitcoinjs-lib"));
const wallet_1 = require("./wallet");
exports.privateKeysCommand = new commander_1.Command('privateKeys')
    .description('Returns private keys for an account object')
    .option('-i, --index <index>', 'index you want to derive your account keys from')
    .requiredOption('-p, --provider <provider>', 'provider to use when querying the network ')
    .action((options) => {
    const wallet = new wallet_1.Wallet({ networkType: options.provider });
    const provider = wallet.provider;
    const privateKeys = (0, __1.getWalletPrivateKeys)({
        mnemonic: options.mnemonic,
        opts: {
            index: options.index,
            network: provider.network,
        },
    });
    console.log(privateKeys);
});
/* @dev example call
  oyl account mnemonicToAccount -p oylnet
*/
exports.mnemonicToAccountCommand = new commander_1.Command('mnemonicToAccount')
    .description('Returns an account from a mnemonic')
    .requiredOption('-p, --provider <provider>', 'provider to use when querying the network ')
    .option('-i, --index <index>', 'Account index (default: 0)')
    .option('-w, --wallet-standard <walletStandard>', 'Wallet standard')
    .action((options) => {
    const wallet = new wallet_1.Wallet({ networkType: options.provider });
    const provider = wallet.provider;
    let hdPaths;
    if (options.walletStandard) {
        hdPaths = (0, __1.getHDPaths)(options.index, provider.network, options.walletStandard);
    }
    const account = (0, __1.mnemonicToAccount)({
        mnemonic: wallet.mnemonic,
        opts: {
            index: options.index,
            network: provider.network,
            hdPaths,
        },
    });
    console.log(account);
});
/* @dev example call
  oyl account generateMnemonic
*/
exports.generateMnemonicCommand = new commander_1.Command('generateMnemonic')
    .description('Returns a new mnemonic phrase')
    .action(() => {
    const mnemonic = (0, __1.generateMnemonic)();
    console.log(mnemonic);
});
exports.signPsbt = new commander_1.Command('sign')
    .requiredOption('-p, --provider <provider>', 'provider to use when signing the network psbt')
    .requiredOption('-f, --finalize <finalize>', 'flag to finalize and push psbt')
    .requiredOption('-e, --extract <finalize>', 'flag to extract transaction')
    /* @dev example call
    oyl account sign -p regtest -f yes -e yes
  */
    .action(async (options) => {
    const wallet = new wallet_1.Wallet({ networkType: options.provider });
    const signer = wallet.signer;
    let finalize = options.finalize == 'yes' ? true : false;
    let extract = options.extract == 'yes' ? true : false;
    const { signedHexPsbt, signedPsbt } = await signer.signAllInputs({
        rawPsbtHex: process.env.PSBT_HEX,
        finalize,
    });
    if (extract) {
        const extractedTx = bitcoin.Psbt.fromHex(signedHexPsbt).extractTransaction();
        console.log('extracted tx', extractedTx);
        console.log('extracted tx hex', extractedTx.toHex());
    }
    console.log('signed hex psbt', signedHexPsbt);
    console.log('--------------------------------------');
    console.log('signed psbt', signedPsbt);
});
//# sourceMappingURL=account.js.map