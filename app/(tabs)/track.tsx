import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { auth, db } from '../../lib/firebase';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useRef } from 'react';

type OrderDoc = {
  id: string;
  productTitle?: string;
  status?: string;
  paymentMethod?: string;
  rentalStartDate?: string | null;
  rentalEndDate?: string | null;
  createdAt?: { seconds: number; nanoseconds: number };
};

const statusMap: Record<string, { label: string; color: string; icon: any }> = {
  processing: { label: 'Processing', color: '#666', icon: 'spinner' },
  dispatched: { label: 'Dispatched', color: '#F6B22F', icon: 'truck' },
  in_transit: { label: 'In Transit', color: '#0B6E6B', icon: 'road' },
  returning: { label: 'Returning', color: '#0B6E6B', icon: 'undo' },
  delivered: { label: 'Delivered', color: '#16A34A', icon: 'check-circle' },
  completed: { label: 'Completed', color: '#16A34A', icon: 'check-circle' },
};

function Header({ title, onPressNotifications, badgeCount }: any) {
  return (
    <View style={styles.header}>
      <TouchableOpacity>
        <FontAwesome5 name="bars" size={20} color="#0B6E6B" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      <TouchableOpacity style={{ position: 'relative' }} onPress={onPressNotifications}>
        <FontAwesome5 name="bell" size={18} color="#0B6E6B" />
        {badgeCount > 0 ? (
          <View style={styles.badgeDot}>
            <Text style={styles.badgeDotText}>{badgeCount}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    </View>
  );
}

export default function TrackTab() {
  const router = useRouter();
  const [activeOrders, setActiveOrders] = useState<OrderDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [notifCount, setNotifCount] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const prevStatuses = useRef<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!auth || typeof auth.onAuthStateChanged !== 'function') return;
    const unsubAuth = auth.onAuthStateChanged((u) => setCurrentUser(u));
    return () => {
      if (typeof unsubAuth === 'function') unsubAuth();
    };
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setActiveOrders([]);
      setLoading(false);
      setNotifCount(0);
      return;
    }
    const q = query(
      collection(db, 'orders'),
      where('userId', '==', currentUser.uid),
      orderBy('createdAt', 'desc'),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: OrderDoc[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          const status = (data.status || '').toLowerCase();
          const done = status.includes('delivered') || status.includes('completed') || status.includes('cancel');
          if (!done) list.push({ id: d.id, ...data });
        });
        // detect status changes for toast
        list.forEach((o) => {
          const prev = prevStatuses.current[o.id];
          if (prev && o.status && prev !== o.status) {
            setToast(`${o.productTitle || 'Order'} is now ${o.status}`);
            setTimeout(() => setToast(null), 2500);
          }
        });
        const next: Record<string, string> = {};
        list.forEach((o) => {
          if (o.status) next[o.id] = o.status;
        });
        prevStatuses.current = next;
        setNotifCount(list.length);
        setActiveOrders(list.slice(0, 5));
        setLastUpdated(new Date().toLocaleTimeString());
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, [currentUser]);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  };

  const renderTimeline = (order: OrderDoc) => {
    const stages = [
      { key: 'processing', label: 'Processing', icon: 'check-circle' },
      { key: 'dispatched', label: 'Dispatched', icon: 'truck' },
      { key: 'in_transit', label: 'In Transit', icon: 'road' },
      { key: 'delivered', label: 'Delivered', icon: 'box' },
    ];
    const current = (order.status || '').toLowerCase();
    const activeIndex = stages.findIndex(s => current.includes(s.key));
    return (
      <View style={styles.timelineContainer}>
        <Text style={styles.timelineTitle}>Progress</Text>
        <View style={styles.timeline}>
          {stages.map((stage, idx) => {
            const completed = activeIndex >= idx;
            return (
              <View key={stage.key} style={styles.timelineItem}>
                <View style={[styles.timelineIcon, completed && styles.timelineIconCompleted]}>
                  <FontAwesome5 name={stage.icon as any} size={14} color={completed ? '#fff' : '#ddd'} />
                </View>
                <Text style={[styles.timelineStage, completed && styles.timelineStageCompleted]}>{stage.label}</Text>
                {idx < stages.length - 1 && (
                  <View style={[styles.timelineConnector, completed && styles.timelineConnectorCompleted]} />
                )}
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderTrackingCard = ({ item }: { item: OrderDoc }) => {
    const sKey = (item.status || 'processing').toLowerCase();
    const statusInfo = statusMap[sKey] || statusMap.processing;
    const dateText = item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000).toLocaleDateString() : '';
    return (
      <TouchableOpacity style={styles.trackCard} onPress={() => router.push(`/(tabs)/orders/${item.id}` as any)}>
        <View style={styles.trackHeader}>
          <View>
            <Text style={styles.trackOrderNum}>Order #{String(item.id).slice(0, 6)}</Text>
            <Text style={styles.trackProduct}>{item.productTitle || 'Order'}</Text>
            {dateText ? <Text style={styles.orderDate}>{dateText}</Text> : null}
          </View>
          <View style={[styles.statusIndicator, { backgroundColor: statusInfo.color }]}>
            <FontAwesome5 name={statusInfo.icon as any} size={16} color="#fff" />
          </View>
        </View>

        <View style={styles.trackDetails}>
          <View style={styles.detailRow}>
            <FontAwesome5 name="clock" size={14} color="#666" />
            <Text style={styles.detailText}>{statusInfo.label}</Text>
          </View>
          <View style={styles.detailRow}>
            <FontAwesome5 name="wallet" size={14} color="#666" />
            <Text style={styles.detailText}>{item.paymentMethod || 'Payment'}</Text>
          </View>
        </View>

        {item.rentalStartDate || item.rentalEndDate ? (
          <Text style={styles.rentalText}>
            Rental: {item.rentalStartDate || '—'} to {item.rentalEndDate || '—'}
          </Text>
        ) : null}

        <TouchableOpacity style={styles.statusBar} onPress={() => router.push('/(tabs)/orders')}>
          <Text style={[styles.statusLabel, { color: statusInfo.color }]}>{statusInfo.label}</Text>
          <FontAwesome5 name="chevron-right" size={16} color="#999" />
        </TouchableOpacity>
        {renderTimeline(item)}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#0B6E6B']} />}
      >
        <Header title="Track Delivery" onPressNotifications={() => router.push('/notifications')} badgeCount={notifCount} />
        {toast ? (
          <View style={styles.toast}>
            <FontAwesome5 name="bell" size={12} color="#0B6E6B" />
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        ) : null}
        {lastUpdated ? (
          <Text style={styles.lastUpdated}>Last updated: {lastUpdated}</Text>
        ) : null}
        {loading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator color="#0B6E6B" />
            <Text style={styles.emptySubtext}>Loading your active orders...</Text>
          </View>
        ) : activeOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <FontAwesome5 name="map-marker-alt" size={48} color="#ddd" />
            <Text style={styles.emptyText}>No Active Deliveries</Text>
            <Text style={styles.emptySubtext}>Your deliveries will appear here once dispatched</Text>
          </View>
        ) : (
          <FlatList
            data={activeOrders}
            renderItem={renderTrackingCard}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAFBFB' },
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 14, borderBottomColor: '#e0e0e0', borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0B6E6B' },
  badgeDot: { position: 'absolute', top: -8, right: -8, backgroundColor: '#EF4444', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  badgeDotText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  trackCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e0e0e0', shadowColor: '#0B6E6B', shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
  trackHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  trackOrderNum: { fontSize: 15, fontWeight: 'bold', color: '#0B6E6B' },
  trackProduct: { fontSize: 13, color: '#666' },
  statusIndicator: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  trackDetails: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginRight: 16, gap: 6 },
  detailText: { fontSize: 13, color: '#333' },
  rentalText: { fontSize: 12, color: '#475569', marginTop: 8 },
  statusBar: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  statusLabel: { fontSize: 13, fontWeight: 'bold', marginRight: 8 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 64, gap: 6 },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: '#999', marginTop: 4 },
  emptySubtext: { fontSize: 14, color: '#999', marginTop: 2 },
  timelineContainer: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginTop: 10, borderWidth: 1, borderColor: '#e0e0e0' },
  timelineTitle: { fontSize: 14, fontWeight: 'bold', color: '#1E293B', marginBottom: 12 },
  timeline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timelineItem: { alignItems: 'center', flex: 1 },
  timelineIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#ddd', justifyContent: 'center', alignItems: 'center' },
  timelineIconCompleted: { backgroundColor: '#0B6E6B' },
  timelineStage: { fontSize: 12, color: '#666', marginTop: 4 },
  timelineStageCompleted: { color: '#0B6E6B', fontWeight: 'bold' },
  timelineConnector: { width: 32, height: 2, backgroundColor: '#ddd', alignSelf: 'center' },
  timelineConnectorCompleted: { backgroundColor: '#0B6E6B' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E6F4F3',
    borderColor: '#0B6E6B',
    borderWidth: 1,
    padding: 10,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 8,
  },
  toastText: { color: '#0B6E6B', fontWeight: '700', fontSize: 12, flex: 1 },
  lastUpdated: { fontSize: 11, color: '#64748b', marginHorizontal: 16, marginTop: 6 },
});
