"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const collectible_1 = require("./collectible");
const alkane_1 = require("./alkane");
const regtest_1 = require("./regtest");
const rune_1 = require("./rune");
const brc20_1 = require("./brc20");
const btc_1 = require("./btc");
const utxo_1 = require("./utxo");
const account_1 = require("./account");
const provider_1 = require("./provider");
const program = new commander_1.Command();
program
    .name('default')
    .description('All functionality for oyl-sdk in a cli-wrapper')
    .version(require('../../package.json').version);
const regtestCommand = new commander_1.Command('regtest')
    .description('Regtest commands')
    .addCommand(regtest_1.init)
    .addCommand(regtest_1.genBlocks)
    .addCommand(regtest_1.sendFromFaucet);
const accountCommand = new commander_1.Command('account')
    .description('Manage accounts')
    .addCommand(account_1.mnemonicToAccountCommand)
    .addCommand(account_1.signPsbt)
    .addCommand(account_1.privateKeysCommand)
    .addCommand(account_1.generateMnemonicCommand);
const utxosCommand = new commander_1.Command('utxo')
    .description('Examine utxos')
    .addCommand(utxo_1.accountUtxosToSpend)
    .addCommand(utxo_1.addressUtxosToSpend)
    .addCommand(utxo_1.accountAvailableBalance);
const btcCommand = new commander_1.Command('btc')
    .description('Functions for sending bitcoin')
    .addCommand(btc_1.btcSend);
const brc20Command = new commander_1.Command('brc20')
    .description('Functions for brc20')
    .addCommand(brc20_1.brc20Send)
    .addCommand(utxo_1.addressBRC20Balance);
const collectibleCommand = new commander_1.Command('collectible')
    .description('Functions for collectibles')
    .addCommand(collectible_1.collectibleSend);
const runeCommand = new commander_1.Command('rune')
    .description('Functions for runes')
    .addCommand(rune_1.runeSend)
    .addCommand(rune_1.runeMint)
    .addCommand(rune_1.runeEtchCommit)
    .addCommand(rune_1.runeEtchReveal);
const alkaneCommand = new commander_1.Command('alkane')
    .description('Functions for alkanes')
    .addCommand(alkane_1.alkaneContractDeploy)
    .addCommand(alkane_1.alkaneExecute)
    .addCommand(alkane_1.alkaneAcai)
    .addCommand(alkane_1.alkaneAcaiCustom)
    .addCommand(alkane_1.alkaneAutoMint)
    .addCommand(alkane_1.alkaneTokenDeploy)
    .addCommand(alkane_1.alkanesTrace)
    .addCommand(alkane_1.alkaneSend)
    .addCommand(alkane_1.alkaneCreatePool)
    .addCommand(alkane_1.alkaneAddLiquidity)
    .addCommand(alkane_1.alkaneRemoveLiquidity)
    .addCommand(alkane_1.alkaneSwap)
    .addCommand(alkane_1.alkaneSimulate)
    .addCommand(alkane_1.alkaneGetAllPoolsDetails)
    .addCommand(alkane_1.alkaneBumpFee)
    .addCommand(alkane_1.alkanePreviewRemoveLiquidity);
const providerCommand = new commander_1.Command('provider')
    .description('Functions avaialble for all provider services')
    .addCommand(provider_1.ordProviderCall)
    .addCommand(provider_1.multiCallSandshrewProviderCall)
    .addCommand(provider_1.alkanesProvider);
program.addCommand(regtestCommand);
program.addCommand(alkaneCommand);
program.addCommand(utxosCommand);
program.addCommand(accountCommand);
program.addCommand(btcCommand);
program.addCommand(brc20Command);
program.addCommand(collectibleCommand);
program.addCommand(runeCommand);
program.addCommand(providerCommand);
program.parse(process.argv);
//# sourceMappingURL=index.js.map