/// <reference types="node" />
/// <reference types="node" />
import { Provider } from '../provider/provider';
import { ProtoruneEdict } from 'alkanes/lib/protorune/protoruneedict';
import { Account, Signer } from '..';
import { GatheredUtxos, AlkanesPayload } from '../shared/interface';
export interface ProtostoneMessage {
    protocolTag?: bigint;
    edicts?: ProtoruneEdict[];
    pointer?: number;
    refundPointer?: number;
    calldata: bigint[];
}
export declare const encodeProtostone: ({ protocolTag, edicts, pointer, refundPointer, calldata, }: ProtostoneMessage) => Buffer;
/**
 * 专门为ACAI代币设计的mint函数
 * 确保交易包含必需的FARTANE费用输出
 */
export declare const createAcaiExecutePsbt: ({ frontendFee, feeAddress, alkaneUtxos, gatheredUtxos, account, protostone, provider, feeRate, fee, }: {
    frontendFee?: number | undefined;
    feeAddress?: string | undefined;
    alkaneUtxos?: {
        alkaneUtxos: any[];
        totalSatoshis: number;
    } | undefined;
    gatheredUtxos: GatheredUtxos;
    account: Account;
    protostone: Buffer;
    provider: Provider;
    feeRate?: number | undefined;
    fee?: number | undefined;
}) => Promise<{
    psbt: string;
    psbtHex: string;
}>;
/**
 * ACAI专用的execute函数
 */
export declare const acaiExecute: ({ alkaneUtxos, gatheredUtxos, account, protostone, provider, feeRate, signer, frontendFee, feeAddress, noBroadcast, }: {
    alkaneUtxos?: {
        alkaneUtxos: any[];
        totalSatoshis: number;
    } | undefined;
    gatheredUtxos: GatheredUtxos;
    account: Account;
    protostone: Buffer;
    provider: Provider;
    feeRate?: number | undefined;
    signer: Signer;
    frontendFee?: number | undefined;
    feeAddress?: string | undefined;
    noBroadcast?: boolean | undefined;
}) => Promise<{
    txId: string;
    rawTx: string;
    size: number;
    weight: number;
    fee: number;
    satsPerVByte: string;
    psbtBase64: any;
    fartaneFee: number;
    message: string;
} | {
    fartaneFee: number;
    note: string;
    txId: string;
    rawTx: string;
    size: any;
    weight: any;
    fee: number;
    satsPerVByte: string;
    psbtBase64?: undefined;
    message?: undefined;
}>;
/**
 * 计算ACAI mint的实际费用
 */
export declare const actualAcaiExecuteFee: ({ gatheredUtxos, account, protostone, provider, feeRate, alkaneUtxos, frontendFee, feeAddress, }: {
    gatheredUtxos: GatheredUtxos;
    account: Account;
    protostone: Buffer;
    provider: Provider;
    feeRate: number;
    alkaneUtxos?: {
        alkaneUtxos: any[];
        totalSatoshis: number;
    } | undefined;
    frontendFee?: number | undefined;
    feeAddress?: string | undefined;
}) => Promise<{
    totalFee: number;
    vSize: number;
    feeRate: number;
    fartaneFee: number;
    note: string;
}>;
export declare const createExecutePsbt: ({ frontendFee, feeAddress, alkaneUtxos, gatheredUtxos, account, protostone, provider, feeRate, fee, }: {
    frontendFee?: number | undefined;
    feeAddress?: string | undefined;
    alkaneUtxos?: {
        alkaneUtxos: any[];
        totalSatoshis: number;
    } | undefined;
    gatheredUtxos: GatheredUtxos;
    account: Account;
    protostone: Buffer;
    provider: Provider;
    feeRate?: number | undefined;
    fee?: number | undefined;
}) => Promise<{
    psbt: string;
    psbtHex: string;
}>;
export declare const createDeployCommitPsbt: ({ payload, gatheredUtxos, tweakedPublicKey, account, provider, feeRate, fee, }: {
    payload: AlkanesPayload;
    gatheredUtxos: GatheredUtxos;
    tweakedPublicKey: string;
    account: Account;
    provider: Provider;
    feeRate?: number | undefined;
    fee?: number | undefined;
}) => Promise<{
    psbt: string;
    script: Buffer;
}>;
export declare const deployCommit: ({ payload, gatheredUtxos, account, provider, feeRate, signer, }: {
    payload: AlkanesPayload;
    gatheredUtxos: GatheredUtxos;
    account: Account;
    provider: Provider;
    feeRate?: number | undefined;
    signer: Signer;
}) => Promise<{
    script: string;
    txId: string;
    rawTx: string;
    size: any;
    weight: any;
    fee: number;
    satsPerVByte: string;
}>;
export declare const createDeployRevealPsbt: ({ protostone, receiverAddress, script, feeRate, tweakedPublicKey, provider, fee, commitTxId, }: {
    protostone: Buffer;
    receiverAddress: string;
    script: Buffer;
    feeRate: number;
    tweakedPublicKey: string;
    provider: Provider;
    fee?: number | undefined;
    commitTxId: string;
}) => Promise<{
    psbt: string;
    fee: number;
}>;
export declare const deployReveal: ({ protostone, commitTxId, script, account, provider, feeRate, signer, }: {
    protostone: Buffer;
    commitTxId: string;
    script: string;
    account: Account;
    provider: Provider;
    feeRate?: number | undefined;
    signer: Signer;
}) => Promise<{
    txId: string;
    rawTx: string;
    size: any;
    weight: any;
    fee: number;
    satsPerVByte: string;
}>;
export declare const findAlkaneUtxos: ({ address, greatestToLeast, provider, alkaneId, targetNumberOfAlkanes, }: {
    address: string;
    greatestToLeast: boolean;
    provider: Provider;
    alkaneId: {
        block: string;
        tx: string;
    };
    targetNumberOfAlkanes: number;
}) => Promise<{
    alkaneUtxos: {
        txId: string;
        txIndex: number;
        script: string;
        address: string;
        amountOfAlkanes: string;
        satoshis: number;
    }[];
    totalSatoshis: number;
    totalBalanceBeingSent: number;
}>;
export declare const actualTransactRevealFee: ({ protostone, tweakedPublicKey, commitTxId, receiverAddress, script, provider, feeRate, }: {
    protostone: Buffer;
    tweakedPublicKey: string;
    commitTxId: string;
    receiverAddress: string;
    script: Buffer;
    provider: Provider;
    feeRate?: number | undefined;
}) => Promise<{
    fee: any;
    vsize: any;
}>;
export declare const actualExecuteFee: ({ gatheredUtxos, account, protostone, provider, feeRate, alkaneUtxos, frontendFee, feeAddress, }: {
    gatheredUtxos: GatheredUtxos;
    account: Account;
    protostone: Buffer;
    provider: Provider;
    feeRate: number;
    alkaneUtxos?: {
        alkaneUtxos: any[];
        totalSatoshis: number;
    } | undefined;
    frontendFee?: number | undefined;
    feeAddress?: string | undefined;
}) => Promise<{
    fee: any;
    vsize: any;
}>;
export declare const executePsbt: ({ alkaneUtxos, gatheredUtxos, account, protostone, provider, feeRate, frontendFee, feeAddress, }: {
    alkaneUtxos?: {
        alkaneUtxos: any[];
        totalSatoshis: number;
    } | undefined;
    gatheredUtxos: GatheredUtxos;
    account: Account;
    protostone: Buffer;
    provider: Provider;
    feeRate?: number | undefined;
    frontendFee?: number | undefined;
    feeAddress?: string | undefined;
}) => Promise<{
    psbt: string;
    fee: any;
}>;
export declare const execute: ({ alkaneUtxos, gatheredUtxos, account, protostone, provider, feeRate, signer, frontendFee, feeAddress, noBroadcast, }: {
    alkaneUtxos?: {
        alkaneUtxos: any[];
        totalSatoshis: number;
    } | undefined;
    gatheredUtxos: GatheredUtxos;
    account: Account;
    protostone: Buffer;
    provider: Provider;
    feeRate?: number | undefined;
    signer: Signer;
    frontendFee?: number | undefined;
    feeAddress?: string | undefined;
    noBroadcast?: boolean | undefined;
}) => Promise<{
    txId: string;
    rawTx: string;
    size: any;
    weight: any;
    fee: number;
    satsPerVByte: string;
} | {
    txId: string;
    rawTx: string;
    size: number;
    weight: number;
    fee: any;
    satsPerVByte: string;
    psbtBase64: any;
    message: string;
}>;
export declare const createTransactReveal: ({ protostone, receiverAddress, script, feeRate, tweakedPublicKey, provider, fee, commitTxId, }: {
    protostone: Buffer;
    receiverAddress: string;
    script: Buffer;
    feeRate: number;
    tweakedPublicKey: string;
    provider: Provider;
    fee?: number | undefined;
    commitTxId: string;
}) => Promise<{
    psbt: string;
    fee: number;
}>;
/**
 * Calculate the correct fee for bumping a transaction fee
 * @param txid - Transaction ID to bump
 * @param account - Wallet account
 * @param provider - Network provider
 * @param newFeeRate - New fee rate in sat/vB
 * @param signer - Wallet signer
 * @returns Object containing the calculated fee
 */
export declare const actualBumpFeeFee: ({ txid, account, provider, newFeeRate, signer, }: {
    txid: string;
    account: Account;
    provider: Provider;
    newFeeRate: number;
    signer: Signer;
}) => Promise<{
    fee: number;
}>;
/**
 * Create a PSBT for bumping transaction fee
 * @param txid - Transaction ID to bump
 * @param account - Wallet account
 * @param provider - Network provider
 * @param newFeeRate - New fee rate in sat/vB
 * @param fee - Optional specific fee amount (if not provided, calculated from newFeeRate)
 * @returns Object containing the base64 encoded PSBT
 */
export declare const createBumpFeePsbt: ({ txid, account, provider, newFeeRate, fee, }: {
    txid: string;
    account: Account;
    provider: Provider;
    newFeeRate: number;
    fee?: number | undefined;
}) => Promise<{
    psbt: string;
}>;
/**
 * Bump the fee of a transaction using RBF
 * @param txid - Transaction ID to bump
 * @param newFeeRate - New fee rate in sat/vB
 * @param account - Wallet account
 * @param provider - Network provider
 * @param signer - Wallet signer
 * @returns Result of the transaction broadcast
 */
export declare const bumpFee: ({ txid, newFeeRate, account, provider, signer, }: {
    txid: string;
    newFeeRate: number;
    account: Account;
    provider: Provider;
    signer: Signer;
}) => Promise<{
    txId: string;
    rawTx: string;
    size: any;
    weight: any;
    fee: number;
    satsPerVByte: string;
}>;
/**
 * 获取指定地址的UTXO
 */
export declare const getCustomAddressUtxos: ({ address, provider, }: {
    address: string;
    provider: Provider;
}) => Promise<{
    utxos: {
        txId: any;
        outputIndex: any;
        satoshis: any;
        address: string;
        scriptPk: any;
    }[];
    totalAmount: number;
}>;
/**
 * 自定义ACAI执行函数 - 支持指定付款地址和找零地址
 */
export declare const customAcaiExecute: ({ paymentAddress, changeAddress, account, protostone, provider, feeRate, signer, noBroadcast, }: {
    paymentAddress: string;
    changeAddress: string;
    account: Account;
    protostone: Buffer;
    provider: Provider;
    feeRate?: number | undefined;
    signer: Signer;
    noBroadcast?: boolean | undefined;
}) => Promise<{
    txId: string;
    rawTx: string;
    size: number;
    weight: number;
    fee: any;
    satsPerVByte: string;
    psbtBase64: any;
    fartaneFee: number;
    paymentAddress: string;
    changeAddress: string;
    message: string;
} | {
    fartaneFee: number;
    paymentAddress: string;
    changeAddress: string;
    note: string;
    txId: string;
    rawTx: string;
    size: any;
    weight: any;
    fee: number;
    satsPerVByte: string;
    psbtBase64?: undefined;
    message?: undefined;
}>;
/**
 * 创建自定义ACAI PSBT
 */
export declare const createCustomAcaiPsbt: ({ gatheredUtxos, account, protostone, provider, feeRate, fee, paymentAddress, changeAddress, }: {
    gatheredUtxos: {
        utxos: any[];
        totalAmount: number;
    };
    account: Account;
    protostone: Buffer;
    provider: Provider;
    feeRate?: number | undefined;
    fee?: number | undefined;
    paymentAddress: string;
    changeAddress: string;
}) => Promise<string>;
/**
 * 计算自定义ACAI交易的费用
 */
export declare const customAcaiExecuteFee: ({ gatheredUtxos, account, protostone, provider, feeRate, paymentAddress, changeAddress, }: {
    gatheredUtxos: {
        utxos: any[];
        totalAmount: number;
    };
    account: Account;
    protostone: Buffer;
    provider: Provider;
    feeRate: number;
    paymentAddress: string;
    changeAddress: string;
}) => Promise<{
    totalFee: any;
    vSize: any;
    feeRate: number;
    fartaneFee: number;
    note: string;
}>;
//# sourceMappingURL=alkanes.d.ts.map