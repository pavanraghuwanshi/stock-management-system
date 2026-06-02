import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
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
      index: true,
    },

    nodeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BusinessNode",
      default: null,
    },

    attendancePolicyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AttendancePolicy",
      default: null,
    },

    date: {
      type: Date,
      required: true,
      index: true,
    },

    punchInTime: {
      type: Date,
      default: null,
    },

    punchOutTime: {
      type: Date,
      default: null,
    },

    totalMinutes: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ["Present", "Late", "HalfDay", "Absent", "WeeklyOff"],
      default: "Present",
    },

    punchInLocation: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },

    punchOutLocation: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },

    note: {
      type: String,
      default: null,
    },

    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    isManual: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

attendanceSchema.index(
  { organizationId: 1, userId: 1, date: 1 },
  { unique: true }
);

export const Attendance = mongoose.model(
  "Attendance",
  attendanceSchema
);