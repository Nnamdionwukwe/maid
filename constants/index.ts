export const COLORS = {
  navy: "#1a1a2e",
  navyDark: "#121220",
  cream: "#f5f4f0",
  white: "#ffffff",
  green: "rgb(10, 107, 46)",
  greenLight: "rgb(209, 247, 224)",
  amber: "rgb(133, 100, 4)",
  amberLight: "rgb(255, 243, 205)",
  red: "rgb(187, 19, 47)",
  redLight: "rgb(255, 228, 228)",
  blue: "#1a56c4",
  blueLight: "#e8f0fe",
  purple: "#6f42c1",
  border: "#e8e6e0",
  borderLight: "#f0ede6",
  muted: "#f5f4f0",
  gray: "#888888",
  grayLight: "#aaaaaa",
  grayDark: "#444444",
};

export const FONTS = {
  regular: "DMSans_400Regular",
  medium: "DMSans_500Medium",
  bold: "Syne_700Bold",
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const RADIUS = {
  sm: 6,
  md: 10,
  lg: 12,
  xl: 14,
  xxl: 16,
  full: 999,
};

export const API_URL = "https://api.deusizisparkle.com";
export const CURRENCY_SYMBOLS: Record<string, string> = {
  NGN: "₦",
  USD: "$",
  GBP: "£",
  EUR: "€",
  GHS: "₵",
  KES: "KSh",
  ZAR: "R",
  UGX: "USh",
  TZS: "TSh",
  EGP: "E£",
  CAD: "CA$",
  AUD: "A$",
  INR: "₹",
  AED: "د.إ",
  SAR: "﷼",
  QAR: "QR",
  SGD: "S$",
  MYR: "RM",
  BRL: "R$",
  JPY: "¥",
};

export function sym(c: string) {
  return CURRENCY_SYMBOLS[c] || (c ? `${c} ` : "₦");
}

export function fmt(amount: number | string, currency: string) {
  return `${sym(currency)}${Number(amount || 0).toLocaleString()}`;
}

export function formatDate(d: string | Date) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export const BOOKING_STATUS_COLORS: Record<
  string,
  { bg: string; text: string }
> = {
  awaiting_payment: { bg: "#f5f4f0", text: "#888" },
  pending: { bg: "rgb(255,243,205)", text: "rgb(133,100,4)" },
  confirmed: { bg: "#e8f0fe", text: "#1a56c4" },
  in_progress: { bg: "#f0e6ff", text: "#6f42c1" },
  completed: { bg: "rgb(209,247,224)", text: "rgb(10,107,46)" },
  cancelled: { bg: "rgb(255,228,228)", text: "rgb(168,28,28)" },
};
