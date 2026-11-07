/** Official Sepolia release: https://docs.squeekchain.com/assets/deployments/sepolia.json */
export const NETWORK = {
  id: 11155111,
  hexId: '0xaa36a7',
  name: 'Sepolia',
  rpc: 'https://eth-sepolia.blockscout.com/api/eth-rpc',
  explorer: 'https://eth-sepolia.blockscout.com',
  coreImplementation: '0x6869d6102696243fd17013ab955d99cd0c522ad3',
  coreRuntimeHash: '0x65b5780a4fccafedeca1260806364d2bb512b4501c097253f792ae2839565a9c',
} as const;
export const shortAddress = (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`;
export const txLink = (hash: string) => `${NETWORK.explorer}/tx/${hash}`;
export const addressLink = (address: string) => `${NETWORK.explorer}/address/${address}`;
export const isAddress = (value: string) =>
  /^0x[0-9a-fA-F]{40}$/.test(value) && !/^0x0{40}$/i.test(value);
export const isHash = (value: string) => /^0x[0-9a-fA-F]{64}$/.test(value);
