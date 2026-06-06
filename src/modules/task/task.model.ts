import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
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
    },

    title: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    description: {
      type: String,
      default: null,
    },

    status: {
      type: String,
      enum: [
        "pending",
        "in_progress",
        "review",
        "completed",
        "cancelled",
      ],
      default: "pending",
      index: true,
    },
    towerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tower",
      default: null,
    },

    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
      index: true,
    },

    assignedToId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    createdById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    dueDate: {
      type: Date,
      default: null,
      index: true,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);


taskSchema.index({
  organizationId: 1,
  assignedToId: 1,
});

export const Task = mongoose.model("Task", taskSchema);