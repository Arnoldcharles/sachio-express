import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TextInput } from 'react-native';
import { getProducts, Product } from '../lib/products';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const BUY_TAGS = ['buy toilet', 'buy', 'purchase', 'sale'];

function productMatchesCategory(product: Product, tags: string[]) {
  const names: string[] = [];
  if (product.category) names.push(product.category);
  if (Array.isArray(product.categories)) names.push(...product.categories);
  const normalized = names
    .map((name) => (name || '').trim().toLowerCase())
    .filter(Boolean);
  return normalized.some((name) => tags.some((tag) => name === tag || name.includes(tag)));
}

export default function Buy() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function fetchProducts() {
      setLoading(true);
      const items = await getProducts();
      setProducts(items.filter((p) => productMatchesCategory(p, BUY_TAGS)));
      setLoading(false);
    }
    fetchProducts();
  }, []);

  const filteredProducts = useMemo(
    () => products.filter((p) => (p.title || '').toLowerCase().includes(search.toLowerCase())),
    [products, search],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
      <Text style={styles.title}>Buy Toilet</Text>
      <View style={styles.searchBarContainer}>
        <Text style={styles.searchLabel}>Search:</Text>
        <View style={styles.searchInputWrapper}>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search products..."
          />
        </View>
      </View>
      {loading ? (
        <ActivityIndicator size="large" color="#0B6E6B" />
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={item => item.id || Math.random().toString()}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => {
              router.push(`/product?id=${item.id}` as any);
            }}>
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.image} />
              ) : (
                <View style={styles.imagePlaceholder}><FontAwesome5 name="toilet" size={40} color="#0B6E6B" /></View>
              )}
              <Text style={styles.name}>{item.title}</Text>
              <Text style={styles.price}>₦{item.price}</Text>
            </TouchableOpacity>
          )}
        />
      )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  searchBarContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  searchLabel: { fontSize: 16, marginRight: 8, color: '#0B6E6B' },
  searchInputWrapper: { flex: 1 },
  searchInput: { backgroundColor: '#f0f0f0', borderRadius: 8, padding: 8, fontSize: 16 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 16, color: '#0B6E6B' },
  card: { backgroundColor: '#f9f9f9', borderRadius: 8, padding: 12, marginBottom: 12 },
  image: { width: '100%', height: 120, borderRadius: 8 },
  imagePlaceholder: { width: '100%', height: 120, backgroundColor: '#e0e0e0', borderRadius: 8 },
  name: { fontSize: 16, fontWeight: '600', marginTop: 8 },
  price: { fontSize: 14, color: '#0B6E6B', marginTop: 4 },
});
