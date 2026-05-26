import mongoose from "mongoose";

const attendancePolicySchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: null,
      trim: true,
    },

    checkInTime: {
      type: String,
      default: "09:00",
    },

    checkOutTime: {
      type: String,
      default: "18:00",
    },

    graceMinutes: {
      type: Number,
      default: 10,
    },

    halfDayAfterMinutes: {
      type: Number,
      default: 240,
    },

    fullDayMinutes: {
      type: Number,
      default: 480,
    },

    allowLateCheckIn: {
      type: Boolean,
      default: true,
    },

    allowEarlyCheckOut: {
      type: Boolean,
      default: true,
    },

    requireGeofence: {
      type: Boolean,
      default: false,
    },

    requireSelfie: {
      type: Boolean,
      default: false,
    },

    allowRegularization: {
      type: Boolean,
      default: true,
    },

    weeklyOffs: [
      {
        type: String,
        enum: [
          "sunday",
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
        ],
      },
    ],

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

attendancePolicySchema.index(
  { organizationId: 1, name: 1 },
  { unique: true }
);

export const AttendancePolicy = mongoose.model(
  "AttendancePolicy",
  attendancePolicySchema
);