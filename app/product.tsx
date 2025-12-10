import React, { useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Animated,
  Easing,
  View,
  Text,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Share,
  Modal,
  TouchableWithoutFeedback,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getProducts, Product } from "../lib/products";
import { FontAwesome5 } from "@expo/vector-icons";
import { FontAwesome } from "@expo/vector-icons";

export default function ProductPage() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [favorite, setFavorite] = useState(false);
  const [recommended, setRecommended] = useState<Product[]>([]);
  const [cardAnim] = useState(new Animated.Value(0));
  const outOfStock = product?.inStock === false;
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const gallery = useMemo(() => {
    const urls: string[] = [];
    if (product?.images && Array.isArray(product.images)) {
      product.images.forEach((u) => {
        const s = (u || "").trim();
        if (s) urls.push(s);
      });
    }
    if ((!urls.length) && product?.imageUrl) {
      const s = (product.imageUrl || "").trim();
      if (s) urls.push(s);
    }
    return Array.from(new Set(urls));
  }, [product]);

  useEffect(() => {
    async function fetchProduct() {
      setLoading(true);
      const products = await getProducts();
      const found = products.find((p) => p.id === id);
      setProduct(found || null);
      setLoading(false);
    }
    fetchProduct();
    Animated.timing(cardAnim, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.exp),
      useNativeDriver: true,
    }).start();
    // Load favorite state from AsyncStorage
    AsyncStorage.getItem(`fav_${id}`).then((val) => {
      setFavorite(val === "true");
    });
  }, [id]);

  useEffect(() => {
    if (!product) return;
    getProducts().then((all) => {
      if (product.category) {
        setRecommended(
          all
            .filter((p) => p.category === product.category && p.id !== id)
            .slice(0, 10)
        );
      } else {
        setRecommended(all.filter((p) => p.id !== id).slice(0, 10));
      }
    });
  }, [product, id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.imageSkeleton} />
          <View style={styles.skeletonLine} />
          <View style={[styles.skeletonLine, { width: 140 }]} />
        </View>
      </SafeAreaView>
    );
  }
  if (!product)
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.container, { justifyContent: "center" }]}>
          <Text style={styles.emptyTitle}>Product not found.</Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.replace("/(tabs)/home")}
          >
            <Text style={styles.primaryBtnText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Breadcrumbs and Back Button */}
        <View style={styles.breadcrumbsRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <FontAwesome5 name="arrow-left" size={18} color="#0B6E6B" />
          </TouchableOpacity>
          <Text style={styles.breadcrumbs}>
            Home {">"} Products {">"} {product?.title || "Product"}
          </Text>
        </View>
        <Animated.View
          style={[
            styles.card,
            {
              opacity: cardAnim,
              transform: [
                {
                  scale: cardAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.95, 1],
                  }),
                },
              ],
            },
          ]}
        >
          {/* Featured Badge */}
          <View style={styles.badgeRow}>
            <View style={styles.featuredBadge}>
              <Text style={styles.badgeText}>Featured</Text>
            </View>
            <TouchableOpacity
              onPress={async () => {
                const newFav = !favorite;
                setFavorite(newFav);
                await AsyncStorage.setItem(
                  `fav_${id}`,
                  newFav ? "true" : "false"
                );
              }}
              style={styles.favoriteBtn}
            >
              <FontAwesome
                name={favorite ? "heart" : "heart-o"}
                size={22}
                color={favorite ? "#EF4444" : "#0B6E6B"}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.metaPills}>
            {product.category ? (
              <View style={styles.chip}>
                <FontAwesome5 name="tags" size={12} color="#0B6E6B" />
                <Text style={styles.chipText}>{product.category}</Text>
              </View>
            ) : null}
            <View style={styles.chip}>
              <FontAwesome5 name="check-circle" size={12} color="#0B6E6B" />
              <Text style={styles.chipText}>{outOfStock ? 'Out of stock' : 'In stock'}</Text>
            </View>
            <View style={styles.chip}>
              <FontAwesome5 name="shield-alt" size={12} color="#0B6E6B" />
              <Text style={styles.chipText}>Clean & serviced</Text>
            </View>
          </View>
          {outOfStock ? (
            <View style={styles.alertBox}>
              <FontAwesome5 name="exclamation-circle" size={14} color="#EF4444" />
              <Text style={styles.alertText}>This item is currently out of stock and cannot be purchased.</Text>
            </View>
          ) : null}
          {/* Image Gallery (slider) */}
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ alignItems: "center" }}
            style={{ marginBottom: 16 }}
          >
            {gallery.length > 0 ? (
              gallery.map((img, idx) => (
                <TouchableOpacity
                  key={idx}
                  activeOpacity={0.85}
                  onPress={() => {
                    setLightboxIndex(idx);
                    setLightboxVisible(true);
                  }}
                >
                  <Image source={{ uri: img }} style={styles.imageCard} resizeMode="cover" />
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.imageFallback}>
                <FontAwesome5 name="toilet" size={56} color="#0B6E6B" />
              </View>
            )}
          </ScrollView>
          <Text style={styles.title}>{product.title}</Text>
          <View style={styles.priceCard}>
            <View>
              <Text style={styles.priceLabel}>Price</Text>
              <Text style={styles.price}>
                {product.price ? `NGN ${product.price}` : "Contact us"}
              </Text>
            </View>
            <View style={styles.priceActions}>
              <View style={styles.miniPill}>
                <FontAwesome5 name="truck" size={12} color="#0B6E6B" />
                <Text style={styles.miniPillText}>Fast delivery</Text>
              </View>
              <View style={styles.miniPill}>
                <FontAwesome5 name="star" size={12} color="#0B6E6B" />
                <Text style={styles.miniPillText}>VIP clean</Text>
              </View>
            </View>
          </View>
          {/* Ratings */}
          <View style={styles.ratingsRow}>
            {[...Array(5)].map((_, i) => (
              <FontAwesome5
                key={i}
                name="star"
                size={16}
                color={i < 4 ? "#FFD700" : "#e0e0e0"}
                style={{ marginRight: 2 }}
              />
            ))}
            <Text style={styles.ratingsText}>(23 reviews)</Text>
          </View>
          {/* Divider */}
          <View style={styles.divider} />
          {/* Category & Metadata */}
          <View style={styles.metaRow}>
            {product.category && (
              <View style={styles.metaItem}>
                <FontAwesome5
                  name="tags"
                  size={16}
                  color="#0B6E6B"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.metaText}>{product.category}</Text>
              </View>
            )}
            <View style={styles.metaItem}>
              <FontAwesome5
                name="id-badge"
                size={16}
                color="#0B6E6B"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.metaText}>ID: {product.id}</Text>
            </View>
          </View>
          <Text style={styles.desc}>{product.description}</Text>
          {/* Highlights */}
          <View style={styles.highlights}>
            <Text style={styles.highlightsTitle}>Why choose this toilet</Text>
            <View style={styles.highlightItem}>
              <FontAwesome5 name="spray-can" size={14} color="#0B6E6B" />
              <Text style={styles.highlightText}>
                Deep cleaned and odor-free
              </Text>
            </View>
            <View style={styles.highlightItem}>
              <FontAwesome5 name="clock" size={14} color="#0B6E6B" />
              <Text style={styles.highlightText}>On-time delivery guarantee</Text>
            </View>
            <View style={styles.highlightItem}>
              <FontAwesome5 name="shield-alt" size={14} color="#0B6E6B" />
              <Text style={styles.highlightText}>Service support available</Text>
            </View>
          </View>
          {/* Divider */}
          <View style={styles.divider} />
          {/* Actions - vertical arrangement */}
          <View style={styles.actionsVertical}>
            <TouchableOpacity
              style={[styles.button, outOfStock && styles.buttonDisabled]}
              disabled={outOfStock}
              onPress={() => {
                if (outOfStock) return;
                router.push(`/checkout?id=${product.id}&type=buy`);
              }}
            >
              <FontAwesome5
                name="shopping-cart"
                size={16}
                color="#fff"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.buttonText}>Buy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, outOfStock && styles.buttonDisabled]}
              disabled={outOfStock}
              onPress={() => {
                if (outOfStock) return;
                router.push(`/checkout?id=${product.id}&type=rent`);
              }}
            >
              <FontAwesome5
                name="calendar-alt"
                size={16}
                color="#fff"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.buttonText}>Rent</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.button}
              onPress={() => {
                const shareText = `Check out this product: ${product.title} for NGN ${product.price}`;
                Share.share({
                  title: product.title,
                  message: shareText,
                  url: product.imageUrl || "",
                }).catch(() => {
                  alert("Share not supported on this device");
                });
              }}
            >
              <FontAwesome5
                name="share"
                size={16}
                color="#fff"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.buttonText}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.buttonOutline}
              onPress={() => alert("Contact Seller")}
            >
              <FontAwesome5
                name="envelope"
                size={16}
                color="#0B6E6B"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.buttonOutlineText}>Contact Seller</Text>
            </TouchableOpacity>
          </View>
          {/* Recommended Products Section */}
          <View style={styles.relatedSection}>
            <Text style={styles.relatedTitle}>Recommended</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 6 }}
            >
              {recommended.length === 0 ? (
                <Text style={{ color: "#666", marginLeft: 12 }}>
                  No recommendations yet.
                </Text>
              ) : (
                recommended.map((prod) => (
                  <TouchableOpacity
                    key={prod.id}
                    style={styles.relatedCard}
                    onPress={() => router.push(`/product?id=${prod.id}`)}
                  >
                    {prod.imageUrl ? (
                      <Image
                        source={{ uri: prod.imageUrl }}
                        style={{
                          width: 70,
                          height: 70,
                          borderRadius: 10,
                          marginBottom: 6,
                        }}
                      />
                    ) : (
                      <FontAwesome5
                        name="toilet"
                        size={32}
                        color="#0B6E6B"
                        style={{ marginBottom: 6 }}
                      />
                    )}
                    <Text style={styles.relatedText} numberOfLines={2}>
                      {prod.title}
                    </Text>
                    <Text style={styles.relatedPrice} numberOfLines={1}>
                      {prod.price ? `NGN ${prod.price}` : "View"}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </Animated.View>
        <View style={styles.spacerBottom} />
      </ScrollView>
      <View style={styles.ctaBar}>
        <TouchableOpacity
          style={[styles.ctaButton, outOfStock && styles.buttonDisabled]}
          disabled={outOfStock}
          onPress={() => {
            if (outOfStock) return;
            router.push(`/checkout?id=${product.id}&type=buy`);
          }}
        >
          <FontAwesome5 name="shopping-cart" size={14} color="#fff" />
          <Text style={styles.ctaText}>Buy</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.ctaButton, { backgroundColor: "#0A5C59" }, outOfStock && styles.buttonDisabled]}
          disabled={outOfStock}
          onPress={() => {
            if (outOfStock) return;
            router.push(`/checkout?id=${product.id}&type=rent`);
          }}
        >
          <FontAwesome5 name="calendar-alt" size={14} color="#fff" />
          <Text style={styles.ctaText}>Rent</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={lightboxVisible} transparent animationType="fade" onRequestClose={() => setLightboxVisible(false)}>
        <View style={styles.lightboxBackdrop}>
          <TouchableWithoutFeedback onPress={() => setLightboxVisible(false)}>
            <View style={styles.lightboxCloseArea} />
          </TouchableWithoutFeedback>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: lightboxIndex * 360, y: 0 }}
            style={styles.lightboxScroller}
          >
            {gallery.map((img, idx) => (
              <View key={idx} style={styles.lightboxSlide}>
                <Image source={{ uri: img }} style={styles.lightboxImage} resizeMode="contain" />
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.lightboxClose} onPress={() => setLightboxVisible(false)}>
            <FontAwesome5 name="times" size={16} color="#0B6E6B" />
            <Text style={styles.lightboxCloseText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

  const styles = StyleSheet.create({
  badgeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: 8,
  },
  featuredBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
    backgroundColor: "#0B6E6B",
  },
  badgeText: { color: "#fff", fontWeight: "bold", fontSize: 13 },
  favoriteBtn: {
    padding: 6,
  },
  ratingsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  ratingsText: {
    fontSize: 13,
    color: "#666",
    marginLeft: 8,
  },
  buttonOutline: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#0B6E6B",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  buttonOutlineText: {
    color: "#0B6E6B",
    fontSize: 16,
    fontWeight: "bold",
  },
  relatedSection: {
    marginTop: 24,
    width: "100%",
  },
  relatedTitle: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#0B6E6B",
    marginBottom: 8,
  },
  relatedCard: {
    backgroundColor: "#F3F7F7",
    borderRadius: 10,
    padding: 12,
    marginRight: 12,
    alignItems: "center",
    width: 100,
  },
  relatedText: {
    fontSize: 13,
    color: "#0B6E6B",
    marginTop: 6,
    textAlign: "center",
  },
  relatedPrice: {
    fontSize: 12,
    color: "#475569",
    marginTop: 2,
    textAlign: "center",
  },
  actionsVertical: {
    flexDirection: "column",
    gap: 14,
    marginTop: 8,
    justifyContent: "center",
    alignItems: "stretch",
    width: "100%",
  },
  safeArea: { flex: 1, backgroundColor: "#fff" },
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
    alignItems: "center",
  },
  breadcrumbsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    alignSelf: "stretch",
  },
  backBtn: { marginRight: 10, padding: 6 },
  breadcrumbs: { fontSize: 14, color: "#0B6E6B", fontWeight: "600" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginTop: 8,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    alignItems: "center",
    width: "100%",
  },
  imageCard: {
    width: 320,
    height: 260,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#0B6E6B",
    backgroundColor: "#e0e0e0",
    marginRight: 12,
    shadowColor: "#0B6E6B",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  imageFallback: {
    width: 320,
    height: 260,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#0B6E6B",
    marginBottom: 10,
    backgroundColor: "#e0e0e0",
    justifyContent: "center",
    alignItems: "center",
  },
  divider: {
    height: 1,
    backgroundColor: "#e0e0e0",
    alignSelf: "stretch",
    marginVertical: 16,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    marginBottom: 8,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F7F7",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  metaText: {
    fontSize: 13,
    color: "#0B6E6B",
    fontWeight: "600",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#0B6E6B",
    textAlign: "center",
  },
  price: {
    fontSize: 20,
    color: "#0B6E6B",
    marginBottom: 8,
    textAlign: "center",
  },
  desc: { fontSize: 16, color: "#333", marginBottom: 16, textAlign: "center" },
  ctaBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#fff",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
  },
  ctaButton: {
    flex: 1,
    backgroundColor: "#0B6E6B",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  ctaText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  spacerBottom: {
    height: 80,
  },
  actions: {
    flexDirection: "row",
    gap: 16,
    marginTop: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  button: {
    backgroundColor: "#0B6E6B",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  buttonDisabled: { opacity: 0.5 },
  imageSkeleton: {
    backgroundColor: "#e0e0e0",
    borderRadius: 16,
    marginBottom: 16,
    width: 260,
    height: 260,
  },
  skeletonLine: {
    height: 12,
    backgroundColor: "#e5e7eb",
    borderRadius: 8,
    marginBottom: 8,
    width: 180,
  },
  priceCard: {
    width: "100%",
    backgroundColor: "#F3F7F7",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    marginBottom: 12,
  },
  priceLabel: {
    fontSize: 13,
    color: "#475569",
    marginBottom: 4,
    fontWeight: "600",
  },
  priceActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
    flexWrap: "wrap",
  },
  miniPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  miniPillText: {
    fontSize: 12,
    color: "#0B6E6B",
    fontWeight: "600",
  },
  highlights: {
    alignSelf: "stretch",
    gap: 10,
  },
  alertBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    borderWidth: 1,
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
    alignSelf: "stretch",
  },
  alertText: { color: "#B91C1C", fontWeight: "700", flex: 1, fontSize: 12 },
  highlightsTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0B6E6B",
  },
  highlightItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  highlightText: {
    fontSize: 13,
    color: "#1E293B",
  },
  relatedPrice: {
    fontSize: 12,
    color: "#475569",
    marginTop: 2,
    textAlign: "center",
  },
  metaPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignSelf: "stretch",
    marginBottom: 10,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#E6F4F3",
  },
  chipText: {
    color: "#0B6E6B",
    fontWeight: "600",
    fontSize: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0B6E6B",
    marginVertical: 12,
  },
  primaryBtn: {
    backgroundColor: "#0B6E6B",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "700",
  },
  lightboxBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.82)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  lightboxScroller: { flexGrow: 0 },
  lightboxSlide: { width: 360, height: 360, justifyContent: "center", alignItems: "center" },
  lightboxImage: { width: "100%", height: "100%" },
  lightboxClose: {
    position: "absolute",
    top: 30,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#E6F4F3",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  lightboxCloseText: { color: "#0B6E6B", fontWeight: "700" },
  lightboxCloseArea: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0 },
});
