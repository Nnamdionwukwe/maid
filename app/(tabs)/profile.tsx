import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Image,
  ActivityIndicator,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as DocumentPicker from "expo-document-picker";
import { useAuthStore } from "../../stores/authStore";
import { API_URL, COLORS, FONTS, SPACING, RADIUS } from "../../constants";
import { useAppToast } from "../../components/AppToast";
import { FontAwesome5 } from "@expo/vector-icons";

// ── API ───────────────────────────────────────────────────────────────
const apiFetch = async (path: string, token: string) => {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
};
const apiPatch = async (path: string, token: string, body: any) => {
  const res = await fetch(`${API_URL}${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  return res.json();
};
const apiPut = async (path: string, token: string, body: any) => {
  const res = await fetch(`${API_URL}${path}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  return res.json();
};

// ── FLUTTERWAVE SUPPORTED CURRENCIES (18 currencies) ────────────────
const FLUTTERWAVE_CURRENCIES = [
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

// ── Built-in services (rest are custom) ───────────────────────────────
const DEFAULT_SERVICES = [
  "Cleaning",
  "Nannies & Babysitting",
  "Caregivers & Elderly Care",
  "Housekeepers",
  "Handymen & Odd Jobs",
  "Electricians",
  "Plumbers",
  "Painters",
  "Laundry",
  "Cooks",
  "Ironing",
  "Organizing",
  "AC Technicians",
  "Facility Management",
  "Estate Maintenance",
  "Property Inspections",
  "Short-Let Property Support",
  "Window Cleaning",
  "Carpet Cleaning",
  "Deep Cleaning",
  "Space Planning",
  "Home Furnishing",
  "Lighting",
  "Residential Cleaning",
  "Commercial Cleaning",
  "Post-Construction Cleaning",
  "Move-In/Move-Out Cleaning",
  "Domestic & Care Services",
];

// ── Document types ────────────────────────────────────────────────────
const DOC_TYPES = [
  { key: "national_id", label: "National ID", icon: "id-card" },
  { key: "passport", label: "International Passport", icon: "passport" },
  { key: "drivers_license", label: "Driver's License", icon: "car" },
  { key: "utility_bill", label: "Utility Bill", icon: "home" },
];

// ── Days of week ──────────────────────────────────────────────────────
const DAYS = [
  { idx: 0, short: "Sun", full: "Sunday" },
  { idx: 1, short: "Mon", full: "Monday" },
  { idx: 2, short: "Tue", full: "Tuesday" },
  { idx: 3, short: "Wed", full: "Wednesday" },
  { idx: 4, short: "Thu", full: "Thursday" },
  { idx: 5, short: "Fri", full: "Friday" },
  { idx: 6, short: "Sat", full: "Saturday" },
];

// ── Time slots (every 30 min) ─────────────────────────────────────────
const TIME_OPTIONS: { display: string; value: string }[] = (() => {
  const out: { display: string; value: string }[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const hour12 = h % 12 || 12;
      const ampm = h < 12 ? "AM" : "PM";
      const min = m.toString().padStart(2, "0");
      out.push({
        display: `${hour12}:${min} ${ampm}`,
        value: `${h.toString().padStart(2, "0")}:${min}`,
      });
    }
  }
  return out;
})();

function formatTime(value: string) {
  const opt = TIME_OPTIONS.find(
    (t) => t.value === value || t.value === value?.slice(0, 5),
  );
  return opt?.display || value;
}

export default function MaidProfileScreen() {
  const router = useRouter();
  const { token, user, refreshUser } = useAuthStore();
  const { toast, confirm } = useAppToast();
  const qc = useQueryClient();

  // ── State for profile fields ────────────────────────────────────
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [yearsExp, setYearsExp] = useState("");
  const [currency, setCurrency] = useState("NGN");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  // Pricing
  const [rateHourly, setRateHourly] = useState("");
  const [rateDaily, setRateDaily] = useState("");
  const [rateWeekly, setRateWeekly] = useState("");
  const [rateMonthly, setRateMonthly] = useState("");
  const [pricingNote, setPricingNote] = useState("");
  const [customRates, setCustomRates] = useState<
    { name: string; amount: string }[]
  >([]);
  // Services
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [customServiceInput, setCustomServiceInput] = useState("");
  // Availability — keyed by day_of_week
  const [availability, setAvailability] = useState<
    Record<number, { enabled: boolean; start: string; end: string }>
  >(() => {
    const init: any = {};
    DAYS.forEach(
      (d) => (init[d.idx] = { enabled: false, start: "09:00", end: "17:00" }),
    );
    return init;
  });

  // ── UI state ────────────────────────────────────────────────────
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAvail, setSavingAvail] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [timePicker, setTimePicker] = useState<{
    day: number;
    field: "start" | "end";
  } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  // ── Fetch profile, availability, documents ────────────────────
  const { data: maidData, refetch: refetchProfile } = useQuery({
    queryKey: ["my-maid-profile", user?.id],
    queryFn: () => apiFetch(`/api/maids/${user?.id}`, token!),
    enabled: !!token && !!user?.id,
  });

  const { data: availData, refetch: refetchAvail } = useQuery({
    queryKey: ["my-availability"],
    queryFn: () => apiFetch("/api/maids/my/availability", token!),
    enabled: !!token,
  });

  const { data: docsData, refetch: refetchDocs } = useQuery({
    queryKey: ["my-documents"],
    queryFn: () => apiFetch("/api/maids/my/documents", token!),
    enabled: !!token,
  });

  useFocusEffect(
    useCallback(() => {
      refetchProfile();
      refetchAvail();
      refetchDocs();
    }, []),
  );

  // ── Hydrate state when data arrives ─────────────────────────────
  useEffect(() => {
    if (maidData?.maid) {
      const m = maidData.maid;
      setBio(m.bio || "");
      setLocation(m.location || "");
      setYearsExp(String(m.years_exp || ""));
      setCurrency(m.currency || "NGN");
      setLatitude(m.latitude ? Number(m.latitude) : null);
      setLongitude(m.longitude ? Number(m.longitude) : null);
      setRateHourly(
        m.rate_hourly
          ? String(m.rate_hourly)
          : m.hourly_rate
            ? String(m.hourly_rate)
            : "",
      );
      setRateDaily(m.rate_daily ? String(m.rate_daily) : "");
      setRateWeekly(m.rate_weekly ? String(m.rate_weekly) : "");
      setRateMonthly(m.rate_monthly ? String(m.rate_monthly) : "");
      setPricingNote(m.pricing_note || "");

      // ✅ Handle rate_custom - supports both object and array formats
      const rc = m.rate_custom;
      console.log("[MaidProfile] Rate custom raw:", rc);

      if (rc) {
        let ratesArray: { name: string; amount: string }[] = [];

        if (Array.isArray(rc)) {
          // If it's already an array (from app)
          ratesArray = rc.map((r: any) => ({
            name: r.name || "",
            amount: String(r.amount || ""),
          }));
        } else if (typeof rc === "object" && rc !== null) {
          // If it's an object (from website)
          ratesArray = Object.entries(rc).map(([name, amount]) => ({
            name: name,
            amount: String(amount || ""),
          }));
        } else if (typeof rc === "string" && rc) {
          try {
            const parsed = JSON.parse(rc);
            if (Array.isArray(parsed)) {
              ratesArray = parsed.map((r: any) => ({
                name: r.name || "",
                amount: String(r.amount || ""),
              }));
            } else if (typeof parsed === "object") {
              ratesArray = Object.entries(parsed).map(([name, amount]) => ({
                name: name,
                amount: String(amount || ""),
              }));
            }
          } catch (e) {
            console.warn("[MaidProfile] Failed to parse rate_custom:", e);
          }
        }

        setCustomRates(ratesArray);
        console.log("[MaidProfile] Custom rates set:", ratesArray);
      } else {
        setCustomRates([]);
        console.log("[MaidProfile] No custom rates found");
      }

      setSelectedServices(m.services || []);
    }
  }, [maidData]);

  useEffect(() => {
    if (availData?.availability) {
      const next: any = {};
      DAYS.forEach(
        (d) => (next[d.idx] = { enabled: false, start: "09:00", end: "17:00" }),
      );
      availData.availability.forEach((slot: any) => {
        next[slot.day_of_week] = {
          enabled: true,
          start: slot.start_time?.slice(0, 5) || "09:00",
          end: slot.end_time?.slice(0, 5) || "17:00",
        };
      });
      setAvailability(next);
    }
  }, [availData]);

  const documents = docsData?.documents || [];
  // ── USE FLUTTERWAVE_CURRENCIES instead of API call ──
  const currencies = FLUTTERWAVE_CURRENCIES;

  // ── Avatar upload ──────────────────────────────────────────────
  async function pickAvatar() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast({
        type: "warning",
        title: "Permission denied",
        message: "Allow photo access to change your avatar.",
      });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;

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

    setUploadingAvatar(true);
    try {
      // ✅ Use XMLHttpRequest - reliable in production builds
      const formData = new FormData();
      const filename =
        asset.fileName || asset.uri.split("/").pop() || "avatar.jpg";
      const mimeType = asset.mimeType || "image/jpeg";

      formData.append("avatar", {
        uri: asset.uri,
        type: mimeType,
        name: filename,
      } as any);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_URL}/api/maids/avatar`);
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

      toast({ type: "success", title: "Avatar updated!" });
      await refreshUser();
      qc.invalidateQueries({ queryKey: ["my-maid-profile"] });
    } catch (err: any) {
      toast({ type: "error", title: "Upload failed", message: err.message });
    } finally {
      setUploadingAvatar(false);
    }
  }

  // ── Use current location ───────────────────────────────────────
  async function useCurrentLocation() {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        toast({ type: "warning", title: "Location denied" });
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLatitude(loc.coords.latitude);
      setLongitude(loc.coords.longitude);
      // Reverse geocode
      const places = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      if (places[0]) {
        const p = places[0];
        const addr = [p.city || p.subregion, p.region, p.country]
          .filter(Boolean)
          .join(", ");
        if (addr) setLocation(addr);
      }
      toast({ type: "success", title: "📍 Location captured" });
    } catch (err: any) {
      toast({
        type: "error",
        title: "Couldn't get location",
        message: err.message,
      });
    } finally {
      setGpsLoading(false);
    }
  }

  // ── Toggle service ─────────────────────────────────────────────
  function toggleService(name: string) {
    setSelectedServices((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name],
    );
  }

  // ── Add custom service ─────────────────────────────────────────
  function addCustomService() {
    const name = customServiceInput.trim();
    if (!name) return;
    if (selectedServices.includes(name)) {
      toast({ type: "warning", title: "Already added" });
      return;
    }
    setSelectedServices([...selectedServices, name]);
    setCustomServiceInput("");
  }

  function removeCustomService(name: string) {
    setSelectedServices(selectedServices.filter((s) => s !== name));
  }

  // ── Custom rates ───────────────────────────────────────────────
  function addCustomRate() {
    setCustomRates([...customRates, { name: "", amount: "" }]);
  }
  function updateCustomRate(
    i: number,
    field: "name" | "amount",
    value: string,
  ) {
    setCustomRates(
      customRates.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)),
    );
  }
  function removeCustomRate(i: number) {
    setCustomRates(customRates.filter((_, idx) => idx !== i));
  }

  // ── Save profile ───────────────────────────────────────────────

  async function saveProfile() {
    if (!rateHourly) {
      toast({ type: "warning", title: "Hourly rate required" });
      return;
    }
    setSavingProfile(true);
    try {
      // ✅ Convert custom rates from array to object format (like the website)
      const rateCustomObject = customRates.reduce((acc: any, r) => {
        const name = r.name.trim();
        if (name && r.amount.trim()) {
          acc[name] = Number(r.amount);
        }
        return acc;
      }, {});

      // ✅ Send to the SAME endpoint as the website with rate_custom as object
      const body = {
        bio,
        location,
        years_exp: yearsExp ? Number(yearsExp) : undefined,
        currency,
        latitude,
        longitude,
        hourly_rate: Number(rateHourly),
        rate_hourly: Number(rateHourly),
        rate_daily: rateDaily ? Number(rateDaily) : null,
        rate_weekly: rateWeekly ? Number(rateWeekly) : null,
        rate_monthly: rateMonthly ? Number(rateMonthly) : null,
        pricing_note: pricingNote || null,
        services: selectedServices,
        // ✅ Send rate_custom as an OBJECT (like the website does)
        rate_custom:
          Object.keys(rateCustomObject).length > 0
            ? rateCustomObject
            : undefined,
      };

      const res = await apiPatch("/api/maids/profile", token!, body);
      if (res.error) throw new Error(res.error);

      toast({ type: "success", title: "Profile saved!" });
      qc.invalidateQueries({ queryKey: ["my-maid-profile"] });
      await refetchProfile();
    } catch (err: any) {
      console.error("[MaidProfile] Save error:", err);
      toast({ type: "error", title: "Save failed", message: err.message });
    } finally {
      setSavingProfile(false);
    }
  }
  // ── Save availability ──────────────────────────────────────────
  async function saveAvailability() {
    setSavingAvail(true);
    try {
      const slots = Object.entries(availability)
        .filter(([_, v]) => v.enabled)
        .map(([day, v]) => ({
          day_of_week: Number(day),
          start_time: v.start,
          end_time: v.end,
        }));
      const res = await apiPut("/api/maids/my/availability", token!, { slots });
      if (res.error) throw new Error(res.error);
      toast({ type: "success", title: "Availability saved!" });
      refetchAvail();
    } catch (err: any) {
      toast({ type: "error", title: "Save failed", message: err.message });
    } finally {
      setSavingAvail(false);
    }
  }

  // ── Upload document ────────────────────────────────────────────
  async function uploadDocument(docType: string) {
    setUploadingDoc(docType);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/*", "application/pdf"],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) {
        setUploadingDoc(null);
        return;
      }
      const asset = result.assets[0];
      const fd = new FormData();
      fd.append("document", {
        uri: asset.uri,
        name: asset.name || "document.jpg",
        type: asset.mimeType || "image/jpeg",
      } as any);
      fd.append("doc_type", docType);
      const res = await fetch(`${API_URL}/api/maids/my/documents`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast({
        type: "success",
        title: "Document submitted",
        message: "Awaiting admin review.",
      });
      refetchDocs();
    } catch (err: any) {
      toast({ type: "error", title: "Upload failed", message: err.message });
    } finally {
      setUploadingDoc(null);
    }
  }

  // ── RENDER ──────────────────────────────────────────────────────
  const customServices = selectedServices.filter(
    (s) => !DEFAULT_SERVICES.includes(s),
  );

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Profile</Text>
        <TouchableOpacity onPress={() => router.push("/settings" as any)}>
          <View style={s.headerActionRow}>
            <FontAwesome5 name="cog" size={16} color={COLORS.navy} />
            <Text style={s.headerAction}> Settings</Text>
          </View>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={() => {
                refetchProfile();
                refetchAvail();
                refetchDocs();
              }}
              tintColor={COLORS.navy}
            />
          }
        >
          <Text style={s.bigTitle}>My Profile</Text>

          {/* ═══════ PROFILE PHOTO ═══════ */}
          <View style={s.card}>
            <View style={s.cardTitleRow}>
              <FontAwesome5 name="camera" size={16} color={COLORS.navy} />
              <Text style={s.cardTitle}> Profile Photo</Text>
            </View>
            <View style={s.photoRow}>
              {user?.avatar ? (
                <Image source={{ uri: user.avatar }} style={s.avatar} />
              ) : (
                <View style={[s.avatar, s.avatarFallback]}>
                  <Text style={s.avatarInit}>
                    {user?.name?.[0]?.toUpperCase() || "?"}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <TouchableOpacity
                  style={s.photoBtn}
                  onPress={pickAvatar}
                  disabled={uploadingAvatar}
                >
                  <View style={s.photoBtnRow}>
                    <FontAwesome5 name="camera" size={14} color="#fff" />
                    <Text style={s.photoBtnText}>
                      {uploadingAvatar ? "Uploading…" : " Change Photo"}
                    </Text>
                  </View>
                </TouchableOpacity>
                <Text style={s.photoHint}>JPG or PNG · Max 5 MB</Text>
              </View>
            </View>
          </View>

          {/* ═══════ BASIC INFORMATION ═══════ */}
          <View style={s.card}>
            <View style={s.cardTitleRow}>
              <FontAwesome5 name="user" size={16} color={COLORS.navy} />
              <Text style={s.cardTitle}> Basic Information</Text>
            </View>

            <Text style={s.fieldLabel}>Bio</Text>
            <TextInput
              style={[s.input, s.textArea]}
              placeholder="Tell customers about yourself…"
              placeholderTextColor={COLORS.grayLight}
              multiline
              value={bio}
              onChangeText={setBio}
              maxLength={500}
            />

            <View style={s.locationRow}>
              <Text style={s.fieldLabel}>Location</Text>
              <TouchableOpacity
                onPress={useCurrentLocation}
                disabled={gpsLoading}
              >
                <View style={s.locationLinkRow}>
                  <FontAwesome5
                    name="map-marker-alt"
                    size={14}
                    color={COLORS.navy}
                  />
                  <Text style={s.locationLink}>
                    {gpsLoading ? " Getting…" : " Use current location"}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
            <TextInput
              style={s.input}
              placeholder="e.g. Lagos"
              placeholderTextColor={COLORS.grayLight}
              value={location}
              onChangeText={setLocation}
            />

            <View style={s.row2}>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Years Experience</Text>
                <TextInput
                  style={s.input}
                  placeholder="0"
                  placeholderTextColor={COLORS.grayLight}
                  keyboardType="number-pad"
                  value={yearsExp}
                  onChangeText={setYearsExp}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Preferred Currency</Text>
                <TouchableOpacity
                  style={s.input}
                  onPress={() => setCurrencyOpen(true)}
                >
                  <View style={s.currencySelector}>
                    <Text style={s.inputText}>
                      {currency} —{" "}
                      {currencies.find((c: any) => c.code === currency)?.name ||
                        currency}
                    </Text>
                    <FontAwesome5
                      name="chevron-down"
                      size={14}
                      color={COLORS.grayLight}
                    />
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* ═══════ PRICING RATES ═══════ */}
          <View style={s.card}>
            <View style={s.cardTitleRow}>
              <FontAwesome5
                name="money-bill-wave"
                size={16}
                color={COLORS.navy}
              />
              <Text style={s.cardTitle}> Pricing Rates</Text>
            </View>
            <Text style={s.cardSub}>
              Set your rates per hour, day, week, or month. Customers will see
              all rates you fill in. Currency:{" "}
              <Text style={{ fontFamily: FONTS.bold, color: COLORS.navy }}>
                {currency}
              </Text>
            </Text>

            <View style={s.rateLabelRow}>
              <Text style={s.fieldLabel}>
                Hourly Rate <Text style={{ color: "#ef4444" }}>*</Text>
              </Text>
              <View style={s.unitPill}>
                <Text style={s.unitPillText}>/ hr</Text>
              </View>
            </View>
            <TextInput
              style={s.input}
              placeholder="0.00"
              placeholderTextColor={COLORS.grayLight}
              keyboardType="decimal-pad"
              value={rateHourly}
              onChangeText={setRateHourly}
            />

            <View style={s.rateLabelRow}>
              <Text style={s.fieldLabel}>Daily Rate</Text>
              <View style={s.unitPill}>
                <Text style={s.unitPillText}>/ day</Text>
              </View>
            </View>
            <TextInput
              style={s.input}
              placeholder="0.00"
              placeholderTextColor={COLORS.grayLight}
              keyboardType="decimal-pad"
              value={rateDaily}
              onChangeText={setRateDaily}
            />

            <View style={s.rateLabelRow}>
              <Text style={s.fieldLabel}>Weekly Rate</Text>
              <View style={s.unitPill}>
                <Text style={s.unitPillText}>/ week</Text>
              </View>
            </View>
            <TextInput
              style={s.input}
              placeholder="0.00"
              placeholderTextColor={COLORS.grayLight}
              keyboardType="decimal-pad"
              value={rateWeekly}
              onChangeText={setRateWeekly}
            />

            <View style={s.rateLabelRow}>
              <Text style={s.fieldLabel}>Monthly Rate</Text>
              <View style={s.unitPill}>
                <Text style={s.unitPillText}>/ month</Text>
              </View>
            </View>
            <TextInput
              style={s.input}
              placeholder="0.00"
              placeholderTextColor={COLORS.grayLight}
              keyboardType="decimal-pad"
              value={rateMonthly}
              onChangeText={setRateMonthly}
            />

            <Text style={s.fieldLabel}>
              Pricing Note <Text style={s.optional}>(optional)</Text>
            </Text>
            <TextInput
              style={[s.input, s.textArea]}
              placeholder="e.g. Prices are negotiable…"
              placeholderTextColor={COLORS.grayLight}
              multiline
              value={pricingNote}
              onChangeText={setPricingNote}
              maxLength={300}
            />

            <View style={s.customRatesHeader}>
              <Text style={s.fieldLabel}>
                Custom Rates <Text style={s.optional}>(optional)</Text>
              </Text>
              <TouchableOpacity onPress={addCustomRate}>
                <Text style={s.addLink}>+ Add</Text>
              </TouchableOpacity>
            </View>
            {customRates.map((r, i) => (
              <View key={i} style={s.customRateRow}>
                <TextInput
                  style={[s.input, { flex: 2 }]}
                  placeholder="e.g. Weekend special"
                  placeholderTextColor={COLORS.grayLight}
                  value={r.name}
                  onChangeText={(v) => updateCustomRate(i, "name", v)}
                />
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  placeholder="0"
                  placeholderTextColor={COLORS.grayLight}
                  keyboardType="decimal-pad"
                  value={r.amount}
                  onChangeText={(v) => updateCustomRate(i, "amount", v)}
                />
                <TouchableOpacity
                  style={s.removeBtn}
                  onPress={() => removeCustomRate(i)}
                >
                  <FontAwesome5 name="times" size={16} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {/* ═══════ SERVICES OFFERED ═══════ */}
          <View style={s.card}>
            <View style={s.sectionTitleRow}>
              <View style={s.cardTitleRow}>
                <FontAwesome5 name="broom" size={16} color={COLORS.navy} />
                <Text style={s.cardTitle}> Services Offered</Text>
              </View>
              <Text style={s.countText}>
                · {selectedServices.length} selected
              </Text>
            </View>

            <View style={s.serviceGrid}>
              {DEFAULT_SERVICES.map((svc) => {
                const checked = selectedServices.includes(svc);
                return (
                  <TouchableOpacity
                    key={svc}
                    style={[s.serviceItem, checked && s.serviceItemChecked]}
                    onPress={() => toggleService(svc)}
                    activeOpacity={0.85}
                  >
                    <View style={[s.checkbox, checked && s.checkboxChecked]}>
                      {checked && (
                        <FontAwesome5 name="check" size={11} color="#fff" />
                      )}
                    </View>
                    <Text
                      style={[s.serviceName, checked && s.serviceNameChecked]}
                      numberOfLines={2}
                      ellipsizeMode="tail"
                    >
                      {svc}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Custom services as pills */}
            {customServices.length > 0 && (
              <View style={s.customServiceWrap}>
                {customServices.map((svc) => (
                  <View key={svc} style={s.customServicePill}>
                    <Text style={s.customServicePillText}>{svc}</Text>
                    <TouchableOpacity
                      onPress={() => removeCustomService(svc)}
                      style={s.pillRemove}
                    >
                      <FontAwesome5 name="times" size={12} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Add custom service */}
            <View style={s.customAddRow}>
              <TextInput
                style={[s.input, { flex: 1 }]}
                placeholder="Add a custom service e.g. Fumigation"
                placeholderTextColor={COLORS.grayLight}
                value={customServiceInput}
                onChangeText={setCustomServiceInput}
                onSubmitEditing={addCustomService}
              />
              <TouchableOpacity
                style={[
                  s.addBtn,
                  !customServiceInput.trim() && s.addBtnDisabled,
                ]}
                onPress={addCustomService}
                disabled={!customServiceInput.trim()}
              >
                <Text style={s.addBtnText}>+ Add</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ═══════ SAVE PROFILE BUTTON ═══════ */}
          <TouchableOpacity
            style={[s.saveBtn, savingProfile && { opacity: 0.6 }]}
            onPress={saveProfile}
            disabled={savingProfile}
          >
            {savingProfile ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.saveBtnText}>Save Profile</Text>
            )}
          </TouchableOpacity>

          {/* ═══════ WEEKLY AVAILABILITY ═══════ */}
          <View style={s.card}>
            <View style={s.cardTitleRow}>
              <FontAwesome5 name="calendar-alt" size={16} color={COLORS.navy} />
              <Text style={s.cardTitle}> Weekly Availability</Text>
            </View>
            <Text style={s.cardSub}>
              Set which days and hours you're available for bookings.
            </Text>

            {DAYS.map((d) => {
              const a = availability[d.idx];
              return (
                <View
                  key={d.idx}
                  style={[s.dayRow, a.enabled && s.dayRowActive]}
                >
                  <Switch
                    value={a.enabled}
                    onValueChange={(val) =>
                      setAvailability({
                        ...availability,
                        [d.idx]: { ...a, enabled: val },
                      })
                    }
                    trackColor={{ false: "#e5e7eb", true: "#22c55e" }}
                    thumbColor="#fff"
                  />
                  <Text
                    style={[s.dayLabel, !a.enabled && { color: COLORS.gray }]}
                  >
                    {d.short}
                  </Text>
                  {a.enabled ? (
                    <View style={s.timeRow}>
                      <TouchableOpacity
                        style={s.timeBtn}
                        onPress={() =>
                          setTimePicker({ day: d.idx, field: "start" })
                        }
                      >
                        <View style={s.timeBtnRow}>
                          <Text style={s.timeBtnText}>
                            {formatTime(a.start)}
                          </Text>
                          <FontAwesome5
                            name="clock"
                            size={12}
                            color={COLORS.navy}
                          />
                        </View>
                      </TouchableOpacity>
                      <FontAwesome5
                        name="arrow-right"
                        size={12}
                        color={COLORS.gray}
                      />
                      <TouchableOpacity
                        style={s.timeBtn}
                        onPress={() =>
                          setTimePicker({ day: d.idx, field: "end" })
                        }
                      >
                        <View style={s.timeBtnRow}>
                          <Text style={s.timeBtnText}>{formatTime(a.end)}</Text>
                          <FontAwesome5
                            name="clock"
                            size={12}
                            color={COLORS.navy}
                          />
                        </View>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Text style={s.notAvail}>Not available</Text>
                  )}
                </View>
              );
            })}
          </View>

          <TouchableOpacity
            style={[s.saveBtn, savingAvail && { opacity: 0.6 }]}
            onPress={saveAvailability}
            disabled={savingAvail}
          >
            {savingAvail ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.saveBtnText}>Save Availability</Text>
            )}
          </TouchableOpacity>

          {/* ═══════ IDENTITY VERIFICATION ═══════ */}
          <View style={s.card}>
            <View style={s.cardTitleRow}>
              <FontAwesome5 name="id-card" size={16} color={COLORS.navy} />
              <Text style={s.cardTitle}> Identity Verification</Text>
            </View>

            {/* ── Check if user is fully verified ── */}
            {user?.id_verified ? (
              // ── SHOW VERIFIED SHIELD ──
              <View style={s.verifiedContainer}>
                <View style={s.verifiedBadge}>
                  <FontAwesome5
                    name="shield-alt"
                    size={48}
                    color={COLORS.green}
                  />
                  <View style={s.verifiedCheckCircle}>
                    <FontAwesome5 name="check" size={20} color="#fff" />
                  </View>
                </View>
                <Text style={s.verifiedTitle}>✓ Identity Verified</Text>
                <Text style={s.verifiedSub}>
                  Your account has been successfully verified. Your ID documents
                  have been reviewed and approved.
                </Text>
                <View style={s.verifiedFeatures}>
                  <View style={s.verifiedFeature}>
                    <FontAwesome5
                      name="check-circle"
                      size={16}
                      color={COLORS.green}
                    />
                    <Text style={s.verifiedFeatureText}>
                      Profile is fully verified
                    </Text>
                  </View>
                  <View style={s.verifiedFeature}>
                    <FontAwesome5
                      name="check-circle"
                      size={16}
                      color={COLORS.green}
                    />
                    <Text style={s.verifiedFeatureText}>
                      Trusted by customers
                    </Text>
                  </View>
                  <View style={s.verifiedFeature}>
                    <FontAwesome5
                      name="check-circle"
                      size={16}
                      color={COLORS.green}
                    />
                    <Text style={s.verifiedFeatureText}>
                      Higher search ranking
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              // ── SHOW UPLOAD DOCUMENTS ──
              <>
                <Text style={s.cardSub}>
                  Upload a valid document to get your profile verified,
                  whichever ID you choose to upload you must upload a Utility
                  Bill for proof of address. Verified maids appear higher in
                  search results.
                </Text>

                {DOC_TYPES.map((dt) => {
                  const doc = documents.find((d: any) => d.doc_type === dt.key);
                  const status = doc?.status || "not_submitted";
                  const isRejected = status === "rejected";
                  const isApproved = status === "approved";
                  const isPending = status === "pending";
                  const isUploading = uploadingDoc === dt.key;

                  return (
                    <View
                      key={dt.key}
                      style={[s.docCard, isRejected && s.docCardRejected]}
                    >
                      <View style={s.docHeader}>
                        <FontAwesome5
                          name={dt.icon}
                          size={32}
                          color={COLORS.navy}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={s.docName}>{dt.label}</Text>
                          <View style={s.docStatusRow}>
                            {status === "not_submitted" && (
                              <Text style={s.docStatus}>Not submitted</Text>
                            )}
                            {isPending && (
                              <>
                                <FontAwesome5
                                  name="clock"
                                  size={12}
                                  color="#92400e"
                                />
                                <Text
                                  style={[s.docStatus, { color: "#92400e" }]}
                                >
                                  {" "}
                                  Pending review
                                </Text>
                              </>
                            )}
                            {isApproved && (
                              <>
                                <FontAwesome5
                                  name="check-circle"
                                  size={12}
                                  color={COLORS.green}
                                />
                                <Text
                                  style={[s.docStatus, { color: COLORS.green }]}
                                >
                                  {" "}
                                  Approved
                                </Text>
                              </>
                            )}
                            {isRejected && (
                              <>
                                <FontAwesome5
                                  name="times-circle"
                                  size={12}
                                  color="#991b1b"
                                />
                                <Text
                                  style={[s.docStatus, { color: "#991b1b" }]}
                                >
                                  {" "}
                                  Rejected
                                </Text>
                              </>
                            )}
                          </View>
                        </View>
                      </View>

                      {isRejected && doc?.admin_notes && (
                        <View style={s.rejectBox}>
                          <View style={s.rejectRow}>
                            <FontAwesome5
                              name="comment"
                              size={14}
                              color="#991b1b"
                            />
                            <Text style={s.rejectText}> {doc.admin_notes}</Text>
                          </View>
                        </View>
                      )}

                      {!isApproved && (
                        <TouchableOpacity
                          style={[s.uploadBtn, isUploading && { opacity: 0.6 }]}
                          onPress={() => uploadDocument(dt.key)}
                          disabled={isUploading}
                        >
                          {isUploading ? (
                            <ActivityIndicator color="#fff" />
                          ) : (
                            <Text style={s.uploadBtnText}>
                              {isRejected ? "Re-upload" : "Upload"}
                            </Text>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}

                <Text style={s.docFooter}>
                  Accepted formats: JPG, PNG, PDF · Max 10 MB per file.
                  Processing usually takes 1–2 business days. Accepted Utility
                  Bills include electricity, water, bank statements or internet
                  bills with your name and address clearly visible.
                </Text>
              </>
            )}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ═══════ CURRENCY PICKER MODAL ═══════ */}
      <Modal
        visible={currencyOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCurrencyOpen(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Preferred Currency</Text>
              <TouchableOpacity onPress={() => setCurrencyOpen(false)}>
                <FontAwesome5 name="times" size={22} color={COLORS.gray} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {currencies.map((c: any) => (
                <TouchableOpacity
                  key={c.code}
                  style={[s.modalRow, currency === c.code && s.modalRowActive]}
                  onPress={() => {
                    setCurrency(c.code);
                    setCurrencyOpen(false);
                  }}
                >
                  <Text style={s.modalRowSym}>{c.symbol || c.code}</Text>
                  <Text style={s.modalRowText}>
                    {c.code} — {c.name}
                  </Text>
                  {currency === c.code && (
                    <FontAwesome5 name="check" size={18} color={COLORS.green} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ═══════ TIME PICKER MODAL ═══════ */}
      <Modal
        visible={!!timePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setTimePicker(null)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>
                {timePicker &&
                  `${DAYS[timePicker.day].full} — ${timePicker.field === "start" ? "Start" : "End"} time`}
              </Text>
              <TouchableOpacity onPress={() => setTimePicker(null)}>
                <FontAwesome5 name="times" size={22} color={COLORS.gray} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {TIME_OPTIONS.map((t) => {
                const current = timePicker
                  ? availability[timePicker.day][timePicker.field]
                  : "";
                const isActive = current === t.value;
                return (
                  <TouchableOpacity
                    key={t.value}
                    style={[s.modalRow, isActive && s.modalRowActive]}
                    onPress={() => {
                      if (timePicker) {
                        setAvailability({
                          ...availability,
                          [timePicker.day]: {
                            ...availability[timePicker.day],
                            [timePicker.field]: t.value,
                          },
                        });
                      }
                      setTimePicker(null);
                    }}
                  >
                    <Text style={s.modalRowText}>{t.display}</Text>
                    {isActive && (
                      <FontAwesome5
                        name="check"
                        size={18}
                        color={COLORS.green}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { fontFamily: FONTS.bold, fontSize: 18, color: COLORS.navy },
  headerActionRow: { flexDirection: "row", alignItems: "center" },
  headerAction: { fontFamily: FONTS.medium, fontSize: 14, color: COLORS.navy },

  bigTitle: {
    fontFamily: FONTS.bold,
    fontSize: 24,
    color: COLORS.navy,
    padding: SPACING.md,
    paddingBottom: SPACING.sm,
  },

  // Card
  card: {
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    padding: SPACING.lg,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  cardTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.navy,
  },
  cardSub: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.gray,
    marginBottom: SPACING.md,
    lineHeight: 19,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.md,
    gap: 4,
  },
  countText: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.gray },

  // Profile photo
  photoRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.muted,
  },
  avatarFallback: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.navy,
  },
  avatarInit: { fontFamily: FONTS.bold, fontSize: 32, color: "#fff" },
  photoBtn: {
    backgroundColor: COLORS.navy,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    alignItems: "center",
  },
  photoBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  photoBtnText: { fontFamily: FONTS.bold, fontSize: 13, color: "#fff" },
  photoHint: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 6,
    textAlign: "center",
  },

  // Fields
  fieldLabel: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.navy,
    marginBottom: 6,
    marginTop: SPACING.sm,
  },
  optional: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.grayLight,
  },
  input: {
    backgroundColor: "#fff",
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
  inputText: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.navy },
  textArea: { minHeight: 90, textAlignVertical: "top", paddingTop: 12 },
  currencySelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  locationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  locationLinkRow: { flexDirection: "row", alignItems: "center" },
  locationLink: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.navy,
    textDecorationLine: "underline",
    marginTop: SPACING.sm,
  },

  row2: { flexDirection: "row", gap: SPACING.sm },

  // Pricing
  rateLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: SPACING.sm,
  },
  unitPill: {
    backgroundColor: COLORS.muted,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  unitPillText: { fontFamily: FONTS.medium, fontSize: 11, color: COLORS.navy },

  customRatesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: SPACING.md,
  },
  addLink: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.navy,
    textDecorationLine: "underline",
  },
  customRateRow: {
    flexDirection: "row",
    gap: SPACING.xs,
    marginTop: SPACING.sm,
    alignItems: "center",
  },
  removeBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },

  // Services grid - RESPONSIVE FIX
  serviceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
    marginHorizontal: -4,
  },
  serviceItem: {
    width: "48%", // 2 columns on all screens
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#fff",
    gap: 8,
    minHeight: 44,
    overflow: "hidden",
  },
  serviceItemChecked: {
    backgroundColor: COLORS.muted,
    borderColor: COLORS.navy,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: COLORS.navy,
    borderColor: COLORS.navy,
  },
  serviceName: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.gray,
    flex: 1,
    flexWrap: "wrap",
    lineHeight: 16,
  },
  serviceNameChecked: {
    fontFamily: FONTS.bold,
    color: COLORS.navy,
  },

  // Custom services wrap
  customServiceWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: SPACING.md,
  },
  customServicePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: COLORS.navy,
    borderRadius: RADIUS.full,
    paddingLeft: 10,
    paddingRight: 4,
    paddingVertical: 4,
    gap: 4,
    maxWidth: "48%",
  },
  customServicePillText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.navy,
    flexShrink: 1,
  },
  pillRemove: {
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },

  customAddRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: SPACING.md,
  },
  addBtn: {
    backgroundColor: COLORS.navy,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 60,
  },
  addBtnDisabled: { opacity: 0.4 },
  addBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: "#fff",
  },

  // Save button
  saveBtn: {
    backgroundColor: COLORS.navy,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    paddingVertical: 16,
    borderRadius: RADIUS.lg,
    alignItems: "center",
  },
  saveBtnText: { fontFamily: FONTS.bold, fontSize: 15, color: "#fff" },

  // Availability
  dayRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.sm,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: "transparent",
    backgroundColor: "#f9fafb",
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  dayRowActive: { backgroundColor: COLORS.muted, borderColor: COLORS.navy },
  dayLabel: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.navy,
    width: 40,
  },
  notAvail: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.gray,
    fontStyle: "italic",
  },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  timeBtn: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 8,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.sm,
    alignItems: "center",
  },
  timeBtnRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  timeBtnText: { fontFamily: FONTS.medium, fontSize: 12, color: COLORS.navy },

  // Documents
  docCard: {
    backgroundColor: "#fff",
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  docCardRejected: { backgroundColor: "#fef2f2", borderColor: "#dc2626" },
  docHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  docName: { fontFamily: FONTS.bold, fontSize: 15, color: COLORS.navy },
  docStatusRow: { flexDirection: "row", alignItems: "center" },
  docStatus: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.gray,
  },
  rejectBox: {
    backgroundColor: "#fee2e2",
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.sm,
  },
  rejectRow: { flexDirection: "row", alignItems: "center" },
  rejectText: { fontFamily: FONTS.medium, fontSize: 12, color: "#991b1b" },
  uploadBtn: {
    backgroundColor: COLORS.navy,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    alignItems: "center",
  },
  uploadBtnText: { fontFamily: FONTS.bold, fontSize: 14, color: "#fff" },
  docFooter: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.gray,
    lineHeight: 18,
    marginTop: SPACING.sm,
  },

  // Modal
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
  modalTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.navy,
    flex: 1,
  },
  modalRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.sm,
  },
  modalRowActive: { backgroundColor: COLORS.muted },
  modalRowSym: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.navy,
    width: 30,
  },
  modalRowText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.navy,
    flex: 1,
  },

  // ── Verified styles ──
  verifiedContainer: {
    alignItems: "center",
    paddingVertical: SPACING.md,
  },
  verifiedBadge: {
    position: "relative",
    marginBottom: SPACING.md,
  },
  verifiedCheckCircle: {
    position: "absolute",
    bottom: -4,
    right: -4,
    backgroundColor: COLORS.green,
    borderRadius: 14,
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },
  verifiedTitle: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    color: COLORS.green,
    marginBottom: 6,
  },
  verifiedSub: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.gray,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  verifiedFeatures: {
    width: "100%",
    backgroundColor: "#f0fdf4",
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.sm,
  },
  verifiedFeature: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingVertical: 4,
  },
  verifiedFeatureText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.navy,
  },
});
