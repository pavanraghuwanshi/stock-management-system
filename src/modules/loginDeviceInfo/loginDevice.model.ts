// device.model.ts

import mongoose from "mongoose";

const userDeviceSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
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

    deviceId: {
      type: String,
      required: true,
      trim: true,
    },

    deviceName: {
      type: String,
      default: null,
      trim: true,
    },

    deviceModel: {
      type: String,
      default: null,
      trim: true,
    },

    platform: {
      type: String,
      default: null,
      trim: true,
    },

    osVersion: {
      type: String,
      default: null,
      trim: true,
    },

    appVersion: {
      type: String,
      default: null,
      trim: true,
    },

    ipAddress: {
      type: String,
      default: null,
    },

    lastLoginAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export const UserDevice = mongoose.model(
  "UserDevice",
  userDeviceSchema
);