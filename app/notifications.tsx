import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { auth, db } from '../lib/firebase';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';

type OrderNote = {
  id: string;
  productTitle?: string;
  status?: string;
  createdAt?: { seconds: number; nanoseconds: number };
};

export default function NotificationsPage() {
  const router = useRouter();
  const [notes, setNotes] = useState<OrderNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!auth || typeof auth.onAuthStateChanged !== 'function') return;
    const unsubAuth = auth.onAuthStateChanged((user) => setCurrentUser(user));
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      setNotes([]);
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
        const list: OrderNote[] = [];
        snap.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...(docSnap.data() as any) });
        });
        // Show most recent 50 without deleting orders
        setNotes(list.slice(0, 50));
        setLoading(false);
      },
      () => {
        setLoading(false);
      },
    );
    return () => unsub();
  }, [currentUser]);

  const renderItem = ({ item }: { item: OrderNote }) => {
    const dateText = item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000).toLocaleDateString() : '';
    return (
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={styles.iconWrap}>
            <FontAwesome5 name="bell" size={14} color="#0B6E6B" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{item.productTitle || 'Order update'}</Text>
            <Text style={styles.meta}>{item.status ? `Status: ${item.status}` : 'Status updated'}</Text>
            {dateText ? <Text style={styles.date}>{dateText}</Text> : null}
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/orders')}
            style={{ padding: 6, marginRight: 6 }}
          >
            <FontAwesome5 name="chevron-right" size={14} color="#0B6E6B" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setPendingDelete(item.id)} style={{ padding: 6 }}>
            <FontAwesome5 name="trash" size={14} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 6, marginRight: 8 }}>
          <FontAwesome5 name="arrow-left" size={18} color="#0B6E6B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 20 }} />
      </View>
      <View style={styles.container}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#0B6E6B" />
          </View>
        ) : !auth.currentUser ? (
          <View style={styles.center}>
            <FontAwesome5 name="lock" size={32} color="#94a3b8" />
            <Text style={styles.empty}>Login to see your notifications.</Text>
            <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/auth/login')}>
              <Text style={styles.loginBtnText}>Go to Login</Text>
            </TouchableOpacity>
          </View>
        ) : notes.length === 0 ? (
          <View style={styles.center}>
            <FontAwesome5 name="bell-slash" size={32} color="#94a3b8" />
            <Text style={styles.empty}>No updates yet.</Text>
          </View>
        ) : (
          <FlatList
            data={notes}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ padding: 16 }}
          />
        )}
      </View>

      <Modal
        visible={!!pendingDelete}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingDelete(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete notification</Text>
            <Text style={styles.modalText}>
              This only hides the notification here. Your order stays intact.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.outlineBtn} onPress={() => setPendingDelete(null)}>
                <Text style={styles.outlineBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.loginBtn, { marginTop: 0 }]}
                onPress={async () => {
                  if (!pendingDelete) return;
                  // Hide locally without deleting the underlying order
                  setNotes((prev) => prev.filter((n) => n.id !== pendingDelete));
                  setPendingDelete(null);
                }}
              >
                <Text style={styles.loginBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAFBFB' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0B6E6B' },
  container: { flex: 1, backgroundColor: '#FAFBFB' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  empty: { color: '#475569', fontWeight: '600' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 10,
    shadowColor: '#0B6E6B',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 1,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E6F4F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  meta: { fontSize: 12, color: '#475569', marginTop: 2 },
  date: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  loginBtn: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#0B6E6B',
    borderRadius: 10,
  },
  loginBtnText: { color: '#fff', fontWeight: '700' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0B6E6B',
    marginBottom: 6,
  },
  modalText: {
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 14,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  outlineBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  outlineBtnText: {
    color: '#0B6E6B',
    fontWeight: '700',
  },
});
