"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.alkaneAutoMint = exports.alkaneBumpFee = exports.alkanePreviewRemoveLiquidity = exports.alkaneGetAllPoolsDetails = exports.alkaneSimulate = exports.alkaneAddLiquidity = exports.alkaneCreatePool = exports.alkaneSend = exports.alkaneSwap = exports.alkaneRemoveLiquidity = exports.alkaneAcaiCustom = exports.alkaneAcai = exports.alkaneExecute = exports.alkaneTokenDeploy = exports.alkaneContractDeploy = exports.alkanesTrace = exports.AlkanesCommand = void 0;
const tslib_1 = require("tslib");
const commander_1 = require("commander");
const fs_extra_1 = tslib_1.__importDefault(require("fs-extra"));
const node_zlib_1 = require("node:zlib");
const util_1 = require("util");
const path_1 = tslib_1.__importDefault(require("path"));
const alkanes = tslib_1.__importStar(require("../alkanes/alkanes"));
const utxo = tslib_1.__importStar(require("../utxo"));
const wallet_1 = require("./wallet");
const contract_1 = require("../alkanes/contract");
const token_1 = require("../alkanes/token");
const proto_runestone_upgrade_1 = require("alkanes/lib/protorune/proto_runestone_upgrade");
const protostone_1 = require("alkanes/lib/protorune/protostone");
const bytes_1 = require("alkanes/lib/bytes");
const alkanes_1 = require("../rpclient/alkanes");
const protoruneruneid_1 = require("alkanes/lib/protorune/protoruneruneid");
const integer_1 = require("@magiceden-oss/runestone-lib/dist/src/integer");
const factory_1 = require("../amm/factory");
const pool_1 = require("../amm/pool");
const utils_1 = require("../shared/utils");
const auto_mint_js_1 = require("./auto-mint.js");
/* @dev example call
  oyl alkane trace -params '{"txid":"e6561c7a8f80560c30a113c418bb56bde65694ac2b309a68549f35fdf2e785cb","vout":0}'

  Note the json format if you need to pass an object.
*/
class AlkanesCommand extends commander_1.Command {
    constructor(cmd) {
        super(cmd);
    }
    action(fn) {
        this.option('-s, --metashrew-rpc-url <url>', 'metashrew JSON-RPC override');
        return super.action(async (options) => {
            alkanes_1.metashrew.set(options.metashrewRpcUrl || null);
            return await fn(options);
        });
    }
}
exports.AlkanesCommand = AlkanesCommand;
exports.alkanesTrace = new AlkanesCommand('trace')
    .description('Returns data based on txid and vout of deployed alkane')
    .option('-p, --provider <provider>', 'provider to use to access the network.')
    .option('-params, --parameters <parameters>', 'parameters for the ord method you are calling.')
    .action(async (options) => {
    const wallet = new wallet_1.Wallet(options);
    const provider = wallet.provider;
    let isJson;
    isJson = JSON.parse(options.parameters);
    const { vout, txid } = isJson;
    console.log(JSON.stringify(await provider.alkanes.trace({
        vout,
        txid,
    })));
});
/* @dev example call
  oyl alkane new-contract -c ./src/cli/contracts/free_mint.wasm -data 3,77,100

  The free_mint.wasm contract is used as an example. This deploys to Reserve Number 77.

  To verify the factory contract was deployed, you can use the oyl alkane trace command
  using the returned txid and vout: 3

  Remember to genBlocks after sending transactions to the regtest chain!
*/
exports.alkaneContractDeploy = new AlkanesCommand('new-contract')
    .requiredOption('-data, --calldata <calldata>', 'op code + params to be used when deploying a contracts', (value, previous) => {
    const items = value.split(',');
    return previous ? previous.concat(items) : items;
}, [])
    .requiredOption('-c, --contract <contract>', 'Relative path to contract wasm file to deploy (e.g., "../alkanes/free_mint.wasm")')
    .option('-p, --provider <provider>', 'Network provider type (regtest, bitcoin)')
    .option('-feeRate, --feeRate <feeRate>', 'fee rate')
    .action(async (options) => {
    const wallet = new wallet_1.Wallet(options);
    const { accountSpendableTotalUtxos, accountSpendableTotalBalance } = await utxo.accountUtxos({
        account: wallet.account,
        provider: wallet.provider,
    });
    const contract = new Uint8Array(Array.from(await fs_extra_1.default.readFile(path_1.default.resolve(process.cwd(), options.contract))));
    const gzip = (0, util_1.promisify)(node_zlib_1.gzip);
    const payload = {
        body: await gzip(contract, { level: 9 }),
        cursed: false,
        tags: { contentType: '' },
    };
    const callData = [];
    for (let i = 0; i < options.calldata.length; i++) {
        callData.push(BigInt(options.calldata[i]));
    }
    const protostone = (0, proto_runestone_upgrade_1.encodeRunestoneProtostone)({
        protostones: [
            protostone_1.ProtoStone.message({
                protocolTag: 1n,
                edicts: [],
                pointer: 0,
                refundPointer: 0,
                calldata: (0, bytes_1.encipher)(callData),
            }),
        ],
    }).encodedRunestone;
    console.log(await (0, contract_1.contractDeployment)({
        protostone,
        payload,
        gatheredUtxos: {
            utxos: accountSpendableTotalUtxos,
            totalAmount: accountSpendableTotalBalance,
        },
        feeRate: wallet.feeRate,
        account: wallet.account,
        signer: wallet.signer,
        provider: wallet.provider,
    }));
});
/* @dev example call
  oyl alkane new-token -pre 5000 -amount 1000 -c 100000 -name "OYL" -symbol "OL" -resNumber 77 -i ./src/cli/contracts/image.png
  
  The resNumber must be a resNumber for a deployed contract. In this case 77 is the resNumber for
  the free_mint.wasm contract and the options supplied are for the free_mint.wasm contract.

  The token will deploy to the next available [2, n] Alkane ID.

  To get information on the deployed token, you can use the oyl alkane trace command
  using the returned txid and vout: 4

  Remember to genBlocks after transactions...
*/
exports.alkaneTokenDeploy = new AlkanesCommand('new-token')
    .requiredOption('-resNumber, --reserveNumber <reserveNumber>', 'Number to reserve for factory id')
    .requiredOption('-c, --cap <cap>', 'the token cap')
    .requiredOption('-name, --token-name <name>', 'the token name')
    .requiredOption('-symbol, --token-symbol <symbol>', 'the token symbol')
    .requiredOption('-amount, --amount-per-mint <amount-per-mint>', 'Amount of tokens minted each time mint is called')
    .option('-pre, --premine <premine>', 'amount to premine')
    .option('-i, --image <image>', 'Relative path to image file to deploy (e.g., "../alkanes/free_mint.wasm")')
    .option('-p, --provider <provider>', 'Network provider type (regtest, bitcoin)')
    .option('-feeRate, --feeRate <feeRate>', 'fee rate')
    .action(async (options) => {
    const wallet = new wallet_1.Wallet(options);
    const { accountSpendableTotalUtxos, accountSpendableTotalBalance } = await utxo.accountUtxos({
        account: wallet.account,
        provider: wallet.provider,
    });
    const tokenName = (0, utils_1.packUTF8)(options.tokenName);
    const tokenSymbol = (0, utils_1.packUTF8)(options.tokenSymbol);
    if (tokenName.length > 2) {
        throw new Error('Token name too long');
    }
    if (tokenSymbol.length > 1) {
        throw new Error('Token symbol too long');
    }
    const calldata = [
        BigInt(6),
        BigInt(options.reserveNumber),
        BigInt(0),
        BigInt(options.premine ?? 0),
        BigInt(options.amountPerMint),
        BigInt(options.cap),
        BigInt('0x' + tokenName[0]),
        BigInt(tokenName.length > 1 ? '0x' + tokenName[1] : 0),
        BigInt('0x' + tokenSymbol[0]),
    ];
    const protostone = (0, proto_runestone_upgrade_1.encodeRunestoneProtostone)({
        protostones: [
            protostone_1.ProtoStone.message({
                protocolTag: 1n,
                edicts: [],
                pointer: 0,
                refundPointer: 0,
                calldata: (0, bytes_1.encipher)(calldata),
            }),
        ],
    }).encodedRunestone;
    if (options.image) {
        const image = new Uint8Array(Array.from(await fs_extra_1.default.readFile(path_1.default.resolve(process.cwd(), options.image))));
        const gzip = (0, util_1.promisify)(node_zlib_1.gzip);
        const payload = {
            body: await gzip(image, { level: 9 }),
            cursed: false,
            tags: { contentType: '' },
        };
        console.log(await (0, token_1.tokenDeployment)({
            payload,
            protostone,
            gatheredUtxos: {
                utxos: accountSpendableTotalUtxos,
                totalAmount: accountSpendableTotalBalance,
            },
            feeRate: wallet.feeRate,
            account: wallet.account,
            signer: wallet.signer,
            provider: wallet.provider,
        }));
        return;
    }
    console.log(await alkanes.execute({
        protostone,
        gatheredUtxos: {
            utxos: accountSpendableTotalUtxos,
            totalAmount: accountSpendableTotalBalance,
        },
        feeRate: wallet.feeRate,
        account: wallet.account,
        signer: wallet.signer,
        provider: wallet.provider,
    }));
});
/* @dev example call
  oyl alkane execute -data 2,1,77 -e 2:1:333:1

  In this example we call a mint (opcode 77) from the [2,1] token. The token
  will mint to the wallet calling execute.

  We also pass the edict 2:1:333:1. That is id [2,1], the amount is 333, and the output is vout 1.

  Hint: you can grab the TEST_WALLET's alkanes balance with:
  oyl provider alkanes -method getAlkanesByAddress -params '{"address":"bcrt1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqvg32hk"}'
*/
exports.alkaneExecute = new AlkanesCommand('execute')
    .requiredOption('-data, --calldata <calldata>', 'op code + params to be called on a contract', (value, previous) => {
    const items = value.split(',');
    return previous ? previous.concat(items) : items;
}, [])
    .option('-e, --edicts <edicts>', 'edicts for protostone', (value, previous) => {
    const items = value.split(',');
    return previous ? previous.concat(items) : items;
}, [])
    .option('-m, --mnemonic <mnemonic>', '(optional) Mnemonic used for signing transactions (default = TEST_WALLET)')
    .option('-p, --provider <provider>', 'Network provider type (regtest, bitcoin)')
    .option('-feeRate, --feeRate <feeRate>', 'fee rate')
    .option('--dry-run', '不广播交易，仅返回签名后的原始交易数据')
    .action(async (options) => {
    const wallet = new wallet_1.Wallet(options);
    const { accountSpendableTotalUtxos, accountSpendableTotalBalance } = await utxo.accountUtxos({
        account: wallet.account,
        provider: wallet.provider,
    });
    const calldata = options.calldata.map((item) => BigInt(item));
    const edicts = options.edicts.map((item) => {
        const [block, tx, amount, output] = item
            .split(':')
            .map((part) => part.trim());
        return {
            id: new protoruneruneid_1.ProtoruneRuneId((0, integer_1.u128)(block), (0, integer_1.u128)(tx)),
            amount: amount ? BigInt(amount) : undefined,
            output: output ? Number(output) : undefined,
        };
    });
    const protostone = (0, proto_runestone_upgrade_1.encodeRunestoneProtostone)({
        protostones: [
            protostone_1.ProtoStone.message({
                protocolTag: 1n,
                edicts,
                pointer: 0,
                refundPointer: 0,
                calldata: (0, bytes_1.encipher)(calldata),
            }),
        ],
    }).encodedRunestone;
    console.log(await alkanes.execute({
        protostone,
        gatheredUtxos: {
            utxos: accountSpendableTotalUtxos,
            totalAmount: accountSpendableTotalBalance,
        },
        feeRate: wallet.feeRate,
        account: wallet.account,
        signer: wallet.signer,
        provider: wallet.provider,
        noBroadcast: options.dryRun,
    }));
});
/* @dev example call
  oyl alkane acai -data "2,21219,77" -p bitcoin -feeRate 2.1

  专门为ACAI代币设计的mint命令，自动包含1069 sats的FARTANE费用
*/
exports.alkaneAcai = new AlkanesCommand('acai')
    .description('专门为ACAI代币mint设计的命令，自动包含FARTANE费用')
    .requiredOption('-data, --calldata <calldata>', '操作码 + 参数 (例如: "2,21219,77")', (value, previous) => {
    const items = value.split(',');
    return previous ? previous.concat(items) : items;
}, [])
    .option('-edicts, --edicts <edicts>', 'edicts for protostone', (value, previous) => {
    const items = value.split(',');
    return previous ? previous.concat(items) : items;
}, [])
    .option('-m, --mnemonic <mnemonic>', '(可选) 助记词用于签名交易 (默认 = TEST_WALLET)')
    .option('-p, --provider <provider>', '网络提供者类型 (regtest, bitcoin)')
    .option('-feeRate, --feeRate <feeRate>', '费率')
    .option('--dry-run', '不广播交易，仅返回签名后的原始交易数据')
    .action(async (options) => {
    const wallet = new wallet_1.Wallet(options);
    // 添加调试信息，确认使用的钱包
    console.log('=== 钱包调试信息 ===');
    console.log('使用的助记词前4个词:', wallet.mnemonic.split(' ').slice(0, 4).join(' ') + '...');
    console.log('Legacy地址:', wallet.account.legacy);
    console.log('Taproot地址:', wallet.account.taproot);
    console.log('========================');
    console.log('');
    const { accountSpendableTotalUtxos, accountSpendableTotalBalance } = await utxo.accountUtxos({
        account: wallet.account,
        provider: wallet.provider,
    });
    const calldata = options.calldata.map((item) => BigInt(item));
    const edicts = options.edicts.map((item) => {
        const [block, tx, amount, output] = item
            .split(':')
            .map((part) => part.trim());
        return {
            id: new protoruneruneid_1.ProtoruneRuneId((0, integer_1.u128)(block), (0, integer_1.u128)(tx)),
            amount: amount ? BigInt(amount) : undefined,
            output: output ? Number(output) : undefined,
        };
    });
    const protostone = (0, proto_runestone_upgrade_1.encodeRunestoneProtostone)({
        protostones: [
            protostone_1.ProtoStone.message({
                protocolTag: 1n,
                edicts,
                pointer: 0,
                refundPointer: 0,
                calldata: (0, bytes_1.encipher)(calldata),
            }),
        ],
    }).encodedRunestone;
    console.log('🎯 使用ACAI专用mint模式...');
    console.log('📄 自动包含1069 sats发送到FARTANE地址');
    console.log('🔗 FARTANE地址: bc1qta5glek90en6pd70mq9fguwel0xrlghmv6r09e');
    console.log('');
    const result = await alkanes.acaiExecute({
        protostone,
        gatheredUtxos: {
            utxos: accountSpendableTotalUtxos,
            totalAmount: accountSpendableTotalBalance,
        },
        feeRate: wallet.feeRate,
        account: wallet.account,
        signer: wallet.signer,
        provider: wallet.provider,
        noBroadcast: options.dryRun,
    });
    console.log(result);
});
/* @dev example call
  oyl alkane acai-custom -data "2,21219,77" -paymentAddress bc1qx7fvgr9dwllua2njfxlp43ux9rx49h2p78n38f -receiveAddress bc1pfhux2a67he3gp75lsvs0fq7vkxvcltuutuckr7exgjuldqdlfx8sdcc77u -p bitcoin -feeRate 2.1

  专门为ACAI代币设计的自定义mint命令，可指定付款地址和接收地址
*/
exports.alkaneAcaiCustom = new AlkanesCommand('acai-custom')
    .description('ACAI自定义mint命令，支持指定付款地址和ACAI接收地址')
    .requiredOption('-data, --calldata <calldata>', '操作码 + 参数 (例如: "2,21219,77")', (value, previous) => {
    const items = value.split(',');
    return previous ? previous.concat(items) : items;
}, [])
    .requiredOption('-paymentAddress, --payment-address <address>', '付款地址（从此地址花费UTXO，剩余BTC也返回此地址）')
    .requiredOption('-receiveAddress, --receive-address <address>', '接收地址（ACAI mint的546 sats输出发送到此地址）')
    .option('-edicts, --edicts <edicts>', 'edicts for protostone', (value, previous) => {
    const items = value.split(',');
    return previous ? previous.concat(items) : items;
}, [])
    .option('-m, --mnemonic <mnemonic>', '(可选) 助记词用于签名交易 (默认 = TEST_WALLET)')
    .option('-p, --provider <provider>', '网络提供者类型 (regtest, bitcoin)')
    .option('-feeRate, --feeRate <feeRate>', '费率')
    .option('--dry-run', '不广播交易，仅返回签名后的原始交易数据')
    .action(async (options) => {
    const wallet = new wallet_1.Wallet(options);
    console.log('=== ACAI自定义地址Mint ===');
    console.log('🎯 使用自定义地址模式...');
    console.log('💳 付款地址:', options.paymentAddress);
    console.log('🎁 ACAI接收地址:', options.receiveAddress);
    console.log('📄 自动包含1069 sats发送到FARTANE地址');
    console.log('🔗 FARTANE地址: bc1qta5glek90en6pd70mq9fguwel0xrlghmv6r09e');
    console.log('💰 剩余BTC找零返回到付款地址');
    console.log('==============================');
    console.log('');
    const calldata = options.calldata.map((item) => BigInt(item));
    const edicts = options.edicts.map((item) => {
        const [block, tx, amount, output] = item
            .split(':')
            .map((part) => part.trim());
        return {
            id: new protoruneruneid_1.ProtoruneRuneId((0, integer_1.u128)(block), (0, integer_1.u128)(tx)),
            amount: amount ? BigInt(amount) : undefined,
            output: output ? Number(output) : undefined,
        };
    });
    const protostone = (0, proto_runestone_upgrade_1.encodeRunestoneProtostone)({
        protostones: [
            protostone_1.ProtoStone.message({
                protocolTag: 1n,
                edicts,
                pointer: 0,
                refundPointer: 0,
                calldata: (0, bytes_1.encipher)(calldata),
            }),
        ],
    }).encodedRunestone;
    const result = await alkanes.customAcaiExecute({
        paymentAddress: options.paymentAddress,
        changeAddress: options.receiveAddress,
        protostone,
        feeRate: wallet.feeRate,
        account: wallet.account,
        signer: wallet.signer,
        provider: wallet.provider,
        noBroadcast: options.dryRun,
    });
    console.log(result);
});
/* @dev example call
  oyl alkane   -data "2,9,1" -p alkanes -feeRate 5 -blk 2 -tx 1 -amt 200

  Burns an alkane LP token amount
*/
exports.alkaneRemoveLiquidity = new AlkanesCommand('remove-liquidity')
    .requiredOption('-data, --calldata <calldata>', 'op code + params to be called on a contract', (value, previous) => {
    const items = value.split(',');
    return previous ? previous.concat(items) : items;
}, [])
    .requiredOption('-amt, --amount <amount>', 'amount to burn')
    .requiredOption('-blk, --block <block>', 'block number')
    .requiredOption('-tx, --txNum <txNum>', 'transaction number')
    .option('-p, --provider <provider>', 'Network provider type (regtest, bitcoin)')
    .option('-feeRate, --feeRate <feeRate>', 'fee rate')
    .action(async (options) => {
    const wallet = new wallet_1.Wallet(options);
    const { accountSpendableTotalUtxos, accountSpendableTotalBalance } = await utxo.accountUtxos({
        account: wallet.account,
        provider: wallet.provider,
    });
    const calldata = options.calldata.map((item) => BigInt(item));
    console.log(await (0, pool_1.removeLiquidity)({
        calldata,
        token: { block: options.block, tx: options.txNum },
        tokenAmount: BigInt(options.amount),
        gatheredUtxos: {
            utxos: accountSpendableTotalUtxos,
            totalAmount: accountSpendableTotalBalance,
        },
        feeRate: wallet.feeRate,
        account: wallet.account,
        signer: wallet.signer,
        provider: wallet.provider,
    }));
});
/* @dev example call
  oyl alkane swap -data "2,7,3,160" -p alkanes -feeRate 5 -blk 2 -tx 1 -amt 200

  Swaps an alkane from a pool
*/
exports.alkaneSwap = new AlkanesCommand('swap')
    .requiredOption('-data, --calldata <calldata>', 'op code + params to be called on a contract', (value, previous) => {
    const items = value.split(',');
    return previous ? previous.concat(items) : items;
}, [])
    .requiredOption('-amt, --amount <amount>', 'amount to swap')
    .requiredOption('-blk, --block <block>', 'block number')
    .requiredOption('-tx, --txNum <txNum>', 'transaction number')
    .option('-p, --provider <provider>', 'Network provider type (regtest, bitcoin)')
    .option('-feeRate, --feeRate <feeRate>', 'fee rate')
    .action(async (options) => {
    const wallet = new wallet_1.Wallet(options);
    const { accountSpendableTotalUtxos, accountSpendableTotalBalance } = await utxo.accountUtxos({
        account: wallet.account,
        provider: wallet.provider,
    });
    const calldata = options.calldata.map((item) => BigInt(item));
    console.log(await (0, pool_1.swap)({
        calldata,
        token: { block: options.block, tx: options.txNum },
        tokenAmount: BigInt(options.amount),
        gatheredUtxos: {
            utxos: accountSpendableTotalUtxos,
            totalAmount: accountSpendableTotalBalance,
        },
        feeRate: wallet.feeRate,
        account: wallet.account,
        signer: wallet.signer,
        provider: wallet.provider,
    }));
});
/* @dev example call
  oyl alkane send -blk 2 -tx 1 -amt 200 -to bcrt1pkq6ayylfpe5hn05550ry25pkakuf72x9qkjc2sl06dfcet8sg25ql4dm73

  Sends an alkane token amount to a given address (example is sending token with Alkane ID [2, 1])
*/
exports.alkaneSend = new AlkanesCommand('send')
    .requiredOption('-to, --to <to>')
    .requiredOption('-amt, --amount <amount>')
    .requiredOption('-blk, --block <block>')
    .requiredOption('-tx, --txNum <txNum>')
    .option('-m, --mnemonic <mnemonic>', '(optional) Mnemonic used for signing transactions (default = TEST_WALLET)')
    .option('-p, --provider <provider>', 'Network provider type (regtest, bitcoin)')
    .option('-feeRate, --feeRate <feeRate>', 'fee rate')
    .action(async (options) => {
    const wallet = new wallet_1.Wallet(options);
    const { accountSpendableTotalUtxos, accountSpendableTotalBalance } = await utxo.accountUtxos({
        account: wallet.account,
        provider: wallet.provider,
    });
    console.log(await (0, token_1.send)({
        alkaneId: { block: options.block, tx: options.txNum },
        toAddress: options.to,
        amount: Number(options.amount),
        gatheredUtxos: {
            utxos: accountSpendableTotalUtxos,
            totalAmount: accountSpendableTotalBalance,
        },
        account: wallet.account,
        signer: wallet.signer,
        provider: wallet.provider,
        feeRate: wallet.feeRate,
    }));
});
/* @dev example call
 oyl alkane create-pool -data "2,1,1" -tokens "2:2:50000,2:3:50000" -feeRate 5 -p alkanes

Creates a new pool with the given tokens and amounts
*/
exports.alkaneCreatePool = new AlkanesCommand('create-pool')
    .requiredOption('-data, --calldata <calldata>', 'op code + params to be called on a contract', (value, previous) => {
    const items = value.split(',');
    return previous ? previous.concat(items) : items;
}, [])
    .requiredOption('-tokens, --tokens <tokens>', 'tokens and amounts to pair for pool', (value, previous) => {
    const items = value.split(',');
    return previous ? previous.concat(items) : items;
}, [])
    .option('-m, --mnemonic <mnemonic>', '(optional) Mnemonic used for signing transactions (default = TEST_WALLET)')
    .option('-p, --provider <provider>', 'Network provider type (regtest, bitcoin)')
    .option('-feeRate, --feeRate <feeRate>', 'fee rate')
    .action(async (options) => {
    const wallet = new wallet_1.Wallet(options);
    const { accountSpendableTotalUtxos, accountSpendableTotalBalance } = await utxo.accountUtxos({
        account: wallet.account,
        provider: wallet.provider,
    });
    const calldata = options.calldata.map((item) => BigInt(item));
    const alkaneTokensToPool = options.tokens.map((item) => {
        const [block, tx, amount] = item.split(':').map((part) => part.trim());
        return {
            alkaneId: { block: block, tx: tx },
            amount: BigInt(amount),
        };
    });
    console.log(await (0, factory_1.createNewPool)({
        calldata,
        token0: alkaneTokensToPool[0].alkaneId,
        token0Amount: alkaneTokensToPool[0].amount,
        token1: alkaneTokensToPool[1].alkaneId,
        token1Amount: alkaneTokensToPool[1].amount,
        gatheredUtxos: {
            utxos: accountSpendableTotalUtxos,
            totalAmount: accountSpendableTotalBalance,
        },
        feeRate: wallet.feeRate,
        account: wallet.account,
        signer: wallet.signer,
        provider: wallet.provider,
    }));
});
/* @dev example call
 oyl alkane add-liquidity -data "2,1,1" -tokens "2:2:50000,2:3:50000" -feeRate 5 -p alkanes

Mints new LP tokens and adds liquidity to the pool with the given tokens and amounts
*/
exports.alkaneAddLiquidity = new AlkanesCommand('add-liquidity')
    .requiredOption('-data, --calldata <calldata>', 'op code + params to be called on a contract', (value, previous) => {
    const items = value.split(',');
    return previous ? previous.concat(items) : items;
}, [])
    .requiredOption('-tokens, --tokens <tokens>', 'tokens and amounts to pair for pool', (value, previous) => {
    const items = value.split(',');
    return previous ? previous.concat(items) : items;
}, [])
    .option('-m, --mnemonic <mnemonic>', '(optional) Mnemonic used for signing transactions (default = TEST_WALLET)')
    .option('-p, --provider <provider>', 'Network provider type (regtest, bitcoin)')
    .option('-feeRate, --feeRate <feeRate>', 'fee rate')
    .action(async (options) => {
    const wallet = new wallet_1.Wallet(options);
    const { accountSpendableTotalUtxos, accountSpendableTotalBalance } = await utxo.accountUtxos({
        account: wallet.account,
        provider: wallet.provider,
    });
    const calldata = options.calldata.map((item) => BigInt(item));
    const alkaneTokensToMint = options.tokens.map((item) => {
        const [block, tx, amount] = item.split(':').map((part) => part.trim());
        return {
            alkaneId: { block: block, tx: tx },
            amount: BigInt(amount),
        };
    });
    console.log(await (0, pool_1.addLiquidity)({
        calldata,
        token0: alkaneTokensToMint[0].alkaneId,
        token0Amount: alkaneTokensToMint[0].amount,
        token1: alkaneTokensToMint[1].alkaneId,
        token1Amount: alkaneTokensToMint[1].amount,
        gatheredUtxos: {
            utxos: accountSpendableTotalUtxos,
            totalAmount: accountSpendableTotalBalance,
        },
        feeRate: wallet.feeRate,
        account: wallet.account,
        signer: wallet.signer,
        provider: wallet.provider,
    }));
});
/* @dev example call
 AMM factory:
 oyl alkane simulate  -target "2:1" -inputs "1,2,6,2,7" -tokens "2:6:1000,2:7:2000" -decoder "factory"
 oyl alkane simulate  -target "2:1" -inputs "2,2,3,2,4" -decoder "factory"

  Simulates an operation using the pool decoder
  First input is the opcode
*/
exports.alkaneSimulate = new AlkanesCommand('simulate')
    .requiredOption('-target, --target <target>', 'target block:tx for simulation', (value) => {
    const [block, tx] = value.split(':').map((part) => part.trim());
    return { block: block.toString(), tx: tx.toString() };
})
    .requiredOption('-inputs, --inputs <inputs>', 'inputs for simulation (comma-separated)', (value) => value.split(',').map((item) => item.trim()))
    .option('-tokens, --tokens <tokens>', 'tokens and amounts to pair for pool', (value) => {
    return value.split(',').map((item) => {
        const [block, tx, value] = item.split(':').map((part) => part.trim());
        return {
            id: { block, tx },
            value,
        };
    });
}, [])
    .option('-decoder, --decoder <decoder>', 'decoder to use for simulation results (e.g., "pool")')
    .option('-p, --provider <provider>', 'Network provider type (regtest, bitcoin)')
    .action(async (options) => {
    const wallet = new wallet_1.Wallet(options);
    const request = {
        alkanes: options.tokens,
        transaction: '0x',
        block: '0x',
        height: '20000',
        txindex: 0,
        target: options.target,
        inputs: options.inputs,
        pointer: 0,
        refundPointer: 0,
        vout: 0,
    };
    let decoder;
    switch (options.decoder) {
        case 'pool':
            const { AlkanesAMMPoolDecoder } = await Promise.resolve().then(() => tslib_1.__importStar(require('../amm/pool')));
            decoder = (result) => AlkanesAMMPoolDecoder.decodeSimulation(result, Number(options.inputs[0]));
            break;
        case 'factory':
            const { AlkanesAMMPoolFactoryDecoder } = await Promise.resolve().then(() => tslib_1.__importStar(require('../amm/factory')));
            decoder = (result) => AlkanesAMMPoolFactoryDecoder.decodeSimulation(result, Number(options.inputs[0]));
    }
    console.log(JSON.stringify(await wallet.provider.alkanes.simulate(request, decoder), null, 2));
});
/* @dev example call
 oyl alkane get-all-pools-details -target "2:1"

 Gets details for all pools by:
 1. Getting all pool IDs from the factory contract
 2. For each pool ID, getting its details
 3. Returning a combined result with all pool details
*/
exports.alkaneGetAllPoolsDetails = new AlkanesCommand('get-all-pools-details')
    .requiredOption('-target, --target <target>', 'target block:tx for the factory contract', (value) => {
    const [block, tx] = value.split(':').map((part) => part.trim());
    return { block: block.toString(), tx: tx.toString() };
})
    .option('-p, --provider <provider>', 'Network provider type (regtest, bitcoin)')
    .action(async (options) => {
    const wallet = new wallet_1.Wallet(options);
    const { AlkanesAMMPoolFactoryDecoder, PoolFactoryOpcodes } = await Promise.resolve().then(() => tslib_1.__importStar(require('../amm/factory')));
    const request = {
        alkanes: [],
        transaction: '0x',
        block: '0x',
        height: '20000',
        txindex: 0,
        target: options.target,
        inputs: [PoolFactoryOpcodes.GET_ALL_POOLS.toString()],
        pointer: 0,
        refundPointer: 0,
        vout: 0,
    };
    const factoryResult = await wallet.provider.alkanes.simulate(request);
    const factoryDecoder = new AlkanesAMMPoolFactoryDecoder();
    const allPoolsDetails = await factoryDecoder.decodeAllPoolsDetails(factoryResult.execution, wallet.provider);
    console.log(JSON.stringify(allPoolsDetails, null, 2));
});
/* @dev example call
 oyl alkane preview-remove-liquidity -target "2:1" -blk 2 -tx 1 -amt 200

 预览移除流动性的结果，显示将获得的代币数量
*/
exports.alkanePreviewRemoveLiquidity = new AlkanesCommand('preview-remove-liquidity')
    .requiredOption('-target, --target <target>', 'target block:tx for simulation', (value) => {
    const [block, tx] = value.split(':').map((part) => part.trim());
    return { block: block.toString(), tx: tx.toString() };
})
    .requiredOption('-amt, --amount <amount>', 'amount to burn')
    .requiredOption('-blk, --block <block>', 'block number')
    .requiredOption('-tx, --txNum <txNum>', 'transaction number')
    .option('-p, --provider <provider>', 'Network provider type (regtest, bitcoin)')
    .action(async (options) => {
    const wallet = new wallet_1.Wallet(options);
    const request = {
        alkanes: [],
        transaction: '0x',
        block: '0x',
        height: '20000',
        txindex: 0,
        target: options.target,
        inputs: [9, options.block, options.txNum, options.amount],
        pointer: 0,
        refundPointer: 0,
        vout: 0,
    };
    const { AlkanesAMMPoolDecoder } = await Promise.resolve().then(() => tslib_1.__importStar(require('../amm/pool')));
    const decoder = (result) => AlkanesAMMPoolDecoder.decodeSimulation(result, 9);
    console.log(JSON.stringify(await wallet.provider.alkanes.simulate(request, decoder), null, 2));
});
/**
 * Command for bumping the fee of a transaction using RBF
 * @example
 * oyl alkane bump-fee -txid "6c17d0fc8b915aae2ce1a99b4bfd149f2ebc5e6762202a770a1329dff99ee0b1" -feeRate 5 -p regtest
 */
exports.alkaneBumpFee = new AlkanesCommand('bump-fee')
    .requiredOption('-txid, --transaction-id <txid>', 'Transaction ID to bump')
    .option('-feeRate, --feeRate <feeRate>', 'New fee rate in sat/vB')
    .option('-p, --provider <provider>', 'Network provider type (regtest, bitcoin)')
    .action(async (options) => {
    const wallet = new wallet_1.Wallet(options);
    console.log(await alkanes.bumpFee({
        txid: options.transactionId.replace(/"/g, ''),
        newFeeRate: Number(options.feeRate || wallet.feeRate),
        account: wallet.account,
        signer: wallet.signer,
        provider: wallet.provider,
    }));
});
/**
 * Command for auto-mint ACAI tokens
 * @example
 * oyl alkane auto-mint -d "2,21219,77" -p bc1qx7fvgr9dwllua2njfxlp43ux9rx49h2p78n38f -r bc1pfhux2a67he3gp75lsvs0fq7vkxvcltuutuckr7exgjuldqdlfx8sdcc77u --provider bitcoin
 */
exports.alkaneAutoMint = new AlkanesCommand('auto-mint')
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
    const autoMinter = new auto_mint_js_1.AutoMintManager(config);
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
//# sourceMappingURL=alkane.js.map