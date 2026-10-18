import CryptoUtils from '@otsblockchain/lib/crypto';
import { compile } from '@otsblockchain/lib/compiler';
import { consts, costs } from '@otsblockchain/lib/config';
import { countInstructions } from '../utils/format';

export const EXPLORER_URL = 'https://ots.su';

export const blockchainService = {
  /**
   * Compiles ECMAScript code to OTS AST
   */
  compileContract(sourceCode) {
    try {
      return compile(sourceCode);
    } catch (err) {
      throw new Error(`Compilation error: ${err.message}`);
    }
  },

  /**
   * Calculates deployment cost based on opcode count
   */
  calculateDeployCost(compiledAst) {
    try {
      const count = countInstructions(compiledAst);
      const codeAmount = BigInt(count) * consts.OPCODE_PRICE;
      const totalCost = codeAmount + costs.BASE_FEE;
      return { count, codeAmount, totalCost };
    } catch {
      return { count: 0, codeAmount: 0n, totalCost: costs.BASE_FEE };
    }
  },

  /**
   * Computes expected future contract address
   */
  predictContractAddress(senderPubKeyHex, nonce) {
    return CryptoUtils.hash(senderPubKeyHex + nonce);
  }
};
