const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const fs = require("fs");

const serviceAccount = JSON.parse(fs.readFileSync("/Users/jamesmac/Downloads/simpleplek-9d373-firebase-adminsdk-fbsvc-29751ad467.json", "utf8"));

admin.initializeApp({
  credential: admin.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

const db = getFirestore();

async function check() {
  const uid = "I8cgAm2UQddZM7cAfT74cmsxunj1";
  console.log("Querying Firestore user document:", uid);
  const doc = await db.collection("users").doc(uid).get();
  if (doc.exists) {
    console.log("User Document Found:", JSON.stringify(doc.data(), null, 2));
  } else {
    console.log("User Document NOT found in Firestore users collection.");
  }

  console.log("\nQuerying Firebase Authentication via Admin SDK:", uid);
  try {
    const auth = getAuth();
    const userRecord = await auth.getUser(uid);
    console.log("Firebase Auth User Record Found:");
    console.log("- Email:", userRecord.email);
    console.log("- Display Name:", userRecord.displayName);
    console.log("- Email Verified:", userRecord.emailVerified);
  } catch (err) {
    console.error("Failed to query Firebase Auth:", err.message);
  }
}

check().catch(console.error);
