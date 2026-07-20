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

export function computeOptionPrices<T extends { pool: unknown }>(options: T[]): (T & { price: number })[] {
  const pools = options.map((o) => Number(o.pool));
  const total = pools.reduce((sum, p) => sum + p, 0);
  return options.map((option, i) => ({
    ...option,
    price: Number((total > 0 ? pools[i] / total : 1 / options.length).toFixed(4)),
  }));
}
