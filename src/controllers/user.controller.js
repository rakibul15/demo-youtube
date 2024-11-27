import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";

const generateAccessAndRefreshTokens = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  // Check if user model has token generation methods
  if (typeof user.generateAccessToken !== "function" || typeof user.generateRefreshToken !== "function") {
    throw new ApiError(500, "Token generation methods are not defined in the User model");
  }

  try {
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(500, "Something went wrong while generating access or refresh token");
  }
};


const registerUser = asyncHandler(async (req, res) => {
  const { username, email, fullName, password } = req.body;
  if (
    [fullName, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }
  const existingUser = await User.findOne({
    $or: [
      { username },
      { email },
    ],
  });
  if (existingUser) {
    throw new ApiError(409, "User already exist");
  }
  let coverImageLocalPath;
  if (req.files && Array.isArray(req.files?.coverImage) && req.files?.coverImage?.length > 0) {
    coverImageLocalPath = req.files?.coverImage[0]?.path;
  }

  let avatarLocalPath;
  if (req.files && Array.isArray(req.files?.avatar) && req.files?.avatar?.length > 0) {
    avatarLocalPath = req.files?.avatar[0]?.path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);
  if (!avatar) {
    throw new ApiError(400, "Avatar file is required");
  }
  const user = await User.create({
    username: username.toLowerCase(),
    email,
    fullName,
    password,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
  });
  const createdUser = await User.findById(user._id).select("-password -refreshToken -__v -_id");

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering user");
  }

  return res.status(201).json(
    new ApiResponse(200, createdUser, "User registered successfully"));

});


const loginUser = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;
  if (!username && !email) {
    throw new ApiError(400, "username or email required");
  }
  const user = await User.findOne({
    $or: [{ username }, { email }],
  });
  if (!user) {
    throw new ApiError(404, "User doesn't exist");
  }
  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credential");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);
  const loggedInUser = await User.findById(user._id).select("-__v");

  const options = {
    httpOnly: true,
    secure: true,
  };
  return res.status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser, accessToken,
          refreshToken,
        },
        "User logged In Successfully",
      ),
    );

});


const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id, {
      $unset: {
        refreshToken: 1,
      },
    },
    {
      new: true,
    },
  );

  const options = {
    httpOnly: true,
    secure: true,
  };
  return res.status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(
      new ApiResponse(
        200,
        {},
        "User logged Out Successfully",
      ),
    );
});


const refreshAccessToken = asyncHandler(async (req, res) => {
  // Get the incoming refresh token from cookies or body
  const incomingRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

  // Check if refresh token is present, if not throw an unauthorized error
  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized Request: Refresh token is missing");
  }

  // Decode the token and check if it's valid
  let decodedToken;
  try {
    decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
  } catch (error) {
    throw new ApiError(401, "Invalid refresh token: Token verification failed");
  }

  // Find the user associated with the decoded token
  const user = await User.findById(decodedToken?._id);
  if (!user) {
    throw new ApiError(401, "Invalid refresh token: User not found");
  }

  // Check if the incoming refresh token matches the user's refresh token
  if (incomingRefreshToken !== user.refreshToken) {
    throw new ApiError(401, "Refresh token is expired or used");
  }

  try {
    // Generate new access and refresh tokens
    const options = {
      httpOnly: true,
      secure: true,
    };
    const { accessToken, refreshToken: newRefreshToken } = await generateAccessAndRefreshTokens(user._id);

    // Send the new tokens as cookies in the response
    return res.status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access token refreshed successfully",
        ),
      );
  } catch (error) {
    // Catch any unexpected errors during the token generation process
    throw new ApiError(500, "Error while generating new tokens: " + (error?.message || error));
  }
});


const changeCurrentUserPassword = asyncHandler(async (req, res) => {

  const { oldPassword, newPassword } = req.body;
  const user = await User.findById(req.user?._id);

  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid old password");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res.status(200).json(new ApiResponse(200, {}, "Password changed successfully"));
});


const getCurrentUser = asyncHandler(async (req, res) => {
  return res.status(200).json(new ApiResponse(200, req.user, "Current user fetched successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName,
        email,
      },
    },
    {
      new: true,
    },
  ).select("-password");
  return res.status(200).json(new ApiResponse(200, user, "Account Details updated successfully"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;
  if (!avatarLocalPath) {
    throw new ApiError(400, "Please upload an image");
  }
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  if (!avatar.url) {
    throw new ApiError(400, "Error uploading image");
  }
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    {
      new: true,
    },
  ).select("-password");
  return res.status(200).json(new ApiResponse(200, user, "Avatar updated successfully"));
});

const updateUserCover = asyncHandler(async (req, res) => {
  const coverLocalPath = req.file?.path;
  if (!coverLocalPath) {
    throw new ApiError(400, "Please upload an image");
  }
  const cover = await uploadOnCloudinary(coverLocalPath);
  if (!cover.url) {
    throw new ApiError(400, "Error uploading image");
  }
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: cover.url,
      },
    },
    {
      new: true,
    },
  ).select("-password");
  return res.status(200).json(new ApiResponse(200, user, "Cover Image updated successfully"));
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;

  if (!username?.trim()) {
    throw new ApiError(400, "Username is required");
  }

  // Ensure `req.user` is available
  if (!req.user || !req.user._id) {
    throw new ApiError(401, "User is not authenticated");
  }

  const channel = await User.aggregate([
    {
      $match: {
        username: username.toLowerCase(), // Ensure case-insensitivity
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      $addFields: {
        subscriberCount: {
          $size: "$subscribers",
        },
        channelsSubscribedToCount: {
          $size: "$subscribedTo",
        },
        // Check if `req.user._id` exists in the subscribers array
        isSubscribed: {
          $in: [new mongoose.Types.ObjectId(req.user._id), "$subscribers.subscriber"],
        },
      },
    },
    {
      $project: {
        fullName: 1,
        username: 1,
        subscriberCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        email: 1,
      },
    },
  ]);

  if (!channel || !channel.length) {
    throw new ApiError(404, "Channel does not exist");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, channel[0], "User channel fetched successfully"),
    );
});


const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullName: 1,
                    username: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          }, {
            $addFields: {
              owner: {
                $first: "$owner",
              },
            },
          },
        ],
      },
    },
  ]);

  return res.status(200)
    .json(
      new ApiResponse(200, user[0].watchHistory, "Watch history fetched successfully"),
    );
});

const addToWatchHistory = asyncHandler(async (req, res) => {
  const { videoId } = req.body; // The video ID to add to watch history

  // Validate videoId format
  if (!videoId || !isValidObjectId(videoId)) {
    return res.status(400).json(new ApiResponse(400, null, "Invalid video ID format."));
  }

  try {
    // Check if the video exists in the database
    const videoExists = await Video.findById(videoId);
    if (!videoExists) {
      return res.status(404).json(new ApiResponse(404, null, "Video not found."));
    }

    // Add the video ID to the user's watchHistory
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $addToSet: { watchHistory: videoId } }, // Prevent duplicate entries
      { new: true }, // Return the updated document
    );

    if (!user) {
      return res.status(404).json(new ApiResponse(404, null, "User not found."));
    }

    return res
      .status(200)
      .json(new ApiResponse(200, user.watchHistory, "Watch history updated successfully."));
  } catch (error) {
    console.error(error);
    return res.status(500).json(new ApiResponse(500, null, "Failed to update watch history."));
  }
});


export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentUserPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCover,
  getUserChannelProfile,
  getWatchHistory,
  addToWatchHistory,
};