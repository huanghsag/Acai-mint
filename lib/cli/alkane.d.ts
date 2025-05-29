import { Command } from 'commander';
export declare class AlkanesCommand extends Command {
    constructor(cmd: any);
    action(fn: any): this;
}
export declare const alkanesTrace: AlkanesCommand;
export declare const alkaneContractDeploy: AlkanesCommand;
export declare const alkaneTokenDeploy: AlkanesCommand;
export declare const alkaneExecute: AlkanesCommand;
export declare const alkaneAcai: AlkanesCommand;
export declare const alkaneAcaiCustom: AlkanesCommand;
export declare const alkaneRemoveLiquidity: AlkanesCommand;
export declare const alkaneSwap: AlkanesCommand;
export declare const alkaneSend: AlkanesCommand;
export declare const alkaneCreatePool: AlkanesCommand;
export declare const alkaneAddLiquidity: AlkanesCommand;
export declare const alkaneSimulate: AlkanesCommand;
export declare const alkaneGetAllPoolsDetails: AlkanesCommand;
export declare const alkanePreviewRemoveLiquidity: AlkanesCommand;
/**
 * Command for bumping the fee of a transaction using RBF
 * @example
 * oyl alkane bump-fee -txid "6c17d0fc8b915aae2ce1a99b4bfd149f2ebc5e6762202a770a1329dff99ee0b1" -feeRate 5 -p regtest
 */
export declare const alkaneBumpFee: AlkanesCommand;
/**
 * Command for auto-mint ACAI tokens
 * @example
 * oyl alkane auto-mint -d "2,21219,77" -p bc1qx7fvgr9dwllua2njfxlp43ux9rx49h2p78n38f -r bc1pfhux2a67he3gp75lsvs0fq7vkxvcltuutuckr7exgjuldqdlfx8sdcc77u --provider bitcoin
 */
export declare const alkaneAutoMint: AlkanesCommand;
