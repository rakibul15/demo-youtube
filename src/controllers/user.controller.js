import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async (req, res, next) => {
  // get user input
  //validate user input
  //check if user already exist:username,email
  //check for images
  //Upload images to cloudinary
  //create user in our database
  //remove password from the response and refresh token filed from the response
  //check for user creation
  //return response
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
  if(req.files && Array.isArray(req.files?.coverImage) && req.files?.coverImage?.length > 0){
    coverImageLocalPath=  req.files?.coverImage[0]?.path;
  }
  const avatarLocalPath = req.files?.avatar[0]?.path;

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


export { registerUser };