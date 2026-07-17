export function toChainAmount(amount: number): bigint {
  return BigInt(Math.round(amount * 100));
}

export function fromChainAmount(units: bigint): number {
  return Number(units) / 100;
}
