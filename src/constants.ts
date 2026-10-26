export const BASES_PREFIX: Record<string, number> = {
    "0b": 2,
    "0o": 8,
    "0x": 16,
};

/** Size of an EVM word in bytes. */
export const WORD_BYTES = 32;

/** 2^256 - 1. Every numeric EVM value is normalized into this range. */
export const MAX_UINT256 = (1n << 256n) - 1n;

/** 2^255, the most significant bit of a 256 bit word. */
export const SIGN_BIT_256 = 1n << 255n;

/** 2^160 - 1, the mask used by the `AND` address detection heuristic. */
export const ADDRESS_MASK = (1n << 160n) - 1n;

/** Default maximum recursive depth used while following jumps. */
export const DEFAULT_MAX_DEPTH = 100;

/**
 * Description used for the 4 byte function selector (`calldataload(0)` shifted
 * down by 224 bits). Also used to recognise dispatch comparisons.
 */
export const SELECTOR_DESCRIPTION = "msg.sig";
