require("dotenv").config();
const { connectDB } = require("../db/connect");
const CabType = require("../models/CabType");
const Route = require("../models/Route");
const Package = require("../models/Package");
const GalleryPhoto = require("../models/GalleryPhoto");
const { CAB_TYPES } = require("../data/cabTypes");

const ROUTES = [
  { from: "Chandigarh", to: "Delhi", km: 247, hours: "4h 17m", fare: 2989 },
  { from: "Chandigarh", to: "Shimla", km: 112, hours: "3h 09m", fare: 1423 },
  { from: "Chandigarh", to: "Manali", km: 310, hours: "7h 40m", fare: 4550 },
  { from: "Chandigarh", to: "Amritsar", km: 234, hours: "4h 05m", fare: 2810 },
  { from: "Ludhiana", to: "Chandigarh", km: 100, hours: "2h 05m", fare: 1330 },
  { from: "Delhi", to: "Chandigarh", km: 247, hours: "4h 20m", fare: 2989 },
];

// Placeholder photos (freely usable Unsplash source links) — swap for
// real photos via /admin/packages once you have some.
const PACKAGES = [
  {
    title: "Manali Getaway",
    description: "Mountain views, Solang Valley, and a night by the Beas river.",
    imageUrl: "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800",
    price: 12999,
    durationLabel: "3 Days / 2 Nights",
    cities: "Chandigarh, Manali",
  },
  {
    title: "Shimla Weekend",
    description: "Mall Road, Kufri, and colonial-era hill station charm.",
    imageUrl: "https://images.unsplash.com/photo-1626015449188-91a37e0d13a0?w=800",
    price: 7499,
    durationLabel: "2 Days / 1 Night",
    cities: "Chandigarh, Shimla",
  },
  {
    title: "Golden Temple & Amritsar",
    description: "The Golden Temple, Wagah Border ceremony, and Amritsari food.",
    imageUrl: "https://images.unsplash.com/photo-1588083949404-c4f1ed1323b1?w=800",
    price: 6999,
    durationLabel: "2 Days / 1 Night",
    cities: "Chandigarh, Amritsar",
  },
];

// Placeholder photos (freely usable Unsplash links) — swap for real fleet
// and destination photos via /admin/gallery once you have some.
const GALLERY_PHOTOS = [
  {
    imageUrl: "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=1200",
    caption: "Mountain roads on the way to Himachal",
    category: "Destinations",
    order: 1,
  },
  {
    imageUrl: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=1200",
    caption: "Sedan fleet, ready for outstation trips",
    category: "Fleet",
    order: 2,
  },
  {
    imageUrl: "https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=1200",
    caption: "Golden Temple, Amritsar",
    category: "Destinations",
    order: 3,
  },
  {
    imageUrl: "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=1200",
    caption: "Solang Valley, Manali",
    category: "Destinations",
    order: 4,
  },
];

async function seed() {
  await connectDB();

  for (const cab of CAB_TYPES) {
    await CabType.updateOne({ id: cab.id }, { $set: cab }, { upsert: true });
  }

  for (const route of ROUTES) {
    await Route.updateOne(
      { from: route.from, to: route.to },
      { $set: route },
      { upsert: true }
    );
  }

  for (const pkg of PACKAGES) {
    await Package.updateOne({ title: pkg.title }, { $set: pkg }, { upsert: true });
  }

  for (const photo of GALLERY_PHOTOS) {
    await GalleryPhoto.updateOne({ imageUrl: photo.imageUrl }, { $set: photo }, { upsert: true });
  }

  console.log(
    `Seeded ${CAB_TYPES.length} cab types, ${ROUTES.length} routes, ${PACKAGES.length} packages, and ${GALLERY_PHOTOS.length} gallery photos.`
  );
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
