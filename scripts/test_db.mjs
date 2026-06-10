import mongoose from 'mongoose';

const MONGODB_URI = "mongodb+srv://carrysheriff_db_user:2ofToMFogyF0FaDE@zlearner.aa3ptuy.mongodb.net/zLearner";

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
