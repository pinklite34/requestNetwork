import { ContractTransaction, Signer } from 'ethers';
import { Web3Provider } from 'ethers/providers';
import { BigNumberish } from 'ethers/utils';

import { ethereumProxyArtifact } from '@requestnetwork/smart-contracts/src/lib';
import { ClientTypes, PaymentTypes } from '@requestnetwork/types';

import { EthProxyContract } from '../contracts/EthProxyContract';
import {
  getAmountToPay,
  getProvider,
  getRequestPaymentValues,
  getSigner,
  validateRequest,
} from './utils';

/**
 * processes the transaction to pay an ETH request.
 * @param request the request to pay
 * @param signerOrProvider the Web3 provider, or signer. Defaults to window.ethereum.
 * @param amount optionally, the amount to pay. Defaults to remaining amount of the request.
 */
export async function payEthInputDataRequest(
  request: ClientTypes.IRequestData,
  signerOrProvider: Web3Provider | Signer = getProvider(),
  amount?: BigNumberish,
): Promise<ContractTransaction> {
  validateRequest(request, PaymentTypes.PAYMENT_NETWORK_ID.ETH_INPUT_DATA);
  const signer = getSigner(signerOrProvider);
  const { paymentReference, paymentAddress } = getRequestPaymentValues(request);

  const amountToPay = getAmountToPay(request, amount);

  const tx = await signer.sendTransaction({
    data: `0x${paymentReference}`,
    to: paymentAddress,
    value: amountToPay,
  });
  return tx;
}

/**
 * Encodes a call to the Ethereum Proxy Contract, for multisig usage
 * @param request
 * @param signerOrProvider
 */
export function encodePayEthProxyContractRequest(
  request: ClientTypes.IRequestData,
  signerOrProvider: Web3Provider | Signer = getProvider(),
): string {
  validateRequest(request, PaymentTypes.PAYMENT_NETWORK_ID.ETH_INPUT_DATA);
  const signer = getSigner(signerOrProvider);
  const proxyAddress = ethereumProxyArtifact.getAddress(request.currencyInfo.network!);
  const ethProxyInterface = EthProxyContract.connect(proxyAddress, signer).interface;

  const { paymentAddress, paymentReference } = getRequestPaymentValues(request);

  const encodedApproveCall = ethProxyInterface.functions.transferWithReference.encode([
    paymentAddress,
    `0x${paymentReference}`,
  ]);
  return encodedApproveCall;
}

/**
 * processes the transaction to pay an ETH request.
 * @param request the request to pay
 * @param signerOrProvider the Web3 provider, or signer. Defaults to window.ethereum.
 * @param amount optionally, the amount to pay. Defaults to remaining amount of the request.
 */
export function _getEthPaymentUrl(
  request: ClientTypes.IRequestData,
  amount?: BigNumberish,
): string {
  const { paymentAddress, paymentReference } = getRequestPaymentValues(request);
  const amountToPay = getAmountToPay(request, amount);

  // tslint:disable-next-line: no-console
  return `ethereum:${paymentAddress}?value=${amountToPay}&data=${paymentReference}`;
}
