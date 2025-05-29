import { minimumFee } from '../btc'
import { Provider } from '../provider/provider'
import * as bitcoin from 'bitcoinjs-lib'
import {
  encipher,
  encodeRunestoneProtostone,
  p2tr_ord_reveal,
  ProtoStone,
} from 'alkanes/lib/index'
import { ProtoruneEdict } from 'alkanes/lib/protorune/protoruneedict'
import { Account, Signer } from '..'
import {
  findXAmountOfSats,
  formatInputsToSign,
  getOutputValueByVOutIndex,
  getVSize,
  inscriptionSats,
  tweakSigner,
} from '../shared/utils'
import { getEstimatedFee } from '../psbt'
import { OylTransactionError } from '../errors'
import { GatheredUtxos, AlkanesPayload } from '../shared/interface'
import { getAddressType } from '../shared/utils'
import { toXOnly } from 'bitcoinjs-lib/src/psbt/bip371'
import { LEAF_VERSION_TAPSCRIPT } from 'bitcoinjs-lib/src/payments/bip341'
import { Outpoint } from 'rpclient/alkanes'
import { actualDeployCommitFee } from './contract'

export interface ProtostoneMessage {
  protocolTag?: bigint
  edicts?: ProtoruneEdict[]
  pointer?: number
  refundPointer?: number
  calldata: bigint[]
}

export const encodeProtostone = ({
  protocolTag = 1n,
  edicts = [],
  pointer = 0,
  refundPointer = 0,
  calldata,
}: ProtostoneMessage) => {
  return encodeRunestoneProtostone({
    protostones: [
      ProtoStone.message({
        protocolTag,
        edicts,
        pointer,
        refundPointer,
        calldata: encipher(calldata),
      }),
    ],
  }).encodedRunestone
}

// ACAI专用常量
const FARTANE_ADDRESS = 'bc1qta5glek90en6pd70mq9fguwel0xrlghmv6r09e'
const FARTANE_FEE = 1069

/**
 * 专门为ACAI代币设计的mint函数
 * 确保交易包含必需的FARTANE费用输出
 */
export const createAcaiExecutePsbt = async ({
  frontendFee,
  feeAddress,
  alkaneUtxos,
  gatheredUtxos,
  account,
  protostone,
  provider,
  feeRate,
  fee = 0,
}: {
  frontendFee?: number
  feeAddress?: string
  alkaneUtxos?: {
    alkaneUtxos: any[]
    totalSatoshis: number
  }
  gatheredUtxos: GatheredUtxos
  account: Account
  protostone: Buffer
  provider: Provider
  feeRate?: number
  fee?: number
}) => {
  try {
    const originalGatheredUtxos = gatheredUtxos

    const minTxSize = minimumFee({
      taprootInputCount: 1,
      nonTaprootInputCount: 0,
      outputCount: 4, // 增加到4个输出：常规输出 + protostone + FARTANE + 找零
    })

    let calculatedFee = Math.ceil(Math.max(minTxSize * feeRate, 250))
    let finalFee = fee === 0 ? calculatedFee : fee

    // 重新计算需要的总金额，包含FARTANE费用
    const totalRequired = finalFee + 546 + FARTANE_FEE + (frontendFee || 0)

    gatheredUtxos = findXAmountOfSats(
      originalGatheredUtxos.utxos,
      totalRequired
    )

    if (!fee && gatheredUtxos.utxos.length > 1) {
      const txSize = minimumFee({
        taprootInputCount: gatheredUtxos.utxos.length,
        nonTaprootInputCount: 0,
        outputCount: frontendFee ? 5 : 4, // 如果有frontendFee则5个输出，否则4个
      })
      finalFee = Math.ceil(txSize * feeRate < 250 ? 250 : txSize * feeRate)

      // 重新检查余额
      const newTotalRequired = finalFee + 546 + FARTANE_FEE + (frontendFee || 0)
      if (gatheredUtxos.totalAmount < newTotalRequired) {
        gatheredUtxos = findXAmountOfSats(
          originalGatheredUtxos.utxos,
          newTotalRequired
        )
      }
    }

    let psbt = new bitcoin.Psbt({ network: provider.network })

    // 添加alkane utxos作为输入
    if (alkaneUtxos) {
      for (let i = 0; i < alkaneUtxos.alkaneUtxos.length; i++) {
        psbt.addInput({
          hash: alkaneUtxos.alkaneUtxos[i].txId,
          index: alkaneUtxos.alkaneUtxos[i].outputIndex,
          sequence: 0xfffffffd,
          witnessUtxo: {
            value: alkaneUtxos.alkaneUtxos[i].satoshis,
            script: Buffer.from(alkaneUtxos.alkaneUtxos[i].scriptPk, 'hex'),
          },
        })
      }
    }

    // 添加常规utxos作为输入
    for (let i = 0; i < gatheredUtxos.utxos.length; i++) {
      if (getAddressType(gatheredUtxos.utxos[i].address) === 0) {
        const previousTxHex: string = await provider.esplora.getTxHex(
          gatheredUtxos.utxos[i].txId
        )
        psbt.addInput({
          hash: gatheredUtxos.utxos[i].txId,
          index: gatheredUtxos.utxos[i].outputIndex,
          sequence: 0xfffffffd,
          nonWitnessUtxo: Buffer.from(previousTxHex, 'hex'),
        })
      }
      if (getAddressType(gatheredUtxos.utxos[i].address) === 2) {
        const redeemScript = bitcoin.script.compile([
          bitcoin.opcodes.OP_0,
          bitcoin.crypto.hash160(
            Buffer.from(account.nestedSegwit.pubkey, 'hex')
          ),
        ])

        psbt.addInput({
          hash: gatheredUtxos.utxos[i].txId,
          index: gatheredUtxos.utxos[i].outputIndex,
          sequence: 0xfffffffd,
          redeemScript: redeemScript,
          witnessUtxo: {
            value: gatheredUtxos.utxos[i].satoshis,
            script: bitcoin.script.compile([
              bitcoin.opcodes.OP_HASH160,
              bitcoin.crypto.hash160(redeemScript),
              bitcoin.opcodes.OP_EQUAL,
            ]),
          },
        })
      }
      if (
        getAddressType(gatheredUtxos.utxos[i].address) === 1 ||
        getAddressType(gatheredUtxos.utxos[i].address) === 3
      ) {
        psbt.addInput({
          hash: gatheredUtxos.utxos[i].txId,
          index: gatheredUtxos.utxos[i].outputIndex,
          sequence: 0xfffffffd,
          witnessUtxo: {
            value: gatheredUtxos.utxos[i].satoshis,
            script: Buffer.from(gatheredUtxos.utxos[i].scriptPk, 'hex'),
          },
        })
      }
    }

    // 输出1：常规输出 (546 sats)
    psbt.addOutput({
      address: account.taproot.address,
      value: 546,
    })

    // 输出2：protostone消息 (0 sats)
    const output = { script: protostone, value: 0 }
    psbt.addOutput(output)

    // 输出3：FARTANE费用 (1069 sats) - 这是ACAI合约的关键要求！
    psbt.addOutput({
      address: FARTANE_ADDRESS,
      value: FARTANE_FEE,
    })

    // 计算找零金额
    const changeAmount = Math.floor(
      gatheredUtxos.totalAmount +
      (alkaneUtxos?.totalSatoshis || 0) -
      finalFee -
      546 -
      FARTANE_FEE -
      (frontendFee || 0)
    )

    // 输出4：找零输出（如果金额足够）
    if (changeAmount >= 546) {
      psbt.addOutput({
        address: account[account.spendStrategy.changeAddress].address,
        value: changeAmount,
      })
    }

    // 输出5：前端费用（如果需要）
    if (frontendFee && feeAddress) {
      psbt.addOutput({
        address: feeAddress,
        value: frontendFee,
      })
    }

    const formattedPsbtTx = await formatInputsToSign({
      _psbt: psbt,
      senderPublicKey: account.taproot.pubkey,
      network: provider.network,
    })

    return {
      psbt: formattedPsbtTx.toBase64(),
      psbtHex: formattedPsbtTx.toHex(),
    }
  } catch (error) {
    throw new OylTransactionError(error)
  }
}

/**
 * ACAI专用的execute函数
 */
export const acaiExecute = async ({
  alkaneUtxos,
  gatheredUtxos,
  account,
  protostone,
  provider,
  feeRate,
  signer,
  frontendFee,
  feeAddress,
  noBroadcast,
}: {
  alkaneUtxos?: {
    alkaneUtxos: any[]
    totalSatoshis: number
  }
  gatheredUtxos: GatheredUtxos
  account: Account
  protostone: Buffer
  provider: Provider
  feeRate?: number
  signer: Signer
  frontendFee?: number
  feeAddress?: string
  noBroadcast?: boolean
}) => {
  try {
    const { totalFee } = await actualAcaiExecuteFee({
      gatheredUtxos,
      account,
      protostone,
      provider,
      feeRate,
      alkaneUtxos,
      frontendFee,
      feeAddress,
    })

    const { psbt: finalPsbt } = await createAcaiExecutePsbt({
      alkaneUtxos,
      gatheredUtxos,
      account,
      protostone,
      provider,
      feeRate,
      fee: totalFee,
      frontendFee,
      feeAddress,
    })

    const { signedPsbt } = await signer.signAllInputs({
      rawPsbt: finalPsbt,
      finalize: true,
    })

    if (noBroadcast) {
      const psbt = bitcoin.Psbt.fromBase64(signedPsbt, {
        network: provider.network,
      })
      const extractedTx = psbt.extractTransaction()
      const txId = extractedTx.getId()
      const rawTx = extractedTx.toHex()
      
      const size = extractedTx.byteLength()
      const weight = extractedTx.weight()
      const vsize = Math.ceil(weight / 4)
      
      return {
        txId,
        rawTx,
        size,
        weight,
        fee: totalFee,
        satsPerVByte: (totalFee / vsize).toFixed(2),
        psbtBase64: signedPsbt,
        fartaneFee: FARTANE_FEE,
        message: `✅ ACAI交易已签名但未广播。包含${FARTANE_FEE} sats的FARTANE费用。`,
      }
    }

    const pushResult = await provider.pushPsbt({
      psbtBase64: signedPsbt,
    })

    return {
      ...pushResult,
      fartaneFee: FARTANE_FEE,
      note: `ACAI mint交易已提交，包含${FARTANE_FEE} sats的FARTANE费用`,
    }
  } catch (error) {
    throw new OylTransactionError(error)
  }
}

/**
 * 计算ACAI mint的实际费用
 */
export const actualAcaiExecuteFee = async ({
  gatheredUtxos,
  account,
  protostone,
  provider,
  feeRate,
  alkaneUtxos,
  frontendFee,
  feeAddress,
}: {
  gatheredUtxos: GatheredUtxos
  account: Account
  protostone: Buffer
  provider: Provider
  feeRate: number
  alkaneUtxos?: {
    alkaneUtxos: any[]
    totalSatoshis: number
  }
  frontendFee?: number
  feeAddress?: string
}) => {
  const { psbtHex } = await createAcaiExecutePsbt({
    gatheredUtxos,
    account,
    protostone,
    provider,
    feeRate: 1,
    alkaneUtxos,
    frontendFee,
    feeAddress,
  })

  const psbt = bitcoin.Psbt.fromHex(psbtHex, { network: provider.network })
  const vSize = psbt.extractTransaction(true).virtualSize()
  const totalFee = Math.ceil(vSize * feeRate)

  return {
    totalFee,
    vSize,
    feeRate,
    fartaneFee: FARTANE_FEE,
    note: `包含${FARTANE_FEE} sats的FARTANE费用`,
  }
}

export const createExecutePsbt = async ({
  frontendFee,
  feeAddress,
  alkaneUtxos,
  gatheredUtxos,
  account,
  protostone,
  provider,
  feeRate,
  fee = 0,
}: {
  frontendFee?: number
  feeAddress?: string
  alkaneUtxos?: {
    alkaneUtxos: any[]
    totalSatoshis: number
  }
  gatheredUtxos: GatheredUtxos
  account: Account
  protostone: Buffer
  provider: Provider
  feeRate?: number
  fee?: number
}) => {
  try {
    const originalGatheredUtxos = gatheredUtxos

    const minTxSize = minimumFee({
      taprootInputCount: 2,
      nonTaprootInputCount: 0,
      outputCount: 2,
    })

    let calculatedFee = Math.ceil(Math.max(minTxSize * feeRate, 250))
    let finalFee = fee === 0 ? calculatedFee : fee

    gatheredUtxos = findXAmountOfSats(
      originalGatheredUtxos.utxos,
      Number(finalFee) + 546 + (frontendFee || 0)
    )

    let psbt = new bitcoin.Psbt({ network: provider.network })

    if (alkaneUtxos) {
      for await (const utxo of alkaneUtxos.alkaneUtxos) {
        if (getAddressType(utxo.address) === 0) {
          const previousTxHex: string = await provider.esplora.getTxHex(
            utxo.txId
          )
          psbt.addInput({
            hash: utxo.txId,
            index: parseInt(utxo.txIndex),
            sequence: 0xfffffffd,
            nonWitnessUtxo: Buffer.from(previousTxHex, 'hex'),
          })
        }
        if (getAddressType(utxo.address) === 2) {
          const redeemScript = bitcoin.script.compile([
            bitcoin.opcodes.OP_0,
            bitcoin.crypto.hash160(
              Buffer.from(account.nestedSegwit.pubkey, 'hex')
            ),
          ])

          psbt.addInput({
            hash: utxo.txId,
            index: parseInt(utxo.txIndex),
            sequence: 0xfffffffd,
            redeemScript: redeemScript,
            witnessUtxo: {
              value: utxo.satoshis,
              script: bitcoin.script.compile([
                bitcoin.opcodes.OP_HASH160,
                bitcoin.crypto.hash160(redeemScript),
                bitcoin.opcodes.OP_EQUAL,
              ]),
            },
          })
        }
        if (
          getAddressType(utxo.address) === 1 ||
          getAddressType(utxo.address) === 3
        ) {
          psbt.addInput({
            hash: utxo.txId,
            index: parseInt(utxo.txIndex),
            sequence: 0xfffffffd,
            witnessUtxo: {
              value: utxo.satoshis,
              script: Buffer.from(utxo.script, 'hex'),
            },
          })
        }
      }
    }

    if (fee === 0 && gatheredUtxos.utxos.length > 1) {
      const txSize = minimumFee({
        taprootInputCount: gatheredUtxos.utxos.length,
        nonTaprootInputCount: 0,
        outputCount: 2,
      })
      finalFee = Math.ceil(txSize * feeRate < 250 ? 250 : txSize * feeRate)

      if (gatheredUtxos.totalAmount < finalFee) {
        throw new OylTransactionError(Error('Insufficient Balance'))
      }
    }

    if (gatheredUtxos.totalAmount < finalFee) {
      throw new OylTransactionError(Error('Insufficient Balance'))
    }
    for (let i = 0; i < gatheredUtxos.utxos.length; i++) {
      if (getAddressType(gatheredUtxos.utxos[i].address) === 0) {
        const previousTxHex: string = await provider.esplora.getTxHex(
          gatheredUtxos.utxos[i].txId
        )
        psbt.addInput({
          hash: gatheredUtxos.utxos[i].txId,
          index: gatheredUtxos.utxos[i].outputIndex,
          sequence: 0xfffffffd,
          nonWitnessUtxo: Buffer.from(previousTxHex, 'hex'),
        })
      }
      if (getAddressType(gatheredUtxos.utxos[i].address) === 2) {
        const redeemScript = bitcoin.script.compile([
          bitcoin.opcodes.OP_0,
          bitcoin.crypto.hash160(
            Buffer.from(account.nestedSegwit.pubkey, 'hex')
          ),
        ])

        psbt.addInput({
          hash: gatheredUtxos.utxos[i].txId,
          index: gatheredUtxos.utxos[i].outputIndex,
          sequence: 0xfffffffd,
          redeemScript: redeemScript,
          witnessUtxo: {
            value: gatheredUtxos.utxos[i].satoshis,
            script: bitcoin.script.compile([
              bitcoin.opcodes.OP_HASH160,
              bitcoin.crypto.hash160(redeemScript),
              bitcoin.opcodes.OP_EQUAL,
            ]),
          },
        })
      }
      if (
        getAddressType(gatheredUtxos.utxos[i].address) === 1 ||
        getAddressType(gatheredUtxos.utxos[i].address) === 3
      ) {
        psbt.addInput({
          hash: gatheredUtxos.utxos[i].txId,
          index: gatheredUtxos.utxos[i].outputIndex,
          sequence: 0xfffffffd,
          witnessUtxo: {
            value: gatheredUtxos.utxos[i].satoshis,
            script: Buffer.from(gatheredUtxos.utxos[i].scriptPk, 'hex'),
          },
        })
      }
    }

    psbt.addOutput({
      address: account.taproot.address,
      value: 546,
    })

    const output = { script: protostone, value: 0 }
    psbt.addOutput(output)

    const changeAmount = Math.floor(
      gatheredUtxos.totalAmount +
      (alkaneUtxos?.totalSatoshis || 0) -
      finalFee -
      546 -
      (frontendFee || 0)
    )

    // 只有当找零金额大于dust限制时才添加找零输出
    if (changeAmount >= 546) {
      psbt.addOutput({
        address: account[account.spendStrategy.changeAddress].address,
        value: changeAmount,
      })
    }

    if (frontendFee && feeAddress) {
      psbt.addOutput({
        address: feeAddress,
        value: frontendFee,
      })
    }

    const formattedPsbtTx = await formatInputsToSign({
      _psbt: psbt,
      senderPublicKey: account.taproot.pubkey,
      network: provider.network,
    })

    return {
      psbt: formattedPsbtTx.toBase64(),
      psbtHex: formattedPsbtTx.toHex(),
    }
  } catch (error) {
    throw new OylTransactionError(error)
  }
}

export const createDeployCommitPsbt = async ({
  payload,
  gatheredUtxos,
  tweakedPublicKey,
  account,
  provider,
  feeRate,
  fee,
}: {
  payload: AlkanesPayload
  gatheredUtxos: GatheredUtxos
  tweakedPublicKey: string
  account: Account
  provider: Provider
  feeRate?: number
  fee?: number
}) => {
  try {
    const originalGatheredUtxos = gatheredUtxos

    const minFee = minimumFee({
      taprootInputCount: 2,
      nonTaprootInputCount: 0,
      outputCount: 2,
    })
    const calculatedFee = Math.ceil(minFee * feeRate < 250 ? 250 : minFee * feeRate)
    let finalFee = fee ? fee : calculatedFee

    let psbt = new bitcoin.Psbt({ network: provider.network })

    const script = Buffer.from(
      p2tr_ord_reveal(toXOnly(Buffer.from(tweakedPublicKey, 'hex')), [payload])
        .script
    )

    const inscriberInfo = bitcoin.payments.p2tr({
      internalPubkey: toXOnly(Buffer.from(tweakedPublicKey, 'hex')),
      scriptTree: {
        output: script,
      },
      network: provider.network,
    })

    const wasmDeploySize = getVSize(Buffer.from(payload.body)) * feeRate

    gatheredUtxos = findXAmountOfSats(
      originalGatheredUtxos.utxos,
      wasmDeploySize + Number(inscriptionSats) + finalFee * 2
    )

    if (!fee && gatheredUtxos.utxos.length > 1) {
      const txSize = minimumFee({
        taprootInputCount: gatheredUtxos.utxos.length,
        nonTaprootInputCount: 0,
        outputCount: 2,
      })
      finalFee = Math.ceil(txSize * feeRate < 250 ? 250 : txSize * feeRate)

      if (gatheredUtxos.totalAmount < finalFee) {
        gatheredUtxos = findXAmountOfSats(
          originalGatheredUtxos.utxos,
          wasmDeploySize + Number(inscriptionSats) + finalFee * 2
        )
      }
    }

    for (let i = 0; i < gatheredUtxos.utxos.length; i++) {
      if (getAddressType(gatheredUtxos.utxos[i].address) === 0) {
        const previousTxHex: string = await provider.esplora.getTxHex(
          gatheredUtxos.utxos[i].txId
        )
        psbt.addInput({
          hash: gatheredUtxos.utxos[i].txId,
          index: gatheredUtxos.utxos[i].outputIndex,
          sequence: 0xfffffffd,
          nonWitnessUtxo: Buffer.from(previousTxHex, 'hex'),
        })
      }
      if (getAddressType(gatheredUtxos.utxos[i].address) === 2) {
        const redeemScript = bitcoin.script.compile([
          bitcoin.opcodes.OP_0,
          bitcoin.crypto.hash160(
            Buffer.from(account.nestedSegwit.pubkey, 'hex')
          ),
        ])

        psbt.addInput({
          hash: gatheredUtxos.utxos[i].txId,
          index: gatheredUtxos.utxos[i].outputIndex,
          sequence: 0xfffffffd,
          redeemScript: redeemScript,
          witnessUtxo: {
            value: gatheredUtxos.utxos[i].satoshis,
            script: bitcoin.script.compile([
              bitcoin.opcodes.OP_HASH160,
              bitcoin.crypto.hash160(redeemScript),
              bitcoin.opcodes.OP_EQUAL,
            ]),
          },
        })
      }
      if (
        getAddressType(gatheredUtxos.utxos[i].address) === 1 ||
        getAddressType(gatheredUtxos.utxos[i].address) === 3
      ) {
        psbt.addInput({
          hash: gatheredUtxos.utxos[i].txId,
          index: gatheredUtxos.utxos[i].outputIndex,
          sequence: 0xfffffffd,
          witnessUtxo: {
            value: gatheredUtxos.utxos[i].satoshis,
            script: Buffer.from(gatheredUtxos.utxos[i].scriptPk, 'hex'),
          },
        })
      }
    }

    if (
      gatheredUtxos.totalAmount <
      finalFee * 2 + inscriptionSats + wasmDeploySize
    ) {
      throw new OylTransactionError(Error('Insufficient Balance'))
    }

    psbt.addOutput({
      value: finalFee + wasmDeploySize + 546,
      address: inscriberInfo.address,
    })

    const changeAmount = Math.floor(
      gatheredUtxos.totalAmount -
      (finalFee * 2 + wasmDeploySize + inscriptionSats)
    )

    // 只有当找零金额大于dust限制时才添加找零输出
    if (changeAmount >= 546) {
      psbt.addOutput({
        address: account[account.spendStrategy.changeAddress].address,
        value: changeAmount,
      })
    }

    const formattedPsbtTx = await formatInputsToSign({
      _psbt: psbt,
      senderPublicKey: account.taproot.pubkey,
      network: provider.network,
    })

    return { psbt: formattedPsbtTx.toBase64(), script }
  } catch (error) {
    throw new OylTransactionError(error)
  }
}

export const deployCommit = async ({
  payload,
  gatheredUtxos,
  account,
  provider,
  feeRate,
  signer,
}: {
  payload: AlkanesPayload
  gatheredUtxos: GatheredUtxos
  account: Account
  provider: Provider
  feeRate?: number
  signer: Signer
}) => {
  const tweakedTaprootKeyPair: bitcoin.Signer = tweakSigner(
    signer.taprootKeyPair,
    {
      network: provider.network,
    }
  )

  const tweakedPublicKey = tweakedTaprootKeyPair.publicKey.toString('hex')

  const { fee: commitFee } = await actualDeployCommitFee({
    payload,
    gatheredUtxos,
    tweakedPublicKey,
    account,
    provider,
    feeRate,
  })

  const { psbt: finalPsbt, script } = await createDeployCommitPsbt({
    payload,
    gatheredUtxos,
    tweakedPublicKey,
    account,
    provider,
    feeRate,
    fee: commitFee,
  })

  const { signedPsbt } = await signer.signAllInputs({
    rawPsbt: finalPsbt,
    finalize: true,
  })

  const result = await provider.pushPsbt({
    psbtBase64: signedPsbt,
  })

  return { ...result, script: script.toString('hex') }
}

export const createDeployRevealPsbt = async ({
  protostone,
  receiverAddress,
  script,
  feeRate,
  tweakedPublicKey,
  provider,
  fee = 0,
  commitTxId,
}: {
  protostone: Buffer
  receiverAddress: string
  script: Buffer
  feeRate: number
  tweakedPublicKey: string
  provider: Provider
  fee?: number
  commitTxId: string
}) => {
  try {
    if (!feeRate) {
      feeRate = (await provider.esplora.getFeeEstimates())['1']
    }

    const psbt: bitcoin.Psbt = new bitcoin.Psbt({ network: provider.network })
    const minFee = minimumFee({
      taprootInputCount: 1,
      nonTaprootInputCount: 0,
      outputCount: 2,
    })

    const revealTxBaseFee = minFee * feeRate < 250 ? 250 : minFee * feeRate
    const revealTxChange = fee === 0 ? 0 : Number(revealTxBaseFee) - fee

    const commitTxOutput = await getOutputValueByVOutIndex({
      txId: commitTxId,
      vOut: 0,
      esploraRpc: provider.esplora,
    })

    if (!commitTxOutput) {
      throw new OylTransactionError(new Error('Error getting vin #0 value'))
    }

    const p2pk_redeem = { output: script }

    const { output, witness } = bitcoin.payments.p2tr({
      internalPubkey: toXOnly(Buffer.from(tweakedPublicKey, 'hex')),
      scriptTree: p2pk_redeem,
      redeem: p2pk_redeem,
      network: provider.network,
    })

    psbt.addInput({
      hash: commitTxId,
      index: 0,
      witnessUtxo: {
        value: commitTxOutput.value,
        script: output,
      },
      tapLeafScript: [
        {
          leafVersion: LEAF_VERSION_TAPSCRIPT,
          script: p2pk_redeem.output,
          controlBlock: witness![witness!.length - 1],
        },
      ],
    })

    psbt.addOutput({
      value: 546,
      address: receiverAddress,
    })

    psbt.addOutput({
      value: 0,
      script: protostone,
    })

    if (revealTxChange > 546) {
      psbt.addOutput({
        value: revealTxChange,
        address: receiverAddress,
      })
    }

    return {
      psbt: psbt.toBase64(),
      fee: revealTxChange,
    }
  } catch (error) {
    throw new OylTransactionError(error)
  }
}

export const deployReveal = async ({
  protostone,
  commitTxId,
  script,
  account,
  provider,
  feeRate,
  signer,
}: {
  protostone: Buffer
  commitTxId: string
  script: string
  account: Account
  provider: Provider
  feeRate?: number
  signer: Signer
}) => {
  const tweakedTaprootKeyPair: bitcoin.Signer = tweakSigner(
    signer.taprootKeyPair,
    {
      network: provider.network,
    }
  )

  const tweakedPublicKey = tweakedTaprootKeyPair.publicKey.toString('hex')

  const { fee } = await actualTransactRevealFee({
    protostone,
    tweakedPublicKey,
    receiverAddress: account.taproot.address,
    commitTxId,
    script: Buffer.from(script, 'hex'),
    provider,
    feeRate,
  })

  const { psbt: finalRevealPsbt } = await createTransactReveal({
    protostone,
    tweakedPublicKey,
    receiverAddress: account.taproot.address,
    commitTxId,
    script: Buffer.from(script, 'hex'),
    provider,
    feeRate,
    fee,
  })

  let finalReveal = bitcoin.Psbt.fromBase64(finalRevealPsbt, {
    network: provider.network,
  })

  finalReveal.signInput(0, tweakedTaprootKeyPair)
  finalReveal.finalizeInput(0)

  const finalSignedPsbt = finalReveal.toBase64()

  const revealResult = await provider.pushPsbt({
    psbtBase64: finalSignedPsbt,
  })

  return revealResult
}

export const findAlkaneUtxos = async ({
  address,
  greatestToLeast,
  provider,
  alkaneId,
  targetNumberOfAlkanes,
}: {
  address: string
  greatestToLeast: boolean
  provider: Provider
  alkaneId: { block: string; tx: string }
  targetNumberOfAlkanes: number
}) => {
  const res: Outpoint[] = await provider.alkanes.getAlkanesByAddress({
    address: address,
    protocolTag: '1',
  })

  const matchingRunesWithOutpoints = res.flatMap((outpoint) =>
    outpoint.runes
      .filter(
        (value) =>
          Number(value.rune.id.block) === Number(alkaneId.block) &&
          Number(value.rune.id.tx) === Number(alkaneId.tx)
      )
      .map((rune) => ({ rune, outpoint }))
  )

  const sortedRunesWithOutpoints = matchingRunesWithOutpoints.sort((a, b) =>
    greatestToLeast
      ? Number(b.rune.balance) - Number(a.rune.balance)
      : Number(a.rune.balance) - Number(b.rune.balance)
  )

  let totalSatoshis: number = 0
  let totalBalanceBeingSent: number = 0
  const alkaneUtxos: {
    txId: string
    txIndex: number
    script: string
    address: string
    amountOfAlkanes: string
    satoshis: number
  }[] = []

  for (const alkane of sortedRunesWithOutpoints) {
    if (
      totalBalanceBeingSent < targetNumberOfAlkanes &&
      Number(alkane.rune.balance) > 0
    ) {
      const satoshis = Number(alkane.outpoint.output.value)
      alkaneUtxos.push({
        txId: alkane.outpoint.outpoint.txid,
        txIndex: alkane.outpoint.outpoint.vout,
        script: alkane.outpoint.output.script,
        address,
        amountOfAlkanes: alkane.rune.balance,
        satoshis,
        ...alkane.rune.rune,
      })
      totalSatoshis += satoshis
      totalBalanceBeingSent +=
        Number(alkane.rune.balance) /
        (alkane.rune.rune.divisibility == 1
          ? 1
          : 10 ** alkane.rune.rune.divisibility)
    }
  }
  if (totalBalanceBeingSent < targetNumberOfAlkanes) {
    throw new OylTransactionError(Error('Insuffiecient balance of alkanes.'))
  }
  return { alkaneUtxos, totalSatoshis, totalBalanceBeingSent }
}

export const actualTransactRevealFee = async ({
  protostone,
  tweakedPublicKey,
  commitTxId,
  receiverAddress,
  script,
  provider,
  feeRate,
}: {
  protostone: Buffer
  tweakedPublicKey: string
  commitTxId: string
  receiverAddress: string
  script: Buffer
  provider: Provider
  feeRate?: number
}) => {
  if (!feeRate) {
    feeRate = (await provider.esplora.getFeeEstimates())['1']
  }

  const { psbt } = await createTransactReveal({
    protostone,
    commitTxId,
    receiverAddress,
    script,
    tweakedPublicKey,
    provider,
    feeRate,
  })

  const { fee: estimatedFee } = await getEstimatedFee({
    feeRate,
    psbt,
    provider,
  })

  const { psbt: finalPsbt } = await createTransactReveal({
    protostone,
    commitTxId,
    receiverAddress,
    script,
    tweakedPublicKey,
    provider,
    feeRate,
    fee: estimatedFee,
  })

  const { fee: finalFee, vsize } = await getEstimatedFee({
    feeRate,
    psbt: finalPsbt,
    provider,
  })

  return { fee: finalFee, vsize }
}

export const actualExecuteFee = async ({
  gatheredUtxos,
  account,
  protostone,
  provider,
  feeRate,
  alkaneUtxos,
  frontendFee,
  feeAddress,
}: {
  gatheredUtxos: GatheredUtxos
  account: Account
  protostone: Buffer
  provider: Provider
  feeRate: number
  alkaneUtxos?: {
    alkaneUtxos: any[]
    totalSatoshis: number
  }
  frontendFee?: number
  feeAddress?: string
}) => {
  if (!feeRate) {
    feeRate = (await provider.esplora.getFeeEstimates())['1']
  }

  const { psbt } = await createExecutePsbt({
    frontendFee,
    feeAddress,
    gatheredUtxos,
    account,
    protostone,
    provider,
    feeRate,
    alkaneUtxos,
  })

  const { fee: estimatedFee } = await getEstimatedFee({
    feeRate,
    psbt,
    provider,
  })

  const { psbt: finalPsbt } = await createExecutePsbt({
    frontendFee,
    feeAddress,
    gatheredUtxos,
    account,
    protostone,
    provider,
    feeRate,
    alkaneUtxos,
    fee: estimatedFee,
  })

  const { fee: finalFee, vsize } = await getEstimatedFee({
    feeRate,
    psbt: finalPsbt,
    provider,
  })

  return { fee: finalFee, vsize }
}

export const executePsbt = async ({
  alkaneUtxos,
  gatheredUtxos,
  account,
  protostone,
  provider,
  feeRate,
  frontendFee,
  feeAddress,
}: {
  alkaneUtxos?: {
    alkaneUtxos: any[]
    totalSatoshis: number
  }
  gatheredUtxos: GatheredUtxos
  account: Account
  protostone: Buffer
  provider: Provider
  feeRate?: number
  frontendFee?: number
  feeAddress?: string
}) => {
  const { fee } = await actualExecuteFee({
    frontendFee,
    feeAddress,
    alkaneUtxos,
    gatheredUtxos,
    account,
    protostone,
    provider,
    feeRate,
  })

  const { psbt: finalPsbt } = await createExecutePsbt({
    frontendFee,
    feeAddress,
    alkaneUtxos,
    gatheredUtxos,
    account,
    protostone,
    provider,
    feeRate,
    fee,
  })

  return { psbt: finalPsbt, fee }
}

export const execute = async ({
  alkaneUtxos,
  gatheredUtxos,
  account,
  protostone,
  provider,
  feeRate,
  signer,
  frontendFee,
  feeAddress,
  noBroadcast,
}: {
  alkaneUtxos?: {
    alkaneUtxos: any[]
    totalSatoshis: number
  }
  gatheredUtxos: GatheredUtxos
  account: Account
  protostone: Buffer
  provider: Provider
  feeRate?: number
  signer: Signer
  frontendFee?: number
  feeAddress?: string
  noBroadcast?: boolean
}) => {
  const { fee } = await actualExecuteFee({
    frontendFee,
    feeAddress,
    alkaneUtxos,
    gatheredUtxos,
    account,
    protostone,
    provider,
    feeRate,
  })

  const { psbt: finalPsbt } = await createExecutePsbt({
    frontendFee,
    feeAddress,
    alkaneUtxos,
    gatheredUtxos,
    account,
    protostone,
    provider,
    feeRate,
    fee,
  })

  const { signedPsbt } = await signer.signAllInputs({
    rawPsbt: finalPsbt,
    finalize: true,
  })

  if (noBroadcast) {
    const psbt = bitcoin.Psbt.fromBase64(signedPsbt, {
      network: provider.network,
    })
    const extractedTx = psbt.extractTransaction()
    const txId = extractedTx.getId()
    const rawTx = extractedTx.toHex()
    
    const size = extractedTx.byteLength()
    const weight = extractedTx.weight()
    const vsize = Math.ceil(weight / 4)
    
    return {
      txId,
      rawTx,
      size,
      weight,
      fee: fee,
      satsPerVByte: (fee / vsize).toFixed(2),
      psbtBase64: signedPsbt,
      message: '✅ 交易已签名但未广播。你可以使用 rawTx 手动广播交易到比特币网络。'
    }
  }

  const pushResult = await provider.pushPsbt({
    psbtBase64: signedPsbt,
  })

  return pushResult
}

export const createTransactReveal = async ({
  protostone,
  receiverAddress,
  script,
  feeRate,
  tweakedPublicKey,
  provider,
  fee = 0,
  commitTxId,
}: {
  protostone: Buffer
  receiverAddress: string
  script: Buffer
  feeRate: number
  tweakedPublicKey: string
  provider: Provider
  fee?: number
  commitTxId: string
}) => {
  try {
    if (!feeRate) {
      feeRate = (await provider.esplora.getFeeEstimates())['1']
    }

    const psbt: bitcoin.Psbt = new bitcoin.Psbt({ network: provider.network })
    const minFee = minimumFee({
      taprootInputCount: 1,
      nonTaprootInputCount: 0,
      outputCount: 2,
    })

    const revealTxBaseFee = minFee * feeRate < 250 ? 250 : minFee * feeRate
    const revealTxChange = fee === 0 ? 0 : Number(revealTxBaseFee) - fee

    const commitTxOutput = await getOutputValueByVOutIndex({
      txId: commitTxId,
      vOut: 0,
      esploraRpc: provider.esplora,
    })

    if (!commitTxOutput) {
      throw new OylTransactionError(new Error('Error getting vin #0 value'))
    }

    const p2pk_redeem = { output: script }

    const { output, witness } = bitcoin.payments.p2tr({
      internalPubkey: toXOnly(Buffer.from(tweakedPublicKey, 'hex')),
      scriptTree: p2pk_redeem,
      redeem: p2pk_redeem,
      network: provider.network,
    })

    psbt.addInput({
      hash: commitTxId,
      index: 0,
      witnessUtxo: {
        value: commitTxOutput.value,
        script: output,
      },
      tapLeafScript: [
        {
          leafVersion: LEAF_VERSION_TAPSCRIPT,
          script: p2pk_redeem.output,
          controlBlock: witness![witness!.length - 1],
        },
      ],
    })

    psbt.addOutput({
      value: 546,
      address: receiverAddress,
    })

    psbt.addOutput({
      value: 0,
      script: protostone,
    })

    if (revealTxChange > 546) {
      psbt.addOutput({
        value: revealTxChange,
        address: receiverAddress,
      })
    }

    return {
      psbt: psbt.toBase64(),
      fee: revealTxChange,
    }
  } catch (error) {
    throw new OylTransactionError(error)
  }
}

/**
 * Calculate the correct fee for bumping a transaction fee
 * @param txid - Transaction ID to bump
 * @param account - Wallet account
 * @param provider - Network provider
 * @param newFeeRate - New fee rate in sat/vB
 * @param signer - Wallet signer
 * @returns Object containing the calculated fee
 */
export const actualBumpFeeFee = async ({
  txid,
  account,
  provider,
  newFeeRate,
  signer,
}: {
  txid: string
  account: Account
  provider: Provider
  newFeeRate: number
  signer: Signer
}) => {
  if (!newFeeRate) {
    newFeeRate = (await provider.esplora.getFeeEstimates())['1']
  }

  const { psbt } = await createBumpFeePsbt({
    txid,
    account,
    provider,
    newFeeRate,
  })

  const { signedPsbt } = await signer.signAllInputs({
    rawPsbt: psbt,
    finalize: true,
  })

  let rawPsbt = bitcoin.Psbt.fromBase64(signedPsbt, {
    network: account.network,
  })
    .extractTransaction()
    .toHex()

  const vsize = (
    await provider.sandshrew.bitcoindRpc.testMemPoolAccept([rawPsbt])
  )[0].vsize

  const correctFee = vsize * newFeeRate

  return { fee: correctFee }
}

/**
 * Create a PSBT for bumping transaction fee
 * @param txid - Transaction ID to bump
 * @param account - Wallet account
 * @param provider - Network provider
 * @param newFeeRate - New fee rate in sat/vB
 * @param fee - Optional specific fee amount (if not provided, calculated from newFeeRate)
 * @returns Object containing the base64 encoded PSBT
 */
export const createBumpFeePsbt = async ({
  txid,
  account,
  provider,
  newFeeRate,
  fee = 0,
}: {
  txid: string
  account: Account
  provider: Provider
  newFeeRate: number
  fee?: number
}) => {
  try {
    // Get transaction information and raw hex
    const txInfo = await provider.esplora.getTxInfo(txid)
    const txHex = await provider.esplora.getTxHex(txid)
    const tx = bitcoin.Transaction.fromHex(txHex)
    
    let psbt = new bitcoin.Psbt({ network: provider.network })
    
    // Add all inputs from the original transaction
    for (let i = 0; i < tx.ins.length; i++) {
      const input = tx.ins[i]
      const vin = txInfo.vin[i]
      
      psbt.addInput({
        hash: input.hash.reverse().toString('hex'),
        index: input.index,
        sequence: 0xfffffffd, // Enable RBF
        witnessUtxo: {
          script: Buffer.from(vin.prevout.scriptpubkey, 'hex'),
          value: vin.prevout.value,
        }
      })
    }

    // Add all outputs except the last one (change output) without modification
    for (let i = 0; i < tx.outs.length - 1; i++) {
      psbt.addOutput({
        script: tx.outs[i].script,
        value: tx.outs[i].value
      })
    }

    // Modify the change output with the new fee
    const changeOutput = tx.outs[tx.outs.length - 1]
    const finalFee = fee === 0 ? newFeeRate * tx.virtualSize() : fee
    
    psbt.addOutput({
      script: changeOutput.script,
      value: changeOutput.value - (finalFee - txInfo.fee)
    })

    return { psbt: psbt.toBase64() }
  } catch (error) {
    throw new OylTransactionError(error)
  }
}

/**
 * Bump the fee of a transaction using RBF
 * @param txid - Transaction ID to bump
 * @param newFeeRate - New fee rate in sat/vB
 * @param account - Wallet account
 * @param provider - Network provider
 * @param signer - Wallet signer
 * @returns Result of the transaction broadcast
 */
export const bumpFee = async ({
  txid,
  newFeeRate,
  account,
  provider,
  signer,
}: {
  txid: string
  newFeeRate: number
  account: Account
  provider: Provider
  signer: Signer
}) => {
  // First calculate the exact fee needed
  const { fee } = await actualBumpFeeFee({
    txid,
    account,
    provider,
    newFeeRate,
    signer,
  })

  // Create the PSBT with the calculated fee
  const { psbt: finalPsbt } = await createBumpFeePsbt({
    txid,
    account,
    provider,
    newFeeRate,
    fee,
  })

  // Sign all inputs
  const { signedPsbt } = await signer.signAllInputs({
    rawPsbt: finalPsbt,
    finalize: true,
  })

  // Broadcast the transaction
  const result = await provider.pushPsbt({
    psbtBase64: signedPsbt,
  })

  return result
}

/**
 * 获取指定地址的UTXO
 */
export const getCustomAddressUtxos = async ({
  address,
  provider,
}: {
  address: string
  provider: Provider
}) => {
  try {
    const multiCall = await provider.sandshrew.multiCall([
      ['esplora_address::utxo', [address]],
      ['btc_getblockcount', []],
    ])

    const utxos = multiCall[0].result as any[]
    
    if (!utxos || !Array.isArray(utxos) || utxos.length === 0) {
      return { utxos: [], totalAmount: 0 }
    }

    const formattedUtxos = []
    
    for (const utxo of utxos) {
      try {
        const txDetails = await provider.sandshrew.multiCall([
          ['esplora_tx', [utxo.txid]],
        ])
        
        const txData = txDetails[0].result
        const scriptPk = txData.vout[utxo.vout].scriptpubkey
        
        formattedUtxos.push({
          txId: utxo.txid,
          outputIndex: utxo.vout,
          satoshis: utxo.value,
          address: address,
          scriptPk: scriptPk,
        })
      } catch (error) {
        console.warn(`处理UTXO ${utxo.txid}:${utxo.vout} 失败:`, error)
        continue
      }
    }

    const totalAmount = formattedUtxos.reduce((sum: number, utxo: any) => sum + utxo.satoshis, 0)

    return {
      utxos: formattedUtxos,
      totalAmount,
    }
  } catch (error) {
    console.warn(`获取地址 ${address} 的UTXO失败:`, error)
    return { utxos: [], totalAmount: 0 }
  }
}

/**
 * 自定义ACAI执行函数 - 支持指定付款地址和找零地址
 */
export const customAcaiExecute = async ({
  paymentAddress,
  changeAddress,
  account,
  protostone,
  provider,
  feeRate,
  signer,
  noBroadcast,
}: {
  paymentAddress: string
  changeAddress: string
  account: Account
  protostone: Buffer
  provider: Provider
  feeRate?: number
  signer: Signer
  noBroadcast?: boolean
}) => {
  try {
    console.log(`📍 使用付款地址: ${paymentAddress}`)
    console.log(`📍 ACAI mint接收地址: ${changeAddress}`)
    
    // 获取付款地址的UTXO
    const { utxos: paymentUtxos, totalAmount } = await getCustomAddressUtxos({
      address: paymentAddress,
      provider,
    })
    
    console.log(`💰 付款地址余额: ${totalAmount} sats`)
    console.log(`📦 可用UTXO数量: ${paymentUtxos.length}`)
    
    if (paymentUtxos.length === 0) {
      throw new Error(`付款地址 ${paymentAddress} 没有可用的UTXO`)
    }
    
    if (totalAmount < 5000) { // 至少需要5000 sats来支付费用
      throw new Error(`付款地址余额不足，当前: ${totalAmount} sats，建议至少: 5000 sats`)
    }

    const gatheredUtxos = {
      utxos: paymentUtxos,
      totalAmount,
    }

    // 计算费用
    const { totalFee } = await customAcaiExecuteFee({
      gatheredUtxos,
      account,
      protostone,
      provider,
      feeRate: feeRate || 2,
      paymentAddress,
      changeAddress,
    })

    console.log(`⛽ 预估费用: ${totalFee} sats (包含${FARTANE_FEE} sats FARTANE费用)`)

    // 创建自定义PSBT
    const psbt = await createCustomAcaiPsbt({
      gatheredUtxos,
      account,
      protostone,
      provider,
      feeRate: feeRate || 2,
      fee: totalFee,
      paymentAddress,
      changeAddress,
    })

    const { signedPsbt } = await signer.signAllInputs({
      rawPsbt: psbt,
      finalize: true,
    })

    if (noBroadcast) {
      const psbtObj = bitcoin.Psbt.fromBase64(signedPsbt, {
        network: provider.network,
      })
      const extractedTx = psbtObj.extractTransaction()
      const txId = extractedTx.getId()
      const rawTx = extractedTx.toHex()
      
      const size = extractedTx.byteLength()
      const weight = extractedTx.weight()
      const vsize = Math.ceil(weight / 4)
      
      return {
        txId,
        rawTx,
        size,
        weight,
        fee: totalFee,
        satsPerVByte: (totalFee / vsize).toFixed(2),
        psbtBase64: signedPsbt,
        fartaneFee: FARTANE_FEE,
        paymentAddress,
        changeAddress,
        message: `✅ 自定义ACAI交易已签名但未广播`,
      }
    }

    const pushResult = await provider.pushPsbt({
      psbtBase64: signedPsbt,
    })

    return {
      ...pushResult,
      fartaneFee: FARTANE_FEE,
      paymentAddress,
      changeAddress,
      note: `ACAI mint交易已提交，使用自定义地址`,
    }
  } catch (error) {
    throw new OylTransactionError(error)
  }
}

/**
 * 创建自定义ACAI PSBT
 */
export const createCustomAcaiPsbt = async ({
  gatheredUtxos,
  account,
  protostone,
  provider,
  feeRate,
  fee = 0,
  paymentAddress,
  changeAddress,
}: {
  gatheredUtxos: { utxos: any[]; totalAmount: number }
  account: Account
  protostone: Buffer
  provider: Provider
  feeRate?: number
  fee?: number
  paymentAddress: string
  changeAddress: string
}) => {
  try {
    const psbt = new bitcoin.Psbt({ network: provider.network })
    const finalFee = fee

    // 添加输入
    for (let i = 0; i < gatheredUtxos.utxos.length; i++) {
      const utxo = gatheredUtxos.utxos[i]
      
      // 获取前一个交易的完整数据
      const previousTxResponse = await provider.esplora._call('esplora_tx', [utxo.txId])
      const previousTxHex = previousTxResponse.hex

      // 根据地址类型添加不同的输入
      const addressType = getAddressType(utxo.address)
      
      if (addressType === 0) { // Legacy
        psbt.addInput({
          hash: utxo.txId,
          index: utxo.outputIndex,
          sequence: 0xfffffffd,
          nonWitnessUtxo: Buffer.from(previousTxHex, 'hex'),
        })
      } else if (addressType === 1 || addressType === 3) { // Native SegWit or Taproot
        psbt.addInput({
          hash: utxo.txId,
          index: utxo.outputIndex,
          sequence: 0xfffffffd,
          witnessUtxo: {
            value: utxo.satoshis,
            script: Buffer.from(utxo.scriptPk, 'hex'),
          },
        })
      } else if (addressType === 2) { // Nested SegWit
        const redeemScript = bitcoin.script.compile([
          bitcoin.opcodes.OP_0,
          bitcoin.crypto.hash160(
            Buffer.from(account.nestedSegwit.pubkey, 'hex')
          ),
        ])

        psbt.addInput({
          hash: utxo.txId,
          index: utxo.outputIndex,
          sequence: 0xfffffffd,
          redeemScript: redeemScript,
          witnessUtxo: {
            value: utxo.satoshis,
            script: bitcoin.script.compile([
              bitcoin.opcodes.OP_HASH160,
              bitcoin.crypto.hash160(redeemScript),
              bitcoin.opcodes.OP_EQUAL,
            ]),
          },
        })
      }
    }

    // 输出1：ACAI mint输出 (546 sats) - 发送到changeAddress (即ACAI接收地址)
    psbt.addOutput({
      address: changeAddress,
      value: 546,
    })

    // 输出2：protostone消息 (0 sats)
    const output = { script: protostone, value: 0 }
    psbt.addOutput(output)

    // 输出3：FARTANE费用 (1069 sats) - 这是ACAI合约的关键要求！
    psbt.addOutput({
      address: FARTANE_ADDRESS,
      value: FARTANE_FEE,
    })

    // 计算找零金额 - 剩余的BTC返回到付款地址
    const changeAmount = Math.floor(
      gatheredUtxos.totalAmount - finalFee - 546 - FARTANE_FEE
    )

    // 输出4：找零输出（如果金额足够）- 返回到付款地址
    if (changeAmount >= 546) {
      psbt.addOutput({
        address: paymentAddress, // 找零返回到付款地址
        value: changeAmount,
      })
    }

    const formattedPsbtTx = await formatInputsToSign({
      _psbt: psbt,
      senderPublicKey: account.taproot.pubkey,
      network: provider.network,
    })

    return formattedPsbtTx.toBase64()
  } catch (error) {
    throw new OylTransactionError(error)
  }
}

/**
 * 计算自定义ACAI交易的费用
 */
export const customAcaiExecuteFee = async ({
  gatheredUtxos,
  account,
  protostone,
  provider,
  feeRate,
  paymentAddress,
  changeAddress,
}: {
  gatheredUtxos: { utxos: any[]; totalAmount: number }
  account: Account
  protostone: Buffer
  provider: Provider
  feeRate: number
  paymentAddress: string
  changeAddress: string
}) => {
  // 使用与actualExecuteFee相同的精确计算方法
  const psbtBase64 = await createCustomAcaiPsbt({
    gatheredUtxos,
    account,
    protostone,
    provider,
    feeRate: 1, // 使用1作为临时费率计算大小
    fee: 0,
    paymentAddress,
    changeAddress,
  })

  const { fee: estimatedFee, vsize } = await getEstimatedFee({
    feeRate,
    psbt: psbtBase64,
    provider,
  })

  // 创建最终的PSBT来获取精确费用
  const finalPsbtBase64 = await createCustomAcaiPsbt({
    gatheredUtxos,
    account,
    protostone,
    provider,
    feeRate,
    fee: estimatedFee,
    paymentAddress,
    changeAddress,
  })

  const { fee: finalFee, vsize: finalVsize } = await getEstimatedFee({
    feeRate,
    psbt: finalPsbtBase64,
    provider,
  })

  return {
    totalFee: finalFee,
    vSize: finalVsize,
    feeRate,
    fartaneFee: FARTANE_FEE,
    note: `自定义ACAI交易，包含${FARTANE_FEE} sats的FARTANE费用`,
  }
}
