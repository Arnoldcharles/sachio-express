import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';

export default function FavoritesScreen() {
  const router = useRouter();

  const favorites: any[] = [];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFBFB" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome5 name="chevron-left" size={16} color="#0B6E6B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Favorites</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {favorites.length === 0 ? (
          <View style={styles.emptyBox}>
            <FontAwesome5 name="heart" size={24} color="#0B6E6B" />
            <Text style={styles.emptyTitle}>No favorites yet</Text>
            <Text style={styles.emptyText}>Save toilets you love and access them quickly.</Text>
            <TouchableOpacity style={styles.cta} onPress={() => router.push('/catalog' as any)}>
              <Text style={styles.ctaText}>Browse catalog</Text>
            </TouchableOpacity>
          </View>
        ) : (
          favorites.map((fav) => (
            <TouchableOpacity
              key={fav.id}
              style={styles.favCard}
              onPress={() => router.push(`/product?id=${fav.id}` as any)}
            >
              <View style={styles.favIcon}>
                <FontAwesome5 name="toilet" size={16} color="#0B6E6B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.favTitle}>{fav.title}</Text>
                <Text style={styles.favMeta}>{fav.type} • NGN {fav.price}</Text>
              </View>
              <FontAwesome5 name="chevron-right" size={14} color="#999" />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAFBFB' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#FAFBFB',
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E6F4F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: '#0B6E6B' },
  content: {
    padding: 16,
    gap: 12,
    flexGrow: 1,
  },
  emptyBox: {
    marginTop: 40,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  emptyText: { fontSize: 13, color: '#64748B', textAlign: 'center' },
  cta: {
    marginTop: 8,
    backgroundColor: '#0B6E6B',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  ctaText: { color: '#fff', fontWeight: '700' },
  favCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    gap: 12,
  },
  favIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E6F4F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  favTitle: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  favMeta: { fontSize: 12, color: '#64748B' },
});
