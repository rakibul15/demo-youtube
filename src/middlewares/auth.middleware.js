import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";

export const verifyJWT = asyncHandler(async (req, res, next) => {
  try{
    const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer", "").trim();

    if (!token) {
      return next(new ApiError(401, "Unauthorized Request"));
    }
    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(decodedToken?._id).select("-password -refreshToken -__v -_id");
    if(!user){
      return next(new ApiError(401, "Invalid access token"));
    }
    req.user=user;
    next()
  } catch (error) {
    next(new ApiError(401, error?.message || "Invalid Access Token"));
  }
});