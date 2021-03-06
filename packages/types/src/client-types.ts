import * as Identity from './identity-types';
import * as Payment from './payment-types';
import * as RequestLogic from './request-logic-types';

/** Restrict research to two timestamp */
export interface ITimestampBoundaries {
  from?: number;
  to?: number;
}

/** Interface request data */
export interface IRequestData extends Omit<RequestLogic.IRequest, 'currency'> {
  currency: string;
  meta: RequestLogic.IReturnMeta | null;
  balance: Payment.IBalanceWithEvents<any> | null;
  contentData: any;
  currencyInfo: RequestLogic.ICurrency;
  pending: RequestLogic.IPendingRequest | null;
}

/** Create request parameters */
export interface ICreateRequestParameters {
  requestInfo: RequestLogic.ICreateParameters | IRequestInfo;
  signer: Identity.IIdentity;
  paymentNetwork?: Payment.IPaymentNetworkCreateParameters;
  topics?: string[];
  contentData?: any;
}

/** Parameters to create a request. ICreateParameters with a more flexible currency */
export interface IRequestInfo {
  currency: string | RequestLogic.ICurrency;
  expectedAmount: RequestLogic.Amount;
  payee?: Identity.IIdentity;
  payer?: Identity.IIdentity;
  extensionsData?: any[];
  timestamp?: number;
  nonce?: number;
}
