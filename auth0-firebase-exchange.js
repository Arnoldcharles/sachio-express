const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const { URL } = require('url');

const AUTH0_DOMAIN = process.env.EXPO_PUBLIC_AUTH0_DOMAIN || 'arnoldcharles.us.auth0.com';
const AUTH0_CLIENT_ID = process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID || 'iugqNGKBu3AePIIxH3azRG9pEeccR20g';
const FIREBASE_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'sachio-mobile-toilets';
const FIREBASE_CLIENT_EMAIL =
  process.env.FIREBASE_CLIENT_EMAIL ||
  'firebase-adminsdk-fbsvc@sachio-mobile-toilets.iam.gserviceaccount.com';
const FIREBASE_PRIVATE_KEY = (
  process.env.FIREBASE_PRIVATE_KEY ||
  '-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCRM9fFbzCfGjiJ\\nu7Jo/TqxsnCnkFXgai1yPpTXC1goZj5g/G2ZmAcmXCckTnBLW/+7W6EDP1zBgYtA\\n29xuUm5RxPmWEUd+S5i0el7xQzK4htPR+AXBWp319800wyuZRuZdADF4NX5VbKgu\\nLt4QnHpybEWH66wJaT6BjTYYiIFK4JOhdbas9JFNx7kTkrC4DEYsE0g7YRffcLkn\\n5iEFsYE3GUiOPEnpaEbOdu0qQrMPWqbXMaZo25OJQl19hGIrKJ7LvzkTy6Ehnt/u\\nSYOeIH3W4jqoz2vRMB3VEZHEfIJtKcRw1NjXzSx5oLBYOcYHIstdkSNXWHTAs/k5\\nXcg0P/ETAgMBAAECggEAIAMGeHwdg44j1dXALR5bAM8ewAp1rF6sO0opxUk2e92i\\ntf4g6aJXPTFG3d2/KxYSyMsYMd+Xwv+c5EU0kUvyD2v2PIv9r43aEjwCT31por3y\\n2BEur6SbO52Qq6e1pnq3kdxXi7F7czjb0Sa7BX2CD1TodWFTUdXWlng762e43XlV\\nZdqum3XZW+WgTQ7kow5x+VH1c7bw9wCOYQCHU3sB6NPxI7vpcBcu7dH0bHOgTcgM\\nMlWMCBzvx1VvpmHCLnk+/50S4sgrSg4Hm09wrtxVHMc3PURlHz8/p93kC1a6utw+\\nNTZVxq85/ogn/GwSxNzf+Irz/nqqHPVmjMBXaCkLXQKBgQDKcuHbvQKqrA2wFa83\\nW5e/2MCwGZ0fJA3keIkF3q0Eed63urH1KMzv2bxVS+9ORtkCxOfv3/3zZnNk9fhu\\nfeQktP8lypdC3DxtoKQGGBvC0NLghc8N1D6vf2oopkZhmYKGn0RgpADe23Z2gf+5\\nt6GqDIcesUHEDNEw86Th/dSRNQKBgQC3nHIzS4EFpts5+qJEmzzhZpMVVXN75Cew\\nnCQlOZkQecLId4eCxmzPxExq8iR/igj2mr1VupwfpfsLfbb6qZnjNDkbklyUBhb/\\n/SuE3wZsUWH2YlUY2XlHBB1KbRr00Dvyw/lKQAYESXFzzx7o0EAd09ptOyg2OV+x\\n3XiLWGLKJwKBgFxsC/5EEJaYC3uqup38G5ACxRzf5KIV1J3MBUn/uV8EwA+ClMGG\\nSeDptxf9nZdPsryX5gbVbFsVF3Ms86iFooS7eIvpLBri7ldh8d+yW+IZcVv82mTG\\n04NNGMrL9e+SpEsPJKk11gvnhvJdMMC5O32lUH5Lj+mPrGS7pjdhqQxNAoGACKYO\\n3wmsbya35tg+cnrZeEiLnxKiWPCbSf9g2HwJELSbjzPKJ0fPck3tx4/WVkebOnp5\\ndqNOnVMFKzpltxLsE76u/fR79eD/jllPhne25r1CnwdsuLnts4GnG41eGrAAUuQW\\nRwATCHqpJGpaK1871evXuxNxRnSXZFppRi8IoDsCgYEArtJX4wkhGNGYg6ZB8WrS\\nQasCreDrc6lAZRHrmW4WbeaIrzZ2bDLTaa/dPUWWX1Ii/fWIOWZ3bm+idC8RQRvI\\nyKZUEs7HGt+GvOfM+0VIqpMFTxzGgVNbDrWIGlFG32WjHICCBvuCCjfVARjM3cQ8\\ng6WKRvt4QQsipgQuHM7Dv1c=\\n-----END PRIVATE KEY-----\\n'
).replace(/\\n/g, '\n');
const PORT = process.env.PORT || 5001;

if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
  console.warn(
    'Missing Firebase admin env vars (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)'
  );
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY,
    }),
  });
}

(async () => {
  const { createRemoteJWKSet, jwtVerify } = await import('jose');
  const jwks = createRemoteJWKSet(new URL(`https://${AUTH0_DOMAIN}/.well-known/jwks.json`));

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.post('/auth/auth0-exchange', async (req, res) => {
    const { idToken } = req.body || {};
    if (!idToken) return res.status(400).json({ error: 'idToken required' });

    try {
      const { payload } = await jwtVerify(idToken, jwks, {
        issuer: `https://${AUTH0_DOMAIN}/`,
        audience: AUTH0_CLIENT_ID,
      });

      const uid = payload.sub;
      if (!uid) throw new Error('No subject in token');

      const userData = {
        email: payload.email,
        displayName: payload.name || payload.nickname || undefined,
        emailVerified: !!payload.email_verified,
      };

      let userRecord;
      try {
        userRecord = await admin.auth().getUser(uid);
        const updates = {};
        if (userData.email && userRecord.email !== userData.email) updates.email = userData.email;
        if (userData.displayName && userRecord.displayName !== userData.displayName)
          updates.displayName = userData.displayName;
        if (userData.emailVerified && !userRecord.emailVerified) updates.emailVerified = true;
        if (Object.keys(updates).length) {
          userRecord = await admin.auth().updateUser(uid, updates);
        }
      } catch (err) {
        if (err.code === 'auth/user-not-found') {
          userRecord = await admin.auth().createUser({
            uid,
            email: userData.email,
            displayName: userData.displayName,
            emailVerified: userData.emailVerified,
          });
        } else {
          throw err;
        }
      }

      const firebaseCustomToken = await admin.auth().createCustomToken(uid, { auth0: true });
      return res.json({ firebaseCustomToken, uid: userRecord.uid, email: userRecord.email });
    } catch (err) {
      console.error('Auth0 exchange error:', err);
      return res.status(401).json({ error: err.message || 'Invalid token' });
    }
  });

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.listen(PORT, () => {
    console.log(`Auth0 exchange server listening on ${PORT}`);
  });
})();
