import crypto from "crypto";
import { KHQR } from "bakong-khqr-npm";

export type PaymentMethod = "BAKONG" | "WALLET" | "TRUEMONEY" | "WING" | "BANK" | "USDT" | "MANUAL";

export type PaymentCurrency = "USD" | "KHR" | "USDT";

export interface InitiatePaymentArgs {
  orderNumber: string;
  amountUsd: number;
  amountKhr?: number | null;
  currency: PaymentCurrency;
  method: PaymentMethod;
  returnUrl: string;
  cancelUrl: string;
  callbackUrl: string;
  note?: string;
  customerEmail?: string;
  metadata?: Record<string, string>;
}

export interface PaymentInitResult {
  paymentRef: string;
  redirectUrl: string;
  qrString?: string | null;
  expiresAt: Date;
  instructions?: string | null;
}

const SIM_MODE = process.env.PAYMENT_SIMULATION_MODE === "true";

const BAKONG_ACCOUNT = process.env.BAKONG_ACCOUNT || "";
const BAKONG_MERCHANT_NAME = process.env.BAKONG_MERCHANT_NAME || "";
const BAKONG_MERCHANT_CITY = process.env.BAKONG_MERCHANT_CITY || "Phnom Penh";
const BAKONG_TOKEN = process.env.BAKONG_TOKEN || "";

// TrueMoney configuration
const TRUEMONEY_PHONE = process.env.TRUEMONEY_PHONE || "";
const TRUEMONEY_API_KEY = process.env.TRUEMONEY_API_KEY || "";
const TRUEMONEY_MERCHANT_ID = process.env.TRUEMONEY_MERCHANT_ID || "";

// Wing configuration
const WING_PHONE = process.env.WING_PHONE || "";
const WING_API_KEY = process.env.WING_API_KEY || "";
const WING_MERCHANT_ID = process.env.WING_MERCHANT_ID || "";

// Bank Transfer configuration
const BANK_NAME = process.env.BANK_NAME || "ABA Bank";
const BANK_ACCOUNT = process.env.BANK_ACCOUNT || "";
const BANK_ACCOUNT_NAME = process.env.BANK_ACCOUNT_NAME || "Ty Khai TopUp";
const BANK_BRANCH = process.env.BANK_BRANCH || "";

// USDT configuration
const USDT_WALLET = process.env.USDT_WALLET || "";

export function isPaymentMethodConfigured(method: PaymentMethod): boolean {
  switch (method) {
    case "BAKONG":
      return !!(BAKONG_ACCOUNT && BAKONG_TOKEN);
    case "TRUEMONEY":
      return !!TRUEMONEY_PHONE;
    case "WING":
      return !!WING_PHONE;
    case "BANK":
      return !!BANK_ACCOUNT;
    case "USDT":
      return !!USDT_WALLET;
    case "WALLET":
    case "MANUAL":
      return true;
    default:
      return false;
  }
}

export async function initiatePayment(
  args: InitiatePaymentArgs
): Promise<PaymentInitResult> {
  if (args.method === "BAKONG" && BAKONG_TOKEN) return initiateBakong(args);
  
  if (SIM_MODE) return simulatePayment(args);
  if (args.method === "TRUEMONEY") return initiateTrueMoney(args);
  if (args.method === "WING") return initiateWing(args);
  if (args.method === "BANK") return initiateBankTransfer(args);
  if (args.method === "USDT") return initiateUsdt(args);
  throw new Error(`Unsupported payment method: ${args.method}`);
}

function simulatePayment(args: InitiatePaymentArgs): PaymentInitResult {
  const ref = `SIM-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  return {
    paymentRef: ref,
    redirectUrl: `${base}/api/payment/simulate?order=${args.orderNumber}&ref=${ref}&method=${args.method}`,
    qrString: "00020101021252040000530384054041.005802KH5912TYKHAI TOPUP6008PHNOMPENH62150111TYKHAITOPUP6304ABCD",
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  };
}

async function initiateBakong(args: InitiatePaymentArgs): Promise<PaymentInitResult> {
  if (!BAKONG_ACCOUNT || !BAKONG_MERCHANT_NAME || !BAKONG_TOKEN) {
    throw new Error("Bakong not configured. Check BAKONG_ACCOUNT, BAKONG_MERCHANT_NAME, BAKONG_TOKEN in environment variables.");
  }

  // Validate account format (should be phone number, not email)
  if (BAKONG_ACCOUNT.includes('@')) {
    throw new Error(`BAKONG_ACCOUNT should be a phone number (e.g., 855123456789), not email: ${BAKONG_ACCOUNT}`);
  }

  const paymentCurrency = args.currency === "KHR" ? "KHR" : "USD";
  const rawAmount = args.currency === "KHR" ? args.amountKhr : args.amountUsd;
  const amount = Number(rawAmount);

  if (!Number.isFinite(amount)) {
    throw new Error("Bakong: missing valid amount");
  }

  const khqr = new KHQR(BAKONG_TOKEN, "https://api-bakong.nbc.gov.kh/v1");

  // Test token validity by making a simple call
  try {
    console.log("[bakong] Testing token validity...");
    // Try to generate a test QR to verify token works
    const testQr = khqr.create_qr({
      bank_account: BAKONG_ACCOUNT,
      merchant_name: "TEST",
      amount: 0.01,
      currency: "USD",
      bill_number: "TEST",
      terminal_label: "Test",
      static: true,
    });
    
    if (!testQr) {
      throw new Error("Bakong token appears invalid - QR generation returned null");
    }
    console.log("[bakong] Token is valid");
  } catch (testError: any) {
    throw new Error(`Bakong token validation failed: ${testError.message}. Get a new token from https://bkrt.com.kh/`);
  }

  const qrResult = khqr.create_qr({
    bank_account: BAKONG_ACCOUNT,
    merchant_name: BAKONG_MERCHANT_NAME.substring(0, 25),
    merchant_city: BAKONG_MERCHANT_CITY.substring(0, 15),
    amount: amount,
    currency: paymentCurrency,
    bill_number: args.orderNumber.substring(0, 25),
    terminal_label: "TyKhai",
    static: false, // Dynamic QR locks amount - required for security
  });
  
  if (!qrResult) {
    throw new Error("Bakong: failed to generate QR - check if token is valid and account format is correct (should be phone number)");
  }

  const md5Hash = khqr.generate_md5(qrResult);

  const paymentRef = md5Hash;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const redirectUrl = `${baseUrl}/checkout/${args.orderNumber}`;

  return {
    paymentRef,
    redirectUrl,
    qrString: qrResult,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    instructions: `Scan the QR code with Bakong app to pay ${amount} ${args.currency}`,
  };
}

export async function checkBakongPayment(md5Hash: string, expectedAmount?: number): Promise<{
  status: string;
  paid: boolean;
  amount?: number;
  currency?: string;
} | null> {
  if (!BAKONG_TOKEN) {
    return null;
  }

  const khqr = new KHQR(BAKONG_TOKEN, "https://api-bakong.nbc.gov.kh/v1");

  try {
    console.log("[bakong] check_payment:", md5Hash);
    
    const result = await khqr.get_payment(md5Hash);
    console.log("[bakong] get_payment result:", JSON.stringify(result));

    if (!result) {
      return { status: "UNPAID", paid: false };
    }

    const paymentResult = result as any;
    const status = paymentResult.trackingStatus || paymentResult.status || "UNPAID";
    const paidAmount = paymentResult.amount ? parseFloat(String(paymentResult.amount)) : undefined;
    const currency = paymentResult.currency;

    const isPaid = status === "PAID" || status === "COMPLETED" || status === "ACKNOWLEDGED";
    
    if (isPaid && expectedAmount && paidAmount) {
      const amountMatches = Math.abs(paidAmount - expectedAmount) < 0.01;
      if (!amountMatches) {
        console.warn(`[bakong] Amount mismatch: expected ${expectedAmount}, got ${paidAmount}`);
        return {
          status: "AMOUNT_MISMATCH",
          paid: false,
          amount: paidAmount,
          currency,
        };
      }
    }

    return {
      status: isPaid ? "PAID" : status,
      paid: isPaid,
      amount: paidAmount,
      currency,
    };
  } catch (e) {
    console.warn("[bakong] get_payment failed:", e);
    return null;
  }
}

// USDT TRC20 Contract Address
const USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const TRONGRID_API = "https://api.trongrid.io";

export async function checkUsdtPayment(
  walletAddress: string,
  expectedAmount: number,
  orderTimestamp: number
): Promise<{
  status: string;
  paid: boolean;
  txId?: string;
  amount?: number;
} | null> {
  if (!walletAddress) {
    return null;
  }

  try {
    console.log("[usdt] Checking payments to:", walletAddress);
    
    const url = `${TRONGRID_API}/v1/accounts/${walletAddress}/transactions/trc20?` +
      `limit=50&contract_address=${USDT_CONTRACT}&only_confirmed=true&` +
      `min_timestamp=${orderTimestamp}&order_by=block_timestamp,desc`;

    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.warn("[usdt] TronGrid API error:", response.status);
      return null;
    }

    const data = await response.json();
    const transactions = data.data || [];

    console.log("[usdt] Found", transactions.length, "transactions");

    for (const tx of transactions) {
      const txAmount = tx.value ? tx.value / 1000000 : 0;
      const amountMatches = Math.abs(txAmount - expectedAmount) < 0.01;

      if (amountMatches) {
        console.log("[usdt] Found matching transaction:", tx.transaction_id);
        return {
          status: "PAID",
          paid: true,
          txId: tx.transaction_id,
          amount: txAmount,
        };
      }
    }

    return { status: "UNPAID", paid: false };
  } catch (e) {
    console.warn("[usdt] check failed:", e);
    return null;
  }
}

async function initiateTrueMoney(args: InitiatePaymentArgs): Promise<PaymentInitResult> {
  if (!TRUEMONEY_PHONE) {
    throw new Error("TrueMoney not configured. Set TRUEMONEY_PHONE in environment variables.");
  }

  const ref = `TM-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  const amount = args.currency === "KHR" ? args.amountKhr : args.amountUsd;
  const currency = args.currency === "KHR" ? "KHR" : "USD";

  return {
    paymentRef: ref,
    redirectUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/checkout/${args.orderNumber}`,
    qrString: null,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    instructions: `Transfer ${amount} ${currency} to TrueMoney: ${TRUEMONEY_PHONE}.\nReference: ${ref}\nOrder: ${args.orderNumber}`,
  };
}

async function initiateWing(args: InitiatePaymentArgs): Promise<PaymentInitResult> {
  if (!WING_PHONE) {
    throw new Error("Wing not configured. Set WING_PHONE in environment variables.");
  }

  const ref = `WING-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  const amount = args.currency === "KHR" ? args.amountKhr : args.amountUsd;
  const currency = args.currency === "KHR" ? "KHR" : "USD";

  return {
    paymentRef: ref,
    redirectUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/checkout/${args.orderNumber}`,
    qrString: null,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    instructions: `Transfer ${amount} ${currency} to Wing: ${WING_PHONE}.\nReference: ${ref}\nOrder: ${args.orderNumber}`,
  };
}

async function initiateBankTransfer(args: InitiatePaymentArgs): Promise<PaymentInitResult> {
  if (!BANK_ACCOUNT) {
    throw new Error("Bank Transfer not configured. Set BANK_ACCOUNT in environment variables.");
  }

  const ref = `BANK-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  const amount = args.currency === "KHR" ? args.amountKhr : args.amountUsd;
  const currency = args.currency === "KHR" ? "KHR" : "USD";

  const instructions = [
    `Bank: ${BANK_NAME}`,
    `Account: ${BANK_ACCOUNT}`,
    `Name: ${BANK_ACCOUNT_NAME}`,
    BANK_BRANCH ? `Branch: ${BANK_BRANCH}` : null,
    `Amount: ${amount} ${currency}`,
    `Reference: ${ref}`,
    `Order: ${args.orderNumber}`,
    "",
    "⚠️ IMPORTANT: Include the reference number when transferring!",
  ].filter(Boolean).join("\n");

  return {
    paymentRef: ref,
    redirectUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/checkout/${args.orderNumber}`,
    qrString: null,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    instructions,
  };
}

async function initiateUsdt(args: InitiatePaymentArgs): Promise<PaymentInitResult> {
  if (!USDT_WALLET) {
    throw new Error("USDT payment not configured. Set USDT_WALLET in environment variables.");
  }

  const ref = `USDT-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  const amountUsd = args.amountUsd;
  
  const instructions = [
    `Send exactly ${amountUsd} USDT (TRC20)`,
    `To wallet: ${USDT_WALLET}`,
    `Reference: ${ref}`,
    `Order: ${args.orderNumber}`,
    "",
    "⚠️ IMPORTANT:",
    "- Send only USDT on TRC20 network",
    "- Include reference in transaction memo if possible",
    "- Payment will be verified within 30 minutes",
  ].join("\n");

  return {
    paymentRef: ref,
    redirectUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/checkout/${args.orderNumber}`,
    qrString: null,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    instructions,
  };
}
