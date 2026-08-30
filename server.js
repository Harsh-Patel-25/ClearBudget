require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const Transaction = require("./models/Transaction");
const Friend = require("./models/Friend");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// In-Memory Storage Fallback
let memoryTransactions = [];
let memoryFriends = [];

// Helper to generate unique ID for fallback store
const genId = () => Date.now().toString() + Math.random().toString(36).substr(2, 5);

// MongoDB Connection handling
let isMongoConnected = false;

const connectDB = async () => {
  let mongoURI = process.env.MONGODB_URI;
  if (!mongoURI || mongoURI.trim() === "") {
    console.log("⚠️ MONGODB_URI is not set in .env file. Running with fast local store.");
    return;
  }

  mongoURI = mongoURI.trim().replace(/^["']|["']$/g, "");

  try {
    // Set 4 second fast timeout so it never hangs requests if Atlas IP is blocked or offline
    await mongoose.connect(mongoURI, {
      dbName: "clearbudget",
      serverSelectionTimeoutMS: 4000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 10000,
    });
    isMongoConnected = true;
    console.log("⚡ Connected to MongoDB Atlas successfully!");
  } catch (error) {
    isMongoConnected = false;
    console.error("⚠️ MongoDB Atlas connection error / timeout:", error.message);
    console.log("⚡ Running with fast local memory store fallback.");
  }
};

mongoose.connection.on("error", (err) => {
  console.error("Mongoose runtime connection error:", err.message);
  isMongoConnected = false;
});

mongoose.connection.on("disconnected", () => {
  isMongoConnected = false;
});

connectDB();

// Health / Status API
app.get("/api/status", (req, res) => {
  res.json({
    status: "online",
    dbConnected: isMongoConnected,
    message: isMongoConnected
      ? "Connected to MongoDB"
      : "Operating in fast local storage mode.",
  });
});

// --- TRANSACTIONS API ---

// Get all transactions
app.get("/api/transactions", async (req, res) => {
  try {
    if (isMongoConnected) {
      const transactions = await Transaction.find().sort({ createdAt: -1 }).lean();
      const formatted = transactions.map((t) => ({
        ...t,
        id: t._id.toString(),
      }));
      return res.json(formatted);
    }
  } catch (err) {
    console.warn("MongoDB query failed, falling back to memory store:", err.message);
  }
  res.json(memoryTransactions);
});

// Add new transaction
app.post("/api/transactions", async (req, res) => {
  try {
    const { name, category, thingType, icon, amount, date } = req.body;
    if (!name || amount === undefined) {
      return res.status(400).json({ error: "Name and Amount are required" });
    }

    if (isMongoConnected) {
      const newTx = new Transaction({
        name,
        category: category || (amount >= 0 ? "Income" : "Expense"),
        thingType: thingType || "Other",
        icon: icon || (amount >= 0 ? "arrow-up" : "arrow-down"),
        amount,
        date: date || new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" }),
      });
      await newTx.save();
      const result = newTx.toObject();
      result.id = result._id.toString();
      return res.status(201).json(result);
    }

    const newTx = {
      id: genId(),
      name,
      category: category || (amount >= 0 ? "Income" : "Expense"),
      thingType: thingType || "Other",
      icon: icon || (amount >= 0 ? "arrow-up" : "arrow-down"),
      amount,
      date: date || new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" }),
      createdAt: new Date(),
    };
    memoryTransactions.unshift(newTx);
    res.status(201).json(newTx);
  } catch (err) {
    console.warn("MongoDB insert error, saving to memory store:", err.message);
    const newTx = {
      id: genId(),
      name: req.body.name,
      category: req.body.category || (req.body.amount >= 0 ? "Income" : "Expense"),
      thingType: req.body.thingType || "Other",
      icon: req.body.icon || (req.body.amount >= 0 ? "arrow-up" : "arrow-down"),
      amount: req.body.amount,
      date: req.body.date || new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" }),
      createdAt: new Date(),
    };
    memoryTransactions.unshift(newTx);
    res.status(201).json(newTx);
  }
});

// Update transaction
app.put("/api/transactions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, thingType, amount, date } = req.body;

    if (isMongoConnected && mongoose.Types.ObjectId.isValid(id)) {
      const updatedTx = await Transaction.findByIdAndUpdate(
        id,
        { name, category, thingType, amount, date },
        { new: true }
      ).lean();
      if (updatedTx) {
        updatedTx.id = updatedTx._id.toString();
        return res.json(updatedTx);
      }
    }

    const index = memoryTransactions.findIndex((t) => t.id === id);
    if (index !== -1) {
      memoryTransactions[index] = {
        ...memoryTransactions[index],
        name,
        category,
        thingType: thingType || memoryTransactions[index].thingType,
        amount,
        date,
      };
      return res.json(memoryTransactions[index]);
    }
    res.status(404).json({ error: "Transaction not found" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete single transaction
app.delete("/api/transactions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (isMongoConnected && mongoose.Types.ObjectId.isValid(id)) {
      await Transaction.findByIdAndDelete(id);
    }
    memoryTransactions = memoryTransactions.filter((t) => t.id !== id);
    res.json({ message: "Transaction deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete all transactions
app.delete("/api/transactions", async (req, res) => {
  try {
    if (isMongoConnected) {
      await Transaction.deleteMany({});
    }
    memoryTransactions = [];
    res.json({ message: "All transactions cleared" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- FRIENDS API ---

app.get("/api/friends", async (req, res) => {
  try {
    if (isMongoConnected) {
      const friends = await Friend.find({ status: "active" }).sort({ createdAt: -1 }).lean();
      const formatted = friends.map((f) => ({ ...f, id: f._id.toString() }));
      return res.json(formatted);
    }
  } catch (err) {
    console.warn("MongoDB friends query error:", err.message);
  }
  const friends = memoryFriends.filter((f) => f.status === "active");
  res.json(friends);
});

app.get("/api/friends/done", async (req, res) => {
  try {
    if (isMongoConnected) {
      const doneFriends = await Friend.find({ status: "settled" }).sort({ settledAt: -1 }).lean();
      const formatted = doneFriends.map((f) => ({ ...f, id: f._id.toString() }));
      return res.json(formatted);
    }
  } catch (err) {
    console.warn("MongoDB done friends query error:", err.message);
  }
  const doneFriends = memoryFriends.filter((f) => f.status === "settled");
  res.json(doneFriends);
});

app.post("/api/friends", async (req, res) => {
  try {
    const { name, amount, type, description, date } = req.body;
    if (!name || amount === undefined) {
      return res.status(400).json({ error: "Name and amount required" });
    }

    if (isMongoConnected) {
      const newFriend = new Friend({
        name,
        amount,
        type: type || "leva",
        description: description || "",
        date: date || new Date().toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" }),
        status: "active",
      });
      await newFriend.save();
      const result = newFriend.toObject();
      result.id = result._id.toString();
      return res.status(201).json(result);
    }

    const newFriend = {
      id: genId(),
      name,
      amount,
      type: type || "leva",
      description: description || "",
      date: date || new Date().toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" }),
      status: "active",
      createdAt: new Date(),
    };
    memoryFriends.unshift(newFriend);
    res.status(201).json(newFriend);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/friends/:id/settle", async (req, res) => {
  try {
    const { id } = req.params;
    if (isMongoConnected && mongoose.Types.ObjectId.isValid(id)) {
      const updated = await Friend.findByIdAndUpdate(
        id,
        { status: "settled", settledAt: new Date() },
        { new: true }
      ).lean();
      if (updated) {
        updated.id = updated._id.toString();
        return res.json(updated);
      }
    }

    const index = memoryFriends.findIndex((f) => f.id === id);
    if (index !== -1) {
      memoryFriends[index].status = "settled";
      memoryFriends[index].settledAt = new Date();
      return res.json(memoryFriends[index]);
    }
    res.status(404).json({ error: "Friend record not found" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/friends/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (isMongoConnected && mongoose.Types.ObjectId.isValid(id)) {
      await Friend.findByIdAndDelete(id);
    }
    memoryFriends = memoryFriends.filter((f) => f.id !== id);
    res.json({ message: "Friend record deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/friends/done/all", async (req, res) => {
  try {
    if (isMongoConnected) {
      await Friend.deleteMany({ status: "settled" });
    }
    memoryFriends = memoryFriends.filter((f) => f.status !== "settled");
    res.json({ message: "All settled records cleared" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 ClearBudget Server listening at http://localhost:${PORT}`);
});
