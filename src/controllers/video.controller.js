import { isValidObjectId } from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Video } from "../models/video.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import ffmpeg from "fluent-ffmpeg";

const getVideoDuration = (filePath) =>
  new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration); // Duration in seconds
    });
  });


const getAllVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, sortBy = "createdAt", sortType = "desc", userId } = req.query;

  // Set filters based on query and userId
  const filters = {};

  // Add title filter if query is provided
  if (query) filters.title = { $regex: query, $options: "i" }; // Search by title

  // Add userId filter if it's valid
  if (userId && isValidObjectId(userId)) {
    filters.owner = userId;
  }

  console.log("Filters:", filters); // Debugging: check the filters

  // Fetch the videos with pagination and filters
  const videos = await Video.find(filters)
    .sort({ [sortBy]: sortType })
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .populate("owner", "username");

  const totalVideos = await Video.countDocuments(filters);

  console.log("Videos:", videos); // Debugging: check the fetched videos

  res.status(200).json(
    new ApiResponse(200, {
      total: totalVideos,
      page: Number(page),
      limit: Number(limit),
      videos,
    }, "Videos fetched successfully")
  );
});


const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description, owner } = req.body;

  if (!req.files || !req.files.videoFile || !req.files.thumbnail) {
    throw new ApiError(400, "Video file and thumbnail are required");
  }

  const videoLocalPath = req.files.videoFile[0].path;
  const thumbnailLocalPath = req.files.thumbnail[0].path;

  if (!videoLocalPath || !thumbnailLocalPath) {
    throw new ApiError(400, "Video file and thumbnail paths are invalid");
  }
  // Get video duration
  const duration = await getVideoDuration(videoLocalPath);

  if (!duration) {
    throw new ApiError(400, "Unable to retrieve video duration");
  }
  const videoUpload = await uploadOnCloudinary(videoLocalPath);
  const thumbnailUpload = await uploadOnCloudinary(thumbnailLocalPath);

  if (!videoUpload || !thumbnailUpload) {
    throw new ApiError(500, "Something went wrong while uploading video or thumbnail");
  }

  const newVideo = new Video({
    title,
    description,
    videoFile: videoUpload.url,
    thumbnail: thumbnailUpload.url,
    duration,
    isPublished: true,
    owner: owner || req.user._id,
  });

  const saveVideo = await newVideo.save();

  res.status(201).json(
    new ApiResponse(201, { video: saveVideo }, "Video published successfully"),
  );
});



export {
  getAllVideos,
  publishAVideo
};