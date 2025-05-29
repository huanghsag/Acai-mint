# 📖 ACAI 自动挖矿程序详细使用指南

## 🎯 项目概述

本项目是专为ACAI代币设计的自动mint程序，通过智能监控比特币网络状态，在最佳时机执行批量mint操作，有效避免"all fuel consumed by WebAssembly"错误。

## 🔧 安装与配置

### 1. 克隆项目

```bash
git clone https://github.com/Zzzzzarvis/Acai-mint.git
cd Acai-mint
```

### 2. 安装依赖

```bash
npm install
```

### 3. 构建项目

```bash
npm run build
```

### 4. 环境配置（可选）

创建 `.env` 文件（程序会自动使用默认测试助记词，但你可以配置自己的）：

```bash
# 可选：使用自定义助记词
MNEMONIC="your twelve word mnemonic phrase here"

# 可选：Sandshrew项目ID（主网使用时需要）
SANDSHREW_PROJECT_ID="your_project_id"
```

## 🚀 基本使用

### 命令格式

```bash
npx acai auto-mint [必需参数] [可选参数]
```

### 必需参数

- `-d, --data <data>`: ACAI mint数据（固定为 "2,21219,77"）
- `-p, --payment-address <address>`: 付款地址（提供BTC的地址）
- `-r, --receive-address <address>`: ACAI接收地址（1p开头的地址）

### 可选参数

| 参数 | 说明 | 默认值 | 示例 |
|------|------|--------|------|
| `--provider <provider>` | 网络提供商 | `bitcoin` | `bitcoin`, `regtest` |
| `--fee-rate <rate>` | Mint交易费率 (sat/vB) | `2.1` | `2.1`, `3.0` |
| `--max-transactions <count>` | 最大区块交易数 | `3000` | `3000`, `2000` |
| `--max-fee-rate <rate>` | 最大区块费率 (sat/vB) | `1.1` | `1.1`, `1.5` |
| `--wait-minutes <minutes>` | 新区块后等待时间 | `3` | `3`, `5` |
| `--mint-count <count>` | 每次mint数量 | `1` | `1`, `5`, `10` |

## 📊 实际使用示例

### 示例1：基本单次mint

```bash
npx acai auto-mint \
  -d "2,21219,77" \
  -p bc1qx7fvgr9dwllua2njfxlp43ux9rx49h2p78n38f \
  -r bc1pfhux2a67he3gp75lsvs0fq7vkxvcltuutuckr7exgjuldqdlfx8sdcc77u \
  --provider bitcoin
```

### 示例2：批量mint（推荐）

```bash
npx acai auto-mint \
  -d "2,21219,77" \
  -p bc1qx7fvgr9dwllua2njfxlp43ux9rx49h2p78n38f \
  -r bc1pfhux2a67he3gp75lsvs0fq7vkxvcltuutuckr7exgjuldqdlfx8sdcc77u \
  --provider bitcoin \
  --fee-rate 2.1 \
  --mint-count 5
```

### 示例3：保守模式（更严格条件）

```bash
npx acai auto-mint \
  -d "2,21219,77" \
  -p bc1qx7fvgr9dwllua2njfxlp43ux9rx49h2p78n38f \
  -r bc1pfhux2a67he3gp75lsvs0fq7vkxvcltuutuckr7exgjuldqdlfx8sdcc77u \
  --provider bitcoin \
  --max-transactions 2000 \
  --max-fee-rate 1.0 \
  --wait-minutes 5 \
  --mint-count 3
```

## 🔍 程序运行流程

### 启动阶段

1. **配置验证**: 检查所有参数是否正确
2. **网络连接**: 连接到比特币网络和mempool API
3. **地址验证**: 验证付款地址和接收地址格式
4. **余额检查**: 确保付款地址有足够的BTC

### 监控阶段

1. **区块监控**: 实时监控新区块产生
2. **第一次扫描**: 记录新区块信息
3. **等待期**: 等待指定时间（避免过早执行）
4. **第二次扫描**: 重新评估区块条件

### 执行阶段

当所有条件满足时：

1. **批量mint**: 根据设定数量连续执行mint
2. **交易监控**: 跟踪所有mint交易状态
3. **确认等待**: 等待所有交易确认
4. **循环继续**: 寻找下一个合适的区块

## 📈 实际运行输出示例

```
🤖 ACAI自动挖矿程序启动中...
📋 配置参数:
   - 最大区块交易数: 3000
   - 最大费率: 1.1 sat/vB
   - 等待时间: 3 分钟
   - Mint费率: 2.1 sat/vB
   - 每次Mint数量: 5 次
📝 扫描策略: 检查当前区块+1 → 等待3分钟 → 第二次扫描 → 符合条件则批量mint 5 次
-------------------------------------------

🔍 检查区块 898840 是否符合mint条件...
📊 区块分析:
   - 区块高度: 898840
   - 交易数量: 651
   - 最低费率: 1 sat/vB
✅ 条件检查:
   - 交易数量 (<=3000): ✅
   - 费率水平 (<=1.1): ✅
🎯 区块 898840 符合mint条件，开始记录并等待...

⏰ 等待 3 分钟后进行第二次扫描...

🔍 第二次扫描区块: 898840 (3分钟后重新检查)
🎯 区块 898840 第二次扫描符合mint条件，准备执行mint...

🚀 开始批量执行 ACAI mint...
   - 数据: 2,21219,77
   - 付款地址: bc1qx7fvgr9dwllua2njfxlp43ux9rx49h2p78n38f
   - 接收地址: bc1pfhux2a67he3gp75lsvs0fq7vkxvcltuutuckr7exgjuldqdlfx8sdcc77u
   - 费率: 2.1 sat/vB
   - Mint数量: 5 次

📡 执行第 1 次mint...
💰 付款地址余额: 79114 sats
📦 可用UTXO数量: 1
⛽ 预估费用: 448 sats (包含1069 sats FARTANE费用)
✅ 第 1 次 Mint 交易已广播! TxID: 3abf4d2573d3acb7208fcf1f5632fe6bedb5202a622f1804f69e4cbe23a58293

📡 执行第 2 次mint...
✅ 第 2 次 Mint 交易已广播! TxID: 52695d6beb770378162477aa9da81244fdb68f8e231b19044efd047f218cd83d

... (继续执行剩余mint)

🎯 批量mint完成！成功 5/5 次
📝 记录mint交易: 3abf4d25..., 52695d6b..., 5a2f8a9a..., 583e1169..., 0b87b36a...

⏳ 监控 5 个待确认交易...
✅ 交易 3abf4d2573d3acb7208fcf1f5632fe6bedb5202a622f1804f69e4cbe23a58293 已确认! 区块: 898842
✅ 交易 52695d6beb770378162477aa9da81244fdb68f8e231b19044efd047f218cd83d 已确认! 区块: 898842
... (所有交易确认)

🎉 5 个交易已确认，还有 0 个待确认
🔄 所有交易已确认，继续寻找下一个可mint的区块...
```

## ⚙️ 高级配置

### 不同网络环境

```bash
# 主网（默认）
--provider bitcoin

# 测试网
--provider regtest

# Oylnet
--provider oylnet
```

### 费率策略

```bash
# 低费率（经济模式）
--fee-rate 1.1

# 标准费率（推荐）
--fee-rate 2.1

# 高费率（快速确认）
--fee-rate 5.0
```

### 批量策略

```bash
# 保守批量（1-3个）
--mint-count 3

# 标准批量（5个，推荐）
--mint-count 5

# 积极批量（10个，需要更多BTC）
--mint-count 10
```

## 🛠️ 故障排除

### 常见错误及解决方案

#### 1. "unknown command 'auto-mint'"
```bash
# 解决方案：重新构建项目
npm run build
```

#### 2. "all fuel consumed by WebAssembly"
这个错误表明当前区块条件不适合mint，程序会自动等待更好的时机。

#### 3. 余额不足
```bash
# 检查付款地址余额
npx acai balance -address bc1qx7fvgr9dwllua2njfxlp43ux9rx49h2p78n38f
```

#### 4. 网络连接问题
```bash
# 尝试使用不同的provider
--provider regtest  # 或其他网络
```

### 调试模式

```bash
# 启用详细日志
DEBUG=1 npx acai auto-mint ...
```

## 💰 费用计算

每次ACAI mint的费用构成：

- **Mint输出**: 546 sats（发送到ACAI接收地址）
- **FARTANE费用**: 1069 sats（必需的合约费用）
- **网络费用**: ~448 sats（根据费率计算）
- **总计**: 约2063 sats（约0.00002 BTC）

## 🔐 安全注意事项

1. **私钥安全**: 确保助记词的安全存储
2. **网络安全**: 使用可信的网络连接
3. **金额控制**: 不要在付款地址存放过多BTC
4. **测试优先**: 在testnet上充分测试后再使用mainnet

## 📞 支持与反馈

- **GitHub Issues**: [提交问题](https://github.com/Zzzzzarvis/Acai-mint/issues)
- **开发者**: Zzzzzarvis
- **许可证**: MIT License

---

**⚠️ 免责声明**: 本软件仅供学习和研究使用，使用者需自行承担相关风险。使用前请在测试网络上充分测试，并确保了解所有相关技术细节。 