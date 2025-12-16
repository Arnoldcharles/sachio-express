import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FontAwesome5, FontAwesome } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import axios from "axios";
import { auth, db, getUserProfile } from "../lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

type CartItem = {
  id: string;
  title: string;
  price: number | string;
  imageUrl?: string;
  qty: number;
};

const CART_KEY = "cart_items";
const SHIPPING_FEE = 4000;

export default function CartScreen() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [flutterwaveUrl, setFlutterwaveUrl] = useState<string | null>(null);
  const [txRef, setTxRef] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [orderRef, setOrderRef] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [country, setCountry] = useState("Nigeria");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateField, setStateField] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [rentalStart, setRentalStart] = useState("");
  const [rentalEnd, setRentalEnd] = useState("");
  const FLW_PUBLIC_KEY =
    process.env.EXPO_PUBLIC_FLW_PUBLIC_KEY ??
    "FLWPUBK_TEST-b4b6028b1cd2963606e7fd405623b8f6-X";
  const FLW_SECRET_KEY =
    process.env.EXPO_PUBLIC_FLW_SECRET_KEY ??
    "FLWSECK_TEST-4e40dea47380c21b7a9bcdff17b79aba-X";

  useEffect(() => {
    loadCart();
    prefillProfile();
  }, []);

  const prefillProfile = async () => {
    try {
      if (!auth.currentUser) return;
      const profile = await getUserProfile(auth.currentUser.uid);
      if (profile) {
        if (profile.addresses && profile.addresses.length) {
          setAddress(profile.addresses[0]);
        }
        if (profile.phone) setPhone(profile.phone);
        if (profile.name) setNote((prev) => prev || `For ${profile.name}`);
        if (profile.country) setCountry(profile.country);
        if (profile.city) setCity(profile.city);
        if (profile.state) setStateField(profile.state);
      }
      if (auth.currentUser.email) setEmail(auth.currentUser.email);
    } catch (e) {
      // ignore prefill errors
    }
  };

  const loadCart = async () => {
    try {
      setLoading(true);
      const raw = await AsyncStorage.getItem(CART_KEY);
      const parsed: CartItem[] = raw ? JSON.parse(raw) : [];
      setItems(parsed);
    } catch (e) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const persist = useCallback(async (next: CartItem[]) => {
    setItems(next);
    await AsyncStorage.setItem(CART_KEY, JSON.stringify(next));
  }, []);

  const increment = (id: string) => {
    const next = items.map((it) =>
      it.id === id ? { ...it, qty: it.qty + 1 } : it
    );
    persist(next);
  };

  const decrement = (id: string) => {
    const next = items.map((it) =>
      it.id === id ? { ...it, qty: Math.max(1, it.qty - 1) } : it
    );
    persist(next);
  };

  const removeItem = (id: string) => {
    const next = items.filter((it) => it.id !== id);
    persist(next);
  };

  const total = useMemo(() => {
    return items.reduce((sum, it) => {
      const priceNum =
        typeof it.price === "number" ? it.price : parseFloat(it.price || "0");
      return sum + priceNum * (it.qty || 1);
    }, 0);
  }, [items]);
  const totalWithShipping = total + (items.length ? SHIPPING_FEE : 0);

  const goCheckout = () => {
    if (!items.length) {
      alert("Cart is empty.");
      return;
    }
    setShowForm(true);
  };

  const startFlutterwavePayment = async () => {
    const required = [
      { label: "Country", value: country },
      { label: "Address", value: address },
      { label: "City", value: city },
      { label: "State", value: stateField },
      { label: "Phone", value: phone },
      { label: "Email", value: email },
    ];
    const missing = required.find((r) => !r.value.trim());
    if (missing) {
      Alert.alert("Missing info", `Please enter ${missing.label}.`);
      return;
    }
    try {
      const tx_ref = `sachio-cart-${Date.now()}`;
      setTxRef(tx_ref);
      setLoading(true);
      const payload = {
        tx_ref,
        amount: total || 0,
        currency: "NGN",
        redirect_url: "https://sachio-mobile/close",
        customer: {
          email: email || auth.currentUser?.email || "guest@sachio.com",
          phone_number: phone,
        },
        payment_options: "card",
        meta: { items: items.map((it) => ({ id: it.id, qty: it.qty })) },
      };
      const res = await axios.post(
        "https://api.flutterwave.com/v3/payments",
        payload,
        {
          headers: {
            Authorization: `Bearer ${FLW_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );
      const link = res.data?.data?.link;
      if (link) {
        setFlutterwaveUrl(link);
      } else {
        Alert.alert("Payment error", "Could not start payment");
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Payment initialization failed";
      Alert.alert("Payment error", msg);
    } finally {
      setLoading(false);
    }
  };

  const createOrder = async (
    itemsToSave: CartItem[],
    reference: string | null
  ) => {
    try {
      const data = {
        items: itemsToSave.map((it) => ({
          id: it.id,
          title: it.title,
          price:
            typeof it.price === "number"
              ? it.price
              : parseFloat(it.price || "0"),
          qty: it.qty,
          imageUrl: it.imageUrl || "",
        })),
        total,
        type: "buy",
        paymentMethod: "Card",
        paymentMethodId: "flutterwave",
        userId: auth.currentUser?.uid || "guest",
        customerName: auth.currentUser?.email || "Guest",
        customerPhone: phone || null,
        customerAddress: address || null,
        rentalStartDate: rentalStart || null,
        rentalEndDate: rentalEnd || null,
        country,
        city,
        state: stateField,
        note: note || null,
        status: "paid",
        reference: reference || null,
        createdAt: serverTimestamp(),
      };
      const docRef = await addDoc(collection(db, "orders"), data);
      return docRef.id;
    } catch (e) {
      return null;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.circleBtn}
          onPress={() => router.back()}
        >
          <FontAwesome5 name="arrow-left" size={16} color="#0B6E6B" />
        </TouchableOpacity>
        <Text style={styles.title}>Cart</Text>
        <TouchableOpacity style={styles.circleBtn}>
          <FontAwesome name="heart-o" size={16} color="#0B6E6B" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color="#0B6E6B" size="large" />
          <Text style={styles.loaderText}>Loading cart…</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <FontAwesome5 name="shopping-basket" size={32} color="#0B6E6B" />
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <TouchableOpacity
            style={styles.outlineBtn}
            onPress={() => router.replace("/(tabs)/home")}
          >
            <Text style={styles.outlineBtnText}>Browse products</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingBottom: 140,
              gap: 12,
            }}
            showsVerticalScrollIndicator={false}
          >
            {items.map((item) => (
              <View key={item.id} style={styles.card}>
                <View style={styles.greenDot} />
                {item.imageUrl ? (
                  <Image
                    source={{ uri: item.imageUrl }}
                    style={styles.thumb}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.thumb, styles.thumbFallback]}>
                    <FontAwesome5 name="toilet" size={26} color="#0B6E6B" />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.itemPrice}>NGN {item.price}</Text>
                </View>
                <View style={styles.qtyControl}>
                  <TouchableOpacity
                    onPress={() => decrement(item.id)}
                    style={styles.qtyBtn}
                  >
                    <Text style={styles.qtyBtnText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{item.qty}</Text>
                  <TouchableOpacity
                    onPress={() => increment(item.id)}
                    style={styles.qtyBtn}
                  >
                    <Text style={styles.qtyBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  onPress={() => removeItem(item.id)}
                  style={styles.removeBtn}
                >
                  <FontAwesome5 name="times" size={14} color="#94a3b8" />
                </TouchableOpacity>
              </View>
            ))}

            <View style={styles.summaryCard}>
              <Text style={styles.sectionTitle}>Shipping Information</Text>
              <View style={styles.shipRow}>
                <Text style={styles.shipText}>**** **** **** 8148</Text>
                <FontAwesome5 name="chevron-down" size={12} color="#1f2937" />
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>
                  Total ({items.length} item{items.length > 1 ? "s" : ""}):
                </Text>
                <Text style={styles.totalValue}>
                  NGN {total.toLocaleString()}
                </Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Shipping Fee</Text>
                <Text style={styles.totalValue}>
                  ₦{SHIPPING_FEE.toLocaleString()}
                </Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Discount</Text>
                <Text style={styles.totalValue}>N0.00</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Sub Total</Text>
                <Text style={styles.totalValue}>
                  ₦{totalWithShipping.toLocaleString()}
                </Text>
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                Total ({items.length} item{items.length > 1 ? "s" : ""}):
              </Text>
              <Text style={styles.totalValue}>
                NGN {totalWithShipping.toLocaleString()}
              </Text>
            </View>
            {showForm && (
              <View style={styles.formCard}>
                <Text style={styles.sectionLabel}>Delivery Details</Text>
                <TextInput
                  placeholder="Country"
                  value={country}
                  onChangeText={setCountry}
                  style={styles.input}
                  placeholderTextColor="#94a3b8"
                />
                <TextInput
                  placeholder="Street address"
                  value={address}
                  onChangeText={setAddress}
                  style={styles.input}
                  placeholderTextColor="#94a3b8"
                />
                <TextInput
                  placeholder="Town/City"
                  value={city}
                  onChangeText={setCity}
                  style={styles.input}
                  placeholderTextColor="#94a3b8"
                />
                <TextInput
                  placeholder="State"
                  value={stateField}
                  onChangeText={setStateField}
                  style={styles.input}
                  placeholderTextColor="#94a3b8"
                />
                <TextInput
                  placeholder="+234 Your mobile number"
                  value={phone}
                  onChangeText={setPhone}
                  style={styles.input}
                  placeholderTextColor="#94a3b8"
                  keyboardType="phone-pad"
                />
                <TextInput
                  placeholder="Email"
                  value={email}
                  onChangeText={setEmail}
                  style={styles.input}
                  placeholderTextColor="#94a3b8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <TextInput
                  placeholder="Rental start date (YYYY-MM-DD) - optional"
                  value={rentalStart}
                  onChangeText={setRentalStart}
                  style={styles.input}
                  placeholderTextColor="#94a3b8"
                />
                <TextInput
                  placeholder="Rental end date (YYYY-MM-DD) - optional"
                  value={rentalEnd}
                  onChangeText={setRentalEnd}
                  style={styles.input}
                  placeholderTextColor="#94a3b8"
                />
                <Text style={styles.helperTextSmall}>
                  Additional Information (optional)
                </Text>
                <TextInput
                  placeholder="Notes about your order, e.g. delivery note"
                  value={note}
                  onChangeText={setNote}
                  style={[styles.input, { height: 70 }]}
                  placeholderTextColor="#94a3b8"
                  multiline
                />
              </View>
            )}

            {flutterwaveUrl && txRef ? (
              <View style={styles.webviewContainer}>
                <WebView
                  source={{ uri: flutterwaveUrl }}
                  startInLoadingState
                  onNavigationStateChange={async (nav) => {
                    const successHit =
                      nav.url.includes("status=successful") ||
                      nav.url.includes("success=true") ||
                      nav.url.includes("sachio-mobile/close");
                    if (successHit && items.length) {
                      setLoading(true);
                      const createdId = await createOrder(items, txRef);
                      // clear cart after successful payment
                      await AsyncStorage.setItem(CART_KEY, JSON.stringify([]));
                      setItems([]);
                      setLoading(false);
                      setPaymentSuccess(true);
                      setOrderRef(txRef || createdId || null);
                      setFlutterwaveUrl(null);
                    }
                  }}
                  showsVerticalScrollIndicator={false}
                />
              </View>
            ) : paymentSuccess ? (
              <View style={styles.successBox}>
                <FontAwesome5 name="check-circle" size={18} color="#16A34A" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.successTitle}>Payment successful</Text>
                  <Text style={styles.successSub}>Ref: {orderRef || "—"}</Text>
                </View>
                <TouchableOpacity
                  style={styles.checkoutBtn}
                  onPress={() => router.push("/(tabs)/orders")}
                >
                  <Text style={styles.checkoutText}>View Orders</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.checkoutBtn}
                onPress={() => {
                  if (!showForm) {
                    goCheckout();
                  } else {
                    startFlutterwavePayment();
                  }
                }}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.checkoutText}>
                    {showForm ? "Proceed" : "Checkout"}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8F9FB" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  circleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E6F4F3",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D1E7E5",
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  loader: { flex: 1, justifyContent: "center", alignItems: "center", gap: 8 },
  loaderText: { color: "#475569", fontWeight: "600" },
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    padding: 24,
  },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: "#0B6E6B" },
  outlineBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#0B6E6B",
    backgroundColor: "#E6F4F3",
  },
  outlineBtnText: { color: "#0B6E6B", fontWeight: "700" },
  scroll: { flex: 1 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0B6E6B",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  greenDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#0B6E6B",
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  thumbFallback: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F3F7F7",
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 4,
  },
  itemPrice: { fontSize: 13, fontWeight: "700", color: "#0B6E6B" },
  qtyControl: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F3F7F7",
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  qtyBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    justifyContent: "center",
    alignItems: "center",
  },
  qtyBtnText: { color: "#0B6E6B", fontWeight: "800", fontSize: 14 },
  qtyText: {
    fontWeight: "800",
    color: "#0F172A",
    minWidth: 20,
    textAlign: "center",
  },
  removeBtn: { padding: 6 },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: { color: "#475569", fontWeight: "600" },
  totalValue: { color: "#0B6E6B", fontWeight: "800", fontSize: 16 },
  checkoutBtn: {
    backgroundColor: "#F6B22F",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  checkoutText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e6e6e6",
    shadowColor: "#0B6E6B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
    gap: 8,
  },
  shipRow: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f8fafc",
  },
  shipText: { color: "#0F172A", fontWeight: "700" },
  webviewContainer: {
    height: 520,
    borderWidth: 1,
    borderColor: "#cfdede",
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 8,
  },
  successBox: {
    backgroundColor: "#F0FDF4",
    borderColor: "#BBF7D0",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  successTitle: { color: "#166534", fontWeight: "800" },
  successSub: { color: "#166534", fontSize: 12 },
  formCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    shadowColor: "#0B6E6B",
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 1,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#dce0e8",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
    color: "#0f172a",
  },
  helperTextSmall: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 10,
  },
});
