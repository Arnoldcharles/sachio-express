import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { auth, db } from '../../lib/firebase';
import { collection, orderBy, query, onSnapshot, where, doc, getDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type OrderItem = {
  id: string;
  productTitle?: string;
  status?: string;
  createdAt?: { seconds: number; nanoseconds: number };
  price?: number | string;
  paymentMethod?: string;
  type?: string;
  amount?: number | string;
};

// Inline Header
function Header({ title }: any) {
  return (
    <View style={styles.header}>
      <View style={{ width: 20 }} />
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={{ width: 20 }} />
    </View>
  );
}

export default function OrdersTab() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'active' | 'past' | 'cancelled'>('active');
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Track previous statuses to optionally inform users in-app (no push in Expo Go)
  const lastStatuses = useRef<Record<string, string>>({});
  const cacheKey = (uid: string) => `orders_cache_${uid}`;

  useEffect(() => {
    if (!auth || typeof auth.onAuthStateChanged !== 'function') return;
    const unsubAuth = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });
    return () => unsubAuth();
  }, []);

  // Load cached orders immediately for a smoother returning experience
  useEffect(() => {
    const loadCache = async () => {
      if (!currentUser) {
        setOrders([]);
        return;
      }
      try {
        const cached = await AsyncStorage.getItem(cacheKey(currentUser.uid));
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
  }, [currentUser]);

  useEffect(() => {
    // Live updates from Firestore for order status changes
    if (!currentUser) {
      setLoading(false);
      setOrders([]);
      return;
    }
    const q = query(
      collection(db, 'orders'),
      where('userId', '==', currentUser.uid),
      orderBy('createdAt', 'desc'),
    );
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: OrderItem[] = [];
        snapshot.forEach((doc) => {
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
        AsyncStorage.setItem(cacheKey(currentUser.uid), JSON.stringify(list)).catch(() => {});
        setLoading(false);
        setRefreshing(false);
      },
      () => {
        setLoading(false);
        setRefreshing(false);
      },
    );
    return () => unsub();
  }, [currentUser]);

  const grouped = useMemo(() => {
    return orders.reduce(
      (acc: Record<'active' | 'past' | 'cancelled', OrderItem[]>, order) => {
        const status = (order.status || '').toLowerCase();
        if (status.includes('cancel')) acc.cancelled.push(order);
        else if (status.includes('delivered') || status.includes('completed')) acc.past.push(order);
        else acc.active.push(order);
        return acc;
      },
      { active: [], past: [], cancelled: [] },
    );
  }, [orders]);

  const currentOrders = grouped[activeTab] || [];

  const getStatusColor = (status: string) => {
    const norm = status?.toLowerCase() || '';
    if (norm.includes('dispatch') || norm.includes('processing') || norm.includes('pending')) return '#F6B22F';
    if (norm.includes('paid') || norm.includes('completed') || norm.includes('delivered')) return '#16A34A';
    if (norm.includes('cancel')) return '#EF4444';
    return '#0B6E6B';
  };

  const renderOrderCard = ({ item }: { item: OrderItem }) => {
    const dateText = item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000).toLocaleDateString() : '';
    const toNumber = (val: any) => {
      if (typeof val === 'number') return val;
      if (typeof val === 'string') {
        // Strip currency formatting, commas, and spaces before parsing
        const cleaned = val.replace(/[₦,]/g, '').trim();
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
    const statusNorm = (item.status || '').toLowerCase();
    const waitingPrice = numAmount == null && numPrice == null;
    const handlePress = () => {
      const paid = statusNorm.includes('paid');
      // Paid orders: open in-app detail screen; otherwise go to payment/order flow
      if (paid) {
        router.push(`/(tabs)/orders/${item.id}` as any);
      } else {
        router.push(`/order?id=${item.id}`);
      }
    };
    return (
      <TouchableOpacity style={styles.orderCard} onPress={handlePress}>
        <View style={styles.orderHeader}>
          <View>
            <Text style={styles.orderNumber}>Order #{item.id.slice(0, 6)}</Text>
            <Text style={styles.orderDate}>{dateText}</Text>
            <Text style={styles.orderProduct}>{item.productTitle || '—'}</Text>
            <Text style={styles.metaLine}>
              {item.type === 'rent' ? 'Rent' : 'Buy'} · {item.paymentMethod || 'Payment'}
            </Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(item.status || '') + '20', borderColor: getStatusColor(item.status || '') },
            ]}
          >
            <Text style={[styles.statusText, { color: getStatusColor(item.status || '') }]}>{item.status || '—'}</Text>
          </View>
        </View>
        <View style={styles.orderFooter}>
          <Text style={styles.orderTotal}>{total}</Text>
          <FontAwesome5 name="chevron-right" size={14} color="#0B6E6B" />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Header title="Orders" />

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

        {!currentUser ? (
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
        ) : (
          <View style={styles.emptyState}>
            <FontAwesome5 name="inbox" size={48} color="#ddd" />
            <Text style={styles.emptyText}>No {activeTab} orders</Text>
            <Text style={styles.emptySubtext}>When you place an order, it will appear here</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  container: {
    flex: 1,
    backgroundColor: '#FAFBFB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomColor: '#e0e0e0',
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0B6E6B' },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomColor: '#e0e0e0',
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
    borderBottomColor: '#0B6E6B',
  },
  tabText: {
    fontSize: 14,
    color: '#999',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#0B6E6B',
    fontWeight: 'bold',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#0B6E6B',
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
    color: '#1E293B',
  },
  orderDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  orderProduct: {
    fontSize: 13,
    color: '#0B6E6B',
    marginTop: 4,
    fontWeight: '700',
  },
  metaLine: {
    fontSize: 12,
    color: '#475569',
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
  orderTotal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0B6E6B',
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
    color: '#1E293B',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
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
    backgroundColor: '#0B6E6B',
    borderRadius: 10,
  },
  loginBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
});
