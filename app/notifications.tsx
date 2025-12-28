import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../lib/theme';
import { FontAwesome5 } from '@expo/vector-icons';
import { auth, db } from '../lib/firebase';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';

type OrderNote = {
  id: string;
  productTitle?: string;
  status?: string;
  createdAt?: { seconds: number; nanoseconds: number };
  items?: { imageUrl?: string; title?: string }[];
};

type Section = { title: string; data: OrderNote[] };

const statusColors: Record<string, { color: string; darkColor: string }> = {
  cancelled_by_admin: { color: '#B91C1C', darkColor: '#F87171' },
  cancelled: { color: '#B91C1C', darkColor: '#F87171' },
  failed: { color: '#B91C1C', darkColor: '#F87171' },
  delivered: { color: '#16A34A', darkColor: '#22C55E' },
  completed: { color: '#16A34A', darkColor: '#22C55E' },
  paid: { color: '#16A34A', darkColor: '#22C55E' },
  success: { color: '#16A34A', darkColor: '#22C55E' },
  processing: { color: '#0F172A', darkColor: '#E5E7EB' },
  dispatched: { color: '#0F172A', darkColor: '#E5E7EB' },
  in_transit: { color: '#0F172A', darkColor: '#E5E7EB' },
  returning: { color: '#0F172A', darkColor: '#E5E7EB' },
};

function formatHeader(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: 'long', day: '2-digit', month: 'long' });
}

function timeAgo(date?: Date) {
  if (!date) return '';
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min${mins > 1 ? 's' : ''} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

export default function NotificationsPage() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [notes, setNotes] = useState<OrderNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);

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
        snap.forEach((docSnap: any) => {
          list.push({ id: docSnap.id, ...(docSnap.data() as any) });
        });
        setNotes(list.slice(0, 50));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, [currentUser]);

  const sections: Section[] = useMemo(() => {
    const groups: Record<string, OrderNote[]> = {};
    notes.forEach((n) => {
      const date = n.createdAt?.seconds ? new Date(n.createdAt.seconds * 1000) : new Date();
      const key = formatHeader(date);
      if (!groups[key]) groups[key] = [];
      groups[key].push(n);
    });
    return Object.keys(groups).map((k) => ({ title: k, data: groups[k] }));
  }, [notes]);

  const renderItem = ({ item }: { item: OrderNote }) => {
    const dateObj = item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000) : undefined;
    const ago = timeAgo(dateObj);
    const statusKey = (item.status || '').toLowerCase();
    const statusStyle = statusColors[statusKey] || { color: '#0F172A', darkColor: '#E5E7EB' };
    const statusColor = isDark ? statusStyle.darkColor : statusStyle.color;
    const thumb = item.items && item.items[0]?.imageUrl;
    const title = item.productTitle || item.items?.[0]?.title || 'Order update';

    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.thumbWrap}>
            {thumb ? (
              <Image source={{ uri: thumb }} style={styles.thumb} resizeMode="cover" />
            ) : (
            <FontAwesome5 name="box" size={18} color={colors.muted} />
            )}
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            {item.status ? <Text style={[styles.status, { color: statusColor }]}>{item.status.replace(/_/g, ' ')}</Text> : null}
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.meta}>2 items</Text>
            <Text style={styles.time}>{ago}</Text>
          </View>
          <TouchableOpacity style={styles.detailBtn} onPress={() => router.push('/(tabs)/orders')}>
            <Text style={styles.detailText}>View Details</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 6, marginRight: 8 }}>
          <FontAwesome5 name="arrow-left" size={18} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 20 }} />
      </View>
      <View style={styles.container}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : !auth.currentUser ? (
          <View style={styles.center}>
            <FontAwesome5 name="lock" size={32} color={colors.muted} />
            <Text style={styles.empty}>Login to see your notifications.</Text>
            <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/auth/login')}>
              <Text style={styles.loginBtnText}>Go to Login</Text>
            </TouchableOpacity>
          </View>
        ) : notes.length === 0 ? (
          <View style={styles.center}>
            <FontAwesome5 name="bell-slash" size={32} color={colors.muted} />
            <Text style={styles.empty}>No updates yet.</Text>
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            renderSectionHeader={({ section }) => (
              <Text style={styles.sectionHeader}>{section.title}</Text>
            )}
            contentContainerStyle={{ padding: 16, gap: 8 }}
            stickySectionHeadersEnabled={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    headerTitle: { fontSize: 18, fontWeight: '700', color: colors.primary },
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
    empty: { color: colors.muted, fontWeight: '600' },
    sectionHeader: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.muted,
      marginTop: 6,
      marginBottom: 4,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 8,
      shadowColor: colors.primary,
      shadowOpacity: 0.03,
      shadowOffset: { width: 0, height: 3 },
      shadowRadius: 6,
      elevation: 1,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    thumbWrap: {
      width: 52,
      height: 52,
      borderRadius: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    thumb: { width: '100%', height: '100%' },
    status: { fontSize: 13, fontWeight: '800', textTransform: 'capitalize' },
    title: { fontSize: 14, fontWeight: '700', color: colors.text },
    meta: { fontSize: 12, color: colors.muted },
    time: { fontSize: 11, color: colors.muted },
    detailBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    detailText: { fontSize: 12, fontWeight: '700', color: colors.primary },
    loginBtn: {
      marginTop: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: colors.primary,
      borderRadius: 10,
    },
    loginBtnText: { color: '#fff', fontWeight: '700' },
    modalBackdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      padding: 16,
    },
    modalCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.primary,
      marginBottom: 6,
    },
    modalText: {
      fontSize: 14,
      color: colors.text,
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
      borderColor: colors.border,
    },
    outlineBtnText: {
      color: colors.primary,
      fontWeight: '700',
    },
  });
