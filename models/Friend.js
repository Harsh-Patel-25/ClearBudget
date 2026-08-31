const mongoose = require("mongoose");

const friendSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      enum: ["leva", "deva", "give", "take"],
      default: "leva",
    },
    description: {
      type: String,
      default: "",
    },
    date: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["active", "settled"],
      default: "active",
    },
    settledAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model("Friend", friendSchema);
