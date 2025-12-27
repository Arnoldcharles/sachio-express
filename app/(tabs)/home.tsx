import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text as RNText,
  StyleSheet,
  TextInput,
  Pressable,
  TouchableOpacity,
  Image,
  FlatList,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  Animated,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import {
  getProducts,
  getCategories,
  Product,
  Category,
} from "../../lib/products";
import { auth, db } from "../../lib/firebase";
import { useTheme } from "../../lib/theme";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} style={[{ fontFamily: "Nunito" }, props.style]} />
);

const CART_KEY = "cart_items";
const PAYMENT_FAILED_KEY = "payment_failed";
const ANNOUNCEMENT_DISMISS_KEY = "announcement_dismissed";
type Announcement = {
  id: string;
  title: string;
  message: string;
  createdAt?: Date | null;
  audience?: "all" | "user";
  targetUserId?: string | null;
};

const RENT_STATES = [
  "Abia",
  "Adamawa",
  "Akwa Ibom",
  "Anambra",
  "Bauchi",
  "Bayelsa",
  "Benue",
  "Borno",
  "Cross River",
  "Delta",
  "Ebonyi",
  "Edo",
  "Ekiti",
  "Enugu",
  "Gombe",
  "Imo",
  "Jigawa",
  "Kaduna",
  "Kano",
  "Katsina",
  "Kebbi",
  "Kogi",
  "Kwara",
  "Lagos",
  "Nasarawa",
  "Niger",
  "Ogun",
  "Ondo",
  "Osun",
  "Oyo",
  "Plateau",
  "Rivers",
  "Sokoto",
  "Taraba",
  "Yobe",
  "Zamfara",
  "FCT",
];
const RENT_EVENT_TYPES = [
  "Wedding",
  "Anniversary",
  "Birthday",
  "Cocktail Party",
  "Holiday Party",
  "Sporting Event",
  "Religious Event",
  "Corporate Event",
  "Trade Show",
  "Grand Opening",
  "House Warming",
  "Product Launch",
  "Media Event",
  "Awards Event",
  "Fundraiser",
  "Retirement",
  "Long Term Rental",
  "Burial Ceremony",
];
const RENT_GUEST_COUNTS = [
  "0 - 100",
  "100 - 250",
  "250 - 500",
  "500 - 1000",
  "1000+",
];
const RENT_PRODUCT_TYPES = ["VIP Restrooms", "Porta Potties"];
const RENTAL_TYPES = ["Construction", "Events", "Other"];
const RENT_REFERRALS = [
  "Google Search",
  "Social Media",
  "Referral",
  "Website",
  "Other",
];

const addDays = (dateStr: string, days: number) => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + Math.max(0, days - 1));
  return d.toISOString().slice(0, 10);
};

const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const safeDate = (value: string) => {
  const d = value ? new Date(value) : new Date();
  return isNaN(d.getTime()) ? new Date() : d;
};

export default function HomeScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const [products, setProducts] = useState<Product[]>([]);
  const [filtered, setFiltered] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [showPaymentFailed, setShowPaymentFailed] = useState(false);
  const [paymentFailedMessage, setPaymentFailedMessage] = useState(
    "Your payment was not completed. Please try again."
  );
  const [rentName, setRentName] = useState("");
  const [rentEmail, setRentEmail] = useState("");
  const [rentPhone, setRentPhone] = useState("");
  const [rentToilets, setRentToilets] = useState("");
  const [rentDuration, setRentDuration] = useState("");
  const [rentEventDate, setRentEventDate] = useState("");
  const [showRentDatePicker, setShowRentDatePicker] = useState(false);
  const [rentState, setRentState] = useState("");
  const [rentAddress, setRentAddress] = useState("");
  const [rentEventType, setRentEventType] = useState("");
  const [rentGuestCount, setRentGuestCount] = useState("");
  const [rentProductType, setRentProductType] = useState<string[]>([]);
  const [rentRentalType, setRentRentalType] = useState("");
  const [rentComments, setRentComments] = useState("");
  const [rentReferral, setRentReferral] = useState("");
  const [rentPicker, setRentPicker] = useState<{
    type:
      | "state"
      | "event"
      | "guest"
      | "product"
      | "rental"
      | "referral"
      | null;
  }>({ type: null });
  const rentish = (val?: string | null) =>
    !!val && val.toLowerCase().includes("rent");
  const headerAnim = useRef(new Animated.Value(0)).current;
  const searchAnim = useRef(new Animated.Value(0)).current;
  const categoriesAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    Animated.stagger(120, [
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }),
      Animated.timing(searchAnim, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }),
      Animated.timing(categoriesAnim, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }),
      Animated.timing(contentAnim, {
        toValue: 1,
        duration: 520,
        useNativeDriver: true,
      }),
    ]).start();
  }, [categoriesAnim, contentAnim, headerAnim, searchAnim]);

  useEffect(() => {
    applyFilter(selectedCategory, search);
  }, [products, selectedCategory, search]);

  const featured = useMemo(() => {
    if (selectedCategory === "All" && !search.trim()) return filtered;
    return filtered.slice(0, 6);
  }, [filtered, selectedCategory, search]);

  const showRentForm = rentish(selectedCategory);

  const canSubmitRent = useMemo(() => {
    return (
      !!rentName &&
      !!rentEmail &&
      !!rentPhone &&
      !!rentToilets &&
      !!rentDuration &&
      !!rentEventDate &&
      !!rentState &&
      !!rentAddress &&
      !!rentEventType &&
      !!rentGuestCount &&
      rentProductType.length > 0 &&
      !!rentRentalType
    );
  }, [
    rentName,
    rentEmail,
    rentPhone,
    rentToilets,
    rentDuration,
    rentEventDate,
    rentState,
    rentAddress,
    rentEventType,
    rentGuestCount,
    rentProductType,
    rentRentalType,
  ]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [items, cats] = await Promise.all([getProducts(), getCategories()]);
      setProducts(items);
      setCategories(cats);
    } catch (e) {
      // keep silent fail with empty state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    AsyncStorage.getItem("userToken")
      .then((uid) => setUserId(uid))
      .catch(() => setUserId(null));
  }, []);

  useEffect(() => {
    if (!auth || typeof auth.onAuthStateChanged !== "function") return;
    const unsubAuth = auth.onAuthStateChanged((user) => {
      if (user?.uid) {
        setUserId(user.uid);
      }
    });
    return () => unsubAuth();
  }, [userId]);

  const loadCartCount = useCallback(async () => {
    const raw = await AsyncStorage.getItem(CART_KEY);
    const parsed = raw ? (JSON.parse(raw) as any[]) : [];
    const count = parsed.reduce((sum, item) => sum + (item.qty || 1), 0);
    setCartCount(count);
  }, []);

  const saveCartItems = async (items: any[]) => {
    await AsyncStorage.setItem(CART_KEY, JSON.stringify(items));
    const count = items.reduce((sum, item) => sum + (item.qty || 1), 0);
    setCartCount(count);
  };

  useFocusEffect(
    useCallback(() => {
      loadCartCount();
      const intervalId = setInterval(() => {
        loadCartCount();
      }, 1000);
      return () => clearInterval(intervalId);
    }, [loadCartCount])
  );

  
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const checkPaymentFailed = async () => {
        try {
          const flag = await AsyncStorage.getItem(PAYMENT_FAILED_KEY);
          if (flag && active) {
            let message =
              "Your payment was not completed. Please try again.";
            try {
              const parsed = JSON.parse(flag);
              if (parsed?.message) message = parsed.message;
            } catch (parseError) {
              // keep default message
            }
            setPaymentFailedMessage(message);
            setShowPaymentFailed(true);
            await AsyncStorage.removeItem(PAYMENT_FAILED_KEY);
          }
        } catch (e) {
          // ignore storage errors
        }
      };
      checkPaymentFailed();
      return () => {
        active = false;
      };
    }, [])
  );

  useEffect(() => {
    if (!showPaymentFailed) return;
    const timerId = setTimeout(() => {
      setShowPaymentFailed(false);
    }, 4000);
    return () => clearTimeout(timerId);
  }, [showPaymentFailed]);

  useEffect(() => {
    if (userId === undefined) return;
    const fetchAnnouncement = async () => {
      try {
        const snap = await getDocs(
          query(
            collection(db, "announcements"),
            orderBy("createdAt", "desc"),
            limit(20)
          )
        );
        const dismissedId = await AsyncStorage.getItem(
          ANNOUNCEMENT_DISMISS_KEY
        );
        const candidates: Announcement[] = snap.docs.map((d: any) => {
          const data = d.data() as any;
          return {
            id: d.id,
            title: data.title ?? "Announcement",
            message: data.message ?? "",
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
            audience: data.audience ?? "all",
            targetUserId: data.targetUserId ?? null,
          };
        });
        const match = candidates.find(
          (c) =>
            c.audience === "all" ||
            (c.audience === "user" &&
              c.targetUserId &&
              c.targetUserId === userId)
        );
        if (match) {
          setAnnouncement(match);
          setShowAnnouncement(dismissedId !== match.id);
        } else {
          setAnnouncement(null);
          setShowAnnouncement(false);
        }
      } catch (e) {
        // ignore announcement fetch errors to avoid blocking the UI
      }
    };
    fetchAnnouncement();
  }, [userId]);

  const applyFilter = (category: string, query: string) => {
    const sortByDateDesc = (a: Product, b: Product) => {
      const parseDate = (val: any) => {
        if (val?.toDate) return val.toDate();
        if (val instanceof Date) return val;
        const parsed = val ? new Date(val) : null;
        return parsed instanceof Date && !isNaN(parsed.getTime())
          ? parsed
          : null;
      };
      const da = parseDate((a as any)?.createdAt) ?? new Date(0);
      const db = parseDate((b as any)?.createdAt) ?? new Date(0);
      return db.getTime() - da.getTime();
    };

    let list = [...products].sort(sortByDateDesc);
    const q = query.trim().toLowerCase();
    if (category !== "All") {
      list = list.filter(
        (p) =>
          (p.categories || []).includes(category) ||
          (p.category || "").toLowerCase() === category.toLowerCase()
      );
    }
    if (q) {
      list = list.filter(
        (p) =>
          (p.title || "").toLowerCase().includes(q) ||
          (p.description || "").toLowerCase().includes(q)
      );
    }
    setFiltered(list);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const submitRentForm = async () => {
    if (!canSubmitRent) {
      Alert.alert("Missing info", "Please fill all required fields.");
      return;
    }
    try {
      const endDate = addDays(
        rentEventDate,
        parseInt(rentDuration || "1", 10) || 1
      );
      const uid = userId || (await AsyncStorage.getItem("userToken"));
      if (!uid) {
        Alert.alert("Login required", "Please sign in to place a rental.");
        return;
      }
      const orderData = {
        productId: null,
        productTitle: "Rental Request",
        type: "rent",
        status: "waiting_admin_price",
        amount: null,
        userId: uid,
        customerName: rentName,
        customerEmail: rentEmail,
        customerPhone: rentPhone,
        customerAddress: rentAddress,
        phone: rentPhone,
        duration: rentDuration,
        rentalStartDate: rentEventDate,
        rentalEndDate: endDate,
        state: rentState,
        location: rentAddress,
        weddingType: rentEventType,
        guestCount: rentGuestCount,
        productType: rentProductType,
        rentalType: rentRentalType,
        toiletsRequired: rentToilets,
        referral: rentReferral,
        note: rentComments,
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, "orders"), orderData);
      setRentName("");
      setRentEmail("");
      setRentPhone("");
      setRentToilets("");
      setRentDuration("");
      setRentEventDate("");
      setRentState("");
      setRentAddress("");
      setRentEventType("");
      setRentGuestCount("");
      setRentProductType([]);
      setRentRentalType("");
      setRentComments("");
      setRentReferral("");
      setRentPicker({ type: null });
      setShowRentDatePicker(false);
      setSelectedCategory("All");
      Alert.alert("Submitted", "Your rental request has been received.", [
        {
          text: "View orders",
          onPress: () => router.push("/(tabs)/orders"),
        },
        {
          text: "Close",
          style: "cancel",
        },
      ]);
    } catch (e) {
      Alert.alert("Error", "Could not submit request. Please try again.");
    }
  };

  const renderRentPicker = (
    type: "state" | "event" | "guest" | "product" | "rental" | "referral",
    data: string[],
    setter: (value: string) => void
  ) => (
    <Modal
      visible={rentPicker.type === type}
      transparent
      animationType="fade"
      onRequestClose={() => setRentPicker({ type: null })}
    >
      <Pressable
        style={styles.pickerBackdrop}
        onPress={() => setRentPicker({ type: null })}
      >
        <Pressable style={styles.pickerCard} onPress={() => {}}>
          <ScrollView showsVerticalScrollIndicator>
            {data.map((item) => {
              const isSelected =
                type === "product" && rentProductType.includes(item);
              return (
                <TouchableOpacity
                  key={item}
                  style={[
                    styles.pickerOption,
                    isSelected && styles.pickerOptionSelected,
                  ]}
                  onPress={() => {
                    if (type === "product") {
                      setRentProductType((prev) =>
                        prev.includes(item)
                          ? prev.filter((val) => val !== item)
                          : [...prev, item]
                      );
                      return;
                    }
                    setter(item);
                    setRentPicker({ type: null });
                  }}
                >
                  <Text style={styles.pickerOptionText}>{item}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {type === "product" ? (
            <TouchableOpacity
              style={styles.pickerDoneBtn}
              onPress={() => setRentPicker({ type: null })}
            >
              <Text style={styles.pickerDoneText}>Done</Text>
            </TouchableOpacity>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );

  const renderCard = ({ item }: { item: Product }) => {
    const image = (item.images && item.images[0]) || item.imageUrl;
    const outOfStock = item.inStock === false;
    const hidePrice =
      rentish(selectedCategory) ||
      rentish(item.category) ||
      (item.categories || []).some(rentish);
    const created =
      (item as any)?.createdAt?.toDate?.() ??
      ((item as any)?.createdAt instanceof Date
        ? (item as any)?.createdAt
        : new Date((item as any)?.createdAt));
    const isNew =
      created instanceof Date &&
      !isNaN(created.getTime()) &&
      Date.now() - created.getTime() <= 5 * 24 * 60 * 60 * 1000;
    return (
      <TouchableOpacity
        style={styles.gridCard}
        activeOpacity={0.92}
        onPress={() => router.push(`/product?id=${item.id}`)}
      >
        <View style={styles.gridImageWrap}>
          {image ? (
            <Image
              source={{ uri: image }}
              style={styles.gridImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.gridImage, styles.gridImageFallback]}>
              <FontAwesome5 name="toilet" size={26} color="#0B6E6B" />
            </View>
          )}
          <View style={styles.badgeRow}>
            {isNew ? (
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>NEW</Text>
              </View>
            ) : (
              <View style={{ width: 42 }} />
            )}
            <View style={styles.ratingPill}>
              <FontAwesome5 name="star" size={10} color="#F6B22F" />
              <Text style={styles.ratingText}>4.8</Text>
            </View>
          </View>
          <View style={styles.iconPills}>
            {outOfStock ? (
              <View
                style={[
                  styles.gridCart,
                  { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
                ]}
              >
                <FontAwesome5 name="ban" size={12} color="#B91C1C" />
              </View>
            ) : (
              <TouchableOpacity
                style={styles.gridCart}
                onPress={async () => {
                  try {
                    const raw = await AsyncStorage.getItem(CART_KEY);
                    const parsed = raw ? (JSON.parse(raw) as any[]) : [];
                    const idx = parsed.findIndex((p) => p.id === item.id);
                    if (idx >= 0) {
                      parsed[idx].qty = (parsed[idx].qty || 1) + 1;
                    } else {
                      parsed.push({
                        id: item.id,
                        title: item.title,
                        price: item.price,
                        imageUrl: image || "",
                        qty: 1,
                      });
                    }
                    await saveCartItems(parsed);
                    Alert.alert(
                      "Added to cart",
                      `${item.title} was added to your cart.`
                    );
                  } catch (e) {
                    Alert.alert(
                      "Cart error",
                      "Could not add to cart. Please try again."
                    );
                  }
                }}
              >
                <FontAwesome5 name="plus" size={12} color="#0B6E6B" />
              </TouchableOpacity>
            )}
          </View>
        </View>
        <Text style={styles.gridTitle} numberOfLines={2}>
          {item.title}
        </Text>
        {!hidePrice ? (
          <Text style={styles.gridPrice}>NGN {item.price || "-"} </Text>
        ) : null}
        {outOfStock ? (
          <Text style={styles.stockBadge}>Out of stock</Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#0B6E6B"]}
          />
        }
      >
        <Animated.View
          style={[
            styles.headerBar,
            {
              opacity: headerAnim,
              transform: [
                {
                  translateY: headerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [14, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View>
            <Text style={styles.headerTitle}>
              Premium quality mobile toilets for your events
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => router.push("/notifications")}
            >
              <FontAwesome5 name="bell" size={14} color="#0B6E6B" />
            </TouchableOpacity>
            <View style={styles.cartIconWrap}>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => router.push("/cart")}
              >
                <FontAwesome5 name="shopping-cart" size={14} color="#0B6E6B" />
              </TouchableOpacity>
              {
              cartCount > 0 ? (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cartCount}</Text>
                </View>
              ) : null
            }
            </View>
            <TouchableOpacity
              style={styles.avatarBtn}
              onPress={() => router.push("/(tabs)/profile")}
            >
              <FontAwesome5 name="user" size={14} color="#0B6E6B" />
            </TouchableOpacity>
          </View>
        </Animated.View>
        <Animated.View
          style={[
            styles.searchBar,
            {
              opacity: searchAnim,
              transform: [
                {
                  translateY: searchAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [12, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <FontAwesome5 name="search" size={14} color="#94a3b8" />
          <TextInput
            placeholder="Search for products..."
            placeholderTextColor="#94a3b8"
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
          />
        </Animated.View>

        <Animated.View
          style={[
            {
              opacity: categoriesAnim,
              transform: [
                {
                  translateY: categoriesAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.sectionTitle}>Categories</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            <CategoryChip
              label="All"
              active={selectedCategory === "All"}
              onPress={() => setSelectedCategory("All")}
            />
            {categories.map((cat) => (
              <CategoryChip
                key={cat.id}
                label={cat.name}
                active={selectedCategory === cat.name}
                onPress={() => setSelectedCategory(cat.name)}
              />
            ))}
          </ScrollView>
        </Animated.View>

        {!loading && showRentForm ? (
          <Animated.View
          style={[
            styles.rentForm,
            {
              opacity: contentAnim,
              transform: [
                {
                  translateY: contentAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [14, 0],
                  }),
                },
              ],
            },
          ]}
        >
            <Text style={styles.rentTitle}>Rental Request</Text>
            <Text style={styles.rentSubtitle}>
              Fill out the form and we will get back to you.
            </Text>

            <View style={styles.formField}>
              <TextInput
                placeholder="Your Name"
                placeholderTextColor="#94a3b8"
                value={rentName}
                onChangeText={setRentName}
                style={styles.formInput}
              />
            </View>
            <View style={styles.formField}>
              <TextInput
                placeholder="Your Email Address"
                placeholderTextColor="#94a3b8"
                value={rentEmail}
                onChangeText={setRentEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.formInput}
              />
            </View>
            <View style={styles.formField}>
              <TextInput
                placeholder="Your Phone Number"
                placeholderTextColor="#94a3b8"
                value={rentPhone}
                onChangeText={setRentPhone}
                keyboardType="phone-pad"
                style={styles.formInput}
              />
            </View>
            <View style={styles.formField}>
              <TextInput
                placeholder="Number of Toilets Required"
                placeholderTextColor="#94a3b8"
                value={rentToilets}
                onChangeText={setRentToilets}
                keyboardType="numeric"
                style={styles.formInput}
              />
            </View>
            <View style={styles.formField}>
              <TextInput
                placeholder="Event Duration (In Days)"
                placeholderTextColor="#94a3b8"
                value={rentDuration}
                onChangeText={setRentDuration}
                keyboardType="numeric"
                style={styles.formInput}
              />
            </View>
            <TouchableOpacity
              style={styles.formField}
              onPress={() => setShowRentDatePicker(true)}
              activeOpacity={0.85}
            >
              <View pointerEvents="none">
                <TextInput
                  placeholder="Event Date"
                  placeholderTextColor="#94a3b8"
                  value={rentEventDate}
                  editable={false}
                  style={styles.formInput}
                />
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.formField}
              onPress={() => setRentPicker({ type: "state" })}
            >
              <View pointerEvents="none">
                <TextInput
                  placeholder="Event Location (State)"
                  placeholderTextColor="#94a3b8"
                  value={rentState}
                  editable={false}
                  style={styles.formInput}
                />
              </View>
            </TouchableOpacity>
            <View style={styles.formField}>
              <TextInput
                placeholder="Event Location (Full Address)"
                placeholderTextColor="#94a3b8"
                value={rentAddress}
                onChangeText={setRentAddress}
                style={styles.formInput}
              />
            </View>
            <TouchableOpacity
              style={styles.formField}
              onPress={() => setRentPicker({ type: "event" })}
            >
              <View pointerEvents="none">
                <TextInput
                  placeholder="Type of Event"
                  placeholderTextColor="#94a3b8"
                  value={rentEventType}
                  editable={false}
                  style={styles.formInput}
                />
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.formField}
              onPress={() => setRentPicker({ type: "guest" })}
            >
              <View pointerEvents="none">
                <TextInput
                  placeholder="Approximate Number of Guests"
                  placeholderTextColor="#94a3b8"
                  value={rentGuestCount}
                  editable={false}
                  style={styles.formInput}
                />
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.formField}
              onPress={() => setRentPicker({ type: "product" })}
            >
              <View pointerEvents="none">
                <TextInput
                  placeholder="Product Type"
                  placeholderTextColor="#94a3b8"
                  value={rentProductType.join(", ")}
                  editable={false}
                  style={styles.formInput}
                />
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.formField}
              onPress={() => setRentPicker({ type: "rental" })}
            >
              <View pointerEvents="none">
                <TextInput
                  placeholder="Rental Type"
                  placeholderTextColor="#94a3b8"
                  value={rentRentalType}
                  editable={false}
                  style={styles.formInput}
                />
              </View>
            </TouchableOpacity>
            <View style={styles.formField}>
              <TextInput
                placeholder="Additional Request and Comments (Optional)"
                placeholderTextColor="#94a3b8"
                value={rentComments}
                onChangeText={setRentComments}
                style={[styles.formInput, { height: 90 }]}
                multiline
              />
            </View>
            <TouchableOpacity
              style={styles.formField}
              onPress={() => setRentPicker({ type: "referral" })}
            >
              <View pointerEvents="none">
                <TextInput
                  placeholder="How did you hear about us? (Optional)"
                  placeholderTextColor="#94a3b8"
                  value={rentReferral}
                  editable={false}
                  style={styles.formInput}
                />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitBtn, !canSubmitRent && { opacity: 0.6 }]}
              onPress={submitRentForm}
              disabled={!canSubmitRent}
            >
              <Text style={styles.submitText}>Submit Request</Text>
            </TouchableOpacity>
          </Animated.View>
        ) : null}

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#0B6E6B" size="large" />
            <Text style={styles.loadingText}>Loading toilets…</Text>
          </View>
        ) : showRentForm ? null : (
          <Animated.View
            style={[
              {
                opacity: contentAnim,
                transform: [
                  {
                    translateY: contentAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [14, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <FlatList
              data={featured}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderCard}
              numColumns={2}
              columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
              contentContainerStyle={{
                gap: 12,
                paddingVertical: 12,
                paddingBottom: 32,
              }}
              scrollEnabled={false}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>No products found</Text>
                  <Text style={styles.emptyBody}>
                    Try adjusting your filters or search.
                  </Text>
                </View>
              }
            />
          </Animated.View>
        )}
      </ScrollView>

      {renderRentPicker("state", RENT_STATES, setRentState)}
      {renderRentPicker("event", RENT_EVENT_TYPES, setRentEventType)}
      {renderRentPicker("guest", RENT_GUEST_COUNTS, setRentGuestCount)}
      {renderRentPicker("product", RENT_PRODUCT_TYPES, () => {})}
      {renderRentPicker("rental", RENTAL_TYPES, setRentRentalType)}
      {renderRentPicker("referral", RENT_REFERRALS, setRentReferral)}
      {showRentDatePicker && (
        <DateTimePicker
          value={safeDate(rentEventDate)}
          mode="date"
          display="spinner"
          onChange={(_, date) => {
            setShowRentDatePicker(false);
            if (date) setRentEventDate(formatDate(date));
          }}
        />
      )}

      {showPaymentFailed ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setShowPaymentFailed(false)}
        >
          <Pressable
            style={styles.paymentBackdrop}
            onPress={() => setShowPaymentFailed(false)}
          >
            <Pressable style={styles.paymentCard} onPress={() => {}}>
              <Text style={styles.paymentTitle}>Payment failed</Text>
              <Text style={styles.paymentBody}>{paymentFailedMessage}</Text>
              <TouchableOpacity
                style={styles.paymentBtn}
                onPress={() => setShowPaymentFailed(false)}
              >
                <Text style={styles.paymentBtnText}>OK</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
      {showAnnouncement && announcement ? (
        <View style={styles.announcementOverlay}>
          <View style={styles.announcementCard}>
            <View style={styles.announcementHeader}>
              <View>
                <Text style={styles.announcementLabel}>Announcement</Text>
                <Text style={styles.announcementTitle}>
                  {announcement.title}
                </Text>
                {announcement.createdAt ? (
                  <Text style={styles.announcementTime}>
                    {announcement.createdAt.toLocaleString()}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity
                onPress={() => setShowAnnouncement(false)}
                style={styles.closeBtn}
                accessibilityRole="button"
              >
                <Text style={styles.closeBtnText}>x</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.announcementMessage}>
              {announcement.message}
            </Text>
            <TouchableOpacity
              style={styles.announcementAction}
              onPress={async () => {
                if (announcement?.id) {
                  await AsyncStorage.setItem(
                    ANNOUNCEMENT_DISMISS_KEY,
                    announcement.id
                  );
                }
                setShowAnnouncement(false);
              }}
              accessibilityRole="button"
            >
              <Text style={styles.announcementActionText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function CategoryChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.catChip, active && styles.catChipActive]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <Text style={[styles.catChipText, active && { color: "#fff" }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FAFBFB" },
  container: { flex: 1, backgroundColor: "#FAFBFB" },
  headerBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    lineHeight: 24,
    maxWidth: "78%",
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#E6F4F3",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D1E7E5",
  },
  avatarBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cartIconWrap: {
    position: "relative",
  },
  cartBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#EF4444",
    borderRadius: 999,
    paddingHorizontal: 5,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  cartBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  searchBar: {
    marginHorizontal: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0B6E6B",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  searchInput: { flex: 1, color: "#0F172A", fontSize: 14, paddingVertical: 0 },
  sectionTitle: {
    marginTop: 18,
    marginHorizontal: 16,
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  chipRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#F3F7F7",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  catChipActive: {
    backgroundColor: "#0B6E6B",
    borderColor: "#0B6E6B",
  },
  catChipText: { color: "#0B6E6B", fontWeight: "700", fontSize: 13 },
  gridCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#0B6E6B",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  gridImageWrap: { position: "relative" },
  gridImage: {
    width: "100%",
    height: 140,
    borderRadius: 14,
    backgroundColor: "#f0f8f8",
  },
  gridImageFallback: {
    justifyContent: "center",
    alignItems: "center",
  },
  badgeRow: {
    position: "absolute",
    top: 8,
    left: 8,
    right: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  newBadge: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  newBadgeText: { color: "#fff", fontWeight: "800", fontSize: 10 },
  ratingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#fff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  ratingText: { fontSize: 11, fontWeight: "700", color: "#0B6E6B" },
  iconPills: {
    position: "absolute",
    bottom: 8,
    right: 8,
    flexDirection: "row",
    gap: 6,
  },
  gridTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 8,
  },
  gridPrice: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0B6E6B",
    marginTop: 2,
  },
  gridCart: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E6F4F3",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D1E7E5",
  },
  stockBadge: {
    marginTop: 6,
    color: "#B91C1C",
    fontSize: 12,
    fontWeight: "700",
  },
  loadingBox: {
    padding: 32,
    alignItems: "center",
    gap: 8,
  },
  loadingText: { color: "#475569", fontWeight: "600" },
  emptyState: { alignItems: "center", paddingVertical: 20, gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: "#0B6E6B" },
  emptyBody: { fontSize: 13, color: "#475569" },
  rentForm: { marginTop: 12, marginHorizontal: 16, gap: 10 },
  rentTitle: { fontSize: 18, fontWeight: "800", color: "#0F172A" },
  rentSubtitle: { color: "#475569" },
  formField: {},
  formInput: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: "#0F172A",
    backgroundColor: "#fff",
  },
  submitBtn: {
    backgroundColor: "#0B6E6B",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 6,
  },
  submitText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.4)",
    justifyContent: "center",
    padding: 16,
  },
  pickerCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    maxHeight: "70%",
  },
  pickerOption: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  pickerOptionText: { color: "#0F172A", fontWeight: "600" },
  pickerOptionSelected: {
    backgroundColor: "#E6F4F3",
  },
  pickerDoneBtn: {
    marginTop: 10,
    backgroundColor: "#0B6E6B",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  pickerDoneText: { color: "#fff", fontWeight: "700" },
  announcementOverlay: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(15,23,42,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  announcementCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  announcementHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  announcementLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#0B6E6B",
    textTransform: "uppercase",
  },
  announcementTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 2,
  },
  announcementTime: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 2,
  },
  announcementMessage: {
    marginTop: 12,
    fontSize: 14,
    color: "#0F172A",
    lineHeight: 20,
  },
  announcementAction: {
    marginTop: 16,
    alignSelf: "flex-end",
    backgroundColor: "#0B6E6B",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  announcementActionText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  closeBtnText: { fontSize: 14, fontWeight: "800", color: "#475569" },
  paymentBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  paymentCard: {
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
  paymentTitle: { fontSize: 18, fontWeight: "800", color: "#0F172A" },
  paymentBody: {
    marginTop: 8,
    fontSize: 14,
    color: "#475569",
    lineHeight: 20,
  },
  paymentBtn: {
    marginTop: 16,
    backgroundColor: "#EF4444",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  paymentBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },});















