import { db, authReady } from './firebase';
import { collection, writeBatch, doc, getDocs, setDoc, getDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './errors';
import { cleanObject, getBSTISOString } from './utils';

const initialProducts = [
  { name: "Mehedi Mix 120gm", price: 350 },
  { name: "Hairpack 120gm", price: 290 },
  { name: "Complete Hair Therapy", price: 1490 },
  { name: "Nose Strips Gift", price: 0 },
  { name: "Imported Premium Wooden hair brush", price: 990 },
  { name: "Imported Premium WoodenComb 11 Tooth", price: 990 },
  { name: "Imported Premium WoodenComb 30Tooth", price: 990 },
  { name: "Vira Sunscreen Cream Gift 15ml", price: 0 },
  { name: "Soothing Gel", price: 690 },
  { name: "Brightify Cream", price: 1190 },
  { name: "Brightaura Serum", price: 890 },
  { name: "Acnex Serum", price: 890 },
  { name: "Handmade Beauty Bar", price: 600 },
  { name: "Sunscreen Cream 100ml", price: 990 },
  { name: "Silk Drop Hair Serum 100ml", price: 1200 },
  { name: "Scalp Nutrition Serum 50ml", price: 1200 },
  { name: "6 ONIMIX Shampoo Half Course", price: 7800 },
  { name: "ONIMIX Shampoo Gift", price: 0 },
  { name: "Coupon Gift", price: 0 },
  { name: "Mystery Box", price: 0 },
  { name: "Scalp Massager", price: 200 },
  { name: "Comb", price: 350 },
  { name: "ONIMIX Shampoo Trial Course", price: 700 },
  { name: "ONIMIX Shampoo Half Course", price: 1300 },
  { name: "Mehedi Mix", price: 700 },
  { name: "Facepack", price: 500 },
  { name: "Hairpack", price: 600 },
  { name: "Hair Oil Trial Course", price: 700 },
  { name: "Hair Oil Half Course", price: 1200 }
];

export async function seedProducts() {
  try {
    await authReady;
    const productsCol = collection(db, 'products');
    const snapshot = await getDocs(productsCol);
    
    if (snapshot.empty) {
      console.log("Seeding initial products...");
      const batch = writeBatch(db);
      initialProducts.forEach(p => {
        const newDoc = doc(productsCol);
        batch.set(newDoc, cleanObject({
          ...p,
          updatedAt: getBSTISOString()
        }));
      });
      try {
        await batch.commit();
        console.log("Product seeding complete.");
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'products');
      }
    }

    // Seed Gift Rules
    const giftConfigRef = doc(db, 'config', 'gift_rules');
    const giftSnap = await getDoc(giftConfigRef);

    if (!giftSnap.exists()) {
      console.log("Seeding initial gift rules...");
      try {
        await setDoc(giftConfigRef, cleanObject({
          rules: [
            {
              id: 'rule-sm',
              name: 'Scalp Massager Gift',
              triggerKeywords: ['sm gift', 'scalp massager gift', 'sm g'],
              targetKeywords: ['scalp massager', 'sm'],
              isActive: true
            },
            {
              id: 'rule-mehedi',
              name: 'Mehedi Mix Gift',
              triggerKeywords: ['mehedi mix gift', 'mehedi mix 120gm gift', 'mehedi mix 120g gift'],
              targetKeywords: ['mehedi mix'],
              isActive: true
            },
            {
              id: 'rule-hairpack',
              name: 'Hairpack Gift',
              triggerKeywords: ['hairpack gift'],
              targetKeywords: ['hairpack'],
              isActive: true
            }
          ]
        }));
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'config/gift_rules');
      }
    }

    // Seed Site Settings
    const siteConfigRef = doc(db, 'config', 'site_settings');
    const siteSnap = await getDoc(siteConfigRef);
    if (!siteSnap.exists()) {
      console.log("Seeding initial site settings...");
      await setDoc(siteConfigRef, cleanObject({
        companyName: 'Parcel Intelligence',
        amountTolerance: 5,
        permissionKeywords: ['permit', 'permit by', 'permitted by', 'permitted', 'authorized', 'boss ok', 'leader ok'],
        logoUrl: ''
      }));
    }
  } catch (error) {
    console.error("General seed error:", error);
  }
}
