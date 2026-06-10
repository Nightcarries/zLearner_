import mongoose from 'mongoose';

const MONGODB_URI = "";

async function test() {
  console.log("Connecting...");
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    });
    console.log("✅ Connection Successful!");
    await mongoose.disconnect();
  } catch (err) {
    console.error("❌ Connection Failed:", err);
  }
}

test();
