import { db, storage } from './firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
export async function uploadBannerImage(file: any): Promise<string> {
  // file: { uri, name, type }
  try {
    const storageRef = ref(storage, `banners/${Date.now()}_${file.name}`);
    // Expo: fetch local file and convert to blob
    const response = await fetch(file.uri);
    const blob = await response.blob();
    await uploadBytes(storageRef, blob, { contentType: file.type || 'image/jpeg' });
    return await getDownloadURL(storageRef);
  } catch (e) {
    console.warn('Banner upload failed:', e);
    throw e;
  }
}

const BANNERS_DOC = 'appConfig/banners';

export type Banner = { image: string; link?: string };

export async function saveBanners(banners: Banner[]) {
  await setDoc(doc(db, BANNERS_DOC), { banners });
}

export async function getBanners(): Promise<Banner[]> {
  const snap = await getDoc(doc(db, BANNERS_DOC));
  if (snap.exists() && Array.isArray(snap.data().banners)) {
    const arr = snap.data().banners;
    // Support legacy string array
    return arr.map((b: any) => (typeof b === 'string' ? { image: b, link: '' } : b)).filter((b: any) => b?.image);
  }
  return [];
}
