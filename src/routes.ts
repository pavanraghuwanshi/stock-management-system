import { Hono } from "hono";
import unitRoutes from "./modules/unit/unit.route";
import groupRoutes from "./modules/group/group.route";
import subGroupRoutes from "./modules/subGroup/subGroup.route";
import categoryRoutes from "./modules/category/category.route";
import itemRoutes from "./modules/item/item.route";
import vendorRoutes from "./modules/vendor/vendor.route";
import projectRoutes from "./modules/project/project.route";
import towerRoutes from "./modules/tower/tower.route";
import floorRoutes from "./modules/tower-floor/floor.route";
import outsideRoutes from "./modules/tower-outside/outside.route";
import flatRoutes from "./modules/flat/flat.route";
import assetRoutes from "./modules/assets/asset.route";
import trackAssetRoutes from "./modules/assetTrack/trackAssetRecords.route";
import { authRoutes } from "./modules/auth/auth.route";
import { organizationRoutes } from "./modules/Organization/organization.route";
import { roleRoutes } from "./modules/roles/role.route";
import { businessNodeRoutes } from "./modules/businessNode/businessNode.route";
import { userRoutes } from "./modules/User/user.route";
import { taskRoutes } from "./modules/task/task.route";
import geofenceRoutes from "./modules/geofence/geofence.route";
import liveTrackRoutes from "./modules/liveTrack/liveTrack.route";
import attendancePolicyRoutes from "./modules/attendancePolicy/attendancePolicy.route";

const routes = new Hono();

routes.route("/units", unitRoutes);
routes.route("/groups", groupRoutes);
routes.route("/sub-groups", subGroupRoutes);
routes.route("/categories", categoryRoutes);
routes.route("/items", itemRoutes);
routes.route("/vendors", vendorRoutes);
routes.route("/projects", projectRoutes);
routes.route("/towers", towerRoutes);
routes.route("/floors", floorRoutes);
routes.route("/outsides", outsideRoutes);
routes.route("/flats", flatRoutes);
routes.route("/assets", assetRoutes);
routes.route("/track-assets", trackAssetRoutes);


routes.route("/user", userRoutes);
routes.route("/role", roleRoutes);
routes.route("/business-nodes", businessNodeRoutes);
routes.route("/task", taskRoutes );
routes.route("/geofence", geofenceRoutes );
routes.route("/attendancepolicy", attendancePolicyRoutes );
routes.route("/live-track", liveTrackRoutes );


routes.route("/organizations", organizationRoutes);
routes.route("/auth", authRoutes);

export default routes;
