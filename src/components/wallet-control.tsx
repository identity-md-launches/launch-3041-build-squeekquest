import { useEffect, useState } from 'react';
import { Dialog } from './dialog';
import { Icon } from './icons';
import type { WalletState } from '../hooks/use-wallet';
import { NETWORK, shortAddress } from '../web3/network';
import { loadWalletRuntime } from '../web3/runtime';

const OPEN_IN = [
  {
    id: 'metamask',
    name: 'MetaMask',
    href: (url: string) => `https://link.metamask.io/dapp/${url.replace(/^https?:\/\//, '')}`,
  },
  {
    id: 'coinbase',
    name: 'Coinbase Wallet',
    href: (url: string) => `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(url)}`,
  },
  // Rabby Mobile's own universal-link handler: _cmd=open-dapp, dapp=<URL>.
  {
    id: 'rabby',
    name: 'Rabby',
    href: (url: string) =>
      `https://go.rabby.io/mobile/?_cmd=open-dapp&dapp=${encodeURIComponent(url)}`,
  },
  {
    id: 'phantom',
    name: 'Phantom',
    href: (url: string) =>
      `https://phantom.app/ul/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(new URL(url).origin)}`,
  },
];
function Mark({ id, icon }: { id: string; icon?: string }) {
  if (icon && /^(data:image\/|https:\/\/)/.test(icon))
    return <img src={icon} alt="" width={28} height={28} />;
  if (['metamask', 'coinbase', 'rabby', 'phantom', 'coinbaseWalletSDK'].includes(id))
    return (
      <img
        src={`./wallet-icons/${id === 'coinbaseWalletSDK' ? 'coinbase' : id}.svg`}
        alt=""
        width={28}
        height={28}
      />
    );
  return <Icon name="wallet" size={28} />;
}
export function WalletControl({
  wallet,
  onProfile,
}: {
  wallet: WalletState;
  onProfile: () => void;
}) {
  const [open, setOpen] = useState(false),
    [mobile, setMobile] = useState(false),
    [fullAddress, setFullAddress] = useState('');
  useEffect(() => {
    const phone = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    setMobile(
      phone &&
        !('ethereum' in window && window.ethereum) &&
        !wallet.connectors.some((c) => c.type === 'injected' && c.id !== 'injected'),
    );
  }, [wallet.connectors]);
  useEffect(() => {
    if (!wallet.address) {
      setFullAddress('');
      return;
    }
    void loadWalletRuntime().then((sdk) => setFullAddress(sdk.checksum(wallet.address!)));
  }, [wallet.address]);
  const named = wallet.connectors.some((c) => c.type === 'injected' && c.id !== 'injected');
  const listed = wallet.connectors.filter(
    (c) => !(c.id === 'injected' && named) && (!mobile || c.type !== 'injected'),
  );
  return (
    <>
      <button
        className="sq-button wallet-control"
        onClick={() => setOpen(true)}
        aria-label={
          wallet.wrongNetwork
            ? 'Switch to Sepolia'
            : wallet.address
              ? `Wallet ${shortAddress(fullAddress || wallet.address)}, connected`
              : 'Connect wallet'
        }
      >
        <Icon name="wallet" size={17} />
        <span>
          {wallet.wrongNetwork
            ? 'Switch to Sepolia'
            : wallet.address
              ? shortAddress(fullAddress || wallet.address)
              : 'Connect wallet'}
        </span>
      </button>
      {open && (
        <Dialog
          title={wallet.address ? 'Your wallet' : 'Connect a wallet'}
          onClose={() => setOpen(false)}
          sheet
        >
          <div className="wallet-sheet">
            <p>Ethereum wallets connect to Squeekchain’s Sepolia deployment.</p>
            {wallet.address ? (
              <>
                <p className="web3-status">
                  Connected ·{' '}
                  {wallet.wrongNetwork ? `Network ${wallet.chainId ?? 'unknown'}` : NETWORK.name}
                </p>
                <code className="web3-address">{fullAddress || wallet.address}</code>
                {wallet.wrongNetwork && (
                  <button
                    className="sq-button sq-primary"
                    disabled={!!wallet.busy}
                    onClick={() => void wallet.switchNetwork()}
                  >
                    {wallet.busy === 'switch' ? 'Waiting for wallet…' : 'Switch to Sepolia'}
                  </button>
                )}
                <button
                  className="sq-button"
                  onClick={() => {
                    setOpen(false);
                    onProfile();
                  }}
                >
                  Open Web3 profile
                </button>
                <button
                  className="sq-button"
                  disabled={!!wallet.busy}
                  onClick={() => void wallet.disconnect()}
                >
                  Disconnect wallet
                </button>
              </>
            ) : (
              <>
                {mobile &&
                  OPEN_IN.map((w) => (
                    <a className="wallet-row" href={w.href(location.href)} key={w.id}>
                      <Mark id={w.id} />
                      <span>Open in {w.name}</span>
                      <Icon name="arrow" size={16} />
                    </a>
                  ))}
                {!wallet.ready && !wallet.error && <p role="status">Loading wallet tools…</p>}
                {listed.map((c) => (
                  <button
                    className="wallet-row"
                    key={c.uid}
                    disabled={!!wallet.busy}
                    onClick={() => void wallet.connect(c.uid)}
                  >
                    <Mark id={c.id} icon={c.icon} />
                    <span>
                      {c.id === 'injected'
                        ? 'Browser wallet'
                        : c.id === 'coinbaseWalletSDK'
                          ? mobile
                            ? 'Coinbase Smart Wallet'
                            : 'Coinbase Wallet'
                          : c.name}
                      {wallet.busy === c.uid ? ' · opening…' : ''}
                    </span>
                  </button>
                ))}
                <small>
                  On a phone, open this page inside a wallet’s browser. A browser wallet extension
                  must be installed on desktop.
                </small>
              </>
            )}
            {wallet.error && (
              <p className="web3-error" role="alert">
                {wallet.error}
              </p>
            )}
            <p className="web3-note">
              Connection shares your public address. Signing is a separate choice. SqueekQuest never
              asks for recovery phrases or private keys.
            </p>
          </div>
        </Dialog>
      )}
    </>
  );
}
