import React, { useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '../../lib/theme';

export default function FavoritesScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const favorites: any[] = [];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
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

const createStyles = (colors: any) =>
  StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: colors.primary },
  content: {
    padding: 16,
    gap: 12,
    flexGrow: 1,
  },
  emptyBox: {
    marginTop: 40,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  emptyText: { fontSize: 13, color: colors.muted, textAlign: 'center' },
  cta: {
    marginTop: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  ctaText: { color: '#fff', fontWeight: '700' },
  favCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  favIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  favTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  favMeta: { fontSize: 12, color: colors.muted },
});
