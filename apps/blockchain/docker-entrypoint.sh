#!/bin/sh
set -e

npm install

npx hardhat node --hostname 0.0.0.0 &
NODE_PID=$!

node -e "
const net = require('node:net');
const tryConnect = () => {
  const socket = net.connect(8545, '127.0.0.1', () => {
    socket.end();
    process.exit(0);
  });
  socket.on('error', () => setTimeout(tryConnect, 500));
};
tryConnect();
"

npx hardhat run scripts/deploy.ts --network localhost

wait "$NODE_PID"
