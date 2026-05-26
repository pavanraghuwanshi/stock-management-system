import mongoose from "mongoose";

const liveTrackSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    nodeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BusinessNode",
      default: null,
      index: true,
    },

    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    latitude: {
      type: Number,
      required: true,
    },

    longitude: {
      type: Number,
      required: true,
    },

    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },

    accuracy: {
      type: Number,
      default: null,
    },

    speed: {
      type: Number,
      default: null,
    },

    heading: {
      type: Number,
      default: null,
    },

    battery: {
      type: Number,
      default: null,
    },

    deviceInfo: {
      type: Object,
      default: {},
    },

    lastUpdatedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    isOnline: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

liveTrackSchema.index({ location: "2dsphere" });
liveTrackSchema.index({ organizationId: 1, nodeId: 1 });
liveTrackSchema.index({ organizationId: 1, ownerId: 1 });

export const LiveTrack = mongoose.model("LiveTrack", liveTrackSchema);