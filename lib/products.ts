import { db, storage } from './firebase';
import { collection, addDoc, getDocs, query, orderBy, where, doc as firestoreDoc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

export async function uploadImage(uri: string, path = `products/${Date.now()}`) {
  try {
    // fetch the file from the local uri
    const response = await fetch(uri);
    const blob = await response.blob();
    const ref = storageRef(storage, path);
    const metadata = { contentType: (blob as any).type || 'image/jpeg' };
    await uploadBytes(ref, blob as any, metadata);
    const url = await getDownloadURL(ref);
    return url;
  } catch (e) {
    const err: any = e;
    console.warn('uploadImage error', err.code || err.message || err);
    throw e;
  }
}

export type Product = {
  id?: string;
  title: string;
  price: number | string;
  description?: string;
  imageUrl?: string;
  images?: string[];
  category?: string;
  categories?: string[];
  inStock?: boolean;
  createdAt?: string;
};

export type Category = {
  id: string;
  name: string;
};

export async function createProduct(product: Product) {
  try {
    const col = collection(db, 'products');
    const docRef = await addDoc(col, {
      ...product,
      images: product.images || (product.imageUrl ? [product.imageUrl] : []),
      categories: product.categories || (product.category ? [product.category] : []),
      inStock: product.inStock ?? true,
      createdAt: new Date().toISOString(),
    });
    // read back the stored doc to return full data
    const stored = await getDoc(firestoreDoc(db, 'products', docRef.id));
    const data = stored.exists() ? (stored.data() as any) : { ...(product as any) };
    return { id: docRef.id, ...data } as Product & { id: string };
  } catch (e) {
    console.warn('createProduct error', e);
    throw e;
  }
}

export async function getProducts() {
  try {
    const col = collection(db, 'products');
    const q = query(col, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const items: Product[] = [];
    snap.forEach(s => {
      items.push({ id: s.id, ...(s.data() as any) });
    });
    return items;
  } catch (e) {
    console.warn('getProducts error', e);
    throw e;
  }
}

export async function getProductsByCategory(category: string) {
  try {
    const col = collection(db, 'products');
    const q = query(col, where('category', '==', category), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const items: Product[] = [];
    snap.forEach(s => {
      items.push({ id: s.id, ...(s.data() as any) });
    });
    return items;
  } catch (e) {
    console.warn('getProductsByCategory error', e);
    throw e;
  }
}

export async function getCategories(): Promise<Category[]> {
  try {
    const col = collection(db, 'categories');
    const q = query(col, orderBy('name'));
    const snap = await getDocs(q);
    const cats: Category[] = [];
    snap.forEach((s) => {
      const data = s.data() as any;
      if (data?.name) cats.push({ id: s.id, name: data.name });
    });
    return cats;
  } catch (e) {
    console.warn('getCategories error', e);
    throw e;
  }
}

export async function createCategory(name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Category name required');
  const col = collection(db, 'categories');
  const docRef = await addDoc(col, { name: trimmed, createdAt: new Date().toISOString() });
  return { id: docRef.id, name: trimmed } as Category;
}

export async function updateCategory(id: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Category name required');
  await updateDoc(firestoreDoc(db, 'categories', id), { name: trimmed });
  return { id, name: trimmed } as Category;
}

export async function deleteCategory(id: string) {
  await deleteDoc(firestoreDoc(db, 'categories', id));
}
