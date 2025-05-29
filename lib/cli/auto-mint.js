#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoMintManager = void 0;
const tslib_1 = require("tslib");
const commander_1 = require("commander");
const axios_1 = tslib_1.__importDefault(require("axios"));
const alkanes_js_1 = require("../alkanes/alkanes.js");
const wallet_js_1 = require("./wallet.js");
const alkanes_js_2 = require("../alkanes/alkanes.js");
class AutoMintManager {
    config;
    lastProcessedBlock = 0;
    currentMintTxs = []; // 改为数组存储多个交易
    running = false;
    pendingBlocks = new Map();
    constructor(config) {
        this.config = config;
    }
    /**
     * 获取最新区块信息
     */
    async getLatestBlockInfo() {
        try {
            const response = await axios_1.default.get('https://mempool.space/api/blocks/tip/height');
            const latestHeight = response.data;
            const blockResponse = await axios_1.default.get(`https://mempool.space/api/v1/blocks/${latestHeight}`);
            const blockData = blockResponse.data[0];
            return {
                height: blockData.height,
                hash: blockData.id,
                time: blockData.timestamp,
                tx_count: blockData.tx_count,
                fee_range: {
                    min: blockData.extras?.feeRange?.[0] || 1,
                    max: blockData.extras?.feeRange?.[6] || 100
                }
            };
        }
        catch (error) {
            console.error('❌ 获取区块信息失败:', error);
            throw error;
        }
    }
    /**
     * 获取指定区块的信息
     */
    async getBlockInfo(blockHeight) {
        try {
            const blockResponse = await axios_1.default.get(`https://mempool.space/api/v1/blocks/${blockHeight}`);
            const blockData = blockResponse.data[0];
            return {
                height: blockData.height,
                hash: blockData.id,
                time: blockData.timestamp,
                tx_count: blockData.tx_count,
                fee_range: {
                    min: blockData.extras?.feeRange?.[0] || 1,
                    max: blockData.extras?.feeRange?.[6] || 100
                }
            };
        }
        catch (error) {
            console.error(`❌ 获取区块 ${blockHeight} 信息失败:`, error);
            throw error;
        }
    }
    /**
     * 获取交易确认状态
     */
    async getTransactionStatus(txid) {
        try {
            const response = await axios_1.default.get(`https://mempool.space/api/tx/${txid}/status`);
            return {
                confirmed: response.data.confirmed,
                block_height: response.data.block_height,
                block_hash: response.data.block_hash,
                txid: txid
            };
        }
        catch (error) {
            console.error(`❌ 获取交易 ${txid} 状态失败:`, error);
            return {
                confirmed: false,
                txid: txid
            };
        }
    }
    /**
     * 检查区块是否符合mint条件（仅检查交易数量和费率）
     */
    isBlockSuitableForMint(blockInfo) {
        console.log(`📊 区块分析:`);
        console.log(`   - 区块高度: ${blockInfo.height}`);
        console.log(`   - 交易数量: ${blockInfo.tx_count}`);
        console.log(`   - 最低费率: ${blockInfo.fee_range.min} sat/vB`);
        // 只检查交易数量和费率条件
        const txCountOk = blockInfo.tx_count <= this.config.maxBlockTransactions;
        const feeRateOk = blockInfo.fee_range.min <= this.config.maxFeeRate;
        console.log(`✅ 条件检查:`);
        console.log(`   - 交易数量 (<=${this.config.maxBlockTransactions}): ${txCountOk ? '✅' : '❌'}`);
        console.log(`   - 费率水平 (<=${this.config.maxFeeRate}): ${feeRateOk ? '✅' : '❌'}`);
        return txCountOk && feeRateOk;
    }
    /**
     * 执行ACAI mint（批量）
     */
    async executeMint() {
        const mintResults = [];
        try {
            console.log(`🚀 开始批量执行 ACAI mint...`);
            console.log(`   - 数据: ${this.config.data}`);
            console.log(`   - 付款地址: ${this.config.paymentAddress}`);
            console.log(`   - 接收地址: ${this.config.receiveAddress}`);
            console.log(`   - 费率: ${this.config.feeRate} sat/vB`);
            console.log(`   - Mint数量: ${this.config.mintCount} 次`);
            // 创建钱包实例
            const wallet = new wallet_js_1.Wallet({ networkType: this.config.provider });
            // 编码protostone数据
            const protostoneData = (0, alkanes_js_2.encodeProtostone)({
                calldata: this.config.data.split(',').map(x => BigInt(x.trim())),
            });
            // 执行多次mint
            for (let i = 0; i < this.config.mintCount; i++) {
                try {
                    console.log(`📡 执行第 ${i + 1} 次mint...`);
                    const result = await (0, alkanes_js_1.customAcaiExecute)({
                        paymentAddress: this.config.paymentAddress,
                        changeAddress: this.config.receiveAddress,
                        account: wallet.account,
                        protostone: protostoneData,
                        provider: wallet.provider,
                        feeRate: this.config.feeRate,
                        signer: wallet.signer,
                        noBroadcast: false // 直接广播
                    });
                    if (result && result.txId) {
                        console.log(`✅ 第 ${i + 1} 次 Mint 交易已广播! TxID: ${result.txId}`);
                        mintResults.push(result.txId);
                        // 每次mint之间稍微等待，避免nonce冲突
                        if (i < this.config.mintCount - 1) {
                            await new Promise(resolve => setTimeout(resolve, 2000));
                        }
                    }
                    else {
                        console.error(`❌ 第 ${i + 1} 次 Mint 执行失败，没有返回交易ID`);
                    }
                }
                catch (error) {
                    console.error(`❌ 第 ${i + 1} 次 Mint 执行出错:`, error);
                }
            }
            console.log(`🎯 批量mint完成！成功 ${mintResults.length}/${this.config.mintCount} 次`);
            return mintResults;
        }
        catch (error) {
            console.error(`❌ 批量Mint 执行出错:`, error);
            return mintResults;
        }
    }
    /**
     * 处理待扫描的区块
     */
    async processPendingBlocks() {
        const now = Date.now();
        const blocksToProcess = [];
        // 找出需要第二次扫描的区块
        for (const [blockHeight, blockData] of this.pendingBlocks.entries()) {
            const timeSinceFirstScan = (now - blockData.firstScanTime) / 1000 / 60; // 转换为分钟
            if (timeSinceFirstScan >= this.config.waitMinutes) {
                blocksToProcess.push(blockHeight);
            }
        }
        // 处理每个需要第二次扫描的区块
        for (const blockHeight of blocksToProcess) {
            try {
                console.log(`\n🔍 第二次扫描区块: ${blockHeight} (3分钟后重新检查)`);
                // 获取最新的区块信息
                const currentBlockInfo = await this.getBlockInfo(blockHeight);
                // 检查是否仍然符合条件
                if (this.isBlockSuitableForMint(currentBlockInfo)) {
                    console.log(`🎯 区块 ${blockHeight} 第二次扫描符合mint条件，准备执行mint...`);
                    // 如果没有待确认的交易，执行mint
                    if (this.currentMintTxs.length === 0) {
                        const txids = await this.executeMint();
                        if (txids.length > 0) {
                            this.currentMintTxs = txids;
                            console.log(`📝 记录mint交易: ${txids.join(', ')}`);
                        }
                    }
                    else {
                        console.log(`⏳ 有待确认交易，跳过此次mint`);
                    }
                }
                else {
                    console.log(`❌ 区块 ${blockHeight} 第二次扫描不符合mint条件`);
                }
                // 移除已处理的区块
                this.pendingBlocks.delete(blockHeight);
            }
            catch (error) {
                console.error(`❌ 处理区块 ${blockHeight} 时出错:`, error);
                // 出错的区块也要移除，避免重复处理
                this.pendingBlocks.delete(blockHeight);
            }
        }
    }
    /**
     * 立即寻找下一个可mint的区块
     */
    async findNextMintableBlock() {
        try {
            const latestBlock = await this.getLatestBlockInfo();
            // 检查最新的几个区块是否符合条件
            for (let blockHeight = this.lastProcessedBlock + 1; blockHeight <= latestBlock.height; blockHeight++) {
                try {
                    const blockInfo = await this.getBlockInfo(blockHeight);
                    if (this.isBlockSuitableForMint(blockInfo)) {
                        console.log(`🎯 发现符合条件的区块 ${blockHeight}，立即执行mint...`);
                        const txids = await this.executeMint();
                        if (txids.length > 0) {
                            this.currentMintTxs = txids;
                            console.log(`📝 记录mint交易: ${txids.join(', ')}`);
                            this.lastProcessedBlock = blockHeight;
                            return; // 找到并执行了mint，退出搜索
                        }
                    }
                    else {
                        console.log(`⏭️ 区块 ${blockHeight} 不符合条件，继续寻找...`);
                    }
                    this.lastProcessedBlock = blockHeight;
                }
                catch (error) {
                    console.log(`⏳ 区块 ${blockHeight} 还未出现或获取失败`);
                    break;
                }
            }
            // 如果没有找到符合条件的区块，记录下一个区块等待扫描
            if (this.currentMintTxs.length === 0) {
                const nextBlockHeight = latestBlock.height + 1;
                console.log(`📝 没有找到符合条件的区块，记录下一个区块 ${nextBlockHeight} 等待扫描`);
                try {
                    const nextBlockInfo = await this.getBlockInfo(nextBlockHeight);
                    this.pendingBlocks.set(nextBlockHeight, {
                        firstScanTime: Date.now(),
                        blockInfo: nextBlockInfo
                    });
                    this.lastProcessedBlock = nextBlockHeight;
                }
                catch (error) {
                    console.log(`⏳ 区块 ${nextBlockHeight} 还未出现，继续等待...`);
                }
            }
        }
        catch (error) {
            console.error('❌ 寻找下一个可mint区块时出错:', error);
        }
    }
    /**
     * 主监控循环
     */
    async startAutoMint() {
        this.running = true;
        console.log(`🤖 开始自动 ACAI mint 监控...`);
        console.log(`📋 配置参数:`);
        console.log(`   - 最大区块交易数: ${this.config.maxBlockTransactions}`);
        console.log(`   - 最大费率: ${this.config.maxFeeRate} sat/vB`);
        console.log(`   - 等待时间: ${this.config.waitMinutes} 分钟`);
        console.log(`   - Mint费率: ${this.config.feeRate} sat/vB`);
        console.log(`   - 每次Mint数量: ${this.config.mintCount} 次`);
        console.log(`📝 扫描策略: 检查当前区块+1 → 等待${this.config.waitMinutes}分钟 → 第二次扫描 → 符合条件则批量mint ${this.config.mintCount} 次`);
        console.log(`-------------------------------------------`);
        // 获取初始区块高度
        try {
            const initialBlock = await this.getLatestBlockInfo();
            this.lastProcessedBlock = initialBlock.height;
            console.log(`📍 当前区块高度: ${this.lastProcessedBlock}`);
            // 立即检查下一个区块（当前区块+1）
            const nextBlockHeight = this.lastProcessedBlock + 1;
            console.log(`🔍 立即检查下一个区块: ${nextBlockHeight} (这是我们要mint的目标区块)`);
            try {
                const nextBlockInfo = await this.getBlockInfo(nextBlockHeight);
                console.log(`📝 找到区块 ${nextBlockHeight}，记录信息，${this.config.waitMinutes}分钟后进行第二次扫描`);
                // 记录下一个区块信息，等待第二次扫描
                this.pendingBlocks.set(nextBlockHeight, {
                    firstScanTime: Date.now(),
                    blockInfo: nextBlockInfo
                });
                // 更新已处理区块高度
                this.lastProcessedBlock = nextBlockHeight;
            }
            catch (error) {
                console.log(`⏳ 区块 ${nextBlockHeight} 还未出现，等待新区块...`);
            }
        }
        catch (error) {
            console.error('❌ 无法获取初始区块信息');
            return;
        }
        while (this.running) {
            try {
                // 检查是否有待确认的交易
                if (this.currentMintTxs.length > 0) {
                    console.log(`⏳ 监控 ${this.currentMintTxs.length} 个待确认交易...`);
                    // 检查所有待确认交易的状态
                    const confirmedTxs = [];
                    for (const txid of this.currentMintTxs) {
                        const txStatus = await this.getTransactionStatus(txid);
                        if (txStatus.confirmed) {
                            console.log(`✅ 交易 ${txid} 已确认! 区块: ${txStatus.block_height}`);
                            confirmedTxs.push(txid);
                        }
                    }
                    // 移除已确认的交易
                    this.currentMintTxs = this.currentMintTxs.filter(txid => !confirmedTxs.includes(txid));
                    if (confirmedTxs.length > 0) {
                        console.log(`🎉 ${confirmedTxs.length} 个交易已确认，还有 ${this.currentMintTxs.length} 个待确认`);
                        // 如果所有交易都确认了，立即寻找下一个可mint的区块
                        if (this.currentMintTxs.length === 0) {
                            console.log(`🚀 所有交易已确认！立即寻找下一个可mint的区块...`);
                            await this.findNextMintableBlock();
                        }
                    }
                    if (this.currentMintTxs.length > 0) {
                        console.log(`⏳ 还有 ${this.currentMintTxs.length} 个交易等待确认: ${this.currentMintTxs.slice(0, 3).join(', ')}${this.currentMintTxs.length > 3 ? '...' : ''}`);
                    }
                }
                // 处理待扫描的区块（第二次扫描）
                await this.processPendingBlocks();
                // 获取最新区块信息
                const latestBlock = await this.getLatestBlockInfo();
                // 检查是否有新区块（第一次扫描）
                if (latestBlock.height > this.lastProcessedBlock) {
                    console.log(`\n🆕 发现新区块: ${latestBlock.height} (hash: ${latestBlock.hash.substring(0, 16)}...)`);
                    console.log(`📝 第一次扫描，记录区块信息，${this.config.waitMinutes}分钟后进行第二次扫描`);
                    // 记录区块信息，等待第二次扫描
                    this.pendingBlocks.set(latestBlock.height, {
                        firstScanTime: Date.now(),
                        blockInfo: latestBlock
                    });
                    this.lastProcessedBlock = latestBlock.height;
                }
                // 等待30秒后再次检查
                await new Promise(resolve => setTimeout(resolve, 30000));
            }
            catch (error) {
                console.error('❌ 监控循环出错:', error);
                await new Promise(resolve => setTimeout(resolve, 60000)); // 出错后等待1分钟
            }
        }
    }
    /**
     * 停止自动mint
     */
    stop() {
        this.running = false;
        console.log('🛑 自动mint已停止');
    }
}
exports.AutoMintManager = AutoMintManager;
// CLI命令定义
commander_1.program
    .name('auto-mint')
    .description('自动监控区块并在合适时机执行ACAI mint')
    .requiredOption('-d, --data <data>', 'ACAI mint数据 (格式: "2,21219,77")')
    .requiredOption('-p, --payment-address <address>', '付款地址 (BTC来源)')
    .requiredOption('-r, --receive-address <address>', 'ACAI接收地址')
    .option('--provider <provider>', '网络提供商', 'bitcoin')
    .option('--fee-rate <rate>', 'Mint交易费率 (sat/vB)', '2.1')
    .option('--max-transactions <count>', '最大区块交易数量', '3000')
    .option('--max-fee-rate <rate>', '最大区块费率 (sat/vB)', '1.1')
    .option('--wait-minutes <minutes>', '新区块后等待分钟数', '3')
    .option('--mint-count <count>', '每次mint的数量', '1')
    .action(async (options) => {
    const config = {
        data: options.data,
        paymentAddress: options.paymentAddress,
        receiveAddress: options.receiveAddress,
        provider: options.provider,
        feeRate: parseFloat(options.feeRate),
        maxBlockTransactions: parseInt(options.maxTransactions),
        maxFeeRate: parseFloat(options.maxFeeRate),
        waitMinutes: parseFloat(options.waitMinutes),
        mintCount: parseInt(options.mintCount)
    };
    const autoMinter = new AutoMintManager(config);
    // 处理Ctrl+C停止
    process.on('SIGINT', () => {
        console.log('\n⚠️  接收到停止信号...');
        autoMinter.stop();
        process.exit(0);
    });
    try {
        await autoMinter.startAutoMint();
    }
    catch (error) {
        console.error('❌ 自动mint程序出错:', error);
        process.exit(1);
    }
});
if (require.main === module) {
    commander_1.program.parse();
}
//# sourceMappingURL=auto-mint.js.map