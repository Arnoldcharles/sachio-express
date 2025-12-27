import React, { useEffect, useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Alert,
  TextInput,
  Modal,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Swipeable } from "react-native-gesture-handler";
import { useTheme } from "../../lib/theme";

export default function PaymentMethods() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [methods, setMethods] = useState<any[]>([]);
  const [addVisible, setAddVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newBrand, setNewBrand] = useState("");
  const [newLast4, setNewLast4] = useState("");
  const [newExp, setNewExp] = useState("");

  useEffect(() => {
    const bootstrap = async () => {
      const stored = await AsyncStorage.getItem("customPaymentMethods");
      const parsed = stored ? JSON.parse(stored) : [];
      setMethods(parsed);
      const id = await AsyncStorage.getItem("preferredPaymentMethod");
      if (id) setSelectedId(id);
    };
    bootstrap();
  }, []);

  async function handleSelect(id: string) {
    setSelectedId(id);
    await AsyncStorage.setItem("preferredPaymentMethod", id);
    Alert.alert("Saved", "Payment method saved for checkout.");
  }

  async function handleAddMethod() {
    if (!newLabel || !newBrand || !newLast4 || !newExp) {
      Alert.alert("All fields required");
      return;
    }
    const custom = {
      id: `pm-${Date.now()}`,
      brand: newBrand,
      last4: newLast4,
      label: newLabel,
      exp: newExp,
    };
    const updated = [...methods, custom];
    setMethods(updated);
    await AsyncStorage.setItem("customPaymentMethods", JSON.stringify(updated));
    setAddVisible(false);
    setNewLabel("");
    setNewBrand("");
    setNewLast4("");
    setNewExp("");
    Alert.alert("Saved", "New payment method added.");
  }

  function openEdit(method: any) {
    setEditingId(method.id);
    setNewLabel(method.label || "");
    setNewBrand(method.brand || "");
    setNewLast4(method.last4 || "");
    setNewExp(method.exp || "");
    setEditVisible(true);
  }

  async function handleSaveEdit() {
    if (!editingId) return;
    if (!newLabel || !newBrand || !newLast4 || !newExp) {
      Alert.alert("All fields required");
      return;
    }
    const updated = methods.map((m) =>
      m.id === editingId
        ? {
            ...m,
            label: newLabel,
            brand: newBrand,
            last4: newLast4,
            exp: newExp,
          }
        : m
    );
    setMethods(updated);
    await AsyncStorage.setItem("customPaymentMethods", JSON.stringify(updated));
    setEditVisible(false);
    setEditingId(null);
    setNewLabel("");
    setNewBrand("");
    setNewLast4("");
    setNewExp("");
    Alert.alert("Saved", "Payment method updated.");
  }

  async function handleDelete(id: string) {
    const updated = methods.filter((m) => m.id !== id);
    setMethods(updated);
    await AsyncStorage.setItem("customPaymentMethods", JSON.stringify(updated));
    if (selectedId === id) {
      setSelectedId(null);
      await AsyncStorage.removeItem("preferredPaymentMethod");
    }
    Alert.alert("Deleted", "Payment method removed.");
  }

  const renderSwipeActions = (id: string) => (
    <TouchableOpacity
      style={styles.swipeDelete}
      onPress={() =>
        Alert.alert("Delete method?", "This will remove the payment method.", [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: () => handleDelete(id) },
        ])
      }
    >
      <FontAwesome5 name="trash" size={16} color="#fff" />
      <Text style={styles.swipeDeleteText}>Delete</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome5 name="chevron-left" size={16} color="#0B6E6B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment Methods</Text>
        <View style={{ width: 32 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>
          Saved cards are used at checkout for faster payment.
        </Text>
        {methods.length === 0 ? (
          <View style={styles.emptyBox}>
            <FontAwesome5 name="credit-card" size={24} color="#0B6E6B" />
            <Text style={styles.emptyTitle}>No payment methods yet</Text>
            <Text style={styles.emptyText}>
              Add a card or payment method to use at checkout.
            </Text>
          </View>
        ) : (
          methods.map((m) => (
            <Swipeable
              key={m.id}
              renderRightActions={() => renderSwipeActions(m.id)}
              overshootRight={false}
            >
              <TouchableOpacity
                style={[
                  styles.cardRow,
                  selectedId === m.id && styles.cardRowActive,
                ]}
                onPress={() => handleSelect(m.id)}
              >
                <View style={styles.cardIcon}>
                  <FontAwesome5 name="credit-card" size={16} color="#0B6E6B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardLabel}>{m.label}</Text>
                  <Text style={styles.cardMeta}>{`${m.brand}${
                    m.last4 ? ` **** ${m.last4}` : ""
                  }${m.exp ? ` exp ${m.exp}` : ""}`}</Text>
                </View>
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => openEdit(m)}
                  >
                    <FontAwesome5 name="edit" size={12} color="#0B6E6B" />
                  </TouchableOpacity>
                </View>
                {selectedId === m.id ? (
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>Selected</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            </Swipeable>
          ))
        )}

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setAddVisible(true)}
        >
          <FontAwesome5 name="plus" size={14} color="#fff" />
          <Text style={styles.addButtonText}>Add new method</Text>
        </TouchableOpacity>

        <View style={styles.infoBox}>
          <FontAwesome5 name="shield-alt" size={16} color="#0B6E6B" />
          <Text style={styles.infoText}>
            Cards are processed securely via your selected gateway. We do not
            store full card details on device.
          </Text>
        </View>

        <Modal visible={addVisible} transparent animationType="slide">
          <View style={styles.modalContainer}>
            <Pressable
              style={styles.modalOverlay}
              onPress={() => {
                setAddVisible(false);
                setNewLabel("");
                setNewBrand("");
                setNewLast4("");
                setNewExp("");
              }}
            />
            <View style={styles.modalContent}>
              <Text
                style={{ fontWeight: "700", fontSize: 16, marginBottom: 12 }}
              >
                Add payment method
              </Text>
              <Field
                label="Label"
                value={newLabel}
                onChangeText={setNewLabel}
                placeholder="e.g., Business card"
                styles={styles}
                colors={colors}
              />
              <Field
                label="Brand"
                value={newBrand}
                onChangeText={setNewBrand}
                placeholder="Visa / Mastercard"
                styles={styles}
                colors={colors}
              />
              <Field
                label="Last 4 digits"
                value={newLast4}
                onChangeText={setNewLast4}
                placeholder="1234"
                styles={styles}
                colors={colors}
              />
              <Field
                label="Expiry"
                value={newExp}
                onChangeText={setNewExp}
                placeholder="09/28"
                styles={styles}
                colors={colors}
              />
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <TouchableOpacity
                  style={[styles.addButton, { flex: 1 }]}
                  onPress={handleAddMethod}
                >
                  <Text style={styles.addButtonText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.addButton,
                    { flex: 1, backgroundColor: "#e5e7eb" },
                  ]}
                  onPress={() => {
                    setAddVisible(false);
                    setNewLabel("");
                    setNewBrand("");
                    setNewLast4("");
                    setNewExp("");
                  }}
                >
                  <Text style={[styles.addButtonText, { color: "#1E293B" }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={editVisible} transparent animationType="slide">
          <View style={styles.modalContainer}>
            <Pressable
              style={styles.modalOverlay}
              onPress={() => {
                setEditVisible(false);
                setEditingId(null);
                setNewLabel("");
                setNewBrand("");
                setNewLast4("");
                setNewExp("");
              }}
            />
            <View style={styles.modalContent}>
              <Text
                style={{ fontWeight: "700", fontSize: 16, marginBottom: 12 }}
              >
                Edit payment method
              </Text>
              <Field
                label="Label"
                value={newLabel}
                onChangeText={setNewLabel}
                placeholder="e.g., Business card"
                styles={styles}
                colors={colors}
              />
              <Field
                label="Brand"
                value={newBrand}
                onChangeText={setNewBrand}
                placeholder="Visa / Mastercard"
                styles={styles}
                colors={colors}
              />
              <Field
                label="Last 4 digits"
                value={newLast4}
                onChangeText={setNewLast4}
                placeholder="1234"
                styles={styles}
                colors={colors}
              />
              <Field
                label="Expiry"
                value={newExp}
                onChangeText={setNewExp}
                placeholder="09/28"
                styles={styles}
                colors={colors}
              />
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <TouchableOpacity
                  style={[styles.addButton, { flex: 1 }]}
                  onPress={handleSaveEdit}
                >
                  <Text style={styles.addButtonText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.addButton,
                    { flex: 1, backgroundColor: "#e5e7eb" },
                  ]}
                  onPress={() => {
                    setEditVisible(false);
                    setEditingId(null);
                    setNewLabel("");
                    setNewBrand("");
                    setNewLast4("");
                    setNewExp("");
                  }}
                >
                  <Text style={[styles.addButtonText, { color: "#1E293B" }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChangeText, placeholder, styles, colors }: any) {
  return (
    <View style={{ width: "100%", marginBottom: 10 }}>
      <Text style={{ fontWeight: "600", marginBottom: 4, color: colors.text }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        style={styles.input}
      />
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    backBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.surface,
      justifyContent: "center",
      alignItems: "center",
    },
    headerTitle: {
      flex: 1,
      textAlign: "center",
      fontSize: 18,
      fontWeight: "700",
      color: colors.primary,
    },
    content: {
      padding: 16,
      gap: 12,
    },
    subtitle: {
      fontSize: 13,
      color: colors.muted,
    },
    cardRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    cardRowActive: {
      borderColor: colors.primary,
      shadowColor: colors.primary,
      shadowOpacity: 0.08,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 8,
    },
    cardIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.background,
      justifyContent: "center",
      alignItems: "center",
    },
    cardLabel: { fontSize: 14, fontWeight: "700", color: colors.text },
    cardMeta: { fontSize: 12, color: colors.muted },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: colors.primary,
      borderRadius: 999,
    },
    chipText: { color: "#fff", fontSize: 12, fontWeight: "600" },
    cardActions: {
      flexDirection: "row",
      gap: 6,
      marginRight: 8,
    },
    iconBtn: {
      width: 30,
      height: 30,
      borderRadius: 8,
      backgroundColor: colors.background,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    iconDanger: {
      backgroundColor: "rgba(239,68,68,0.12)",
      borderColor: colors.danger,
    },
    addButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.primary,
      paddingVertical: 12,
      borderRadius: 10,
      marginTop: 8,
    },
    addButtonText: { color: "#fff", fontWeight: "700" },
    infoBox: {
      flexDirection: "row",
      gap: 10,
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    infoText: { flex: 1, fontSize: 12, color: colors.muted },
    emptyBox: {
      marginTop: 20,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 20,
      alignItems: "center",
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
    emptyText: { fontSize: 13, color: colors.muted, textAlign: "center" },
    modalContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.overlay,
      padding: 20,
    },
    modalOverlay: {
      ...StyleSheet.absoluteFillObject,
    },
    modalContent: {
      width: "100%",
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: colors.surface,
      color: colors.text,
    },
    swipeDelete: {
      backgroundColor: colors.danger,
      justifyContent: "center",
      alignItems: "center",
      width: 96,
      borderRadius: 12,
      marginBottom: 12,
    },
    swipeDeleteText: {
      color: "#fff",
      fontSize: 12,
      fontWeight: "700",
      marginTop: 4,
    },
  });
