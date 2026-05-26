import { Hono } from "hono";
import {
  updateMyLiveLocation,
  getLiveTracks,
 
} from "./liveTrack.controller";

import { auth } from "../../middleware/auth.middleware";

const liveTrackRoutes = new Hono();

liveTrackRoutes.use("*", auth);

liveTrackRoutes.post("/my-location", updateMyLiveLocation);

liveTrackRoutes.get("/", getLiveTracks);

export default liveTrackRoutes;