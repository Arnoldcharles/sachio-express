# Products helpers (lib/products.ts)

This file provides helpers to upload images to Firebase Storage and to create/fetch product documents from Firestore.

Functions

- `uploadImage(uri: string, path?: string): Promise<string>`
  - Uploads a local image URI to Firebase Storage and returns a public download URL.
  - Example:
    ```ts
    import { uploadImage } from './lib/products';

    const url = await uploadImage(localUri, `products/${Date.now()}`);
    ```

- `createProduct(product: Product): Promise<Product & { id: string }>`
  - Adds a product document to `products` collection. `product` can include `imageUrl` (string), `title`, `price`, `description`.
  - Example:
    ```ts
    import { createProduct } from './lib/products';

    const p = await createProduct({ title: 'VIP Toilet', price: 45000, description: 'Luxury', imageUrl });
    console.log('created product', p.id);
    ```

- `getProducts(): Promise<Product[]>`
  - Returns products ordered by `createdAt` desc.

Notes & runtime

- The upload helper uses `fetch(uri).blob()` which works in the Expo-managed runtime. On web or in some environments you may need to adapt the upload flow.
- Ensure `lib/firebase.ts` exports `db` and `storage` and that Firebase is initialized before calling these helpers.
- Example combined flow (image + product):
  ```ts
  const uri = await pickImage(); // your image picker
  const imageUrl = await uploadImage(uri);
  await createProduct({ title, price, description, imageUrl });
  ```

Security

- Ensure your Firestore security rules allow authenticated creation of `products` if appropriate.
- Consider using Cloud Functions or admin-side validation for production-critical product creation to avoid users creating arbitrary products from client apps.
