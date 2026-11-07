export type WalletConnector = {
  id: string;
  uid: string;
  name: string;
  type: string;
  icon?: string;
};
export type WalletAccount = { address?: string; chainId?: number; status: string };
export type DecodedEvent = {
  name: string;
  contract: string;
  args: Record<string, string>;
  logIndex: string;
};
export type RawLog = {
  address: string;
  data: string;
  topics: string[];
  logIndex: string;
  removed?: boolean;
};
export type WalletRuntime = {
  account: () => WalletAccount;
  connectors: () => WalletConnector[];
  watchAccount: (fn: (account: WalletAccount) => void) => () => void;
  watchConnectors: (fn: (connectors: WalletConnector[]) => void) => () => void;
  reconnect: () => Promise<unknown>;
  connect: (uid: string) => Promise<unknown>;
  disconnect: () => Promise<void>;
  switchNetwork: () => Promise<unknown>;
  prove: (message: string) => Promise<boolean>;
  decode: (logs: RawLog[]) => DecodedEvent[];
  checksum: (address: string) => string;
  hashCode: (code: string) => string;
};
let runtime: Promise<WalletRuntime> | undefined;
/** Prebundled, locally served official packages; reproducible without changing the game's dependencies. */
export function loadWalletRuntime(): Promise<WalletRuntime> {
  if (!runtime) {
    const url = new URL('./wallet-runtime/index.js', document.baseURI).href;
    runtime = import(/* webpackIgnore: true */ url).catch((error) => {
      runtime = undefined;
      throw error;
    });
  }
  return runtime!;
}
