const crypto = require("crypto");

const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/apiError");
const sendEmail = require("../utils/sendEmail");
const createToken = require("../utils/createToken");
const {sanitizeUser} = require("../utils/sanitizeData");
const User = require("../models/userModel");

// @desc    Signup
// @route   post /api/v1/auth/signup
// @access  Public
exports.signup = asyncHandler(async (req, res, next) => {
  // 1- Create user
  const user = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
  });

  // 2- Generate token
  const token = createToken(user._id);

  res.status(201).json({ data: sanitizeUser(user), token });
});

// @desc    Login
// @route   post /api/v1/auth/login
// @access  Public
exports.login = asyncHandler(async (req, res, next) => {
  // 1) check if password and email in the body (validation)
  // 2) check if user exist & check if password is correct
  const user = await User.findOne({ email: req.body.email });

  if (!user || !(await bcrypt.compare(req.body.password, user.password))) {
    return next(new ApiError("Incorrect email or password", 401));
  }
  // 3) generate token
  const token = createToken(user._id);

  // Delete password from response
  delete user._doc.password;
  // 4) send response to client side
  res.status(200).json({ data: user, token });
});

// @desc   make sure the user is logged in
exports.protect = asyncHandler(async (req, res, next) => {
  // 1) Check if token exist, if exist get
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }
  if (!token) {
    return next(
      new ApiError(
        "You are not login, Please login to get access this route",
        401
      )
    );
  }

  // 2) Verify token (no change happens, expired token)
  const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

  // 3) Check if user exists
  const currentUser = await User.findById(decoded.userId);
  if (!currentUser) {
    return next(
      new ApiError(
        "The user that belong to this token does no longer exist",
        401
      )
    );
  }
  //4)check if user deactivated his account
  if (currentUser.active === false) {
    return next(
      new ApiError(
        "Your account has been deactivated, please contact suppurt",
        401
      )
    );
  }
  // 5) Check if user change his password after token created
  if (currentUser.passwordChangedAt) {
    const passChangedTimeStamp = parseInt(
      currentUser.passwordChangedAt.getTime() / 1000,
      10
    );
    //pass changed after token created
    if (passChangedTimeStamp > decoded.iat) {
      return next(
        new ApiError(
          "User recently changed his password, please login again...",
          401
        )
      );
    }
  }
  req.user = currentUser;
  next();
});

//@desc     Authorization(user permissions)
//['admin','manager']
exports.allowedTo = (...roles) =>
  asyncHandler(async (req, res, next) => {
    //1)access roles
    //2)access registered user(req.user.role)
    if (!roles.includes(req.user.role)) {
      return next(
        new ApiError("you are not allowed to access this route", 403)
      );
    }
    next();
  });

// @des     Forgot password
// @route   post /api/v1/auth/forgotPassword
// @access  Public
exports.forgotPassword = asyncHandler(async (req, res, next) => {
  // 1) Get user by email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(
      new ApiError(`There is no user with the email ${req.body.email}`, 404)
    );
  }
  // 2) If user exist , generate hash reset random 6 digits and save it in db
  const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
  const hashedResetCode = crypto
    .createHash("sha256")
    .update(resetCode)
    .digest("hex");
  // save hash reset code in  db
  user.passwordResetCode = hashedResetCode;
  // Add Expiration time to password reset code(10 minutes)
  user.passwordResetExpires = Date.now() + 10 * 60 * 1000;
  user.passwordResetVerified = false;
  await user.save();

  // 3) Send reset code via email

  const message = `Hi ${user.name} ,\n
  We received a request to reset your password on your E-Shop account . \n
  ${resetCode} \n
  Please use this code to reset your password. This code will expire in 10 minutes.\n
  If you did not request a password reset, please ignore this email.\n
  Don't share this code with others\n
  Thanks you for helping us keep your account secure\n
  Best Regards,\n
  E-Shop Team`;
  try {
    await sendEmail({
      email: user.email,
      subject: "your password reset code (valid for 10 minutes)",
      message,
    });
  } catch (err) {
    user.passwordResetCode = undefined;
    user.passwordResetExpires = undefined;
    user.passwordResetVerified = undefined;
    await user.save();
    return next(new ApiError("There is "));
  }
  res.status(200).json({
    status: "Success",
    message: "Your password reset code sent to email",
  });
});

// @desc      Verify password reset code
// @route     post /api/v1/auth//verifyResetCode
// @access    Public
exports.verifyPasswordResetCode = asyncHandler(async (req, res, next) => {
  //1)Get user based in reset code
  const hashedResetCode = crypto
    .createHash("sha256")
    .update(req.body.resetCode)
    .digest("hex");
  const user = await User.findOne({
    passwordResetCode: hashedResetCode,
    passwordResetExpires: { $gt: Date.now() },
  });
  if (!user) {
    return next(new ApiError("Reset code invalid or expired"));
  }
  //2)Reset code valid
  user.passwordResetVerified = true;
  await user.save();

  res.status(200).json({ status: "Success" });
});

// @desc      Reset password
// @route     put /api/v1/auth//resetPassword
// @access    Public
exports.resetPassword = asyncHandler(async (req, res, next) => {
  //1)Get user based on email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(
      new ApiError(`There is no user with email ${req.body.email}`, 404)
    );
  }
  //2)Check if reset code verified
  if (!user.passwordResetVerified) {
    return next(new ApiError("Reset code not verified", 400));
  }
  user.password = req.body.newPassword;
  user.passwordResetCode = undefined;
  user.passwordResetExpires = undefined;
  user.passwordResetVerified = undefined;
  await user.save();
  //3)If everything is ok,Generate token
  const token = createToken(user._id);
  res.status(200).json({ token });
});
