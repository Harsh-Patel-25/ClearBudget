require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("./models/User");
const Transaction = require("./models/Transaction");
const Friend = require("./models/Friend");

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "clearbudget_secret_key_2026_secure";

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// In-Memory Storage Fallback
let memoryUsers = [];
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
    await mongoose.disconnect().catch(() => {});
    console.error("⚠️ MongoDB Atlas connection error:", error.message);
    console.log("⚡ ClearBudget is running with fast local memory store fallback.");
  }
};

mongoose.connection.on("error", (err) => {
  if (isMongoConnected) {
    console.error("Mongoose runtime connection error:", err.message);
    isMongoConnected = false;
  }
});

mongoose.connection.on("disconnected", () => {
  isMongoConnected = false;
});

connectDB().then(() => seedMasterAdmin());

// Helper to generate JWT Token
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id || user._id.toString(), email: user.email, name: user.name, role: user.role || "user" },
    JWT_SECRET,
    { expiresIn: "30d" }
  );
};

// Authentication Middleware
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Access denied. Please log in." });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired session. Please log in again." });
  }
};

// Admin Authentication Middleware
const adminAuthMiddleware = async (req, res, next) => {
  await authMiddleware(req, res, async () => {
    if (req.user && (req.user.role === "admin" || req.user.email === "admin@clearbudget.com")) {
      return next();
    }
    return res.status(403).json({ error: "Access denied. Administrator rights required." });
  });
};

// Master Admin Auto-seeder
const seedMasterAdmin = async () => {
  const adminEmail = "admin@clearbudget.com";
  const adminPassword = "admin123";
  try {
    if (isMongoConnected) {
      let admin = await User.findOne({ email: adminEmail });
      if (!admin) {
        admin = new User({
          name: "System Admin",
          email: adminEmail,
          password: adminPassword,
          role: "admin",
        });
        await admin.save();
        console.log("⚡ Master Admin account seeded in MongoDB.");
      }
    }
  } catch (e) {
    console.warn("MongoDB admin seed check skipped:", e.message);
  }

  if (!memoryUsers.some((u) => u.email === adminEmail)) {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    memoryUsers.push({
      id: "admin_master_1",
      name: "System Admin",
      email: adminEmail,
      password: hashedPassword,
      role: "admin",
      createdAt: new Date(),
    });
    console.log("⚡ Master Admin account seeded in fast memory store.");
  }
};

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

// --- AUTHENTICATION API ---

// User Sign Up
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required." });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long." });
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (isMongoConnected) {
      const existingUser = await User.findOne({ email: normalizedEmail });
      if (existingUser) {
        return res.status(400).json({ error: "An account with this email already exists." });
      }

      const newUser = new User({
        name: name.trim(),
        email: normalizedEmail,
        password,
      });
      await newUser.save();
      const userObj = newUser.toJSON();
      const token = generateToken(userObj);

      return res.status(201).json({
        token,
        user: userObj,
      });
    }

    // In-memory fallback
    const existingMemoryUser = memoryUsers.find((u) => u.email === normalizedEmail);
    if (existingMemoryUser) {
      return res.status(400).json({ error: "An account with this email already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const memoryUser = {
      id: genId(),
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      createdAt: new Date(),
    };
    memoryUsers.push(memoryUser);

    const userObj = { id: memoryUser.id, name: memoryUser.name, email: memoryUser.email };
    const token = generateToken(userObj);

    res.status(201).json({
      token,
      user: userObj,
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: err.message || "Failed to create account" });
  }
});

// User Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (isMongoConnected) {
      const user = await User.findOne({ email: normalizedEmail });
      if (!user) {
        return res.status(400).json({ error: "Invalid email or password." });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(400).json({ error: "Invalid email or password." });
      }

      const userObj = user.toJSON();
      const token = generateToken(userObj);

      return res.json({
        token,
        user: userObj,
      });
    }

    // In-memory fallback
    const memoryUser = memoryUsers.find((u) => u.email === normalizedEmail);
    if (!memoryUser) {
      return res.status(400).json({ error: "Invalid email or password." });
    }

    const isMatch = await bcrypt.compare(password, memoryUser.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid email or password." });
    }

    const userObj = { id: memoryUser.id, name: memoryUser.name, email: memoryUser.email };
    const token = generateToken(userObj);

    res.json({
      token,
      user: userObj,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: err.message || "Login failed" });
  }
});

// Get Current User Profile
app.get("/api/auth/me", authMiddleware, async (req, res) => {
  try {
    if (isMongoConnected && mongoose.Types.ObjectId.isValid(req.userId)) {
      const user = await User.findById(req.userId);
      if (user) {
        return res.json(user.toJSON());
      }
    }
    const memoryUser = memoryUsers.find((u) => u.id === req.userId);
    if (memoryUser) {
      return res.json({ id: memoryUser.id, name: memoryUser.name, email: memoryUser.email });
    }
    res.json({ id: req.userId, name: req.user.name, email: req.user.email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- TRANSACTIONS API (USER PROTECTED) ---

// Get user transactions
app.get("/api/transactions", authMiddleware, async (req, res) => {
  try {
    if (isMongoConnected) {
      const transactions = await Transaction.find({ userId: req.userId }).sort({ createdAt: -1 }).lean();
      const formatted = transactions.map((t) => ({
        ...t,
        id: t._id.toString(),
      }));
      return res.json(formatted);
    }
  } catch (err) {
    console.warn("MongoDB query failed, falling back to memory store:", err.message);
  }
  const userTx = memoryTransactions.filter((t) => String(t.userId) === String(req.userId));
  res.json(userTx);
});

// Add new transaction for user
app.post("/api/transactions", authMiddleware, async (req, res) => {
  try {
    const { name, category, thingType, icon, amount, date } = req.body;
    if (!name || amount === undefined) {
      return res.status(400).json({ error: "Name and Amount are required" });
    }

    if (isMongoConnected) {
      const newTx = new Transaction({
        userId: req.userId,
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
      userId: req.userId,
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
      userId: req.userId,
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

// Update user transaction
app.put("/api/transactions/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, thingType, amount, date } = req.body;

    if (isMongoConnected && mongoose.Types.ObjectId.isValid(id)) {
      const updatedTx = await Transaction.findOneAndUpdate(
        { _id: id, userId: req.userId },
        { name, category, thingType, amount, date },
        { new: true }
      ).lean();
      if (updatedTx) {
        updatedTx.id = updatedTx._id.toString();
        return res.json(updatedTx);
      }
    }

    const index = memoryTransactions.findIndex((t) => t.id === id && String(t.userId) === String(req.userId));
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

// Delete user single transaction
app.delete("/api/transactions/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    if (isMongoConnected && mongoose.Types.ObjectId.isValid(id)) {
      await Transaction.findOneAndDelete({ _id: id, userId: req.userId });
    }
    memoryTransactions = memoryTransactions.filter((t) => !(t.id === id && String(t.userId) === String(req.userId)));
    res.json({ message: "Transaction deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete all user transactions
app.delete("/api/transactions", authMiddleware, async (req, res) => {
  try {
    if (isMongoConnected) {
      await Transaction.deleteMany({ userId: req.userId });
    }
    memoryTransactions = memoryTransactions.filter((t) => String(t.userId) !== String(req.userId));
    res.json({ message: "All transactions cleared" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- FRIENDS API (USER PROTECTED) ---

app.get("/api/friends", authMiddleware, async (req, res) => {
  try {
    if (isMongoConnected) {
      const friends = await Friend.find({ userId: req.userId, status: "active" }).sort({ createdAt: -1 }).lean();
      const formatted = friends.map((f) => ({ ...f, id: f._id.toString() }));
      return res.json(formatted);
    }
  } catch (err) {
    console.warn("MongoDB friends query error:", err.message);
  }
  const friends = memoryFriends.filter((f) => String(f.userId) === String(req.userId) && f.status === "active");
  res.json(friends);
});

app.get("/api/friends/done", authMiddleware, async (req, res) => {
  try {
    if (isMongoConnected) {
      const doneFriends = await Friend.find({ userId: req.userId, status: "settled" }).sort({ settledAt: -1 }).lean();
      const formatted = doneFriends.map((f) => ({ ...f, id: f._id.toString() }));
      return res.json(formatted);
    }
  } catch (err) {
    console.warn("MongoDB done friends query error:", err.message);
  }
  const doneFriends = memoryFriends.filter((f) => String(f.userId) === String(req.userId) && f.status === "settled");
  res.json(doneFriends);
});

app.post("/api/friends", authMiddleware, async (req, res) => {
  try {
    const { name, amount, type, description, date } = req.body;
    if (!name || amount === undefined) {
      return res.status(400).json({ error: "Name and amount required" });
    }

    let normalizedType = (type || "leva").toLowerCase();
    if (normalizedType === "give") normalizedType = "deva";
    if (normalizedType === "take") normalizedType = "leva";

    if (isMongoConnected) {
      const newFriend = new Friend({
        userId: req.userId,
        name,
        amount,
        type: normalizedType,
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
      userId: req.userId,
      name,
      amount,
      type: normalizedType,
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

app.patch("/api/friends/:id/settle", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    if (isMongoConnected && mongoose.Types.ObjectId.isValid(id)) {
      const updated = await Friend.findOneAndUpdate(
        { _id: id, userId: req.userId },
        { status: "settled", settledAt: new Date() },
        { new: true }
      ).lean();
      if (updated) {
        updated.id = updated._id.toString();
        return res.json(updated);
      }
    }

    const index = memoryFriends.findIndex((f) => f.id === id && String(f.userId) === String(req.userId));
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

app.patch("/api/friends/:id/restore", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    if (isMongoConnected && mongoose.Types.ObjectId.isValid(id)) {
      const updated = await Friend.findOneAndUpdate(
        { _id: id, userId: req.userId },
        { status: "active", $unset: { settledAt: 1 } },
        { new: true }
      ).lean();
      if (updated) {
        updated.id = updated._id.toString();
        return res.json(updated);
      }
    }

    const index = memoryFriends.findIndex((f) => f.id === id && String(f.userId) === String(req.userId));
    if (index !== -1) {
      memoryFriends[index].status = "active";
      delete memoryFriends[index].settledAt;
      return res.json(memoryFriends[index]);
    }
    res.status(404).json({ error: "Friend record not found" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/friends/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    if (isMongoConnected && mongoose.Types.ObjectId.isValid(id)) {
      await Friend.findOneAndDelete({ _id: id, userId: req.userId });
    }
    memoryFriends = memoryFriends.filter((f) => !(f.id === id && String(f.userId) === String(req.userId)));
    res.json({ message: "Friend record deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- ADMIN API (ADMIN PROTECTED) ---

// Get System Metrics Overview
app.get("/api/admin/stats", adminAuthMiddleware, async (req, res) => {
  try {
    let totalUsersCount = memoryUsers.length;
    let totalTransactionsCount = memoryTransactions.length;
    let totalFriendsCount = memoryFriends.length;
    let totalVolume = 0;

    if (isMongoConnected) {
      totalUsersCount = await User.countDocuments();
      totalTransactionsCount = await Transaction.countDocuments();
      totalFriendsCount = await Friend.countDocuments();
      const txSum = await Transaction.aggregate([
        { $group: { _id: null, total: { $sum: { $abs: "$amount" } } } },
      ]);
      totalVolume = txSum.length > 0 ? txSum[0].total : 0;
    } else {
      totalVolume = memoryTransactions.reduce((acc, t) => acc + Math.abs(t.amount || 0), 0);
    }

    res.json({
      totalUsers: totalUsersCount,
      totalTransactions: totalTransactionsCount,
      totalFriends: totalFriendsCount,
      totalVolume,
      dbStatus: isMongoConnected ? "MongoDB Atlas" : "Fast Local Store",
      serverUptime: process.uptime(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get All Registered Users
app.get("/api/admin/users", adminAuthMiddleware, async (req, res) => {
  try {
    if (isMongoConnected) {
      const users = await User.find().sort({ createdAt: -1 }).lean();
      const formatted = await Promise.all(
        users.map(async (u) => {
          const txCount = await Transaction.countDocuments({ userId: u._id });
          return {
            id: u._id.toString(),
            name: u.name,
            email: u.email,
            role: u.role || "user",
            createdAt: u.createdAt,
            transactionCount: txCount,
          };
        })
      );
      return res.json(formatted);
    }

    const formatted = memoryUsers.map((u) => {
      const txCount = memoryTransactions.filter((t) => String(t.userId) === String(u.id)).length;
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role || "user",
        createdAt: u.createdAt || new Date(),
        transactionCount: txCount,
      };
    });
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete User & User Data
app.delete("/api/admin/users/:id", adminAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    if (isMongoConnected && mongoose.Types.ObjectId.isValid(id)) {
      await User.findByIdAndDelete(id);
      await Transaction.deleteMany({ userId: id });
      await Friend.deleteMany({ userId: id });
    }

    memoryUsers = memoryUsers.filter((u) => String(u.id) !== String(id));
    memoryTransactions = memoryTransactions.filter((t) => String(t.userId) !== String(id));
    memoryFriends = memoryFriends.filter((f) => String(f.userId) !== String(id));

    res.json({ message: "User and user data deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Change User Role (User <-> Admin)
app.patch("/api/admin/users/:id/role", adminAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (!["user", "admin"].includes(role)) {
      return res.status(400).json({ error: "Invalid role specified" });
    }

    if (isMongoConnected && mongoose.Types.ObjectId.isValid(id)) {
      const updated = await User.findByIdAndUpdate(id, { role }, { new: true }).lean();
      if (updated) {
        updated.id = updated._id.toString();
        delete updated.password;
        return res.json(updated);
      }
    }

    const index = memoryUsers.findIndex((u) => String(u.id) === String(id));
    if (index !== -1) {
      memoryUsers[index].role = role;
      const copy = { ...memoryUsers[index] };
      delete copy.password;
      return res.json(copy);
    }

    res.status(404).json({ error: "User not found" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Global Transactions Ledger
app.get("/api/admin/transactions", adminAuthMiddleware, async (req, res) => {
  try {
    if (isMongoConnected) {
      const txs = await Transaction.find().sort({ createdAt: -1 }).populate("userId", "name email").lean();
      const formatted = txs.map((t) => ({
        ...t,
        id: t._id.toString(),
        userName: t.userId ? t.userId.name : "Unknown",
        userEmail: t.userId ? t.userId.email : "Unknown",
      }));
      return res.json(formatted);
    }

    const formatted = memoryTransactions.map((t) => {
      const user = memoryUsers.find((u) => String(u.id) === String(t.userId)) || {};
      return {
        ...t,
        userName: user.name || "Unknown",
        userEmail: user.email || "Unknown",
      };
    });
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Transaction as Admin
app.delete("/api/admin/transactions/:id", adminAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    if (isMongoConnected && mongoose.Types.ObjectId.isValid(id)) {
      await Transaction.findByIdAndDelete(id);
    }
    memoryTransactions = memoryTransactions.filter((t) => String(t.id) !== String(id));
    res.json({ message: "Transaction purged by admin" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export Database Backup JSON
app.get("/api/admin/export", adminAuthMiddleware, async (req, res) => {
  try {
    let users = memoryUsers.map(({ password, ...rest }) => rest);
    let transactions = memoryTransactions;
    let friends = memoryFriends;

    if (isMongoConnected) {
      users = await User.find().select("-password").lean();
      transactions = await Transaction.find().lean();
      friends = await Friend.find().lean();
    }

    res.json({
      exportedAt: new Date().toISOString(),
      mode: isMongoConnected ? "MongoDB Atlas" : "Fast Local Memory",
      users,
      transactions,
      friends,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 ClearBudget Server listening at http://localhost:${PORT}`);
});
