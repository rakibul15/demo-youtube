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
  const { page = 1, limit = 10, query, sortBy = "createdAt", sortType = "desc" } = req.query;
  const filters = {};
  // Add title filter if query is provided
  if (query) filters.title = { $regex: query, $options: "i" }; // Search by title
  filters.isPublished = true;
  // Fetch the videos with pagination and filters
  const videos = await Video.find(filters)
    .sort({ [sortBy]: sortType })
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .populate("owner", "username");

  const totalVideos = await Video.countDocuments(filters);
  res.status(200).json(
    new ApiResponse(200, {
      total: totalVideos,
      page: Number(page),
      limit: Number(limit),
      videos,
    }, "Videos fetched successfully"),
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


const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  // Validate video ID
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }

  // Find video by ID and populate owner details
  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  res.status(200).json(
    new ApiResponse(200, { video }, "Video fetched successfully"),
  );
});


const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const userId = req.user._id; // Get the logged-in user's ID

  // Validate video ID
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }

  // Find video by ID and populate owner details
  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  // Check if the logged-in user is the owner of the video
  if (video.owner.toString() !== userId.toString()) {
    throw new ApiError(403, "You are not authorized to delete this video", [
      { field: "authorization", message: "You can only delete videos that you own" },
    ]);
  }
  // Delete the video
  const deletedVideo = await Video.findByIdAndDelete(videoId);
  res.status(200).json(
    new ApiResponse(200, { video: deletedVideo }, "Video deleted successfully"),
  );
});



const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const userId = req.user._id; // Get the logged-in user's ID

  // Validate video ID
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }

  // Find video by ID and populate owner details
  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  // Check if the logged-in user is the owner of the video
  if (video.owner.toString() !== userId.toString()) {
    throw new ApiError(403, "You are not authorized to update this video");
  }

  const updates = {};
  const { title, description } = req.body;

  // Update title and description if provided
  if (title) updates.title = title;
  if (description) updates.description = description;

  // Debugging the file upload
  if (req.files && req.files.thumbnail) {
    const thumbnailLocalPath = req.files.thumbnail[0].path;
    const thumbnailUpload = await uploadOnCloudinary(thumbnailLocalPath);
    if (thumbnailUpload && thumbnailUpload.url) {
      updates.thumbnail = thumbnailUpload.url;
    }
  }

  // Perform the update
  const updatedVideo = await Video.findByIdAndUpdate(videoId, updates, { new: true });

  res.status(200).json(
    new ApiResponse(200, { video: updatedVideo }, "Video updated successfully")
  );
});


const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const userId = req.user._id; // Get the logged-in user's ID

  // Validate video ID
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }

  // Find video by ID
  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  // Check if the logged-in user is the owner of the video
  if (video.owner.toString() !== userId.toString()) {
    throw new ApiError(403, "You are not authorized to change this video's publish status");
  }

  // Toggle the publish status
  video.isPublished = !video.isPublished;
  await video.save();

  res.status(200).json(new ApiResponse(200, video, "Video publish status updated"));
});



const getAllVideosByUserId = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, sortBy = "createdAt", sortType = "desc" } = req.query;
  const userId = req.user._id;
  // Set filters based on query and userId
  const filters = {};

  // Add title filter if query is provided
  if (query) filters.title = { $regex: query, $options: "i" }; // Search by title

  // Add userId filter if it's valid
  if (userId && isValidObjectId(userId)) {
    filters.owner = userId;
  }
  // Fetch the videos with pagination and filters
  const videos = await Video.find(filters)
    .sort({ [sortBy]: sortType })
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .populate("owner", "username");

  const totalVideos = await Video.countDocuments(filters);
  res.status(200).json(
    new ApiResponse(200, {
      total: totalVideos,
      page: Number(page),
      limit: Number(limit),
      videos,
    }, "Videos fetched successfully"),
  );
});



export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  deleteVideo,
  updateVideo,
  togglePublishStatus,
  getAllVideosByUserId
};