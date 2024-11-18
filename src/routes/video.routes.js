import { Router } from "express";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  deleteVideo,
  getAllVideos, getAllVideosByUserId,
  getVideoById, incrementVideoViews,
  publishAVideo, togglePublishStatus,
  updateVideo,
} from "../controllers/video.controller.js";

const router=Router();
router.use(verifyJWT);

router.route("/")
  .get(getAllVideos)
  .post(upload.fields([{ name: "videoFile", maxCount: 1 }, { name: "thumbnail", maxCount: 1 }]), publishAVideo);

router.route("/my-videos").get(getAllVideosByUserId);

router.route("/:videoId")
  .delete(deleteVideo)
  .get(getVideoById)
  .patch(upload.fields([{ name: "videoFile", maxCount: 1 }, { name: "thumbnail", maxCount: 1 }]), updateVideo);

router.patch("/:videoId/views", incrementVideoViews);
router.route("/toggle/publish/:videoId").patch(togglePublishStatus);



export default router;
