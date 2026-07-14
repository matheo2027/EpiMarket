export function computePrices(pools: { yesPool: unknown; noPool: unknown }) {
  const yesPool = Number(pools.yesPool);
  const noPool = Number(pools.noPool);
  const total = yesPool + noPool;
  const yesPrice = total > 0 ? yesPool / total : 0.5;
  return {
    yesPrice: Number(yesPrice.toFixed(4)),
    noPrice: Number((1 - yesPrice).toFixed(4)),
  };
}
