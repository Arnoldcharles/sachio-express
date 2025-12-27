import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text as RNText, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, Animated, Easing, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { auth, db } from '../../lib/firebase';
import { collection, orderBy, query, onSnapshot, where, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../lib/theme';

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} style={[{ fontFamily: 'Nunito' }, props.style]} />
);

type OrderItem = {
  id: string;
  productTitle?: string;
  status?: string;
  createdAt?: { seconds: number; nanoseconds: number };
  priceSetAt?: { seconds: number; nanoseconds: number };
  expiresAt?: { seconds: number; nanoseconds: number };
  price?: number | string;
  paymentMethod?: string;
  type?: string;
  amount?: number | string;
};

const REACTIVATION_MS = 24 * 60 * 60 * 1000;

export default function OrdersTab() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [activeTab, setActiveTab] = useState<'active' | 'past' | 'cancelled'>('active');
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [currentUser, setCurrentUser] = useState<FirebaseAuthTypes.User | null>(auth.currentUser);
  const [userId, setUserId] = useState<string | null>(auth.currentUser?.uid ?? null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const headerAnim = useRef(new Animated.Value(0)).current;
  const listAnim = useRef(new Animated.Value(0)).current;
  const timerPulse = useRef(new Animated.Value(0)).current;
  // Track previous statuses to optionally inform users in-app (no push in Expo Go)
  const lastStatuses = useRef<Record<string, string>>({});
  const cacheKey = (uid: string) => `orders_cache_${uid}`;
  const expirySeeded = useRef<Record<string, boolean>>({});

  useEffect(() => {
    if (!auth || typeof auth.onAuthStateChanged !== 'function') return;
    const unsubAuth = auth.onAuthStateChanged((user: FirebaseAuthTypes.User | null) => {
      setCurrentUser(user);
      setUserId(user?.uid ?? null);
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    const curve = Easing.bezier(0.2, 0.8, 0.2, 1);
    Animated.stagger(120, [
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: 420,
        easing: curve,
        useNativeDriver: true,
      }),
      Animated.timing(listAnim, {
        toValue: 1,
        duration: 460,
        easing: curve,
        useNativeDriver: true,
      }),
    ]).start();
  }, [headerAnim, listAnim]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!isDark) {
      timerPulse.setValue(0);
      return;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(timerPulse, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(timerPulse, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [isDark, timerPulse]);

  // Load cached orders immediately for a smoother returning experience
  useEffect(() => {
    const loadCache = async () => {
      if (!userId) {
        setOrders([]);
        return;
      }
      try {
        const cached = await AsyncStorage.getItem(cacheKey(userId));
        if (cached) {
          const parsed: OrderItem[] = JSON.parse(cached);
          setOrders(parsed);
          setLoading(false);
        }
      } catch {
        // ignore cache errors
      }
    };
    loadCache();
  }, [userId]);

  useEffect(() => {
    const loadStoredUser = async () => {
      if (auth.currentUser?.uid) return;
      try {
        const stored = await AsyncStorage.getItem('userToken');
        if (stored) setUserId(stored);
      } catch {
        // ignore storage errors
      }
    };
    loadStoredUser();
  }, []);

  useEffect(() => {
    // Live updates from Firestore for order status changes
    if (!userId) {
      setLoading(false);
      setOrders([]);
      return;
    }
    const q = query(
      collection(db, 'orders'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
    );
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: OrderItem[] = [];
        snapshot.forEach((doc: any) => {
          list.push({ id: doc.id, ...(doc.data() as any) });
        });
        setOrders(list);
        // detect status changes; in Expo Go we skip push but keep last status for future builds
        const next: Record<string, string> = {};
        list.forEach((o) => {
          if (o.status) next[o.id] = o.status;
        });
        lastStatuses.current = next;
        // Persist latest orders for quick access next session
        AsyncStorage.setItem(cacheKey(userId), JSON.stringify(list)).catch(() => {});
        setLoading(false);
        setRefreshing(false);
      },
      () => {
        setLoading(false);
        setRefreshing(false);
      },
    );
    return () => unsub();
  }, [userId]);

  useEffect(() => {
    const seedExpiry = async (order: OrderItem) => {
      try {
        await updateDoc(doc(db, 'orders', order.id), {
          priceSetAt: serverTimestamp(),
          expiresAt: new Date(Date.now() + REACTIVATION_MS),
        });
      } catch {
        // ignore expiry seed errors
      }
    };
    orders.forEach((order) => {
      if (expirySeeded.current[order.id]) return;
      const statusNorm = (order.status || '').toLowerCase();
      const isRent = order.type === 'rent';
      const hasPrice = order.amount != null || order.price != null;
      const isPaid =
        statusNorm.includes('paid') ||
        statusNorm.includes('completed') ||
        statusNorm.includes('delivered');
      if (isRent && hasPrice && !isPaid && !order.expiresAt) {
        expirySeeded.current[order.id] = true;
        seedExpiry(order);
      }
    });
  }, [orders]);

  const getMillis = (timestamp?: { seconds?: number } | Date | null) => {
    if (!timestamp) return null;
    if (timestamp instanceof Date) return timestamp.getTime();
    const maybe: any = timestamp;
    if (typeof maybe?.toDate === 'function') return maybe.toDate().getTime();
    if (typeof maybe?.seconds === 'number') return maybe.seconds * 1000;
    return null;
  };

  const isOrderExpired = (order: OrderItem) => {
    const statusNorm = (order.status || '').toLowerCase();
    const isRent = order.type === 'rent';
    const hasPrice = order.amount != null || order.price != null;
    const isPaid =
      statusNorm.includes('paid') ||
      statusNorm.includes('completed') ||
      statusNorm.includes('delivered');
    if (!isRent || !hasPrice || isPaid) return false;
    const expiresAt =
      getMillis(order.expiresAt) ??
      (getMillis(order.priceSetAt) ? getMillis(order.priceSetAt)! + REACTIVATION_MS : null);
    return expiresAt != null && expiresAt <= now;
  };

  const grouped = useMemo(() => {
    return orders.reduce(
      (acc: Record<'active' | 'past' | 'cancelled', OrderItem[]>, order) => {
        const status = (order.status || '').toLowerCase();
        if (isOrderExpired(order)) acc.cancelled.push(order);
        else if (status.includes('cancel')) acc.cancelled.push(order);
        else if (status.includes('delivered') || status.includes('completed')) acc.past.push(order);
        else acc.active.push(order);
        return acc;
      },
      { active: [], past: [], cancelled: [] },
    );
  }, [orders, now]);

  const currentOrders = grouped[activeTab] || [];

  const getStatusColor = (status: string) => {
    const norm = status?.toLowerCase() || '';
    if (norm.includes('dispatch') || norm.includes('processing') || norm.includes('pending')) return '#F6B22F';
    if (norm.includes('paid') || norm.includes('completed') || norm.includes('delivered')) return '#16A34A';
    if (norm.includes('cancel')) return '#EF4444';
    return '#0B6E6B';
  };

  const formatCountdown = (ms: number) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
  };

  const renderOrderCard = ({ item, index }: { item: OrderItem; index: number }) => {
    const dateText = item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000).toLocaleDateString() : '';
    const toNumber = (val: any) => {
      if (typeof val === 'number') return val;
      if (typeof val === 'string') {
        // Strip currency formatting, commas, and spaces before parsing
        const cleaned = val.replace(/[^0-9.]/g, '');
        const num = parseFloat(cleaned);
        return Number.isNaN(num) ? null : num;
      }
      return null;
    };
    const numAmount = toNumber(item.amount);
    const numPrice = toNumber(item.price);
    const total =
      numAmount != null
        ? `NGN ${numAmount.toLocaleString()}`
        : numPrice != null
        ? `NGN ${numPrice.toLocaleString()}`
        : item.price
        ? `NGN ${item.price}`
        : 'NGN -';
    const statusNorm = (item.status || '-').toLowerCase();
    const waitingPrice = numAmount == null && numPrice == null;
    const isRent = item.type === 'rent';
    const expiresAt =
      getMillis(item.expiresAt) ??
      (getMillis(item.priceSetAt) ? getMillis(item.priceSetAt)! + REACTIVATION_MS : null);
    const remainingMs = expiresAt != null ? expiresAt - now : null;
    const expired = isOrderExpired(item);
    const timerColor = isDark
      ? timerPulse.interpolate({
          inputRange: [0, 1],
          outputRange: [colors.primary, '#5EEAD4'],
        })
      : colors.primary;
    const handlePress = () => {
      const paid = statusNorm.includes('paid');
      // Paid orders: open in-app detail screen; otherwise go to payment/order flow
      if (paid) {
        router.push(`/(tabs)/orders/${item.id}` as any);
      } else {
        router.push(`/order?id=${item.id}`);
      }
    };
    const baseTranslate = 12 + Math.min(index, 6) * 4;
    return (
      <Animated.View
        style={[
          {
            opacity: listAnim.interpolate({
              inputRange: [0, 0.6, 1],
              outputRange: [0, 0.7, 1],
            }),
            transform: [
              {
                translateY: listAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [baseTranslate, 0],
                }),
              },
            ],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.orderCard}
          onPress={expired ? undefined : handlePress}
          activeOpacity={expired ? 1 : 0.9}
        >
          <View style={styles.orderHeader}>
            <View>
              <Text style={styles.orderNumber}>Order #{item.id.slice(0, 6)}</Text>
              <Text style={styles.orderDate}>{dateText}</Text>
              <Text style={styles.orderProduct}>{item.productTitle || '-'}</Text>
              <Text style={styles.metaLine}>
                {item.type === 'rent' ? 'Rent' : 'Buy'} - {item.paymentMethod || 'Payment'}
              </Text>
              {isRent && !waitingPrice && !expired && remainingMs != null ? (
                <Animated.Text style={[styles.timerText, { color: timerColor }]}>
                  Time left: {formatCountdown(remainingMs)}
                </Animated.Text>
              ) : null}
              {expired ? <Text style={styles.expiredText}>Quote expired</Text> : null}
            </View>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: (expired ? colors.danger : getStatusColor(item.status || '-')) + '20',
                  borderColor: expired ? colors.danger : getStatusColor(item.status || '-'),
                },
              ]}
            >
              <Text style={[styles.statusText, { color: expired ? colors.danger : getStatusColor(item.status || '-') }]}>
                {expired ? 'Expired' : item.status || '-'}
              </Text>
            </View>
          </View>
          <View style={styles.orderFooter}>
            <Text style={styles.orderTotal}>{total}</Text>
            {expired ? (
              <TouchableOpacity
                style={styles.reactivateBtn}
                onPress={async () => {
                  try {
                    await updateDoc(doc(db, 'orders', item.id), {
                      expiresAt: new Date(Date.now() + REACTIVATION_MS),
                      reactivatedAt: serverTimestamp(),
                    });
                  } catch {
                    Alert.alert('Reactivate failed', 'Could not reactivate this order. Please try again.');
                  }
                }}
              >
                <Text style={styles.reactivateText}>Reactivate</Text>
              </TouchableOpacity>
            ) : (
              <FontAwesome5 name="chevron-right" size={14} color={colors.primary} />
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <View style={styles.container}>
        <Animated.View
          style={[
            {
              opacity: headerAnim,
              transform: [
                {
                  translateY: headerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [12, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.header}>
            <View style={{ width: 20 }} />
            <Text style={styles.headerTitle}>Orders</Text>
            <View style={{ width: 20 }} />
          </View>
          <View style={styles.tabsContainer}>
            {['active', 'past', 'cancelled'].map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
                onPress={() => setActiveTab(tab as any)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        {!userId ? (
          <View style={styles.emptyState}>
            <FontAwesome5 name="lock" size={48} color="#ddd" />
            <Text style={styles.emptyText}>Login required</Text>
            <Text style={styles.emptySubtext}>Sign in to view your orders.</Text>
            <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/auth/login')}>
              <Text style={styles.loginBtnText}>Go to Login</Text>
            </TouchableOpacity>
          </View>
        ) : loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color="#0B6E6B" />
            <Text style={styles.emptySubtext}>Loading your orders...</Text>
          </View>
        ) : currentOrders.length > 0 ? (
          <Animated.View
            style={[
              {
                opacity: listAnim,
                transform: [
                  {
                    translateY: listAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [16, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <FlatList
              data={currentOrders}
              renderItem={renderOrderCard}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => {
                    // onSnapshot keeps this updated; just show a short spinner
                    setRefreshing(true);
                    setTimeout(() => setRefreshing(false), 400);
                  }}
                />
              }
            />
          </Animated.View>
        ) : (
          <View style={styles.emptyState}>
            <FontAwesome5 name="inbox" size={48} color={colors.muted} />
            <Text style={styles.emptyText}>No {activeTab} orders</Text>
            <Text style={styles.emptySubtext}>When you place an order, it will appear here</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
    },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: colors.primary },
    tabsContainer: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      paddingHorizontal: 16,
    },
    tab: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 3,
      borderBottomColor: 'transparent',
    },
    tabActive: {
      borderBottomColor: colors.primary,
    },
    tabText: {
      fontSize: 14,
      color: colors.muted,
      fontWeight: '500',
    },
    tabTextActive: {
      color: colors.primary,
      fontWeight: 'bold',
    },
    listContent: {
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    orderCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.primary,
      shadowOpacity: 0.04,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 8,
      elevation: 1,
    },
    orderHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    orderNumber: {
      fontSize: 14,
      fontWeight: 'bold',
      color: colors.text,
    },
    orderDate: {
      fontSize: 12,
      color: colors.muted,
      marginTop: 4,
    },
    orderProduct: {
      fontSize: 13,
      color: colors.primary,
      marginTop: 4,
      fontWeight: '700',
    },
    metaLine: {
      fontSize: 12,
      color: colors.muted,
      marginTop: 2,
    },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
      borderWidth: 1,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '600',
    },
    orderFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    timerText: {
      fontSize: 12,
      color: colors.primary,
      marginTop: 6,
      fontWeight: '600',
    },
    expiredText: {
      fontSize: 12,
      color: colors.danger,
      marginTop: 6,
      fontWeight: '700',
    },
    reactivateBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
    reactivateText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '700',
    },
    orderTotal: {
      fontSize: 14,
      fontWeight: 'bold',
      color: colors.primary,
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 16,
    },
    emptyText: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text,
      marginTop: 16,
    },
    emptySubtext: {
      fontSize: 14,
      color: colors.muted,
      marginTop: 8,
      textAlign: 'center',
    },
    loadingState: {
      padding: 32,
      alignItems: 'center',
      gap: 10,
    },
    loginBtn: {
      marginTop: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.primary,
      borderRadius: 10,
    },
    loginBtnText: {
      color: '#fff',
      fontWeight: '700',
    },
  });


