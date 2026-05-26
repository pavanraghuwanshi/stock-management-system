import type { Context } from "hono";
import mongoose from "mongoose";
import { LiveTrack } from "./liveTrack.model";
import { buildScopeFilter } from "../../utils/buildScopeFilter";


const getUserNodeId = (user: any) => {
  return user.nodeId || user.nodeIds?.[0] || null;
};

// Mobile app will hit this API again and again
export const updateMyLiveLocation = async (c: Context) => {
  try {
    const user = c.get("user");
    const body = await c.req.json();

    const {
      latitude,
      longitude,
      accuracy,
      speed,
      heading,
      battery,
      deviceInfo,
    } = body;

    if (latitude === undefined || longitude === undefined) {
      return c.json(
        {
          success: false,
          message: "latitude and longitude are required",
        },
        400
      );
    }

    const lat = Number(latitude);
    const lng = Number(longitude);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return c.json(
        {
          success: false,
          message: "latitude and longitude must be valid numbers",
        },
        400
      );
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return c.json(
        {
          success: false,
          message: "Invalid latitude or longitude range",
        },
        400
      );
    }

    const nodeId = getUserNodeId(user);

    const updatedTrack = await LiveTrack.findOneAndUpdate(
      { userId: user.id },
      {
        $set: {
          organizationId: user.organizationId,
          nodeId,
          ownerId: user.ownerId || user.id,
          userId: user.id,

          latitude: lat,
          longitude: lng,
          location: {
            type: "Point",
            coordinates: [lng, lat],
          },

          accuracy: accuracy ?? null,
          speed: speed ?? null,
          heading: heading ?? null,
          battery: battery ?? null,
          deviceInfo: deviceInfo || {},

          lastUpdatedAt: new Date(),
          isOnline: true,
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    return c.json(
      {
        success: true,
        message: "Live location updated successfully",
        data: updatedTrack,
      },
      200
    );
  } catch (error: any) {
    return c.json(
      {
        success: false,
        message: error.message,
      },
      500
    );
  }
};


// get live users
export const getLiveTracks = async (c: Context) => {
  try {
    const user = c.get("user");

    const page = Math.max(Number(c.req.query("page")) || 1, 1);
    const limit = Math.max(Number(c.req.query("limit")) || 10, 1);
    const search = c.req.query("search") || "";
    const userId = c.req.query("userId");

    const skip = (page - 1) * limit;

    const scopeFilter = buildScopeFilter(user);

    const match: any = {
      ...scopeFilter,
    };

    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      match.userId = new mongoose.Types.ObjectId(userId);
    }

    const pipeline: any[] = [
      {
        $match: match,
      },

      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },

      {
        $unwind: {
          path: "$user",
          preserveNullAndEmptyArrays: true,
        },
      },
    ];

    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { "user.name": { $regex: search, $options: "i" } },
            { "user.email": { $regex: search, $options: "i" } },
            { "user.mobile": { $regex: search, $options: "i" } },
          ],
        },
      });
    }

    pipeline.push(
      {
        $lookup: {
          from: "businessnodes",
          localField: "nodeId",
          foreignField: "_id",
          as: "node",
        },
      },
      {
        $unwind: {
          path: "$node",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $sort: {
          lastUpdatedAt: -1,
        },
      },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: 1,
                organizationId: 1,
                nodeId: 1,
                ownerId: 1,
                userId: 1,

                latitude: 1,
                longitude: 1,
                location: 1,
                accuracy: 1,
                speed: 1,
                heading: 1,
                battery: 1,
                isOnline: 1,
                lastUpdatedAt: 1,
                createdAt: 1,
                updatedAt: 1,

                user: {
                  _id: "$user._id",
                  name: "$user.name",
                  email: "$user.email",
                  mobile: "$user.mobile",
                  role: "$user.role",
                },

                node: {
                  _id: "$node._id",
                  name: "$node.name",
                  type: "$node.type",
                },
              },
            },
          ],
          totalCount: [{ $count: "count" }],
        },
      }
    );

    const result = await LiveTrack.aggregate(pipeline);

    const data = result[0]?.data || [];
    const total = result[0]?.totalCount?.[0]?.count || 0;

    return c.json(
      {
        success: true,
        message: "Live tracks fetched successfully",
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      200
    );
  } catch (error: any) {
    return c.json(
      {
        success: false,
        message: error.message,
      },
      500
    );
  }
};