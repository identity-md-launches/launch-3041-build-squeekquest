import { useCallback, useEffect, useRef, useState } from 'react';
import { loadWalletRuntime, type WalletAccount, type WalletConnector } from '../web3/runtime';
import { NETWORK } from '../web3/network';

const initial: WalletAccount = { status: 'disconnected' };
export function useWallet() {
  const [account, setAccount] = useState(initial);
  const [connectors, setConnectors] = useState<WalletConnector[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [ready, setReady] = useState(false);
  const [verified, setVerified] = useState<{ address: string; expires: number } | null>(null);
  const current = useRef(account);
  current.current = account;
  useEffect(() => {
    let live = true;
    const stops: (() => void)[] = [];
    void loadWalletRuntime()
      .then(async (sdk) => {
        if (!live) return;
        const update = (next: WalletAccount) => {
          if (!live) return;
          setAccount(next);
          setVerified((v) =>
            v?.address === next.address && next.chainId === NETWORK.id ? v : null,
          );
        };
        update(sdk.account());
        setConnectors(sdk.connectors());
        stops.push(
          sdk.watchAccount(update),
          sdk.watchConnectors((c) => live && setConnectors(c)),
        );
        setReady(true);
        try {
          await sdk.reconnect();
        } catch {
          /* A stale permission needs a new explicit connection. */
        }
      })
      .catch(() => live && setError('Wallet tools could not load. Reload this page to try again.'));
    return () => {
      live = false;
      stops.forEach((stop) => stop());
    };
  }, []);
  useEffect(() => {
    if (!verified) return;
    const timer = setTimeout(() => setVerified(null), Math.max(0, verified.expires - Date.now()));
    return () => clearTimeout(timer);
  }, [verified]);
  const run = useCallback(async (label: string, action: () => Promise<unknown>) => {
    setError('');
    setBusy(label);
    try {
      await action();
    } catch {
      setError('Wallet request was declined or could not finish. Check your wallet and try again.');
    } finally {
      setBusy('');
    }
  }, []);
  const connect = (uid: string) => run(uid, async () => (await loadWalletRuntime()).connect(uid));
  const disconnect = () =>
    run('disconnect', async () => {
      await (await loadWalletRuntime()).disconnect();
      setVerified(null);
    });
  const switchNetwork = () =>
    run('switch', async () => (await loadWalletRuntime()).switchNetwork());
  const prove = () =>
    run('sign', async () => {
      const address = current.current.address;
      if (!address || current.current.chainId !== NETWORK.id) throw new Error('Wrong network');
      const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
        b.toString(16).padStart(2, '0'),
      ).join('');
      const expires = Date.now() + 10 * 60 * 1000;
      const message = [
        `${location.host} wants you to verify this wallet for SqueekQuest:`,
        address,
        '',
        'Link this browser’s local adventure to this wallet for 10 minutes. No transaction, payment or token approval.',
        `URI: ${location.origin}${location.pathname}`,
        'Version: 1',
        `Chain ID: ${NETWORK.id}`,
        `Nonce: ${nonce}`,
        `Issued At: ${new Date().toISOString()}`,
        `Expiration Time: ${new Date(expires).toISOString()}`,
      ].join('\n');
      const valid = await (await loadWalletRuntime()).prove(message);
      if (
        !valid ||
        current.current.address !== address ||
        current.current.chainId !== NETWORK.id ||
        Date.now() >= expires
      )
        throw new Error('Signature did not verify');
      setVerified({ address, expires });
    });
  return {
    ...account,
    connectors,
    error,
    busy,
    ready,
    connect,
    disconnect,
    switchNetwork,
    prove,
    verified: !!verified && verified.address === account.address && verified.expires > Date.now(),
    wrongNetwork: !!account.address && account.chainId !== NETWORK.id,
  };
}
export type WalletState = ReturnType<typeof useWallet>;
