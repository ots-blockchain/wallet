import { toOts, toNanoOts } from '@otsblockchain/lib/format';
export { toOts, toNanoOts };

/**
 * Shortens a Base58 or hex address for display (e.g. 14XYZ...89AB)
 */
export function shortenAddress(address, prefix = 6, suffix = 6) {
  if (!address || typeof address !== 'string') return '';
  if (address.length <= prefix + suffix) return address;
  return `${address.slice(0, prefix)}...${address.slice(-suffix)}`;
}

/**
 * Formats OTS balance with clean decimal notation
 */
export function formatOtsAmount(nanoAmount) {
  try {
    if (nanoAmount === undefined || nanoAmount === null) return '0';
    const val = typeof nanoAmount === 'bigint' ? nanoAmount : BigInt(nanoAmount);
    const ots = toOts(val);
    // Remove trailing zeroes after decimal point if cleanly divisible
    const parts = ots.split('.');
    if (parts.length === 2) {
      const trimmed = parts[1].replace(/0+$/, '');
      return trimmed.length > 0 ? `${parts[0]}.${trimmed}` : parts[0];
    }
    return ots;
  } catch {
    return '0';
  }
}

/**
 * Formats timestamp into human-readable date & time
 */
export function formatTimestamp(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Helper to serialize objects containing BigInts
 */
export function serializeWithBigInt(value) {
  return JSON.stringify(value, (_, v) =>
    typeof v === 'bigint' ? { __bigint: true, value: v.toString() } : v
  );
}

/**
 * Helper to deserialize JSON containing BigInts
 */
export function deserializeWithBigInt(json) {
  if (typeof json === 'string') {
    return JSON.parse(json, (_, v) =>
      v?.__bigint === true ? BigInt(v.value) : v
    );
  }
  return json;
}

/**
 * Recursive opcode / instruction counter for smart contracts
 */
export function countInstructions(node) {
  if (Array.isArray(node)) {
    const isOpcode = typeof node[0] === 'string';
    let count = isOpcode ? 1 : 0;
    for (const item of node) {
      count += countInstructions(item);
    }
    return count;
  } else if (typeof node === 'object' && node !== null) {
    let count = 0;
    for (const key in node) {
      count += countInstructions(node[key]);
    }
    return count;
  }
  return 0;
}
