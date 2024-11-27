import mongoose, { isValidObjectId } from "mongoose";
import { Comment } from "../models/comment.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getVideoComments = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID.");
  }

  const pageNumber = Number(page);
  const pageSize = Number(limit);
  const skip = (pageNumber - 1) * pageSize;

  // Get the total count of comments for pagination
  const totalComments = await Comment.countDocuments({ video: videoId });

  // Debugging: log the total comments and the skip/limit values
  console.log(`Total Comments: ${totalComments}, Skip: ${skip}, Limit: ${pageSize}`);

  // Fetch paginated comments with owner details
  const result = await Comment.aggregate([
    { $match: { video: new mongoose.Types.ObjectId(videoId) } },
    { $sort: { createdAt: -1 } },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "OwnerDetails",
      },
    },
    { $unwind: "$OwnerDetails" },
    {
      $project: {
        content: 1,
        createdAt: 1,
        "OwnerDetails.fullName": 1,
        "OwnerDetails.username": 1,
        "OwnerDetails.avatar": 1,
      },
    },
    { $skip: skip },
    { $limit: pageSize },
  ]);
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        total: totalComments,
        page: pageNumber,
        limit: pageSize,
        result,
      },
      `Comments for video fetched successfully.`,
    ),
  );
});


const addComment = asyncHandler(async (req, res) => {
  // TODO: add a comment to a video
  const { content, video } = req.body;

  const userId = req.user._id;
  if (!userId) {
    throw new ApiError(400, "Invalid user ID.");
  }
  if (!content || !isValidObjectId(video)) {
    throw new ApiError(400, "Content and Video ID are required");
  }

  const comment = await Comment.create({
    owner: userId,
    video,
    content,
  });
  return res.status(201).json(
    new ApiResponse(
      200,
      comment,
      "Comment created successfully.",
    ),
  );

});

const updateComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const { content } = req.body;

  // Validate comment ID
  if (!mongoose.Types.ObjectId.isValid(commentId)) {
    throw new ApiError(400, "Invalid comment ID.");
  }

  // Validate content
  if (!content || typeof content !== "string" || content.trim().length === 0) {
    throw new ApiError(400, "Content is required and must be a non-empty string.");
  }

  // Check if the comment exists and belongs to the user
  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new ApiError(404, "Comment not found.");
  }

  if (comment.owner.toString() !== req.user.id) {
    throw new ApiError(403, "You are not authorized to update this comment.");
  }

  // Update the comment content using findByIdAndUpdate
  const updatedComment = await Comment.findByIdAndUpdate(
    commentId,
    { content: content.trim() },
    { new: true }, // returns the updated document
  );

  return res.status(200).json(
    new ApiResponse(200, updatedComment, "Comment updated successfully."),
  );
});


const deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  // Validate comment ID
  if (!mongoose.Types.ObjectId.isValid(commentId)) {
    throw new ApiError(400, "Invalid comment ID.");
  }

  // Check if the comment exists
  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new ApiError(404, "Comment not found.");
  }

  // Check if the logged-in user is the owner of the comment
  if (comment.owner.toString() !== req.user.id) {
    throw new ApiError(403, "You are not authorized to delete this comment.");
  }

  // Delete the comment using findByIdAndDelete
  const deletedComment = await Comment.findByIdAndDelete(commentId);

  return res.status(200).json(
    new ApiResponse(200, deletedComment, "Comment deleted successfully."),
  );
});


export {
  getVideoComments,
  addComment,
  updateComment,
  deleteComment,
};