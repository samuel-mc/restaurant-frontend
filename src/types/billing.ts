/** Respuesta de canje de cupón (`RedeemCouponResponse.java`). */
export interface RedeemCouponResponse {
  message: string;
  plan: string;
  paymentStatus: string;
  websitePublished: boolean;
  redeemedCode: string;
}
