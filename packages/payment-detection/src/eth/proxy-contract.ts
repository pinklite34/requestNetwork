import {
  AdvancedLogicTypes,
  ExtensionTypes,
  PaymentTypes,
  RequestLogicTypes,
} from '@requestnetwork/types';
import Utils from '@requestnetwork/utils';
import PaymentReferenceCalculator from '../payment-reference-calculator';
import ProxyInfoRetriever from './proxy-info-retriever';

const bigNumber: any = require('bn.js');

interface IProxyContractByVersionByNetwork {
  [version: string]: {
    [network: string]: { address: string; creationBlockNumber: number };
  };
}

const PROXY_CONTRACT_ADDRESS_BY_VERSION_BY_NETWORK: IProxyContractByVersionByNetwork = {
  ['0.1.0']: {
    mainnet: {
      address: 'TODO',
      creationBlockNumber: 0,
    },
    private: {
      address: '0xf204a4ef082f5c04bb89f7d5e6568b796096735a',
      creationBlockNumber: 0,
    },
    rinkeby: {
      address: '0x9c6c7817e3679c4b3f9ef9486001eae5aaed25ff',
      creationBlockNumber: 5955681,
    },
  },
};

/**
 * Handle payment networks with Ethereum proxy contract extension
 */
export default class PaymentNetworkEthereumProxyContract implements PaymentTypes.IPaymentNetwork {
  private extension: ExtensionTypes.PnReferenceBased.IReferenceBased;
  /**
   * @param extension The advanced logic payment network extensions
   */
  public constructor({ advancedLogic }: { advancedLogic: AdvancedLogicTypes.IAdvancedLogic }) {
    this.extension = advancedLogic.extensions.proxyContractEthereum;
  }

  /**
   * Creates the extensions data for the creation of this extension.
   * Will set a salt if none is already given
   *
   * @param paymentNetworkCreationParameters Parameters to create the extension
   * @returns The extensionData object
   */
  public createExtensionsDataForCreation(
    paymentNetworkCreationParameters: PaymentTypes.IReferenceBasedCreationParameters,
  ): ExtensionTypes.IAction {
    // If no salt is given, generate one
    const salt = paymentNetworkCreationParameters.salt || Utils.crypto.generate8randomBytes();

    return this.extension.createCreationAction({
      paymentAddress: paymentNetworkCreationParameters.paymentAddress,
      refundAddress: paymentNetworkCreationParameters.refundAddress,
      salt,
    });
  }

  /**
   * Creates the extensions data to add payment address
   *
   * @param parameters to add payment information
   * @returns The extensionData object
   */
  public createExtensionsDataForAddPaymentInformation(
    parameters: ExtensionTypes.PnReferenceBased.IAddPaymentAddressParameters,
  ): ExtensionTypes.IAction {
    return this.extension.createAddPaymentAddressAction({
      paymentAddress: parameters.paymentAddress,
    });
  }

  /**
   * Creates the extensions data to add refund address
   *
   * @param Parameters to add refund information
   * @returns The extensionData object
   */
  public createExtensionsDataForAddRefundInformation(
    parameters: ExtensionTypes.PnReferenceBased.IAddRefundAddressParameters,
  ): ExtensionTypes.IAction {
    return this.extension.createAddRefundAddressAction({
      refundAddress: parameters.refundAddress,
    });
  }

  /**
   * Gets the balance and the payment/refund events
   *
   * @param request the request to check
   * @param paymentNetworkId payment network id
   * @param tokenContractAddress the address of the token contract
   * @returns the balance and the payment/refund events
   */
  public async getBalance(
    request: RequestLogicTypes.IRequest,
  ): Promise<PaymentTypes.IBalanceWithEvents> {
    const paymentNetworkId = ExtensionTypes.ID.PAYMENT_NETWORK_ETH_PROXY_CONTRACT;
    const paymentNetwork = request.extensions[paymentNetworkId];

    if (!paymentNetwork) {
      throw new Error(`The request do not have the extension: ${paymentNetworkId}`);
    }

    const paymentAddress = paymentNetwork.values.paymentAddress;
    const refundAddress = paymentNetwork.values.refundAddress;
    const salt = paymentNetwork.values.salt;

    let payments: PaymentTypes.IBalanceWithEvents = { balance: '0', events: [] };
    if (paymentAddress) {
      payments = await this.extractBalanceAndEvents(
        request,
        salt,
        paymentAddress,
        PaymentTypes.EVENTS_NAMES.PAYMENT,
        paymentNetwork.version,
      );
    }

    let refunds: PaymentTypes.IBalanceWithEvents = { balance: '0', events: [] };
    if (refundAddress) {
      refunds = await this.extractBalanceAndEvents(
        request,
        salt,
        refundAddress,
        PaymentTypes.EVENTS_NAMES.REFUND,
        paymentNetwork.version,
      );
    }

    const balance: string = new bigNumber(payments.balance || 0)
      .sub(new bigNumber(refunds.balance || 0))
      .toString();

    const events: PaymentTypes.ETHPaymentNetworkEvent[] = [
      ...payments.events,
      ...refunds.events,
    ].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    return {
      balance,
      events,
    };
  }

  /**
   * Extracts the balance and events of an address
   *
   * @private
   * @param address Address to check
   * @param eventName Indicate if it is an address for payment or refund
   * @param network The id of network we want to check
   * @param tokenContractAddress the address of the token contract
   * @returns The balance and events
   */
  private async extractBalanceAndEvents(
    request: RequestLogicTypes.IRequest,
    salt: string,
    toAddress: string,
    eventName: PaymentTypes.EVENTS_NAMES,
    paymentNetworkVersion: string,
  ): Promise<PaymentTypes.IBalanceWithEvents> {
    const network = request.currency.network;

    if (!network) {
      throw new Error(`Payment network not supported by Ethereum payment detection`);
    }

    if (!PROXY_CONTRACT_ADDRESS_BY_VERSION_BY_NETWORK[paymentNetworkVersion]) {
      throw new Error(`Payment network version not supported: ${paymentNetworkVersion}`);
    }

    const proxyContractAddress: string | undefined =
      PROXY_CONTRACT_ADDRESS_BY_VERSION_BY_NETWORK[paymentNetworkVersion][network].address;
    const proxyCreationBlockNumber: number =
      PROXY_CONTRACT_ADDRESS_BY_VERSION_BY_NETWORK[paymentNetworkVersion][network]
        .creationBlockNumber;

    if (!proxyContractAddress) {
      throw new Error(
        `Network not supported for this payment network: ${request.currency.network}`,
      );
    }

    const paymentReference = PaymentReferenceCalculator.calculate(
      request.requestId,
      salt,
      toAddress,
    );

    const infoRetriever = new ProxyInfoRetriever(
      paymentReference,
      proxyContractAddress,
      proxyCreationBlockNumber,
      toAddress,
      eventName,
      network,
    );

    const events = await infoRetriever.getTransferEvents();

    const balance = events
      .reduce((acc, event) => acc.add(new bigNumber(event.amount)), new bigNumber(0))
      .toString();

    return {
      balance,
      events,
    };
  }
}
