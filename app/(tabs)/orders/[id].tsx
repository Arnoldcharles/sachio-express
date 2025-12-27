import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text as RNText,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import { auth, db } from "../../../lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import type { FirebaseAuthTypes } from "@react-native-firebase/auth";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} style={[{ fontFamily: "Nunito" }, props.style]} />
);

type OrderDoc = {
  productTitle?: string;
  status?: string;
  price?: number | string;
  amount?: number | string;
  total?: number | string;
  type?: string;
  paymentMethod?: string;
  rentalStartDate?: string | null;
  rentalEndDate?: string | null;
  userId?: string;
  createdAt?: { seconds: number; nanoseconds: number } | { toDate: () => Date };
  items?: { title?: string | null }[];
};

export default function OrderDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [order, setOrder] = useState<OrderDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [currentUser, setCurrentUser] = useState<FirebaseAuthTypes.User | null>(
    auth.currentUser
  );
  const [showItems, setShowItems] = useState(false);

  useEffect(() => {
    if (!auth || typeof auth.onAuthStateChanged !== "function") return;
    const unsubAuth = auth.onAuthStateChanged(
      (user: FirebaseAuthTypes.User | null) => {
        setCurrentUser(user);
      }
    );
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!id) return;
    const ref = doc(db, "orders", String(id));
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setOrder(null);
          setUnauthorized(false);
          setLoading(false);
          return;
        }
        const data = snap.data() as OrderDoc;
        if (currentUser && data.userId && data.userId !== currentUser.uid) {
          setUnauthorized(true);
          setOrder(null);
        } else if (!currentUser) {
          setUnauthorized(true);
          setOrder(null);
        } else {
          setUnauthorized(false);
          setOrder(data);
        }
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );
    return () => unsub();
  }, [id, currentUser]);

  const timelineSteps = useMemo(
    () => ["Processing", "Dispatched", "In transit", "Delivered"],
    []
  );
  const activeIndex = useMemo(() => {
    const status = (order?.status || "").toLowerCase();
    if (status.includes("deliver")) return 3;
    if (status.includes("transit")) return 2;
    if (status.includes("dispatch")) return 1;
    if (status.includes("process")) return 0;
    return 0;
  }, [order]);

  const toNumber = (val: any) => {
    if (typeof val === "number") return val;
    if (typeof val === "string") {
      const cleaned = val.replace(/[ƒ,İ,]/g, "").trim();
      const num = parseFloat(cleaned);
      return Number.isNaN(num) ? null : num;
    }
    return null;
  };
  const numTotal = toNumber(order?.total);
  const numAmount = toNumber(order?.amount);
  const numPrice = toNumber(order?.price);
  const total =
    numTotal != null
      ? `NGN ${numTotal.toLocaleString()}`
      : numAmount != null
      ? `NGN ${numAmount.toLocaleString()}`
      : numPrice != null
      ? `NGN ${numPrice.toLocaleString()}`
      : order?.price
      ? `NGN ${order.price}`
      : "NGN -";
  const createdAtDate =
    (order?.createdAt as any)?.toDate?.() ??
    ((order?.createdAt as any)?.seconds
      ? new Date((order?.createdAt as any).seconds * 1000)
      : null);
  const dateText = createdAtDate ? createdAtDate.toLocaleDateString() : "N/A";
  const timeText = createdAtDate ? createdAtDate.toLocaleTimeString() : "N/A";
  const itemNames = (order?.items || [])
    .map((item) => item.title)
    .filter((title): title is string => !!title);
  const truncate = (value: string, max = 22) =>
    value.length > max ? `${value.slice(0, max - 3)}...` : value;
  const shortNames = itemNames.map((name) => truncate(name));
  const itemLabel =
    itemNames.length > 2
      ? `${shortNames.slice(0, 2).join(", ")} +${
          itemNames.length - 2
        } more`
      : itemNames.length > 0
      ? shortNames.join(", ")
      : order?.productTitle
      ? truncate(order.productTitle, 32)
      : "N/A";

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ padding: 6, marginRight: 8 }}
          >
            <FontAwesome5 name="arrow-left" size={18} color="#0B6E6B" />
          </TouchableOpacity>
          <Text style={styles.title}>Order Details</Text>
        </View>

        {!currentUser ? (
          <View style={styles.emptyState}>
            <FontAwesome5 name="lock" size={32} color="#94a3b8" />
            <Text style={styles.emptyText}>Login required</Text>
            <Text style={styles.emptySubtext}>
              Please sign in to view this order.
            </Text>
            <TouchableOpacity
              style={styles.loginBtn}
              onPress={() => router.push("/auth/login")}
            >
              <Text style={styles.loginBtnText}>Go to Login</Text>
            </TouchableOpacity>
          </View>
        ) : unauthorized ? (
          <View style={styles.emptyState}>
            <FontAwesome5 name="ban" size={32} color="#ef4444" />
            <Text style={styles.emptyText}>Access denied</Text>
            <Text style={styles.emptySubtext}>
              This order is not in your account.
            </Text>
          </View>
        ) : loading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color="#0B6E6B" />
            <Text style={styles.emptySubtext}>Loading order...</Text>
          </View>
        ) : order ? (
          <View style={styles.card}>
            <Text style={styles.orderId}>Order #{String(id).slice(0, 6)}</Text>
            <Text style={styles.label}>Item</Text>
            <Text style={styles.value}>{itemLabel}</Text>
            {itemNames.length > 0 ? (
              <TouchableOpacity
                onPress={() => setShowItems(true)}
                style={styles.itemsToggle}
              >
                <Text style={styles.itemsToggleText}>View items</Text>
              </TouchableOpacity>
            ) : null}
            <Text style={styles.label}>Status</Text>
            <Text style={styles.value}>{order.status || "N/A"}</Text>
            <Text style={styles.label}>Type</Text>
            <Text style={styles.value}>
              {order.type === "rent" ? "Rent" : "Buy"}
            </Text>
            <Text style={styles.label}>Payment</Text>
            <Text style={styles.value}>{order.paymentMethod || "N/A"}</Text>
            <Text style={styles.label}>Date</Text>
            <Text style={styles.value}>{dateText}</Text>
            <Text style={styles.label}>Time</Text>
            <Text style={styles.value}>{timeText}</Text>
            <Text style={styles.label}>Total</Text>
            <Text style={styles.value}>{total}</Text>
            {order.rentalStartDate || order.rentalEndDate ? (
              <>
                <Text style={styles.label}>Rental dates</Text>
                <Text style={styles.value}>
                  {order.rentalStartDate || "N/A"} to{" "}
                  {order.rentalEndDate || "N/A"}
                </Text>
              </>
            ) : null}
            <View style={styles.timeline}>
              {timelineSteps.map((step, idx) => {
                const active = idx <= activeIndex;
                return (
                  <View key={step} style={styles.timelineStep}>
                    <View style={[styles.dot, active && styles.dotActive]} />
                    <Text
                      style={[styles.stepText, active && styles.stepTextActive]}
                    >
                      {step}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <FontAwesome5 name="inbox" size={32} color="#94a3b8" />
            <Text style={styles.emptyText}>Order not found</Text>
          </View>
        )}
      </View>

      {showItems ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setShowItems(false)}
        >
          <Pressable
            style={styles.itemsBackdrop}
            onPress={() => setShowItems(false)}
          >
            <Pressable style={styles.itemsModal} onPress={() => {}}>
              <View style={styles.itemsModalHeader}>
                <Text style={styles.itemsModalTitle}>Items</Text>
                <TouchableOpacity
                  onPress={() => setShowItems(false)}
                  style={styles.itemsCloseIcon}
                >
                  <FontAwesome5 name="times" size={14} color="#0B6E6B" />
                </TouchableOpacity>
              </View>
              <View style={styles.itemsListWrap}>
                <ScrollView showsVerticalScrollIndicator={false}>
                  {itemNames.map((name, index) => (
                    <View key={`${name}-${index}`} style={styles.itemsRow}>
                      <Text style={styles.itemsBullet}>•</Text>
                      <Text style={styles.itemsModalItem}>{name}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
              <TouchableOpacity
                style={styles.itemsCloseBtn}
                onPress={() => setShowItems(false)}
              >
                <Text style={styles.itemsCloseText}>Close</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FAFBFB" },
  container: { flex: 1, padding: 16, backgroundColor: "#FAFBFB" },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  title: { fontSize: 20, fontWeight: "700", color: "#0B6E6B" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    shadowColor: "#0B6E6B",
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 1,
  },
  orderId: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0B6E6B",
    marginBottom: 8,
  },
  label: { fontSize: 12, color: "#475569", marginTop: 6 },
  value: { fontSize: 14, color: "#0F172A", fontWeight: "700" },
  itemsToggle: { marginTop: 6, alignSelf: "flex-start" },
  itemsToggleText: { color: "#0B6E6B", fontWeight: "700", fontSize: 12 },
  itemsBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  itemsModal: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  itemsModalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0B6E6B",
    marginBottom: 10,
  },
  itemsModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  itemsCloseIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#E6F4F3",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D1E7E5",
  },
  itemsListWrap: { maxHeight: 260 },
  itemsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 6,
  },
  itemsBullet: { fontSize: 16, color: "#0B6E6B", lineHeight: 20 },
  itemsModalItem: { fontSize: 14, color: "#0F172A", marginBottom: 6 },
  itemsCloseBtn: {
    marginTop: 12,
    backgroundColor: "#0B6E6B",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  itemsCloseText: { color: "#fff", fontWeight: "700" },
  timeline: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
  },
  timelineStep: { alignItems: "center", flex: 1 },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#e5e7eb",
    marginBottom: 4,
  },
  dotActive: { backgroundColor: "#0B6E6B" },
  stepText: { fontSize: 11, color: "#94a3b8", textAlign: "center" },
  stepTextActive: { color: "#0B6E6B", fontWeight: "700" },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyText: { fontSize: 16, fontWeight: "700", color: "#1E293B" },
  emptySubtext: { fontSize: 14, color: "#64748b", textAlign: "center" },
  loginBtn: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#0B6E6B",
    borderRadius: 10,
  },
  loginBtnText: { color: "#fff", fontWeight: "700" },
});
