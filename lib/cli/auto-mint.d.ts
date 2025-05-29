#!/usr/bin/env node
interface AutoMintConfig {
    data: string;
    paymentAddress: string;
    receiveAddress: string;
    provider: string;
    feeRate: number;
    maxBlockTransactions: number;
    maxFeeRate: number;
    waitMinutes: number;
    mintCount: number;
}
declare class AutoMintManager {
    private config;
    private lastProcessedBlock;
    private currentMintTxs;
    private running;
    private pendingBlocks;
    constructor(config: AutoMintConfig);
    /**
     * 获取最新区块信息
     */
    private getLatestBlockInfo;
    /**
     * 获取指定区块的信息
     */
    private getBlockInfo;
    /**
     * 获取交易确认状态
     */
    private getTransactionStatus;
    /**
     * 检查区块是否符合mint条件（仅检查交易数量和费率）
     */
    private isBlockSuitableForMint;
    /**
     * 执行ACAI mint（批量）
     */
    private executeMint;
    /**
     * 处理待扫描的区块
     */
    private processPendingBlocks;
    /**
     * 立即寻找下一个可mint的区块
     */
    private findNextMintableBlock;
    /**
     * 主监控循环
     */
    startAutoMint(): Promise<void>;
    /**
     * 停止自动mint
     */
    stop(): void;
}
export { AutoMintManager };
