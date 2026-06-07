import type { Context } from "hono";
import mongoose from "mongoose";

import { Attendance } from "./attendance.model";
import { User } from "../User/user.model";
import { AttendancePolicy } from "../attendancePolicy/attendancePolicy.model";
import { buildScopeFilter } from "../../utils/buildScopeFilter";

const isValidObjectId = (id: any) =>
  mongoose.Types.ObjectId.isValid(id);

const startOfDay = (date?: string | Date) => {
  const d = date ? new Date(date) : new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date?: string | Date) => {
  const d = date ? new Date(date) : new Date();
  d.setHours(23, 59, 59, 999);
  return d;
};

const timeToMinutes = (time: string) => {
  const [hours = 0, minutes = 0] = time
    .split(":")
    .map(Number);

  return hours * 60 + minutes;
};

const getMinutesFromDate = (date: Date) => {
  return date.getHours() * 60 + date.getMinutes();
};

const getDayName = (date: Date) => {
  return date
    .toLocaleDateString("en-US", { weekday: "long" })
    .toLowerCase();
};

const calculatePunchInStatus = (punchInTime: Date, policy: any) => {
  const checkInMinutes = timeToMinutes(policy.checkInTime);
  const punchInMinutes = getMinutesFromDate(punchInTime);
  const allowedMinutes = checkInMinutes + policy.graceMinutes;

  if (punchInMinutes > allowedMinutes) {
    return "Late";
  }

  return "Present";
};

const calculateFinalStatus = (
  totalMinutes: number,
  punchInTime: Date,
  policy: any
) => {
  if (totalMinutes >= policy.fullDayMinutes) {
    return calculatePunchInStatus(punchInTime, policy);
  }

  if (totalMinutes >= policy.halfDayAfterMinutes) {
    return "HalfDay";
  }

  return "Absent";
};

const buildUserScopeFilter = async (user: any) => {
  const scopeFilter = await buildScopeFilter(user);
  const filter: any = { ...scopeFilter };

  if (filter.ownerId) {
    filter._id = filter.ownerId;
    delete filter.ownerId;
  }

  if (filter.nodeId) {
    filter.$or = [
      { primaryNodeId: filter.nodeId },
      { nodeIds: filter.nodeId },
    ];
    delete filter.nodeId;
  }

  return filter;
};



type WeekDay =
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday";





// ======================================================
// PUNCH IN
// ======================================================

export const punchIn = async (c: Context) => {
  try {
    const loggedInUser = c.get("user");
    const body = await c.req.json();

    const { lat, lng } = body;

    const user = await User.findOne({
      _id: loggedInUser._id,
      organizationId: loggedInUser.organizationId,
      isActive: true,
    });

    if (!user) {
      return c.json(
        { success: false, message: "User not found" },
        404
      );
    }

    if (!user.attendancePolicyId) {
      return c.json(
        {
          success: false,
          message: "Attendance policy not assigned to user",
        },
        400
      );
    }

    const policy = await AttendancePolicy.findOne({
      _id: user.attendancePolicyId,
      organizationId: user.organizationId,
      isActive: true,
    });

    if (!policy) {
      return c.json(
        {
          success: false,
          message: "Attendance policy not found",
        },
        404
      );
    }

    const today = startOfDay();

    const alreadyExists = await Attendance.findOne({
      organizationId: user.organizationId,
      userId: user._id,
      date: today,
      isActive: true,
    });

    if (alreadyExists?.punchInTime) {
      return c.json(
        {
          success: false,
          message: "Already punched in today",
        },
        409
      );
    }

    const now = new Date();
    const getDayName = (date: Date): WeekDay => {
    return date
        .toLocaleDateString("en-US", {
        weekday: "long",
        })
        .toLowerCase() as WeekDay;
    };
    const dayName = getDayName(now);
    

    const status = policy.weeklyOffs?.includes(dayName)
      ? "WeeklyOff"
      : calculatePunchInStatus(now, policy);

    if (
      status === "Late" &&
      policy.allowLateCheckIn === false
    ) {
      return c.json(
        {
          success: false,
          message: "Late check-in is not allowed",
        },
        400
      );
    }

    const attendance = await Attendance.create({
      organizationId: user.organizationId,
      userId: user._id,
      nodeId: user.nodeIds?.[0] || null,
      attendancePolicyId: policy._id,
      date: today,
      punchInTime: now,
      status,
      punchInLocation: {
        lat: lat || null,
        lng: lng || null,
      },
    });

    return c.json(
      {
        success: true,
        message: "Punch in successful",
        data: attendance,
      },
      201
    );
  } catch (error: any) {
    return c.json(
      { success: false, message: error.message },
      400
    );
  }
};

// ======================================================
// PUNCH OUT
// ======================================================

export const punchOut = async (c: Context) => {
  try {
    const loggedInUser = c.get("user");

    const id = c.req.param("id");

    const body = await c.req.json();

    const { lat, lng } = body;

    if (!isValidObjectId(id)) {
      return c.json(
        {
          success: false,
          message: "Invalid attendance id",
        },
        400
      );
    }

    const attendance = await Attendance.findOne({
      _id: id,
      organizationId: loggedInUser.organizationId,
      userId: loggedInUser._id,
      isActive: true,
    });

    if (!attendance || !attendance.punchInTime) {
      return c.json(
        {
          success: false,
          message: "Punch in first",
        },
        400
      );
    }

    if (attendance.punchOutTime) {
      return c.json(
        {
          success: false,
          message: "Already punched out",
        },
        409
      );
    }

    const policy = await AttendancePolicy.findOne({
      _id: attendance.attendancePolicyId,
      organizationId: loggedInUser.organizationId,
      isActive: true,
    });

    if (!policy) {
      return c.json(
        {
          success: false,
          message: "Attendance policy not found",
        },
        404
      );
    }

    const now = new Date();

    const totalMinutes = Math.floor(
      (now.getTime() - attendance.punchInTime.getTime()) /
        (1000 * 60)
    );

    attendance.punchOutTime = now;
    attendance.totalMinutes = totalMinutes;
    attendance.punchOutLocation = {
      lat: lat || null,
      lng: lng || null,
    };

    if (attendance.status !== "WeeklyOff") {
      attendance.status = calculateFinalStatus(
        totalMinutes,
        attendance.punchInTime,
        policy
      );
    }

    await attendance.save();

    return c.json({
      success: true,
      message: "Punch out successful",
      data: attendance,
    });
  } catch (error: any) {
    return c.json(
      { success: false, message: error.message },
      400
    );
  }
};

// ======================================================
// ADMIN MARK ATTENDANCE
// ======================================================

export const markAttendanceByAdmin = async (c: Context) => {
  try {
    const loggedInUser = c.get("user");
    const body = await c.req.json();

    const {
      userId,
      date,
      status,
      punchInTime,
      punchOutTime,
      note,
    } = body;

    if (!userId || !status) {
      return c.json(
        {
          success: false,
          message: "userId and status are required",
        },
        400
      );
    }

    if (!isValidObjectId(userId)) {
      return c.json(
        { success: false, message: "Invalid userId" },
        400
      );
    }

    if (
      !["Present", "Late", "HalfDay", "Absent", "WeeklyOff"].includes(
        status
      )
    ) {
      return c.json(
        { success: false, message: "Invalid status" },
        400
      );
    }

    const userScopeFilter = await buildUserScopeFilter(loggedInUser);

    const user = await User.findOne({
      _id: userId,
      ...userScopeFilter,
      isActive: true,
    });

    if (!user) {
      return c.json(
        {
          success: false,
          message: "User not found in your CRM scope",
        },
        404
      );
    }

    const attendanceDate = startOfDay(date);

    let policy = null;

    if (user.attendancePolicyId) {
      policy = await AttendancePolicy.findOne({
        _id: user.attendancePolicyId,
        organizationId: user.organizationId,
        isActive: true,
      });
    }

    let inTime = null;
    let outTime = null;
    let totalMinutes = 0;

    if (punchInTime) {
      inTime = new Date(`${attendanceDate.toDateString()} ${punchInTime}`);
    }

    if (punchOutTime) {
      outTime = new Date(`${attendanceDate.toDateString()} ${punchOutTime}`);
    }

    if (inTime && outTime) {
      totalMinutes = Math.floor(
        (outTime.getTime() - inTime.getTime()) / (1000 * 60)
      );
    }

    const attendance = await Attendance.findOneAndUpdate(
      {
        organizationId: user.organizationId,
        userId: user._id,
        date: attendanceDate,
      },
      {
        organizationId: user.organizationId,
        userId: user._id,
        nodeId: user.nodeIds?.[0] || null,
        attendancePolicyId: policy?._id || null,
        date: attendanceDate,
        punchInTime: inTime,
        punchOutTime: outTime,
        totalMinutes,
        status,
        note: note || null,
        markedBy: loggedInUser._id,
        isManual: true,
        isActive: true,
      },
      {
        upsert: true,
        new: true,
      }
    );

    return c.json({
      success: true,
      message: "Attendance marked successfully",
      data: attendance,
    });
  } catch (error: any) {
    return c.json(
      { success: false, message: error.message },
      400
    );
  }
};

// ======================================================
// GET ATTENDANCE LIST
// ======================================================

export const getAttendances = async (c: Context) => {
  try {
    const user = c.get("user");

    const page = Number(c.req.query("page")) || 1;
    const limit = Number(c.req.query("limit")) || 10;
    const userId = c.req.query("userId");
    const status = c.req.query("status");
    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");

    const skip = (page - 1) * limit;

   const scopeFilter: any = await buildScopeFilter(user);

        const filter: any = {
        ...scopeFilter,
        isActive: true,
        };

        if (scopeFilter.ownerId) {
        filter.userId = scopeFilter.ownerId;
        delete filter.ownerId;
        }

    if (userId) {
      if (!isValidObjectId(userId)) {
        return c.json(
          { success: false, message: "Invalid userId" },
          400
        );
      }

      filter.userId = userId;
    }

    if (status) {
      filter.status = status;
    }

    if (startDate || endDate) {
      filter.date = {};

      if (startDate) {
        filter.date.$gte = startOfDay(startDate);
      }

      if (endDate) {
        filter.date.$lte = endOfDay(endDate);
      }
    }

    const [attendances, total] = await Promise.all([
      Attendance.find(filter)
        .populate("userId", "name email mobile")
        .populate("nodeId", "name type")
        .populate("attendancePolicyId", "name checkInTime checkOutTime")
        .populate("markedBy", "name email mobile")
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit),

      Attendance.countDocuments(filter),
    ]);

    return c.json({
      success: true,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      data: attendances,
    });
  } catch (error: any) {
    return c.json(
      { success: false, message: error.message },
      400
    );
  }
};


// ======================================================
// GET MY TODAY ATTENDANCE STATUS
// ======================================================

export const getMyTodayAttendance = async (c: Context) => {
  try {
    const loggedInUser = c.get("user");

    const today = startOfDay();

    const attendance = await Attendance.findOne({
      organizationId: loggedInUser.organizationId,
      userId: loggedInUser._id,
      date: today,
      isActive: true,
    })
      .populate("userId", "name email mobile")
      .populate("nodeId", "name type")
      .populate("attendancePolicyId", "name checkInTime checkOutTime");

    let nextAction = "PunchIn";

    if (attendance?.punchInTime && !attendance?.punchOutTime) {
      nextAction = "PunchOut";
    }

    if (attendance?.punchInTime && attendance?.punchOutTime) {
      nextAction = "Completed";
    }

    return c.json({
      success: true,
      message: "Today attendance fetched successfully",
      data: {
        date: today,
        nextAction,
        isPunchedIn: !!attendance?.punchInTime,
        isPunchedOut: !!attendance?.punchOutTime,
        attendance: attendance || null,
      },
    });
  } catch (error: any) {
    return c.json(
      { success: false, message: error.message },
      400
    );
  }
};