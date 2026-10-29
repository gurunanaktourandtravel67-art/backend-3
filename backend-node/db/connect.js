const mongoose = require("mongoose");

let isConnected = false;

async function connectDB() {
  if (isConnected) return mongoose.connection;

  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/averra";

  await mongoose.connect(uri, {
    // Connection pooling — reuse sockets instead of opening one per request.
    // Raise this on the API instance handling the most concurrent traffic;
    // total pool usage across all Node instances should stay under MongoDB's
    // own connection limit.
    maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE) || 20,
    minPoolSize: 2,

    // Fail fast instead of queueing requests indefinitely if the DB is unreachable.
    serverSelectionTimeoutMS: 5000,

    // Read replicas: route search/read traffic to secondaries where a few
    // seconds of staleness is fine (route lists, cab types), keep writes and
    // read-your-own-write flows (booking status) on the primary.
    // Set per-query with `.read("secondaryPreferred")` where appropriate.
  });

  isConnected = true;
  mongoose.connection.on("error", (err) => {
    console.error("MongoDB connection error:", err.message);
  });
  mongoose.connection.on("disconnected", () => {
    isConnected = false;
    console.warn("MongoDB disconnected");
  });

  console.log(`MongoDB connected → ${mongoose.connection.name}`);
  return mongoose.connection;
}

module.exports = { connectDB };
module.exports.connectDB = connectDB; // also callable as require("./connect").connectDB(...) or require("./connect")(...)
module.exports.default = connectDB;
