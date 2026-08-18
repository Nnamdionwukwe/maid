import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "../stores/authStore";
import { useAppToast } from "../components/AppToast";
import {
  fmt,
  API_URL,
  COLORS,
  FONTS,
  SPACING,
  RADIUS,
  sym,
} from "../constants";
import { FontAwesome5 } from "@expo/vector-icons";

// ── API ───────────────────────────────────────────────────────────────
const apiFetch = async (path: string, token: string) => {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
};
const apiPost = async (path: string, token: string, body: any) => {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  return res.json();
};

// ── Withdrawal methods config ─────────────────────────────────────────
type Method = {
  key: string;
  icon: string;
  name: string;
  desc: string;
  fee: string;
  countries?: string[];
};

const METHODS: Method[] = [
  {
    key: "bank_transfer",
    icon: "university",
    name: "Local Bank Transfer",
    desc: "Nigerian bank accounts via Paystack",
    fee: "₦200 – ₦750 (tiered)",
    countries: ["NGN"],
  },
  {
    key: "flutterwave",
    icon: "wave-square",
    name: "Flutterwave",
    desc: "Pan-African bank transfers (20+ countries)",
    fee: "₦200 – ₦750 (tiered)",
  },
  {
    key: "mobile_money",
    icon: "mobile-alt",
    name: "Mobile Money",
    desc: "M-Pesa, MTN MoMo, Airtel, Vodafone",
    fee: "₦200 – ₦500 (tiered)",
  },
  {
    key: "wire_transfer",
    icon: "globe",
    name: "International Wire (SWIFT)",
    desc: "Send to any bank worldwide via SWIFT",
    fee: "Flat $15 / £12 / €14",
  },
  {
    key: "paypal",
    icon: "paypal",
    name: "PayPal",
    desc: "Fast transfer to any PayPal account",
    fee: "Flat $2 / £1.50 / €1.80",
  },
  {
    key: "wise",
    icon: "globe",
    name: "Wise (TransferWise)",
    desc: "Cheapest international transfers",
    fee: "Flat $1 / £0.80 / €0.90",
  },
  {
    key: "crypto",
    icon: "bitcoin",
    name: "Crypto",
    desc: "USDT, USDC, BTC, ETH",
    fee: "Network fees only",
  },
];

// ── Mobile money providers ────────────────────────────────────────────
const MOBILE_PROVIDERS = [
  "MTN MoMo",
  "M-Pesa",
  "Airtel Money",
  "Vodafone Cash",
  "Orange Money",
];

// ── Crypto options ────────────────────────────────────────────────────
const CRYPTO_CURRENCIES = ["USDT", "USDC", "BTC", "ETH", "BNB"];
const CRYPTO_NETWORKS = ["TRC20", "ERC20", "BEP20", "Polygon", "Solana"];

export default function WithdrawScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ currency?: string }>();
  const { token } = useAuthStore();
  const { toast, confirm } = useAppToast();

  const [step, setStep] = useState<"select_method" | "fill_details">(
    "select_method",
  );
  const [selectedCurrency, setSelectedCurrency] = useState(
    params.currency || "NGN",
  );
  const [selectedMethod, setSelectedMethod] = useState<Method | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [amount, setAmount] = useState("");
  // Bank
  const [bankName, setBankName] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [bankCountry, setBankCountry] = useState("NG");
  const [verifyingBank, setVerifyingBank] = useState(false);
  const [bankPickerOpen, setBankPickerOpen] = useState(false);
  // Wire
  const [swiftCode, setSwiftCode] = useState("");
  const [iban, setIban] = useState("");
  const [bankAddress, setBankAddress] = useState("");
  // Mobile
  const [mobileProvider, setMobileProvider] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [mobileCountry, setMobileCountry] = useState("NG");
  const [mobilePickerOpen, setMobilePickerOpen] = useState(false);
  // Crypto
  const [cryptoCurrency, setCryptoCurrency] = useState("USDT");
  const [cryptoAddress, setCryptoAddress] = useState("");
  const [cryptoNetwork, setCryptoNetwork] = useState("TRC20");
  const [cryptoCurOpen, setCryptoCurOpen] = useState(false);
  const [cryptoNetOpen, setCryptoNetOpen] = useState(false);
  // PayPal
  const [paypalEmail, setPaypalEmail] = useState("");
  // Wise
  const [wiseEmail, setWiseEmail] = useState("");
  // Notes
  const [notes, setNotes] = useState("");

  // PIN modal
  const [pinModal, setPinModal] = useState(false);
  const [pin, setPin] = useState("");

  // ── Queries ─────────────────────────────────────────────────────
  const { data: walletData } = useQuery({
    queryKey: ["wallet-for-withdraw"],
    queryFn: () => apiFetch("/api/wallet", token!),
    enabled: !!token,
  });

  const { data: pinStatus } = useQuery({
    queryKey: ["pin-status"],
    queryFn: () => apiFetch("/api/settings/pin/status", token!),
    enabled: !!token,
  });

  const { data: ngBanksData } = useQuery({
    queryKey: ["ng-banks"],
    queryFn: () => apiFetch("/api/withdrawals/ng-banks", token!),
    enabled:
      !!token &&
      (selectedMethod?.key === "bank_transfer" ||
        selectedMethod?.key === "flutterwave"),
  });

  const wallets = walletData?.wallets || [];
  const ngBanks = ngBanksData?.banks || [];
  const activeWallet = wallets.find(
    (w: any) => w.currency === selectedCurrency,
  ) ||
    wallets[0] || { currency: "NGN", available_balance: 0 };
  const availableBalance = Number(activeWallet.available_balance || 0);

  // Filter methods that work for selected currency
  const eligibleMethods = METHODS.filter(
    (m) => !m.countries || m.countries.includes(selectedCurrency),
  );

  // ── NG Bank verify with fallback ──────────────────────────────
  async function verifyNGBank() {
    if (!accountNumber || !bankCode) {
      toast({
        type: "warning",
        title: "Missing info",
        message: "Select bank and enter account number",
      });
      return;
    }

    if (accountNumber.length !== 10) {
      toast({
        type: "warning",
        title: "Invalid account number",
        message: "Account number must be 10 digits",
      });
      return;
    }

    setVerifyingBank(true);
    try {
      const res = await apiPost("/api/withdrawals/ng-banks/verify", token!, {
        account_number: accountNumber,
        bank_code: bankCode,
      });
      if (res.error) throw new Error(res.error);
      setAccountName(res.account_name);
      toast({
        type: "success",
        title: "Account verified",
        message: `✅ ${res.account_name}`,
        duration: 4000,
      });
    } catch (err: any) {
      toast({
        type: "warning",
        title: "Auto-verify failed",
        message:
          "Please enter the account name manually and double-check it's correct.",
        duration: 5000,
      });
      setAccountName("");
    } finally {
      setVerifyingBank(false);
    }
  }

  // Auto-verify when account_number reaches 10 digits + bank selected
  useEffect(() => {
    if (
      selectedMethod?.key === "bank_transfer" &&
      bankCode &&
      accountNumber.length === 10
    ) {
      verifyNGBank();
    }
  }, [accountNumber, bankCode]);

  // ── Validate & submit ──────────────────────────────────────────
  function handleSubmit() {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast({ type: "warning", title: "Enter amount" });
      return;
    }
    if (amt > availableBalance) {
      toast({
        type: "error",
        title: "Insufficient balance",
        message: `Available: ${fmt(availableBalance, selectedCurrency)}`,
      });
      return;
    }

    // Method-specific validation
    const m = selectedMethod!.key;

    if (m === "bank_transfer") {
      if (!bankName || !accountNumber || !accountName) {
        return toast({
          type: "warning",
          title: "Fill bank details",
          message: "Please verify your account details before proceeding.",
        });
      }
      confirm({
        title: "Confirm Bank Transfer",
        message:
          `Amount: ${fmt(Number(amount), selectedCurrency)}\n` +
          `Bank: ${bankName}\n` +
          `Account: ${accountNumber}\n` +
          `Name: ${accountName}\n\n` +
          `⚠️ Please confirm these details are correct. ` +
          `We are not liable for incorrect account information.`,
        confirmLabel: "Confirm & Continue",
        onConfirm: () => {
          if (!pinStatus?.pin_set) {
            confirm({
              title: "Set Transaction PIN",
              message:
                "You need a 4–6 digit transaction PIN before you can withdraw. Set one in Settings now?",
              confirmLabel: "Go to Settings",
              onConfirm: () => router.push("/(tabs)/profile" as any),
            });
            return;
          }
          if (pinStatus?.is_locked) {
            toast({
              type: "error",
              title: "PIN Locked",
              message: "Your PIN is locked. Reset it from Settings.",
            });
            return;
          }
          setPinModal(true);
        },
      });
      return;
    }

    if (m === "flutterwave" && (!bankName || !accountNumber)) {
      return toast({ type: "warning", title: "Fill bank details" });
    }
    if (m === "wire_transfer" && !swiftCode && !iban) {
      return toast({ type: "warning", title: "Enter SWIFT or IBAN" });
    }
    if (m === "mobile_money" && (!mobileProvider || !mobileNumber)) {
      return toast({ type: "warning", title: "Fill mobile money details" });
    }
    if (m === "crypto" && (!cryptoAddress || !cryptoNetwork)) {
      return toast({ type: "warning", title: "Enter wallet address" });
    }
    if (m === "paypal" && !paypalEmail) {
      return toast({ type: "warning", title: "Enter PayPal email" });
    }
    if (m === "wise" && !wiseEmail) {
      return toast({ type: "warning", title: "Enter Wise email" });
    }

    if (!pinStatus?.pin_set) {
      confirm({
        title: "Set Transaction PIN",
        message:
          "You need a 4–6 digit transaction PIN before you can withdraw. Set one in Settings now?",
        confirmLabel: "Go to Settings",
        onConfirm: () => router.push("/(tabs)/profile" as any),
      });
      return;
    }

    if (pinStatus?.is_locked) {
      toast({
        type: "error",
        title: "PIN Locked",
        message: "Your PIN is locked. Reset it from Settings.",
      });
      return;
    }

    setPinModal(true);
  }

  async function submitWithdrawal() {
    if (!pin || pin.length < 4) {
      toast({ type: "warning", title: "Enter PIN" });
      return;
    }
    setSubmitting(true);
    try {
      const m = selectedMethod!.key;
      const body: any = {
        amount: Number(amount),
        currency: selectedCurrency,
        method: m,
        transaction_pin: pin,
        notes: notes || undefined,
      };

      if (m === "bank_transfer") {
        Object.assign(body, {
          bank_name: bankName,
          account_number: accountNumber,
          account_name: accountName,
          bank_code: bankCode,
          bank_country: bankCountry,
        });
      } else if (m === "flutterwave") {
        Object.assign(body, {
          flw_account_bank: bankCode || bankName,
          flw_account_number: accountNumber,
          account_name: accountName,
        });
      } else if (m === "wire_transfer") {
        Object.assign(body, {
          swift_code: swiftCode,
          iban,
          bank_address: bankAddress,
          account_name: accountName,
          bank_name: bankName,
        });
      } else if (m === "mobile_money") {
        Object.assign(body, {
          mobile_provider: mobileProvider,
          mobile_number: mobileNumber,
          mobile_country: mobileCountry,
        });
      } else if (m === "crypto") {
        Object.assign(body, {
          crypto_currency: cryptoCurrency,
          crypto_address: cryptoAddress,
          crypto_network: cryptoNetwork,
        });
      } else if (m === "paypal") {
        Object.assign(body, { paypal_email: paypalEmail });
      } else if (m === "wise") {
        Object.assign(body, { wise_email: wiseEmail });
      }

      const res = await apiPost("/api/withdrawals", token!, body);
      if (res.error) {
        if (res.code === "PIN_NOT_SET") {
          throw new Error("Transaction PIN not set. Set it in Settings first.");
        }
        if (res.locked) {
          throw new Error(res.error);
        }
        throw new Error(res.error);
      }

      setPinModal(false);
      setPin("");
      toast({
        type: "success",
        title: "Withdrawal submitted!",
        message: `${fmt(Number(amount), selectedCurrency)} processing within 24h.`,
        duration: 5000,
      });
      router.back();
    } catch (err: any) {
      toast({
        type: "error",
        title: "Withdrawal failed",
        message: err.message,
      });
    } finally {
      setSubmitting(false);
    }
  }

  // ── RENDER ──────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* Navy header */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() =>
            step === "fill_details" ? setStep("select_method") : router.back()
          }
          style={s.backBtn}
        >
          <FontAwesome5 name="arrow-left" size={14} color="#fff" />
          <Text style={s.backText}> Back</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Withdraw Funds</Text>
        <View style={s.availPill}>
          <Text style={s.availPillText}>
            {fmt(availableBalance, selectedCurrency)} available
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {step === "select_method" && (
            <>
              <Text style={s.sectionTitle}>
                CHOOSE HOW TO RECEIVE YOUR MONEY
              </Text>
              <Text style={s.subSection}>WITHDRAW FROM</Text>

              <View style={s.curGrid}>
                {wallets.map((w: any) => {
                  const isActive = w.currency === selectedCurrency;
                  return (
                    <TouchableOpacity
                      key={w.currency}
                      style={[s.curBtn, isActive && s.curBtnActive]}
                      onPress={() => setSelectedCurrency(w.currency)}
                    >
                      <Text
                        style={[s.curBtnText, isActive && s.curBtnTextActive]}
                      >
                        {sym(w.currency)}
                        {fmt(Number(w.available_balance), w.currency)
                          .replace(sym(w.currency), "")
                          .trim()}{" "}
                        {w.currency}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={{ height: SPACING.md }} />
              {eligibleMethods.map((m) => (
                <TouchableOpacity
                  key={m.key}
                  style={s.methodCard}
                  onPress={() => {
                    setSelectedMethod(m);
                    setStep("fill_details");
                  }}
                  activeOpacity={0.85}
                >
                  <View style={s.methodIconWrap}>
                    <FontAwesome5 name={m.icon} size={28} color={COLORS.navy} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.methodName}>{m.name}</Text>
                    <Text style={s.methodDesc} numberOfLines={1}>
                      {m.desc}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <View style={s.feePill}>
                      <Text style={s.feePillText}>{m.fee}</Text>
                    </View>
                    <FontAwesome5
                      name="chevron-right"
                      size={16}
                      color={COLORS.grayLight}
                      style={{ marginTop: 4 }}
                    />
                  </View>
                </TouchableOpacity>
              ))}
              <View style={{ height: 40 }} />
            </>
          )}

          {step === "fill_details" && selectedMethod && (
            <View style={s.formContainer}>
              {/* Selected method header */}
              <View style={s.methodHeader}>
                <View style={s.methodIconWrap}>
                  <FontAwesome5
                    name={selectedMethod.icon}
                    size={28}
                    color={COLORS.navy}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.methodName}>{selectedMethod.name}</Text>
                  <Text style={s.methodDesc}>{selectedMethod.fee}</Text>
                </View>
              </View>

              {/* Amount */}
              <View style={s.field}>
                <Text style={s.fieldLabel}>Amount ({selectedCurrency})</Text>
                <TextInput
                  style={s.input}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={setAmount}
                  placeholderTextColor={COLORS.grayLight}
                />
                <Text style={s.fieldHint}>
                  Available: {fmt(availableBalance, selectedCurrency)}
                </Text>
              </View>

              {/* ── BANK TRANSFER (NG) ── */}
              {selectedMethod.key === "bank_transfer" && (
                <>
                  <View style={s.field}>
                    <Text style={s.fieldLabel}>Bank</Text>
                    <TouchableOpacity
                      style={s.input}
                      onPress={() => setBankPickerOpen(true)}
                    >
                      <Text
                        style={[
                          s.inputText,
                          !bankName && { color: COLORS.grayLight },
                        ]}
                      >
                        {bankName || "Select bank"}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={s.field}>
                    <Text style={s.fieldLabel}>Account Number (10 digits)</Text>
                    <TextInput
                      style={s.input}
                      placeholder="0123456789"
                      keyboardType="number-pad"
                      maxLength={10}
                      value={accountNumber}
                      onChangeText={setAccountNumber}
                      placeholderTextColor={COLORS.grayLight}
                    />
                    {verifyingBank && (
                      <View style={s.verifyingRow}>
                        <ActivityIndicator size="small" color={COLORS.navy} />
                        <Text style={s.fieldHint}> Verifying account…</Text>
                      </View>
                    )}
                  </View>

                  {accountNumber.length === 10 && !verifyingBank && (
                    <TouchableOpacity
                      style={s.verifyBtn}
                      onPress={verifyNGBank}
                      disabled={verifyingBank || !bankCode}
                    >
                      <FontAwesome5 name="search" size={14} color="#fff" />
                      <Text style={s.verifyBtnText}>Verify Account</Text>
                    </TouchableOpacity>
                  )}

                  <View style={s.field}>
                    <Text style={s.fieldLabel}>Account Name</Text>
                    <TextInput
                      style={[s.input, accountName && s.inputVerified]}
                      placeholder={
                        accountName ? "" : "Enter account holder name"
                      }
                      value={accountName}
                      onChangeText={setAccountName}
                      placeholderTextColor={COLORS.grayLight}
                    />
                    {accountName ? (
                      <View style={s.verifiedBox}>
                        <FontAwesome5
                          name="check-circle"
                          size={16}
                          color="#065f46"
                        />
                        <Text style={s.verifiedText}> {accountName}</Text>
                      </View>
                    ) : null}
                  </View>

                  {/* ═══ WARNING DISCLAIMER ═══ */}
                  <View style={s.disclaimerBox}>
                    <View style={s.disclaimerHeader}>
                      <FontAwesome5
                        name="exclamation-triangle"
                        size={18}
                        color="#92400e"
                      />
                      <Text style={s.disclaimerTitle}>
                        ⚠️ Important: Verify Account Details
                      </Text>
                    </View>
                    <Text style={s.disclaimerText}>
                      • Please ensure the account name matches the bank account
                      exactly.
                    </Text>
                    <Text style={s.disclaimerText}>
                      • If the account name is incorrect, the transfer may fail
                      or be sent to the wrong account.
                    </Text>
                    <Text style={s.disclaimerText}>
                      •{" "}
                      <Text style={s.disclaimerBold}>
                        We will not be held liable
                      </Text>{" "}
                      for funds sent to incorrect accounts due to wrong account
                      information.
                    </Text>
                    <Text style={s.disclaimerText}>
                      •{" "}
                      <Text style={s.disclaimerBold}>
                        This action is irreversible
                      </Text>{" "}
                      once the transfer is processed.
                    </Text>
                    <View style={s.disclaimerConfirmRow}>
                      <Text style={s.disclaimerConfirmText}>
                        By proceeding, you confirm the account details are
                        correct.
                      </Text>
                    </View>
                  </View>
                </>
              )}

              {/* ── FLUTTERWAVE ── */}
              {selectedMethod.key === "flutterwave" && (
                <>
                  <View style={s.field}>
                    <Text style={s.fieldLabel}>Bank Name / Code</Text>
                    <TextInput
                      style={s.input}
                      placeholder="e.g. GTB or 058"
                      value={bankName}
                      onChangeText={setBankName}
                      placeholderTextColor={COLORS.grayLight}
                    />
                  </View>
                  <View style={s.field}>
                    <Text style={s.fieldLabel}>Account Number</Text>
                    <TextInput
                      style={s.input}
                      keyboardType="number-pad"
                      value={accountNumber}
                      onChangeText={setAccountNumber}
                      placeholderTextColor={COLORS.grayLight}
                    />
                  </View>
                  <View style={s.field}>
                    <Text style={s.fieldLabel}>Account Name</Text>
                    <TextInput
                      style={s.input}
                      value={accountName}
                      onChangeText={setAccountName}
                      placeholderTextColor={COLORS.grayLight}
                    />
                  </View>
                </>
              )}

              {/* ── WIRE TRANSFER ── */}
              {selectedMethod.key === "wire_transfer" && (
                <>
                  <View style={s.field}>
                    <Text style={s.fieldLabel}>Account Holder Name</Text>
                    <TextInput
                      style={s.input}
                      value={accountName}
                      onChangeText={setAccountName}
                      placeholderTextColor={COLORS.grayLight}
                    />
                  </View>
                  <View style={s.field}>
                    <Text style={s.fieldLabel}>Bank Name</Text>
                    <TextInput
                      style={s.input}
                      value={bankName}
                      onChangeText={setBankName}
                      placeholderTextColor={COLORS.grayLight}
                    />
                  </View>
                  <View style={s.field}>
                    <Text style={s.fieldLabel}>SWIFT / BIC Code</Text>
                    <TextInput
                      style={s.input}
                      autoCapitalize="characters"
                      value={swiftCode}
                      onChangeText={setSwiftCode}
                      placeholderTextColor={COLORS.grayLight}
                    />
                  </View>
                  <View style={s.field}>
                    <Text style={s.fieldLabel}>IBAN (or Account Number)</Text>
                    <TextInput
                      style={s.input}
                      autoCapitalize="characters"
                      value={iban}
                      onChangeText={setIban}
                      placeholderTextColor={COLORS.grayLight}
                    />
                  </View>
                  <View style={s.field}>
                    <Text style={s.fieldLabel}>Bank Address</Text>
                    <TextInput
                      style={[
                        s.input,
                        { minHeight: 60, textAlignVertical: "top" },
                      ]}
                      multiline
                      value={bankAddress}
                      onChangeText={setBankAddress}
                      placeholderTextColor={COLORS.grayLight}
                    />
                  </View>
                </>
              )}

              {/* ── MOBILE MONEY ── */}
              {selectedMethod.key === "mobile_money" && (
                <>
                  <View style={s.field}>
                    <Text style={s.fieldLabel}>Provider</Text>
                    <TouchableOpacity
                      style={s.input}
                      onPress={() => setMobilePickerOpen(true)}
                    >
                      <Text
                        style={[
                          s.inputText,
                          !mobileProvider && { color: COLORS.grayLight },
                        ]}
                      >
                        {mobileProvider || "Select provider"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <View style={s.field}>
                    <Text style={s.fieldLabel}>
                      Mobile Number (with country code)
                    </Text>
                    <TextInput
                      style={s.input}
                      placeholder="+234..."
                      keyboardType="phone-pad"
                      value={mobileNumber}
                      onChangeText={setMobileNumber}
                      placeholderTextColor={COLORS.grayLight}
                    />
                  </View>
                </>
              )}

              {/* ── CRYPTO ── */}
              {selectedMethod.key === "crypto" && (
                <>
                  <View style={s.field}>
                    <Text style={s.fieldLabel}>Currency</Text>
                    <TouchableOpacity
                      style={s.input}
                      onPress={() => setCryptoCurOpen(!cryptoCurOpen)}
                    >
                      <Text style={s.inputText}>{cryptoCurrency}</Text>
                    </TouchableOpacity>
                    {cryptoCurOpen && (
                      <View style={s.dropdown}>
                        {CRYPTO_CURRENCIES.map((c) => (
                          <TouchableOpacity
                            key={c}
                            style={s.dropdownItem}
                            onPress={() => {
                              setCryptoCurrency(c);
                              setCryptoCurOpen(false);
                            }}
                          >
                            <Text style={s.dropdownText}>{c}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                  <View style={s.field}>
                    <Text style={s.fieldLabel}>Network</Text>
                    <TouchableOpacity
                      style={s.input}
                      onPress={() => setCryptoNetOpen(!cryptoNetOpen)}
                    >
                      <Text style={s.inputText}>{cryptoNetwork}</Text>
                    </TouchableOpacity>
                    {cryptoNetOpen && (
                      <View style={s.dropdown}>
                        {CRYPTO_NETWORKS.map((n) => (
                          <TouchableOpacity
                            key={n}
                            style={s.dropdownItem}
                            onPress={() => {
                              setCryptoNetwork(n);
                              setCryptoNetOpen(false);
                            }}
                          >
                            <Text style={s.dropdownText}>{n}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                  <View style={s.field}>
                    <Text style={s.fieldLabel}>Wallet Address</Text>
                    <TextInput
                      style={[s.input, { fontSize: 12 }]}
                      autoCapitalize="none"
                      value={cryptoAddress}
                      onChangeText={setCryptoAddress}
                      placeholder="Paste your wallet address"
                      placeholderTextColor={COLORS.grayLight}
                    />
                    <View style={s.warningRow}>
                      <FontAwesome5
                        name="exclamation-triangle"
                        size={14}
                        color="#92400e"
                      />
                      <Text style={s.warning}>
                        {" "}
                        Double-check the address. Crypto transfers are
                        irreversible.
                      </Text>
                    </View>
                  </View>
                </>
              )}

              {/* ── PAYPAL ── */}
              {selectedMethod.key === "paypal" && (
                <View style={s.field}>
                  <Text style={s.fieldLabel}>PayPal Email</Text>
                  <TextInput
                    style={s.input}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={paypalEmail}
                    onChangeText={setPaypalEmail}
                    placeholder="you@example.com"
                    placeholderTextColor={COLORS.grayLight}
                  />
                </View>
              )}

              {/* ── WISE ── */}
              {selectedMethod.key === "wise" && (
                <View style={s.field}>
                  <Text style={s.fieldLabel}>Wise Email</Text>
                  <TextInput
                    style={s.input}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={wiseEmail}
                    onChangeText={setWiseEmail}
                    placeholder="you@example.com"
                    placeholderTextColor={COLORS.grayLight}
                  />
                </View>
              )}

              {/* Notes */}
              <View style={s.field}>
                <Text style={s.fieldLabel}>Notes (optional)</Text>
                <TextInput
                  style={[s.input, { minHeight: 60, textAlignVertical: "top" }]}
                  multiline
                  value={notes}
                  onChangeText={setNotes}
                  placeholderTextColor={COLORS.grayLight}
                  placeholder="Anything we should know?"
                />
              </View>

              {/* Submit */}
              <TouchableOpacity
                style={[
                  s.submitBtn,
                  (!amount || submitting) && s.submitBtnDisabled,
                ]}
                onPress={handleSubmit}
                disabled={!amount || submitting}
              >
                <Text style={s.submitBtnText}>Continue to PIN</Text>
              </TouchableOpacity>

              <View style={{ height: 40 }} />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ═══════ NG BANK PICKER MODAL ═══════ */}
      <Modal
        visible={bankPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setBankPickerOpen(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Select Bank</Text>
              <TouchableOpacity onPress={() => setBankPickerOpen(false)}>
                <FontAwesome5 name="times" size={22} color={COLORS.gray} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {ngBanks.map((b: any) => (
                <TouchableOpacity
                  key={b.code}
                  style={s.bankRow}
                  onPress={() => {
                    setBankName(b.name);
                    setBankCode(b.code);
                    setBankPickerOpen(false);
                  }}
                >
                  <Text style={s.bankName}>{b.name}</Text>
                  <Text style={s.bankCode}>{b.code}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ═══════ MOBILE PROVIDER PICKER ═══════ */}
      <Modal
        visible={mobilePickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setMobilePickerOpen(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Select Provider</Text>
              <TouchableOpacity onPress={() => setMobilePickerOpen(false)}>
                <FontAwesome5 name="times" size={22} color={COLORS.gray} />
              </TouchableOpacity>
            </View>
            {MOBILE_PROVIDERS.map((p) => (
              <TouchableOpacity
                key={p}
                style={s.bankRow}
                onPress={() => {
                  setMobileProvider(p);
                  setMobilePickerOpen(false);
                }}
              >
                <Text style={s.bankName}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* ═══════ PIN MODAL ═══════ */}
      <Modal
        visible={pinModal}
        transparent
        animationType="fade"
        onRequestClose={() => !submitting && setPinModal(false)}
      >
        <View style={s.pinOverlay}>
          <View style={s.pinCard}>
            <View style={s.pinTitleRow}>
              <FontAwesome5 name="lock" size={20} color={COLORS.navy} />
              <Text style={s.pinTitle}> Enter Transaction PIN</Text>
            </View>
            <Text style={s.pinSub}>
              Confirming withdrawal of{" "}
              {fmt(Number(amount || 0), selectedCurrency)} via{" "}
              {selectedMethod?.name}
            </Text>
            <TextInput
              style={s.pinInput}
              value={pin}
              onChangeText={setPin}
              keyboardType="number-pad"
              maxLength={6}
              secureTextEntry
              placeholder="••••"
              placeholderTextColor={COLORS.grayLight}
              autoFocus
            />
            <View style={s.pinActions}>
              <TouchableOpacity
                style={s.pinCancel}
                onPress={() => {
                  setPinModal(false);
                  setPin("");
                }}
                disabled={submitting}
              >
                <Text style={s.pinCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.pinConfirm, submitting && { opacity: 0.6 }]}
                onPress={submitWithdrawal}
                disabled={submitting || pin.length < 4}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.pinConfirmText}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.navy,
    gap: SPACING.sm,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  backText: { fontFamily: FONTS.bold, fontSize: 12, color: "#fff" },
  headerTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: "#fff",
    flex: 1,
    textAlign: "center",
  },
  availPill: {
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  availPillText: { fontFamily: FONTS.bold, fontSize: 11, color: "#fff" },

  // Sections
  sectionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.gray,
    letterSpacing: 0.6,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  subSection: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.gray,
    letterSpacing: 0.6,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },

  // Currency grid
  curGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  curBtn: {
    backgroundColor: COLORS.muted,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    borderColor: "transparent",
  },
  curBtnActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  curBtnText: { fontFamily: FONTS.bold, fontSize: 14, color: COLORS.navy },
  curBtnTextActive: { color: "#fff" },

  // Method cards
  methodCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.md,
  },
  methodIconWrap: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  methodName: { fontFamily: FONTS.bold, fontSize: 15, color: COLORS.navy },
  methodDesc: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2,
  },
  feePill: {
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  feePillText: { fontFamily: FONTS.bold, fontSize: 10, color: "#065f46" },

  // Form
  formContainer: { padding: SPACING.md },
  methodHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },

  field: { marginBottom: SPACING.md },
  fieldLabel: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.navy,
    marginBottom: 6,
  },
  fieldHint: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.gray,
    marginTop: 4,
  },
  input: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.navy,
    minHeight: 44,
    justifyContent: "center",
  },
  inputText: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.navy },

  verifyingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },

  verifiedBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ecfdf5",
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.green,
    marginBottom: SPACING.md,
  },
  verifiedText: { fontFamily: FONTS.bold, fontSize: 13, color: "#065f46" },

  warningRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  warning: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: "#92400e",
    flex: 1,
  },

  dropdown: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    marginTop: 4,
    overflow: "hidden",
  },
  dropdownItem: {
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dropdownText: { fontFamily: FONTS.medium, fontSize: 14, color: COLORS.navy },

  submitBtn: {
    backgroundColor: COLORS.navy,
    borderRadius: RADIUS.lg,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: SPACING.md,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { fontFamily: FONTS.bold, fontSize: 15, color: "#fff" },

  // Bank picker modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "75%",
    paddingTop: SPACING.md,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: { fontFamily: FONTS.bold, fontSize: 16, color: COLORS.navy },
  bankRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  bankName: { fontFamily: FONTS.medium, fontSize: 14, color: COLORS.navy },
  bankCode: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.gray },

  // PIN modal
  pinOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.lg,
  },
  pinCard: {
    backgroundColor: "#fff",
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    width: "100%",
    maxWidth: 360,
  },
  pinTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.sm,
  },
  pinTitle: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.navy,
    textAlign: "center",
  },
  pinSub: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.gray,
    textAlign: "center",
    marginBottom: SPACING.md,
    lineHeight: 19,
  },
  pinInput: {
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontFamily: FONTS.bold,
    fontSize: 24,
    color: COLORS.navy,
    textAlign: "center",
    letterSpacing: 12,
    marginBottom: SPACING.md,
  },
  pinActions: { flexDirection: "row", gap: SPACING.sm },
  pinCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.muted,
    alignItems: "center",
  },
  pinCancelText: { fontFamily: FONTS.bold, fontSize: 14, color: COLORS.gray },
  pinConfirm: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.navy,
    alignItems: "center",
  },
  pinConfirmText: { fontFamily: FONTS.bold, fontSize: 14, color: "#fff" },

  // Verify button
  verifyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.navy,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    gap: 8,
  },
  verifyBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: "#fff",
  },
  inputVerified: {
    borderColor: COLORS.green,
    backgroundColor: "#f0fdf4",
  },

  // Disclaimer / Warning Box
  disclaimerBox: {
    backgroundColor: "#fffbeb",
    borderWidth: 2,
    borderColor: "#f59e0b",
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  disclaimerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: 8,
  },
  disclaimerTitle: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: "#92400e",
  },
  disclaimerText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: "#78350f",
    lineHeight: 18,
    marginBottom: 4,
    paddingLeft: 4,
  },
  disclaimerBold: {
    fontFamily: FONTS.bold,
    color: "#78350f",
  },
  disclaimerConfirmRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#fde68a",
  },
  disclaimerConfirmText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: "#92400e",
    textAlign: "center",
  },
});
