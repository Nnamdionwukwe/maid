import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useAuthStore } from "../stores/authStore";
import { API_URL, COLORS, FONTS, SPACING, RADIUS } from "../constants";
import { useAppToast } from "../components/AppToast";
import MaidAvatar from "../components/MaidAvatar";
import { SubscriptionBadge, VerifiedBadge } from "../components/MaidBadge";
import { useTranslation } from "react-i18next";
import { FontAwesome5 } from "@expo/vector-icons";

import * as FileSystem from "expo-file-system";

// ── Helper: check if interval is annual ──────────────────────────────
function isAnnual(interval?: string) {
  return ["annual", "yearly", "year"].includes(interval || "");
}

// ── Helper: compute renewal date from start date + interval ──────────
function getRenewalDate(sub: any, isAnnualPlan: boolean): Date {
  const start = sub?.current_period_start
    ? new Date(sub.current_period_start)
    : new Date();
  const monthsToAdd = isAnnualPlan ? 12 : 1;
  const end = new Date(start);
  end.setMonth(end.getMonth() + monthsToAdd);
  return end;
}

// ── API helpers ───────────────────────────────────────────────────────
const apiFetch = (path: string, token: string) =>
  fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json());

const apiPatch = (path: string, token: string, body: any) =>
  fetch(`${API_URL}${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  }).then((r) => r.json());

const apiPost = (path: string, token: string, body: any) =>
  fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  }).then((r) => r.json());

type Section =
  | null
  | "profile"
  | "emergency"
  | "appearance"
  | "notifications"
  | "subscription"
  | "payouts"
  | "pin"
  | "security";

// ── FLUTTERWAVE SUPPORTED CURRENCIES (18 currencies) ────────────────
const PLATFORM_CURRENCIES = [
  // African Currencies
  { code: "NGN", symbol: "₦", name: "Nigerian Naira", country: "Nigeria" },
  { code: "GHS", symbol: "₵", name: "Ghanaian Cedi", country: "Ghana" },
  { code: "KES", symbol: "KSh", name: "Kenyan Shilling", country: "Kenya" },
  { code: "UGX", symbol: "USh", name: "Ugandan Shilling", country: "Uganda" },
  {
    code: "TZS",
    symbol: "TSh",
    name: "Tanzanian Shilling",
    country: "Tanzania",
  },
  {
    code: "ZAR",
    symbol: "R",
    name: "South African Rand",
    country: "South Africa",
  },
  { code: "RWF", symbol: "FRw", name: "Rwandan Franc", country: "Rwanda" },
  {
    code: "XOF",
    symbol: "CFA",
    name: "West African CFA Franc",
    country: "West Africa",
  },

  // Major World Currencies
  { code: "USD", symbol: "$", name: "US Dollar", country: "United States" },
  {
    code: "GBP",
    symbol: "£",
    name: "British Pound",
    country: "United Kingdom",
  },
  { code: "EUR", symbol: "€", name: "Euro", country: "European Union" },
  { code: "CAD", symbol: "CA$", name: "Canadian Dollar", country: "Canada" },
  {
    code: "AUD",
    symbol: "A$",
    name: "Australian Dollar",
    country: "Australia",
  },

  // European Currencies
  { code: "CHF", symbol: "CHF", name: "Swiss Franc", country: "Switzerland" },
  { code: "SEK", symbol: "kr", name: "Swedish Krona", country: "Sweden" },
  { code: "NOK", symbol: "kr", name: "Norwegian Krone", country: "Norway" },
  { code: "DKK", symbol: "kr", name: "Danish Krone", country: "Denmark" },
  { code: "PLN", symbol: "zł", name: "Polish Zloty", country: "Poland" },
];

// For the country select dropdown (with flags)
const COUNTRIES = [
  { code: "NG", flag: "🇳🇬", name: "Nigeria" },
  { code: "GH", flag: "🇬🇭", name: "Ghana" },
  { code: "KE", flag: "🇰🇪", name: "Kenya" },
  { code: "ZA", flag: "🇿🇦", name: "South Africa" },
  { code: "UG", flag: "🇺🇬", name: "Uganda" },
  { code: "TZ", flag: "🇹🇿", name: "Tanzania" },
  { code: "RW", flag: "🇷🇼", name: "Rwanda" },
  { code: "ET", flag: "🇪🇹", name: "Ethiopia" },
  { code: "GB", flag: "🇬🇧", name: "United Kingdom" },
  { code: "US", flag: "🇺🇸", name: "United States" },
  { code: "CA", flag: "🇨🇦", name: "Canada" },
  { code: "AU", flag: "🇦🇺", name: "Australia" },
  { code: "NZ", flag: "🇳🇿", name: "New Zealand" },
  { code: "IN", flag: "🇮🇳", name: "India" },
  { code: "AE", flag: "🇦🇪", name: "UAE" },
  { code: "SA", flag: "🇸🇦", name: "Saudi Arabia" },
  { code: "SG", flag: "🇸🇬", name: "Singapore" },
  { code: "MY", flag: "🇲🇾", name: "Malaysia" },
  { code: "JP", flag: "🇯🇵", name: "Japan" },
  { code: "CN", flag: "🇨🇳", name: "China" },
  { code: "HK", flag: "🇭🇰", name: "Hong Kong" },
  { code: "PH", flag: "🇵🇭", name: "Philippines" },
  { code: "TH", flag: "🇹🇭", name: "Thailand" },
  { code: "ID", flag: "🇮🇩", name: "Indonesia" },
  { code: "PK", flag: "🇵🇰", name: "Pakistan" },
  { code: "BD", flag: "🇧🇩", name: "Bangladesh" },
  { code: "VN", flag: "🇻🇳", name: "Vietnam" },
  { code: "IL", flag: "🇮🇱", name: "Israel" },
  { code: "TR", flag: "🇹🇷", name: "Turkey" },
  { code: "CZ", flag: "🇨🇿", name: "Czech Republic" },
  { code: "PL", flag: "🇵🇱", name: "Poland" },
  { code: "HU", flag: "🇭🇺", name: "Hungary" },
  { code: "RO", flag: "🇷🇴", name: "Romania" },
  { code: "BR", flag: "🇧🇷", name: "Brazil" },
  { code: "MX", flag: "🇲🇽", name: "Mexico" },
  { code: "CH", flag: "🇨🇭", name: "Switzerland" },
  { code: "SE", flag: "🇸🇪", name: "Sweden" },
  { code: "NO", flag: "🇳🇴", name: "Norway" },
  { code: "DK", flag: "🇩🇰", name: "Denmark" },
];

const RELATIONSHIPS = [
  "spouse",
  "parent",
  "sibling",
  "child",
  "family",
  "friend",
  "partner",
  "guardian",
];

// Maid-specific notification categories
const NOTIF_CATEGORIES = [
  {
    key: "bookings",
    label: "Booking Requests",
    sub: "New jobs, accepts, cancellations",
  },
  {
    key: "payments",
    label: "Earnings & Payouts",
    sub: "Payment received, withdrawals",
  },
  { key: "messages", label: "Messages", sub: "Customer messages" },
  { key: "reviews", label: "Reviews", sub: "New customer reviews" },
  { key: "support", label: "Support", sub: "Ticket replies" },
  { key: "system", label: "System", sub: "Security alerts, account updates" },
  { key: "promotions", label: "Promotions", sub: "Tips, features, news" },
];

// Payout methods (matches withdraw screen)
const PAYOUT_METHODS = [
  {
    key: "bank_transfer",
    icon: "university",
    name: "Nigerian Bank / Fintech",
    desc: "Nigerian bank accounts via Paystack",
  },
  {
    key: "wire_transfer",
    icon: "globe",
    name: "International Wire (SWIFT)",
    desc: "Global bank transfers",
  },
  {
    key: "mobile_money",
    icon: "mobile-alt",
    name: "Mobile Money",
    desc: "M-Pesa, MTN MoMo, etc.",
  },
  {
    key: "paypal",
    icon: "paypal",
    name: "PayPal",
    desc: "PayPal email transfer",
  },
  {
    key: "wise",
    icon: "globe",
    name: "Wise (TransferWise)",
    desc: "Cheapest international",
  },
  {
    key: "crypto",
    icon: "bitcoin",
    name: "Cryptocurrency",
    desc: "USDT, USDC, BTC, ETH",
  },
  {
    key: "flutterwave",
    icon: "wave-square",
    name: "Flutterwave",
    desc: "Pan-African transfers",
  },
];

export default function MaidSettingsScreen() {
  const router = useRouter();
  const { token, user, logout, refreshUser } = useAuthStore();
  const { toast, confirm } = useAppToast();
  const { t } = useTranslation();

  const [active, setActive] = useState<Section>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Profile form
  const [pf, setPf] = useState({ name: "", phone: "", country: "NG" });
  const [pfInit, setPfInit] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState("NGN");
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);

  // Emergency form
  const [ef, setEf] = useState({
    name: "",
    phone: "",
    email: "",
    relationship: "family",
  });

  // Password form
  const [pwf, setPwf] = useState({ current: "", newPw: "", confirmPw: "" });
  const [showPw, setShowPw] = useState(false);

  // ── Payouts ──
  const [payoutMethod, setPayoutMethod] = useState<string>("bank_transfer");
  const [bankName, setBankName] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [bankPickerOpen, setBankPickerOpen] = useState(false);
  const [verifyingBank, setVerifyingBank] = useState(false);

  // ── PIN ──
  const [pinModal, setPinModal] = useState<null | "set" | "change">(null);
  const [pinFields, setPinFields] = useState({
    pin: "",
    confirm: "",
    current: "",
    password: "",
  });
  const [submittingPin, setSubmittingPin] = useState(false);

  const [deleteModal, setDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [showDeletePw, setShowDeletePw] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Queries ──
  const { data: meData, refetch: refetchMe } = useQuery({
    queryKey: ["profile-me"],
    queryFn: () => apiFetch("/api/auth/me", token!),
    enabled: !!token,
    staleTime: 0,
    refetchOnMount: true,
  });

  const { data: settingsData, refetch: refetchSettings } = useQuery({
    queryKey: ["profile-settings"],
    queryFn: () => apiFetch("/api/settings", token!),
    enabled: !!token,
  });

  const { data: subData } = useQuery({
    queryKey: ["profile-subscription"],
    queryFn: () => apiFetch("/api/subscriptions/my", token!),
    enabled: !!token,
  });

  const { data: plansData } = useQuery({
    queryKey: ["plans-for-settings"],
    queryFn: () =>
      apiFetch("/api/subscriptions/plans?role=maid&currency=NGN", token!),
    enabled: !!token,
  });

  const { data: ecData, refetch: refetchEC } = useQuery({
    queryKey: ["emergency-contacts"],
    queryFn: () => apiFetch("/api/bookings/emergency-contacts", token!),
    enabled: !!token,
  });

  const { data: langData } = useQuery({
    queryKey: ["languages"],
    queryFn: () => apiFetch("/api/settings/languages", token!),
    enabled: !!token,
  });

  // ── REMOVED: API currency query - using PLATFORM_CURRENCIES directly ──
  // const { data: curData } = useQuery({
  //   queryKey: ["currencies"],
  //   queryFn: () => apiFetch("/api/settings/currencies", token!),
  //   enabled: !!token,
  // });

  const { data: notifPrefData, refetch: refetchNotifPrefs } = useQuery({
    queryKey: ["notif-preferences"],
    queryFn: () => apiFetch("/api/notifications/preferences", token!),
    enabled: !!token,
  });

  const { data: bankDetailsData, refetch: refetchBankDetails } = useQuery({
    queryKey: ["maid-bank-details"],
    queryFn: () => apiFetch("/api/payments/bank-details", token!),
    enabled: !!token,
  });

  const { data: pinStatusData, refetch: refetchPinStatus } = useQuery({
    queryKey: ["pin-status"],
    queryFn: () => apiFetch("/api/settings/pin/status", token!),
    enabled: !!token,
  });

  const { data: ngBanksData } = useQuery({
    queryKey: ["ng-banks-settings"],
    queryFn: () => apiFetch("/api/withdrawals/ng-banks", token!),
    enabled: !!token,
  });

  useFocusEffect(
    useCallback(() => {
      refetchMe();
    }, []),
  );

  const profile = meData?.user || user;
  const settings = settingsData?.settings || {};
  const subscription = subData?.subscription;
  const isFree = subData?.is_free !== false;
  const contacts = ecData?.contacts || [];
  const languages = langData?.languages || [];

  // ── USE PLATFORM_CURRENCIES DIRECTLY (all 40+ currencies) ──
  const currencies = PLATFORM_CURRENCIES;

  const notifPrefs = notifPrefData?.preferences || {};
  const savedBank = bankDetailsData?.bank_details;
  const pinStatus = pinStatusData || {};
  const ngBanks = ngBanksData?.banks || [];

  // ── Find the current plan from plans list ──────────────────────────
  const plans = plansData?.plans || [];
  const currentPlan = plans.find((p: any) => p.id === subscription?.plan_id);
  const isAnnualPlan = currentPlan
    ? isAnnual(currentPlan.interval)
    : isAnnual(subscription?.interval);

  // ── Compute renewal date ──────────────────────────────────────────
  const renewalDate = subscription?.current_period_start
    ? getRenewalDate(subscription, isAnnualPlan)
    : subscription?.current_period_end
      ? new Date(subscription.current_period_end)
      : null;

  // ── Initialize forms ──
  useEffect(() => {
    if (profile && !pfInit) {
      setPf({
        name: profile.name || "",
        phone: profile.phone || "",
        country: profile.country || "NG",
      });
      setPfInit(true);
    }
  }, [profile]);

  // ── Set currency from settings ──
  useEffect(() => {
    if (settings?.preferred_currency) {
      setSelectedCurrency(settings.preferred_currency);
    }
  }, [settings]);

  useEffect(() => {
    if (savedBank) {
      setBankName(savedBank.bank_name || "");
      setBankCode(savedBank.bank_code || "");
      setAccountNumber(savedBank.account_number || "");
      setAccountName(savedBank.account_name || "");
    }
  }, [savedBank]);

  // Auto-verify NG bank
  useEffect(() => {
    if (
      payoutMethod === "bank_transfer" &&
      bankCode &&
      accountNumber.length === 10 &&
      accountName !== savedBank?.account_name
    ) {
      verifyNGBank();
    }
  }, [accountNumber, bankCode]);

  const onRefresh = useCallback(async () => {
    await Promise.all([
      refetchMe(),
      refetchSettings(),
      refetchEC(),
      refetchNotifPrefs(),
      refetchBankDetails(),
      refetchPinStatus(),
    ]);
  }, []);

  function toggle(s: Section) {
    setActive((p) => (p === s ? null : s));
  }

  // ── Avatar upload ───────────────────────────────────────────────

  async function handleAvatarPick() {
    // Request permission first
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      toast({
        type: "warning",
        title: "Permission required",
        message: "Please grant photo library access to change your avatar.",
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];

    // ✅ Check file size (5MB limit)
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
      toast({
        type: "error",
        title: "File too large",
        message: "Image must be under 5MB. Please choose a smaller image.",
      });
      return;
    }

    setUploading(true);
    try {
      // ✅ Use XMLHttpRequest - works reliably in production builds
      const formData = new FormData();
      const filename =
        asset.fileName || asset.uri.split("/").pop() || "avatar.jpg";
      const mimeType = asset.mimeType || "image/jpeg";

      // ✅ This format works with production builds
      formData.append("avatar", {
        uri: asset.uri,
        type: mimeType,
        name: filename,
      } as any);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_URL}/api/auth/avatar`);
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);

      const uploadPromise = new Promise((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status === 200 || xhr.status === 201) {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch {
              resolve(xhr.responseText);
            }
          } else {
            try {
              const data = JSON.parse(xhr.responseText);
              reject(new Error(data.error || "Upload failed"));
            } catch {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          }
        };
        xhr.onerror = () =>
          reject(new Error("Network error - check your connection"));
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            console.log(
              `Upload progress: ${Math.round((e.loaded / e.total) * 100)}%`,
            );
          }
        };
      });

      xhr.send(formData);
      await uploadPromise;

      await refreshUser();
      await refetchMe();

      toast({
        type: "success",
        title: "Avatar updated!",
        message: "Your profile picture has been updated successfully.",
      });
    } catch (err: any) {
      console.error("Upload error:", err);
      toast({
        type: "error",
        title: "Upload failed",
        message: err.message || "Could not upload image. Please try again.",
      });
    } finally {
      setUploading(false);
    }
  }

  // ── Profile save ────────────────────────────────────────────────
  async function handleSaveProfile() {
    if (!pf.name.trim() || pf.name.trim().length < 2) {
      toast({ type: "error", title: "Name must be at least 2 characters" });
      return;
    }
    setSaving(true);
    try {
      // Save profile info
      const res = await fetch(`${API_URL}/api/auth/update-profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: pf.name.trim(),
          phone: pf.phone || null,
          country: pf.country,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Save currency preference
      await apiPatch("/api/settings", token!, {
        preferred_currency: selectedCurrency,
      });

      refetchMe();
      refetchSettings();
      useAuthStore.getState().updateUser?.({
        ...user,
        name: pf.name.trim(),
        phone: pf.phone,
        country: pf.country,
        preferred_currency: selectedCurrency,
      });
      toast({ type: "success", title: "Profile updated!" });
    } catch (err: any) {
      toast({ type: "error", title: "Failed", message: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function updateSetting(body: any) {
    try {
      const res = await apiPatch("/api/settings", token!, body);
      if (body.language) {
        // Update i18n if language changes
        // i18n.changeLanguage(body.language);
      }
      refetchSettings();
      refetchMe();
    } catch (err) {
      console.log("updateSetting error", err);
    }
  }

  async function updateNotifPref(body: any) {
    try {
      await apiPatch("/api/notifications/preferences", token!, body);
      refetchNotifPrefs();
    } catch (err: any) {
      toast({ type: "error", title: "Failed", message: err.message });
    }
  }

  // ── Emergency contacts ──────────────────────────────────────────
  async function handleAddContact() {
    if (!ef.name.trim() || !ef.phone.trim()) {
      toast({ type: "error", title: "Name and phone are required" });
      return;
    }
    setSaving(true);
    try {
      const res = await apiPost("/api/bookings/emergency-contacts", token!, {
        name: ef.name.trim(),
        phone: ef.phone.trim(),
        email: ef.email.trim() || undefined,
        relationship: ef.relationship,
        is_primary: contacts.length === 0,
      });
      if (res.error) throw new Error(res.error);
      setEf({ name: "", phone: "", email: "", relationship: "family" });
      refetchEC();
      toast({ type: "success", title: "Contact added!" });
    } catch (err: any) {
      toast({ type: "error", title: "Failed", message: err.message });
    } finally {
      setSaving(false);
    }
  }

  function handleDeleteContact(id: string) {
    confirm({
      title: "Remove contact",
      message: "Delete this emergency contact?",
      destructive: true,
      onConfirm: async () => {
        await fetch(`${API_URL}/api/bookings/emergency-contacts/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        refetchEC();
      },
    });
  }

  // ── Payouts: verify NG bank ─────────────────────────────────────
  async function verifyNGBank() {
    if (!accountNumber || !bankCode) return;
    setVerifyingBank(true);
    try {
      const res = await apiPost("/api/withdrawals/ng-banks/verify", token!, {
        account_number: accountNumber,
        bank_code: bankCode,
      });
      if (res.error) throw new Error(res.error);
      setAccountName(res.account_name);
    } catch (err: any) {
      toast({
        type: "error",
        title: "Verification failed",
        message: err.message,
      });
    } finally {
      setVerifyingBank(false);
    }
  }

  // ── Save bank details ──────────────────────────────────────────
  async function handleSaveBank() {
    if (!bankName || !accountNumber || !accountName) {
      toast({ type: "warning", title: "Fill all bank fields" });
      return;
    }
    setSaving(true);
    try {
      const res = await apiPost("/api/payments/bank-details", token!, {
        bank_name: bankName,
        account_number: accountNumber,
        account_name: accountName,
        bank_code: bankCode,
        country: "NG",
        currency: "NGN",
      });
      if (res.error) throw new Error(res.error);
      toast({ type: "success", title: "Payout details saved!" });
      refetchBankDetails();
    } catch (err: any) {
      toast({ type: "error", title: "Failed", message: err.message });
    } finally {
      setSaving(false);
    }
  }

  // ── PIN: open set/change modal ──────────────────────────────────
  function openPinModal(mode: "set" | "change") {
    setPinFields({ pin: "", confirm: "", current: "", password: "" });
    setPinModal(mode);
  }

  // ── PIN: submit ─────────────────────────────────────────────────
  async function submitPin() {
    if (pinModal === "set") {
      if (!/^\d{4,6}$/.test(pinFields.pin)) {
        toast({ type: "warning", title: "PIN must be 4–6 digits" });
        return;
      }
      if (pinFields.pin !== pinFields.confirm) {
        toast({ type: "warning", title: "PINs don't match" });
        return;
      }
      setSubmittingPin(true);
      try {
        const res = await apiPost("/api/settings/pin/set", token!, {
          pin: pinFields.pin,
          confirm_pin: pinFields.confirm,
          password: pinFields.password || undefined,
        });
        if (res.error) throw new Error(res.error);
        toast({ type: "success", title: "PIN set!" });
        setPinModal(null);
        refetchPinStatus();
      } catch (err: any) {
        toast({ type: "error", title: "Failed", message: err.message });
      } finally {
        setSubmittingPin(false);
      }
    } else if (pinModal === "change") {
      if (!pinFields.current || !pinFields.pin || !pinFields.confirm) {
        toast({ type: "warning", title: "Fill all fields" });
        return;
      }
      if (pinFields.pin !== pinFields.confirm) {
        toast({ type: "warning", title: "New PINs don't match" });
        return;
      }
      setSubmittingPin(true);
      try {
        const res = await apiPost("/api/settings/pin/change", token!, {
          current_pin: pinFields.current,
          new_pin: pinFields.pin,
          confirm_new_pin: pinFields.confirm,
        });
        if (res.error) throw new Error(res.error);
        toast({ type: "success", title: "PIN changed!" });
        setPinModal(null);
        refetchPinStatus();
      } catch (err: any) {
        toast({ type: "error", title: "Failed", message: err.message });
      } finally {
        setSubmittingPin(false);
      }
    }
  }

  // ── PIN reset email ─────────────────────────────────────────────
  async function handlePinReset() {
    confirm({
      title: "Reset PIN via email?",
      message: "We'll send a reset link to your registered email address.",
      confirmLabel: "Send reset email",
      onConfirm: async () => {
        try {
          const res = await apiPost(
            "/api/settings/pin/reset/request",
            token!,
            {},
          );
          if (res.error) throw new Error(res.error);
          toast({
            type: "success",
            title: "Reset email sent!",
            message: "Check your inbox.",
          });
        } catch (err: any) {
          toast({ type: "error", title: "Failed", message: err.message });
        }
      },
    });
  }

  // ── Change password ─────────────────────────────────────────────
  async function handleChangePassword() {
    if (!pwf.current || !pwf.newPw || !pwf.confirmPw) {
      toast({ type: "error", title: "All password fields required" });
      return;
    }
    if (pwf.newPw.length < 8) {
      toast({ type: "error", title: "Password must be at least 8 characters" });
      return;
    }
    if (pwf.newPw !== pwf.confirmPw) {
      toast({ type: "error", title: "Passwords don't match" });
      return;
    }
    setSaving(true);
    try {
      const res = await apiPost("/api/auth/change-password", token!, {
        current_password: pwf.current,
        new_password: pwf.newPw,
      });
      if (res.error) throw new Error(res.error);
      setPwf({ current: "", newPw: "", confirmPw: "" });
      toast({ type: "success", title: "Password changed!" });
    } catch (err: any) {
      toast({ type: "error", title: "Failed", message: err.message });
    } finally {
      setSaving(false);
    }
  }

  function handleDeleteAccount() {
    setDeletePassword("");
    setShowDeletePw(false);
    setDeleteModal(true);
  }

  async function confirmDeleteAccount() {
    if (!deletePassword.trim()) {
      toast({ type: "warning", title: "Please enter your password" });
      return;
    }
    setDeleting(true);
    try {
      const res = await apiPost("/api/settings/delete-account", token!, {
        password: deletePassword,
      });
      if (res.error) throw new Error(res.error);
      setDeleteModal(false);
      toast({ type: "success", title: "Account deleted" });
      await logout();
      router.replace("/(auth)/login" as any);
    } catch (err: any) {
      toast({ type: "error", title: "Failed", message: err.message });
    } finally {
      setDeleting(false);
    }
  }

  function handleLogout() {
    confirm({
      title: "Sign out?",
      message: "Sign out of your account?",
      confirmLabel: "Sign out",
      destructive: true,
      onConfirm: async () => {
        await logout();
        router.replace("/(auth)/login" as any);
      },
    });
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backButton}>
          <FontAwesome5 name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <FontAwesome5 name="cog" size={22} color="#fff" />
          <Text style={s.headerTitle}>{t("settings") || "Settings"}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={onRefresh}
            tintColor={COLORS.navy}
          />
        }
      >
        {/* User card */}
        <TouchableOpacity
          style={s.userCard}
          onPress={handleAvatarPick}
          activeOpacity={0.85}
        >
          <View style={{ position: "relative" }}>
            <MaidAvatar
              uri={profile?.avatar}
              name={profile?.name}
              size={64}
              isVerified={profile?.id_verified}
              hasProBadge={profile?.has_pro_badge}
              plan={profile?.subscription_plan}
            />
            {uploading && (
              <View style={s.avatarOverlay}>
                <ActivityIndicator color="#fff" size="small" />
              </View>
            )}
            <View style={s.cameraBadge}>
              <FontAwesome5 name="camera" size={12} color={COLORS.navy} />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.userName}>{profile?.name || "User"}</Text>
            <View
              style={{
                flexDirection: "row",
                gap: 6,
                marginTop: 4,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              {(profile?.id_verified || profile?.maid?.id_verified) && (
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 3 }}
                >
                  <VerifiedBadge size="sm" />
                  <Text style={s.badgeLabel}>Verified</Text>
                </View>
              )}
              <SubscriptionBadge plan={profile?.subscription_plan} size="sm" />
            </View>
            {profile?.email && <Text style={s.userEmail}>{profile.email}</Text>}
            <Text style={s.avatarHint}>
              <FontAwesome5
                name="info-circle"
                size={10}
                color={COLORS.grayLight}
              />{" "}
              Tap avatar to change (Max 5MB)
            </Text>
          </View>
        </TouchableOpacity>
        <View style={s.menu}>
          {/* ═══════ PROFILE ═══════ */}
          <MenuItem
            icon="user"
            label="Profile"
            active={active === "profile"}
            onPress={() => toggle("profile")}
          />
          {active === "profile" && (
            <View style={s.sec}>
              <Label>Full name</Label>
              <TextInput
                style={s.input}
                value={pf.name}
                onChangeText={(t) => setPf((f) => ({ ...f, name: t }))}
                placeholder="Your name"
                placeholderTextColor={COLORS.grayLight}
              />
              <Label>Email</Label>
              <View style={[s.input, s.inputOff]}>
                <Text style={s.inputOffText}>{profile?.email || "—"}</Text>
              </View>
              <Text style={s.hint}>Email cannot be changed</Text>
              <Label>Phone number</Label>
              <TextInput
                style={s.input}
                value={pf.phone}
                onChangeText={(t) => setPf((f) => ({ ...f, phone: t }))}
                placeholder="+234 800 000 0000"
                placeholderTextColor={COLORS.grayLight}
                keyboardType="phone-pad"
              />

              {/* ── PREFERRED CURRENCY ── */}
              <Label>Preferred Currency</Label>
              <TouchableOpacity
                style={s.input}
                onPress={() => setCurrencyPickerOpen(true)}
              >
                <View style={s.currencySelector}>
                  <View style={s.currencyDisplay}>
                    <Text style={s.currencySymbolLarge}>
                      {currencies.find((c) => c.code === selectedCurrency)
                        ?.symbol || "₦"}
                    </Text>
                    <Text style={s.currencyCodeLarge}>{selectedCurrency}</Text>
                    <Text style={s.currencyNameLarge}>
                      {currencies.find((c) => c.code === selectedCurrency)
                        ?.name || ""}
                    </Text>
                  </View>
                  <FontAwesome5
                    name="chevron-down"
                    size={14}
                    color={COLORS.grayLight}
                  />
                </View>
              </TouchableOpacity>
              <Text style={s.hint}>
                Your earnings and prices will be displayed in this currency
              </Text>

              <SaveBtn loading={saving} onPress={handleSaveProfile} />

              {/* Link to detailed maid profile */}
              <TouchableOpacity
                style={s.linkCard}
                onPress={() => router.push("/(tabs)/profile" as any)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.linkCardTitle}>
                    <FontAwesome5 name="edit" size={14} color={COLORS.navy} />{" "}
                    Edit detailed profile
                  </Text>
                  <Text style={s.linkCardSub}>
                    Bio, services, pricing, availability, ID verification
                  </Text>
                </View>
                <FontAwesome5
                  name="chevron-right"
                  size={16}
                  color={COLORS.navy}
                />
              </TouchableOpacity>
            </View>
          )}

          {/* ═══════ EMERGENCY ═══════ */}
          <MenuItem
            icon="exclamation-triangle"
            label="Emergency"
            subtitle={`${contacts.length} contact${contacts.length !== 1 ? "s" : ""}`}
            active={active === "emergency"}
            onPress={() => toggle("emergency")}
          />
          {active === "emergency" && (
            <View style={s.sec}>
              {contacts.length > 0 &&
                contacts.map((c: any) => (
                  <View key={c.id} style={s.contactCard}>
                    <View style={{ flex: 1 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Text style={s.contactName}>{c.name}</Text>
                        {c.is_primary && (
                          <View style={s.primaryBadge}>
                            <Text style={s.primaryBadgeText}>Primary</Text>
                          </View>
                        )}
                      </View>
                      <Text style={s.contactSub}>
                        <FontAwesome5
                          name="phone"
                          size={12}
                          color={COLORS.gray}
                        />{" "}
                        {c.phone}
                      </Text>
                      {c.email && (
                        <Text style={s.contactSub}>
                          <FontAwesome5
                            name="envelope"
                            size={12}
                            color={COLORS.gray}
                          />{" "}
                          {c.email}
                        </Text>
                      )}
                      <Text style={s.contactRel}>{c.relationship}</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleDeleteContact(c.id)}>
                      <FontAwesome5 name="trash" size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              <Text style={s.secLabel}>Add new contact</Text>
              <Label>Name *</Label>
              <TextInput
                style={s.input}
                value={ef.name}
                onChangeText={(t) => setEf((f) => ({ ...f, name: t }))}
                placeholder="Contact name"
                placeholderTextColor={COLORS.grayLight}
              />
              <Label>Phone *</Label>
              <TextInput
                style={s.input}
                value={ef.phone}
                onChangeText={(t) => setEf((f) => ({ ...f, phone: t }))}
                placeholder="+234..."
                placeholderTextColor={COLORS.grayLight}
                keyboardType="phone-pad"
              />
              <Label>Email</Label>
              <TextInput
                style={s.input}
                value={ef.email}
                onChangeText={(t) => setEf((f) => ({ ...f, email: t }))}
                placeholder="email@example.com"
                placeholderTextColor={COLORS.grayLight}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Label>Relationship</Label>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={s.chipRow}>
                  {RELATIONSHIPS.map((r) => (
                    <TouchableOpacity
                      key={r}
                      style={[s.chip, ef.relationship === r && s.chipOn]}
                      onPress={() => setEf((f) => ({ ...f, relationship: r }))}
                    >
                      <Text
                        style={[
                          s.chipText,
                          ef.relationship === r && s.chipTextOn,
                        ]}
                      >
                        {r.charAt(0).toUpperCase() + r.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <SaveBtn
                loading={saving}
                onPress={handleAddContact}
                label="Add Contact"
              />
            </View>
          )}

          {/* ═══════ NOTIFICATIONS ═══════ */}
          <MenuItem
            icon="bell"
            label="Notifications"
            active={active === "notifications"}
            onPress={() => toggle("notifications")}
          />
          {active === "notifications" && (
            <View style={s.sec}>
              <Text style={s.secLabel}>Notification channels</Text>
              <Text style={s.hint}>
                Control how you're notified for each category.
              </Text>
              <View style={s.notifHeaderRow}>
                <View style={{ flex: 1 }} />
                <Text style={s.notifColLabel}>
                  <FontAwesome5 name="bell" size={14} color={COLORS.gray} />
                  {"\n"}In-app
                </Text>
                <Text style={s.notifColLabel}>
                  <FontAwesome5 name="envelope" size={14} color={COLORS.gray} />
                  {"\n"}Email
                </Text>
                <Text style={s.notifColLabel}>
                  <FontAwesome5
                    name="mobile-alt"
                    size={14}
                    color={COLORS.gray}
                  />
                  {"\n"}Push
                </Text>
              </View>
              {NOTIF_CATEGORIES.map((cat) => (
                <View key={cat.key} style={s.notifRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.notifCatLabel}>{cat.label}</Text>
                    <Text style={s.notifCatSub}>{cat.sub}</Text>
                  </View>
                  <Switch
                    value={notifPrefs[`inapp_${cat.key}`] !== false}
                    onValueChange={(v) =>
                      updateNotifPref({ [`inapp_${cat.key}`]: v })
                    }
                    trackColor={{ false: COLORS.border, true: COLORS.navy }}
                    thumbColor="#fff"
                    style={s.notifSwitch}
                  />
                  <Switch
                    value={notifPrefs[`email_${cat.key}`] !== false}
                    onValueChange={(v) =>
                      updateNotifPref({ [`email_${cat.key}`]: v })
                    }
                    trackColor={{ false: COLORS.border, true: COLORS.navy }}
                    thumbColor="#fff"
                    style={s.notifSwitch}
                  />
                  <Switch
                    value={notifPrefs[`push_${cat.key}`] !== false}
                    onValueChange={(v) =>
                      updateNotifPref({ [`push_${cat.key}`]: v })
                    }
                    trackColor={{ false: COLORS.border, true: COLORS.navy }}
                    thumbColor="#fff"
                    style={s.notifSwitch}
                  />
                </View>
              ))}
            </View>
          )}

          {/* ═══════ SUBSCRIPTION ═══════ */}
          <MenuItem
            icon="star"
            label="Subscription"
            subtitle={
              isFree ? "Free plan" : subscription?.display_name || "Active"
            }
            active={active === "subscription"}
            onPress={() => toggle("subscription")}
            highlight={!isFree}
          />
          {active === "subscription" && (
            <View style={s.sec}>
              <View style={s.planCard}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text style={s.planName}>
                    {isFree ? "Free Plan" : subscription?.display_name}
                  </Text>
                  {!isFree && (
                    <View
                      style={[s.statusPill, { backgroundColor: "#ecfdf5" }]}
                    >
                      <Text style={[s.statusPillText, { color: "#065f46" }]}>
                        {subscription?.status}
                      </Text>
                    </View>
                  )}
                </View>

                <Text style={s.planDesc}>
                  {isFree
                    ? "Upgrade to unlock priority job matching and the Pro badge."
                    : renewalDate
                      ? `Renews ${renewalDate.toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}`
                      : ""}
                </Text>

                {subscription?.features?.length > 0 &&
                  subscription.features.map((f: string, i: number) => (
                    <Text key={i} style={s.featureItem}>
                      ✓ {f}
                    </Text>
                  ))}
              </View>
              <TouchableOpacity
                style={s.saveBtn}
                onPress={() => router.push("/subscription" as any)}
              >
                <Text style={s.saveBtnText}>
                  {isFree ? "Upgrade Plan →" : "Manage Subscription"}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ═══════ PAYOUTS (MAID) ═══════ */}
          <MenuItem
            icon="money-bill-wave"
            label="Payouts"
            badge="MAID"
            subtitle={
              savedBank
                ? `${savedBank.bank_name} · ${savedBank.account_number?.slice(-4)}`
                : "Set up payout method"
            }
            active={active === "payouts"}
            onPress={() => toggle("payouts")}
          />
          {active === "payouts" && (
            <View style={s.sec}>
              {savedBank && (
                <View style={s.savedBankCard}>
                  <FontAwesome5
                    name="university"
                    size={28}
                    color={COLORS.navy}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={s.savedBankName}>{savedBank.bank_name}</Text>
                    <Text style={s.savedBankAcc}>
                      {savedBank.account_number} · {savedBank.account_name}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={s.editBankBtn}
                    onPress={() => {
                      setBankName("");
                      setBankCode("");
                      setAccountNumber("");
                      setAccountName("");
                      setBankPickerOpen(true);
                    }}
                  >
                    <Text style={s.editBankBtnText}>
                      <FontAwesome5 name="pen" size={12} color={COLORS.navy} />{" "}
                      Change
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <Text style={s.secLabel}>Payout method</Text>
              <Text style={s.hint}>How should we send your earnings?</Text>

              <View style={s.payoutGrid}>
                {PAYOUT_METHODS.map((m) => (
                  <TouchableOpacity
                    key={m.key}
                    style={[
                      s.payoutCard,
                      payoutMethod === m.key && s.payoutCardActive,
                    ]}
                    onPress={() => setPayoutMethod(m.key)}
                  >
                    <FontAwesome5 name={m.icon} size={20} color={COLORS.navy} />
                    <Text
                      style={[
                        s.payoutName,
                        payoutMethod === m.key && s.payoutNameActive,
                      ]}
                    >
                      {m.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Bank transfer form */}
              {payoutMethod === "bank_transfer" && (
                <>
                  <Text style={[s.secLabel, { marginTop: SPACING.lg }]}>
                    Nigerian bank details
                  </Text>
                  <Label>Bank / Fintech</Label>
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
                      {bankName || "— Select bank —"}
                    </Text>
                  </TouchableOpacity>
                  <Label>Account number</Label>
                  <TextInput
                    style={s.input}
                    value={accountNumber}
                    onChangeText={setAccountNumber}
                    placeholder="0123456789"
                    placeholderTextColor={COLORS.grayLight}
                    keyboardType="number-pad"
                    maxLength={10}
                  />
                  <Text style={s.hint}>
                    Enter your 10-digit NUBAN account number
                  </Text>
                  {verifyingBank && <Text style={s.hint}>🔄 Verifying…</Text>}
                  <Label>Account name</Label>
                  <TextInput
                    style={[
                      s.input,
                      accountName && { backgroundColor: "#ecfdf5" },
                    ]}
                    value={accountName}
                    editable={false}
                    placeholder="Auto-filled after verification"
                    placeholderTextColor={COLORS.grayLight}
                  />
                  <Text style={s.hint}>
                    Works with GTB, Zenith, Access, UBA, First Bank, OPay,
                    Moniepoint, Kuda, PalmPay, and all CBN-licensed banks.
                  </Text>
                  <SaveBtn
                    loading={saving}
                    onPress={handleSaveBank}
                    label="Save Payout Details"
                  />
                </>
              )}

              {/* Other methods */}
              {payoutMethod !== "bank_transfer" && (
                <View style={s.infoBox}>
                  <Text style={s.infoBoxText}>
                    <FontAwesome5
                      name="info-circle"
                      size={14}
                      color="#1e40af"
                    />{" "}
                    {PAYOUT_METHODS.find((m) => m.key === payoutMethod)?.name}{" "}
                    details are entered when you submit a withdrawal request.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ═══════ TRANSACTION PIN (MAID) ═══════ */}
          <MenuItem
            icon="lock"
            label="Transaction PIN"
            badge="MAID"
            subtitle={pinStatus.pin_set ? "PIN active" : "Not set"}
            active={active === "pin"}
            onPress={() => toggle("pin")}
          />
          {active === "pin" && (
            <View style={s.sec}>
              <View style={s.pinStatusCard}>
                <Text style={s.pinStatusTitle}>Transaction PIN</Text>
                <Text style={s.pinStatusDesc}>
                  Your PIN is required every time you request a withdrawal. This
                  protects your earnings even if your account is compromised.
                </Text>
                <View style={s.pinStatusRow}>
                  {pinStatus.pin_set ? (
                    <>
                      <View style={s.pinActivePill}>
                        <Text style={s.pinActivePillText}>PIN ACTIVE</Text>
                      </View>
                      {pinStatus.pin_set_at && (
                        <Text style={s.pinSetDate}>
                          Set{" "}
                          {new Date(pinStatus.pin_set_at).toLocaleDateString(
                            "en-GB",
                            {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            },
                          )}
                        </Text>
                      )}
                    </>
                  ) : (
                    <View
                      style={[s.pinActivePill, { backgroundColor: "#fef2f2" }]}
                    >
                      <Text style={[s.pinActivePillText, { color: "#991b1b" }]}>
                        NOT SET
                      </Text>
                    </View>
                  )}
                </View>

                {pinStatus.is_locked && (
                  <View style={s.pinLockedBox}>
                    <Text style={s.pinLockedText}>
                      <FontAwesome5 name="lock" size={12} color="#991b1b" /> PIN
                      is locked until{" "}
                      {new Date(pinStatus.locked_until).toLocaleString()}
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  style={s.changePinBtn}
                  onPress={() =>
                    openPinModal(pinStatus.pin_set ? "change" : "set")
                  }
                >
                  <Text style={s.changePinBtnText}>
                    {pinStatus.pin_set ? "Change PIN" : "Set PIN"}
                  </Text>
                </TouchableOpacity>
              </View>

              {pinStatus.pin_set && (
                <View style={s.pinResetCard}>
                  <Text style={s.pinResetTitle}>Forgot your PIN?</Text>
                  <Text style={s.hint}>
                    We'll send a reset link to your registered email address.
                  </Text>
                  <TouchableOpacity
                    style={s.pinResetBtn}
                    onPress={handlePinReset}
                  >
                    <Text style={s.pinResetBtnText}>
                      <FontAwesome5 name="envelope" size={14} color="#dc2626" />{" "}
                      Send PIN reset email
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <Text style={[s.secLabel, { marginTop: SPACING.lg }]}>
                How the PIN works
              </Text>
              {[
                {
                  icon: "key",
                  title: "Required on every withdrawal",
                  sub: "You must enter your PIN each time you request a payout. It can't be skipped.",
                },
                {
                  icon: "lock",
                  title: "Auto-lock after 5 wrong attempts",
                  sub: "After 5 incorrect attempts your PIN locks for 30 minutes to prevent brute-force attacks.",
                },
                {
                  icon: "envelope",
                  title: "Reset via email",
                  sub: "If you forget your PIN, use the email reset link. No admin can see or override your PIN.",
                },
                {
                  icon: "shield-alt",
                  title: "Separate from your login password",
                  sub: "Your PIN only protects withdrawals — changing your password doesn't change your PIN.",
                },
              ].map((tip) => (
                <View key={tip.title} style={s.tipRow}>
                  <FontAwesome5 name={tip.icon} size={18} color={COLORS.navy} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.tipTitle}>{tip.title}</Text>
                    <Text style={s.tipSub}>{tip.sub}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ═══════ SECURITY ═══════ */}
          <MenuItem
            icon="shield-alt"
            label="Security"
            active={active === "security"}
            onPress={() => toggle("security")}
          />
          {active === "security" && (
            <View style={s.sec}>
              <Text style={s.secLabel}>Change password</Text>
              <Label>Current password</Label>
              <TextInput
                style={s.input}
                value={pwf.current}
                onChangeText={(t) => setPwf((f) => ({ ...f, current: t }))}
                placeholder="Enter current password"
                placeholderTextColor={COLORS.grayLight}
                secureTextEntry={!showPw}
              />
              <Label>New password</Label>
              <TextInput
                style={s.input}
                value={pwf.newPw}
                onChangeText={(t) => setPwf((f) => ({ ...f, newPw: t }))}
                placeholder="At least 8 characters"
                placeholderTextColor={COLORS.grayLight}
                secureTextEntry={!showPw}
              />
              <Label>Confirm new password</Label>
              <TextInput
                style={s.input}
                value={pwf.confirmPw}
                onChangeText={(t) => setPwf((f) => ({ ...f, confirmPw: t }))}
                placeholder="Repeat new password"
                placeholderTextColor={COLORS.grayLight}
                secureTextEntry={!showPw}
              />
              <TouchableOpacity
                onPress={() => setShowPw(!showPw)}
                style={{ marginBottom: SPACING.sm }}
              >
                <Text style={s.linkSmall}>
                  {showPw ? (
                    <FontAwesome5 name="eye-slash" size={14} color="#3b82f6" />
                  ) : (
                    <FontAwesome5 name="eye" size={14} color="#3b82f6" />
                  )}{" "}
                  {showPw ? "Hide" : "Show"} passwords
                </Text>
              </TouchableOpacity>
              <SaveBtn
                loading={saving}
                onPress={handleChangePassword}
                label="Change Password"
              />

              <View style={s.divider} />
              <Text style={s.secLabel}>Danger zone</Text>
              <View style={s.dangerCard}>
                <View style={{ flex: 1 }}>
                  <Text style={s.dangerTitle}>Delete account</Text>
                  <Text style={s.dangerSub}>
                    Permanently delete your account and all data.
                  </Text>
                </View>
                <TouchableOpacity
                  style={s.dangerBtn}
                  onPress={handleDeleteAccount}
                >
                  <Text style={s.dangerBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
          <FontAwesome5 name="sign-out-alt" size={16} color="#dc2626" />
          <Text style={s.logoutBtnText}> Sign Out</Text>
        </TouchableOpacity>
        <Text style={s.version}>Deusizi Sparkle v1.0.0</Text>
        <Text style={s.version}>Powered By GESTECH</Text>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ═══════ NG BANK PICKER ═══════ */}
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
                  <Text style={s.bankNameRow}>{b.name}</Text>
                  <Text style={s.bankCode}>{b.code}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ═══════ CURRENCY PICKER ═══════ */}
      <Modal
        visible={currencyPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCurrencyPickerOpen(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Select Currency</Text>
              <TouchableOpacity onPress={() => setCurrencyPickerOpen(false)}>
                <FontAwesome5 name="times" size={22} color={COLORS.gray} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {currencies.map((c: any) => {
                const isSelected = selectedCurrency === c.code;
                return (
                  <TouchableOpacity
                    key={c.code}
                    style={[s.currencyRow, isSelected && s.currencyRowActive]}
                    onPress={() => {
                      setSelectedCurrency(c.code);
                      setCurrencyPickerOpen(false);
                    }}
                  >
                    <Text style={s.currencySymbol}>{c.symbol || c.code}</Text>
                    <View style={s.currencyInfo}>
                      <Text style={s.currencyCode}>{c.code}</Text>
                      <Text style={s.currencyName}>{c.name}</Text>
                    </View>
                    {isSelected && (
                      <FontAwesome5
                        name="check-circle"
                        size={20}
                        color={COLORS.navy}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ═══════ PIN SET / CHANGE MODAL ═══════ */}
      <Modal
        visible={!!pinModal}
        transparent
        animationType="fade"
        onRequestClose={() => !submittingPin && setPinModal(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <View style={s.pinOverlay}>
            <View style={s.pinCard}>
              <Text style={s.pinTitle}>
                <FontAwesome5 name="lock" size={18} color={COLORS.navy} />{" "}
                {pinModal === "set"
                  ? "Set Transaction PIN"
                  : "Change Transaction PIN"}
              </Text>
              <Text style={s.pinSub}>
                4–6 digit numeric PIN. Required for every withdrawal.
              </Text>

              {pinModal === "change" && (
                <>
                  <Text style={s.pinFieldLabel}>Current PIN</Text>
                  <TextInput
                    style={s.pinInputField}
                    value={pinFields.current}
                    onChangeText={(t) =>
                      setPinFields({ ...pinFields, current: t })
                    }
                    keyboardType="number-pad"
                    maxLength={6}
                    secureTextEntry
                    placeholder="••••"
                    placeholderTextColor={COLORS.grayLight}
                  />
                </>
              )}

              <Text style={s.pinFieldLabel}>
                {pinModal === "set" ? "New PIN" : "New PIN"}
              </Text>
              <TextInput
                style={s.pinInputField}
                value={pinFields.pin}
                onChangeText={(t) => setPinFields({ ...pinFields, pin: t })}
                keyboardType="number-pad"
                maxLength={6}
                secureTextEntry
                placeholder="••••"
                placeholderTextColor={COLORS.grayLight}
              />

              <Text style={s.pinFieldLabel}>Confirm New PIN</Text>
              <TextInput
                style={s.pinInputField}
                value={pinFields.confirm}
                onChangeText={(t) => setPinFields({ ...pinFields, confirm: t })}
                keyboardType="number-pad"
                maxLength={6}
                secureTextEntry
                placeholder="••••"
                placeholderTextColor={COLORS.grayLight}
              />

              {pinModal === "set" && (
                <>
                  <Text style={s.pinFieldLabel}>
                    Account password (optional)
                  </Text>
                  <TextInput
                    style={s.pinInputField}
                    value={pinFields.password}
                    onChangeText={(t) =>
                      setPinFields({ ...pinFields, password: t })
                    }
                    secureTextEntry
                    placeholder="For added security"
                    placeholderTextColor={COLORS.grayLight}
                  />
                </>
              )}

              <View style={s.pinActions}>
                <TouchableOpacity
                  style={s.pinCancel}
                  onPress={() => setPinModal(null)}
                  disabled={submittingPin}
                >
                  <Text style={s.pinCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.pinConfirm, submittingPin && { opacity: 0.6 }]}
                  onPress={submitPin}
                  disabled={submittingPin}
                >
                  {submittingPin ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={s.pinConfirmText}>
                      {pinModal === "set" ? "Set PIN" : "Change PIN"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ═══════ DELETE ACCOUNT MODAL ═══════ */}
      <Modal
        visible={deleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => !deleting && setDeleteModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <View style={s.delOverlay}>
            <View style={s.delCard}>
              <Text
                style={{ fontSize: 40, textAlign: "center", marginBottom: 8 }}
              >
                ⚠️
              </Text>
              <Text style={s.delTitle}>Delete Account</Text>
              <Text style={s.delBody}>
                This will{" "}
                <Text style={{ fontFamily: FONTS.bold, color: "#991b1b" }}>
                  permanently delete
                </Text>{" "}
                your account and all associated data. This action{" "}
                <Text style={{ fontFamily: FONTS.bold }}>cannot be undone</Text>
                .
              </Text>

              {[
                "All your booking history will be erased",
                "Your earnings and payout records will be removed",
                "Your profile and reviews will be deleted",
                "Active subscriptions will not be refunded",
              ].map((w) => (
                <View key={w} style={s.delWarningRow}>
                  <FontAwesome5 name="times" size={12} color="#dc2626" />
                  <Text style={s.delWarningText}>{w}</Text>
                </View>
              ))}

              <View style={s.delVerifyBox}>
                <Text style={s.delVerifyLabel}>Confirm with your password</Text>
                <Text style={s.delVerifyHint}>
                  Enter your account password to authorise this deletion.
                </Text>
                <View style={s.delPwRow}>
                  <TextInput
                    style={s.delPwInput}
                    value={deletePassword}
                    onChangeText={setDeletePassword}
                    placeholder="Your password"
                    placeholderTextColor={COLORS.grayLight}
                    secureTextEntry={!showDeletePw}
                    autoCapitalize="none"
                    editable={!deleting}
                  />
                  <TouchableOpacity
                    onPress={() => setShowDeletePw((v) => !v)}
                    style={s.delEyeBtn}
                  >
                    {showDeletePw ? (
                      <FontAwesome5
                        name="eye-slash"
                        size={18}
                        color={COLORS.gray}
                      />
                    ) : (
                      <FontAwesome5 name="eye" size={18} color={COLORS.gray} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              <View style={s.delActions}>
                <TouchableOpacity
                  style={s.delCancelBtn}
                  onPress={() => setDeleteModal(false)}
                  disabled={deleting}
                >
                  <Text style={s.delCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.delDeleteBtn, deleting && { opacity: 0.6 }]}
                  onPress={confirmDeleteAccount}
                  disabled={deleting}
                >
                  {deleting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={s.delDeleteText}>Delete Account</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────
function MenuItem({
  icon,
  label,
  subtitle,
  active,
  onPress,
  highlight,
  badge,
}: any) {
  return (
    <TouchableOpacity
      style={[s.menuItem, active && s.menuItemOn, highlight && s.menuItemHL]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <FontAwesome5
        name={icon}
        size={20}
        color={active ? COLORS.navy : COLORS.gray}
      />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={[s.menuLabel, active && s.menuLabelOn]}>{label}</Text>
          {badge && (
            <View style={s.maidBadge}>
              <Text style={s.maidBadgeText}>{badge}</Text>
            </View>
          )}
        </View>
        {subtitle && <Text style={s.menuSub}>{subtitle}</Text>}
      </View>
      <FontAwesome5
        name={active ? "chevron-down" : "chevron-right"}
        size={14}
        color={active ? COLORS.navy : COLORS.grayLight}
      />
    </TouchableOpacity>
  );
}

function Label({ children }: { children: string }) {
  return <Text style={s.label}>{children}</Text>;
}

function SaveBtn({ loading, onPress, label = "Save Changes" }: any) {
  return (
    <TouchableOpacity style={s.saveBtn} onPress={onPress} disabled={loading}>
      {loading ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <Text style={s.saveBtnText}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.navy,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  headerTitle: { fontFamily: FONTS.bold, fontSize: 20, color: "#fff" },
  backButton: { padding: 6, marginRight: 4 },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    margin: SPACING.md,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.md,
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  cameraBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  userName: { fontFamily: FONTS.bold, fontSize: 18, color: COLORS.navy },
  userEmail: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.grayLight,
    marginTop: 2,
  },
  badgeLabel: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.gray },
  menu: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.md,
  },
  menuItemOn: { backgroundColor: "rgba(19,19,103,0.03)" },
  menuItemHL: { backgroundColor: "rgba(19,19,103,0.06)" },
  menuLabel: { fontFamily: FONTS.medium, fontSize: 15, color: COLORS.gray },
  menuLabelOn: { color: COLORS.navy, fontFamily: FONTS.bold },
  menuSub: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.grayLight,
    marginTop: 1,
  },
  maidBadge: {
    backgroundColor: COLORS.navy,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  maidBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 9,
    color: "#fff",
    letterSpacing: 0.5,
  },
  sec: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: "rgba(19,19,103,0.01)",
  },
  secLabel: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.navy,
    marginBottom: SPACING.sm,
    marginTop: SPACING.xs,
  },
  label: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 6,
    marginTop: SPACING.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.navy,
    minHeight: 44,
    justifyContent: "center",
  },
  inputText: { fontFamily: FONTS.regular, fontSize: 15, color: COLORS.navy },
  inputOff: { backgroundColor: COLORS.muted, justifyContent: "center" },
  inputOffText: { fontFamily: FONTS.regular, fontSize: 15, color: COLORS.gray },
  hint: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.grayLight,
    marginTop: 4,
    marginBottom: SPACING.sm,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.muted,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipOn: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  chipText: { fontFamily: FONTS.medium, fontSize: 12, color: COLORS.gray },
  chipTextOn: { color: "#fff" },
  saveBtn: {
    backgroundColor: COLORS.navy,
    borderRadius: RADIUS.md,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: SPACING.md,
  },
  saveBtnText: { fontFamily: FONTS.bold, fontSize: 14, color: "#fff" },
  linkSmall: { fontFamily: FONTS.medium, fontSize: 13, color: "#3b82f6" },
  linkCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.muted,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginTop: SPACING.md,
  },
  linkCardTitle: { fontFamily: FONTS.bold, fontSize: 14, color: COLORS.navy },
  linkCardSub: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2,
  },
  contactCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  contactName: { fontFamily: FONTS.bold, fontSize: 14, color: COLORS.navy },
  contactSub: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.gray,
    marginTop: 2,
  },
  contactRel: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.grayLight,
    textTransform: "capitalize",
    marginTop: 2,
  },
  primaryBadge: {
    backgroundColor: "#ecfdf5",
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  primaryBadgeText: { fontFamily: FONTS.bold, fontSize: 10, color: "#065f46" },
  notifHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  notifColLabel: {
    fontFamily: FONTS.medium,
    fontSize: 10,
    color: COLORS.gray,
    textAlign: "center",
    width: 56,
  },
  notifRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  notifCatLabel: { fontFamily: FONTS.bold, fontSize: 13, color: COLORS.navy },
  notifCatSub: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.grayLight,
    marginTop: 1,
  },
  notifSwitch: { transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }], width: 56 },
  planCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  planName: { fontFamily: FONTS.bold, fontSize: 18, color: COLORS.navy },
  planDesc: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.gray,
    marginTop: 4,
    lineHeight: 20,
  },
  featureItem: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: "#10b981",
    paddingVertical: 2,
    marginTop: 4,
  },
  statusPill: {
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  statusPillText: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    textTransform: "capitalize",
  },
  savedBankCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  savedBankName: { fontFamily: FONTS.bold, fontSize: 14, color: COLORS.navy },
  savedBankAcc: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2,
  },
  payoutGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  payoutCard: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    gap: SPACING.sm,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  payoutCardActive: { backgroundColor: COLORS.muted, borderColor: COLORS.navy },
  payoutName: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.gray,
    flex: 1,
  },
  payoutNameActive: { fontFamily: FONTS.bold, color: COLORS.navy },
  infoBox: {
    backgroundColor: "#eff6ff",
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    marginTop: SPACING.md,
  },
  infoBoxText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: "#1e40af",
    lineHeight: 18,
  },
  pinStatusCard: {
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pinStatusTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.navy,
    marginBottom: 6,
  },
  pinStatusDesc: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.gray,
    lineHeight: 19,
    marginBottom: SPACING.md,
  },
  pinStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  pinActivePill: {
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  pinActivePillText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: "#065f46",
    letterSpacing: 0.5,
  },
  pinSetDate: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.gray },
  pinLockedBox: {
    backgroundColor: "#fef2f2",
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.md,
  },
  pinLockedText: { fontFamily: FONTS.medium, fontSize: 12, color: "#991b1b" },
  changePinBtn: {
    borderWidth: 1,
    borderColor: COLORS.navy,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    alignItems: "center",
  },
  changePinBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.navy,
  },
  pinResetCard: {
    marginTop: SPACING.md,
    backgroundColor: "#fef2f2",
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: "#dc2626",
  },
  pinResetTitle: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.navy,
    marginBottom: 4,
  },
  pinResetBtn: {
    borderWidth: 1,
    borderColor: "#dc2626",
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: SPACING.sm,
  },
  pinResetBtnText: { fontFamily: FONTS.bold, fontSize: 13, color: "#dc2626" },
  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tipTitle: { fontFamily: FONTS.bold, fontSize: 14, color: COLORS.navy },
  tipSub: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.lg,
  },
  dangerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: "#dc2626",
    gap: SPACING.md,
  },
  dangerTitle: { fontFamily: FONTS.bold, fontSize: 14, color: "#991b1b" },
  dangerSub: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: "#991b1b",
    opacity: 0.8,
    marginTop: 2,
    lineHeight: 18,
  },
  dangerBtn: {
    borderWidth: 1,
    borderColor: "#dc2626",
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
  },
  dangerBtnText: { fontFamily: FONTS.bold, fontSize: 12, color: "#dc2626" },
  logoutBtn: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.lg,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: "#dc2626",
    paddingVertical: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  logoutBtnText: { fontFamily: FONTS.bold, fontSize: 15, color: "#dc2626" },
  version: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.grayLight,
    textAlign: "center",
    marginTop: SPACING.lg,
  },
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
  bankNameRow: { fontFamily: FONTS.medium, fontSize: 14, color: COLORS.navy },
  bankCode: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.gray },
  editBankBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.navy,
    backgroundColor: "#fff",
  },
  editBankBtnText: { fontFamily: FONTS.bold, fontSize: 12, color: COLORS.navy },
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
    maxWidth: 380,
  },
  pinTitle: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.navy,
    textAlign: "center",
    marginBottom: 6,
  },
  pinSub: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.gray,
    textAlign: "center",
    marginBottom: SPACING.md,
    lineHeight: 19,
  },
  pinFieldLabel: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.navy,
    marginTop: SPACING.sm,
    marginBottom: 6,
  },
  pinInputField: {
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontFamily: FONTS.bold,
    fontSize: 22,
    color: COLORS.navy,
    textAlign: "center",
    letterSpacing: 8,
  },
  pinActions: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.lg },
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
  delOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.lg,
  },
  delCard: {
    backgroundColor: "#fff",
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    width: "100%",
    maxWidth: 400,
  },
  delTitle: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    color: "#991b1b",
    textAlign: "center",
    marginBottom: 8,
  },
  delBody: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.gray,
    lineHeight: 21,
    textAlign: "center",
    marginBottom: SPACING.md,
  },
  delWarningRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 6,
  },
  delWarningText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: "#7f1d1d",
    flex: 1,
    lineHeight: 19,
  },
  delVerifyBox: {
    backgroundColor: "#fef2f2",
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  delVerifyLabel: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: "#991b1b",
    marginBottom: 4,
  },
  delVerifyHint: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: "#b91c1c",
    marginBottom: SPACING.sm,
    lineHeight: 18,
  },
  delPwRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: "#fca5a5",
    paddingHorizontal: SPACING.md,
  },
  delPwInput: {
    flex: 1,
    paddingVertical: 12,
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.navy,
  },
  delEyeBtn: { padding: 4 },
  delActions: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.lg },
  delCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.muted,
    alignItems: "center",
  },
  delCancelText: { fontFamily: FONTS.bold, fontSize: 14, color: COLORS.gray },
  delDeleteBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: RADIUS.md,
    backgroundColor: "#dc2626",
    alignItems: "center",
  },
  delDeleteText: { fontFamily: FONTS.bold, fontSize: 14, color: "#fff" },

  // ── Currency styles ──
  currencySelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  currencyDisplay: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  currencySymbolLarge: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    color: COLORS.navy,
    width: 32,
  },
  currencyCodeLarge: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.navy,
  },
  currencyNameLarge: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.gray,
  },
  currencyRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.md,
  },
  currencyRowActive: {
    backgroundColor: "rgba(19,19,103,0.05)",
  },
  currencySymbol: {
    fontFamily: FONTS.bold,
    fontSize: 24,
    color: COLORS.navy,
    width: 44,
    textAlign: "center",
  },
  currencyInfo: {
    flex: 1,
  },
  currencyCode: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.navy,
  },
  currencyName: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.gray,
    marginTop: 1,
  },

  avatarHint: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: COLORS.grayLight,
    marginTop: 4,
  },
});
