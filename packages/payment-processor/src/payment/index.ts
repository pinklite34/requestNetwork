import { ContractTransaction, Signer } from 'ethers';
import { Provider, Web3Provider } from 'ethers/providers';
import { bigNumberify, BigNumberish } from 'ethers/utils';

import { ClientTypes, ExtensionTypes } from '@requestnetwork/types';

import { getBtcPaymentUrl } from './btc-address-based';
import {
  _getErc20PaymentUrl,
  encodePayErc20Request,
  getErc20Balance,
  payErc20ProxyRequest,
} from './erc20-proxy';
import {
  _getEthPaymentUrl,
  encodePayEthProxyContractRequest,
  payEthInputDataRequest,
} from './eth-input-data';
import { getNetworkProvider, getProvider } from './utils';

const getPaymentNetwork = (request: ClientTypes.IRequestData): ExtensionTypes.ID | undefined => {
  // tslint:disable-next-line: typedef
  return Object.values(request.extensions).find(x => x.type === 'payment-network')?.id;
};

/**
 * Error thrown when the network is not supported.
 */
export class UnsupportedNetworkError extends Error {
  constructor(public networkName?: string) {
    super(`Payment network ${networkName} is not supported`);
  }
}

/**
 * Processes a transaction to pay a Request.
 * Supported networks: ERC20_PROXY_CONTRACT, ETH_INPUT_DATA
 *
 * @throws UnsupportedNetworkError if network isn't supported
 * @param request the request to pay.
 * @param signerOrProvider the Web3 provider, or signer. Defaults to window.ethereum.
 * @param amount optionally, the amount to pay. Defaults to remaining amount of the request.
 */
export async function payRequest(
  request: ClientTypes.IRequestData,
  signerOrProvider: Web3Provider | Signer = getProvider(),
  amount?: BigNumberish,
): Promise<ContractTransaction> {
  const paymentNetwork = getPaymentNetwork(request);
  switch (paymentNetwork) {
    case ExtensionTypes.ID.PAYMENT_NETWORK_ERC20_PROXY_CONTRACT:
      return payErc20ProxyRequest(request, signerOrProvider, amount);
    case ExtensionTypes.ID.PAYMENT_NETWORK_ETH_INPUT_DATA:
      return payEthInputDataRequest(request, signerOrProvider, amount);
    default:
      throw new UnsupportedNetworkError(paymentNetwork);
  }
}

/**
 * Encodes the call to pay a request, if
 * Supported networks: ERC20_PROXY_CONTRACT, ETH_INPUT_DATA
 * @param request
 * @param signerOrProvider
 * @param amount
 */
export function encodePayRequest(
  request: ClientTypes.IRequestData,
  signerOrProvider: Web3Provider | Signer = getProvider(),
  amount?: BigNumberish,
): string {
  const paymentNetwork = getPaymentNetwork(request);
  switch (paymentNetwork) {
    case ExtensionTypes.ID.PAYMENT_NETWORK_ERC20_PROXY_CONTRACT:
      return encodePayErc20Request(request, signerOrProvider, amount);
    case ExtensionTypes.ID.PAYMENT_NETWORK_ETH_INPUT_DATA:
      return encodePayEthProxyContractRequest(request, signerOrProvider);
    default:
      throw new UnsupportedNetworkError(paymentNetwork);
  }
}

/**
 * Verifies the address has enough funds to pay the request. For ERC20
 * Supported networks: ERC20_PROXY_CONTRACT, ETH_INPUT_DATA
 *
 * @throws UnsupportedNetworkError if network isn't supported
 * @param request the request to verify.
 * @param address the address holding the funds
 * @param provider the Web3 provider. Defaults to Etherscan.
 */
export async function hasSufficientFunds(
  request: ClientTypes.IRequestData,
  address: string,
  provider: Provider = getNetworkProvider(request),
): Promise<boolean> {
  const ethBalance = await provider.getBalance(address);

  const paymentNetwork = getPaymentNetwork(request);

  switch (paymentNetwork) {
    case ExtensionTypes.ID.PAYMENT_NETWORK_ERC20_PROXY_CONTRACT:
      const balance = await getErc20Balance(request, address, provider);
      // check ETH for gas, and token for funds transfer
      return ethBalance.gt(0) && balance.gt(bigNumberify(request.expectedAmount || 0));
    case ExtensionTypes.ID.PAYMENT_NETWORK_ETH_INPUT_DATA:
      return ethBalance.gt(bigNumberify(request.expectedAmount || 0));
    default:
      throw new UnsupportedNetworkError(paymentNetwork);
  }
}

/**
 * Get a payment URL, if applicable to the payment network, for a request.
 * BTC: BIP21.
 * ERC20: EIP-681. (Warning, not widely used. Some wallets may not be able to pay.)
 * ETH: EIP-681. (Warning, not widely used. Some wallets may not be able to pay.)
 * @throws UnsupportedNetworkError if the network is not supported.
 * @param request the request to pay
 * @param amount optionally, the amount to pay. Defaults to remaining amount of the request.
 */
export function _getPaymentUrl(request: ClientTypes.IRequestData, amount?: BigNumberish): string {
  const paymentNetwork = getPaymentNetwork(request);
  switch (paymentNetwork) {
    case ExtensionTypes.ID.PAYMENT_NETWORK_ERC20_PROXY_CONTRACT:
      return _getErc20PaymentUrl(request, amount);
    case ExtensionTypes.ID.PAYMENT_NETWORK_ETH_INPUT_DATA:
      return _getEthPaymentUrl(request, amount);
    case ExtensionTypes.ID.PAYMENT_NETWORK_BITCOIN_ADDRESS_BASED:
    case ExtensionTypes.ID.PAYMENT_NETWORK_TESTNET_BITCOIN_ADDRESS_BASED:
      return getBtcPaymentUrl(request, amount);
    default:
      throw new UnsupportedNetworkError(paymentNetwork);
  }
}
