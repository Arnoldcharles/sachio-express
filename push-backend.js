const axios = require("axios");
const admin = require("firebase-admin");

const serviceAccount = require("./assets/images/onboarding/sachio-mobile-toilets-ac767dcdea09.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

function isExpoToken(token) {
  return (
    typeof token === "string" &&
    (token.startsWith("ExponentPushToken") || token.startsWith("ExpoPushToken"))
  );
}

async function sendExpoPush(messages) {
  if (!messages.length) return;
  const chunks = [];
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100));
  }
  for (const chunk of chunks) {
    try {
      await axios.post(EXPO_PUSH_URL, chunk, {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });
    } catch (err) {
      console.error("Expo push error:", err.response?.data || err.message);
    }
  }
}

async function getUserPushToken(uid) {
  if (!uid) return null;
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) return null;
  const token = snap.data()?.pushToken;
  return isExpoToken(token) ? token : null;
}

async function getAllPushTokens() {
  const snap = await db.collection("users").get();
  const tokens = new Set();
  snap.forEach((doc) => {
    const token = doc.data()?.pushToken;
    if (isExpoToken(token)) tokens.add(token);
  });
  return Array.from(tokens);
}

function buildOrderNotification(data) {
  const isRent = String(data?.type || "").toLowerCase().includes("rent");
  const title = isRent ? "Rental update" : "Order update";
  const status = data?.status ? String(data.status).replace(/_/g, " ") : "updated";
  const amount = data?.amount ?? data?.price ?? data?.total;
  const body = amount
    ? `${status} • NGN ${Number(amount).toLocaleString()}`
    : `${status}`;
  return { title, body };
}

async function notifyOrderChange(docSnap, isNew) {
  const data = docSnap.data() || {};
  const userId = data.userId;
  if (!userId) return;

  if (isNew && data.pushCreated) return;
  const statusKey = `${data.status || "created"}|${data.amount ?? data.price ?? data.total ?? ""}`;
  const priceSetAt = data.priceSetAt ? String(data.priceSetAt.toMillis ? data.priceSetAt.toMillis() : data.priceSetAt) : "";
  const changeKey = `${statusKey}|${priceSetAt}`;
  if (!isNew && data.pushLastStatusKey === changeKey) return;

  const token = await getUserPushToken(userId);
  if (!token) return;

  const { title, body } = buildOrderNotification(data);
  await sendExpoPush([
    {
      to: token,
      title: isNew ? (data.type?.includes("rent") ? "Rental request received" : "Order received") : title,
      body,
      data: { orderId: docSnap.id, type: data.type || "order" },
      sound: "default",
    },
  ]);

  const update = isNew
    ? { pushCreated: true, pushLastStatusKey: changeKey, pushLastStatusAt: admin.firestore.FieldValue.serverTimestamp() }
    : { pushLastStatusKey: changeKey, pushLastStatusAt: admin.firestore.FieldValue.serverTimestamp() };
  await db.collection("orders").doc(docSnap.id).set(update, { merge: true });
}

function listenOrders() {
  db.collection("orders").onSnapshot(async (snap) => {
    const changes = snap.docChanges();
    for (const change of changes) {
      try {
        if (change.type === "added") {
          await notifyOrderChange(change.doc, true);
        } else if (change.type === "modified") {
          await notifyOrderChange(change.doc, false);
        }
      } catch (err) {
        console.error("Order push failed:", err.message || err);
      }
    }
  });
}

async function notifyAnnouncement(docSnap) {
  const data = docSnap.data() || {};
  if (data.pushNotifiedAt) return;

  const title = data.title || "Announcement";
  const body = data.message || "New update available.";
  const audience = data.audience || "all";

  if (audience === "user" && data.targetUserId) {
    const token = await getUserPushToken(data.targetUserId);
    if (token) {
      await sendExpoPush([
        { to: token, title, body, data: { announcementId: docSnap.id }, sound: "default" },
      ]);
    }
  } else {
    const tokens = await getAllPushTokens();
    const messages = tokens.map((token) => ({
      to: token,
      title,
      body,
      data: { announcementId: docSnap.id },
      sound: "default",
    }));
    await sendExpoPush(messages);
  }

  await db.collection("announcements").doc(docSnap.id).set(
    { pushNotifiedAt: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );
}

function listenAnnouncements() {
  db.collection("announcements").onSnapshot(async (snap) => {
    const changes = snap.docChanges();
    for (const change of changes) {
      if (change.type !== "added") continue;
      try {
        await notifyAnnouncement(change.doc);
      } catch (err) {
        console.error("Announcement push failed:", err.message || err);
      }
    }
  });
}

listenOrders();
listenAnnouncements();
console.log("Push notification sender running.");
