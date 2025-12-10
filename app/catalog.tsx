import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, ActivityIndicator, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getProducts, Product } from '../lib/products';

export default function Catalog() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');

  useEffect(() => {
    async function fetchProducts() {
      setLoading(true);
      const items = await getProducts();
      setProducts(items);
      setLoading(false);
    }
    fetchProducts();
  }, []);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach(p => p.category && cats.add(p.category));
    return ['all', ...Array.from(cats)];
  }, [products]);

  const filteredProducts = products.filter(p => {
    const matchesSearch = (p.title || '').toLowerCase().includes(search.toLowerCase());
    const matchesCat = category === 'all' || p.category === category;
    return matchesSearch && matchesCat;
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>All Products</Text>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search products..."
          placeholderTextColor="#94a3b8"
        />
        <View style={styles.filterRow}>
          {categories.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[styles.filterChip, category === cat && styles.filterChipActive]}
              onPress={() => setCategory(cat)}
            >
              <Text style={[styles.filterChipText, category === cat && styles.filterChipTextActive]}>
                {cat === 'all' ? 'All' : cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#0B6E6B" />
        ) : filteredProducts.length === 0 ? (
          <View style={styles.emptyState}>
            <FontAwesome5 name="box-open" size={40} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>No products found</Text>
          </View>
        ) : (
          <FlatList
            data={filteredProducts}
            keyExtractor={item => item.id || Math.random().toString()}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.card} onPress={() => router.push(`/product?id=${item.id}` as any)}>
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.image} />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <FontAwesome5 name="toilet" size={24} color="#0B6E6B" />
                  </View>
                )}
                <View style={styles.cardBody}>
                  <Text style={styles.name}>{item.title}</Text>
                  {item.category ? <Text style={styles.cardCategory}>{item.category}</Text> : null}
                  <Text style={styles.price}>NGN {item.price}</Text>
                </View>
              </TouchableOpacity>
            )}
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAFBFB' },
  container: { flex: 1, backgroundColor: '#FAFBFB', padding: 16 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 12, color: '#0B6E6B' },
  searchInput: { backgroundColor: '#fff', borderRadius: 10, padding: 12, fontSize: 16, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 12 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  filterChip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  filterChipActive: { backgroundColor: '#0B6E6B', borderColor: '#0B6E6B' },
  filterChipText: { color: '#475569', fontWeight: '600' },
  filterChipTextActive: { color: '#fff' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: '#e0e0e0', flexDirection: 'row', gap: 12 },
  image: { width: 78, height: 78, borderRadius: 10 },
  imagePlaceholder: { width: 78, height: 78, backgroundColor: '#E6F4F3', borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D1E7E5' },
  cardBody: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700', color: '#0B6E6B' },
  cardCategory: { fontSize: 12, color: '#475569', marginTop: 2 },
  price: { fontSize: 14, color: '#0B6E6B', marginTop: 6, fontWeight: '800' },
  emptyState: { alignItems: 'center', padding: 32 },
  emptyTitle: { color: '#475569', fontWeight: '700', marginTop: 8 },
});
