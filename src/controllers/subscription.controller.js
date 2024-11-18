import { isValidObjectId } from "mongoose";
import { Subscription } from "../models/subscription.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Toggle subscription
const toggleSubscription = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  if (!isValidObjectId(channelId)) {
    throw new ApiError(400, "Invalid channel ID.");
  }

  if (req.user._id.toString() === channelId) {
    throw new ApiError(400, "You cannot subscribe to your own channel.");
  }

  const existingSubscription = await Subscription.findOne({
    subscriber: req.user._id,
    channel: channelId,
  });

  if (existingSubscription) {
    await Subscription.findByIdAndDelete(existingSubscription._id);
    return res
      .status(200)
      .json(new ApiResponse(200, null, "Unsubscribed successfully."));
  } else {
    const subscription = await Subscription.create({
      subscriber: req.user._id,
      channel: channelId,
    });
    return res
      .status(201)
      .json(new ApiResponse(201, subscription, "Subscribed successfully."));
  }
});

// Get subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
  const { channelId } = req.params; // Get channelId from params
  console.log("channelId", req.params);
  // Validate channelId
  if (!isValidObjectId(channelId)) {
    throw new ApiError(400, "Invalid channel ID.");
  }

  // Fetch subscribers for the given channelId
  const subscribers = await Subscription.find({ channel: channelId })
    .populate("subscriber", "fullName username avatar");

  // Return the response
  return res.status(200).json(
    new ApiResponse(
      200,
      subscribers,
      `Subscribers for channel ${channelId} fetched successfully.`
    )
  );
});


// Get channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
  const { subscriberId } = req.params; // Get subscriberId from params

  // Validate subscriberId
  if (!isValidObjectId(subscriberId)) {
    throw new ApiError(400, "Invalid subscriber ID.");
  }

  // Fetch channels to which the user is subscribed
  const subscribedChannels = await Subscription.find({ subscriber: subscriberId })
    .populate("channel", "fullName username avatar");

  // Return the response
  return res.status(200).json(
    new ApiResponse(
      200,
      subscribedChannels,
      `Subscribed channels for user ${subscriberId} fetched successfully.`
    )
  );
});

export {
  toggleSubscription,
  getUserChannelSubscribers,
  getSubscribedChannels,
};
