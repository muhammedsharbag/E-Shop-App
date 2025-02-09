const asyncHandler = require("express-async-handler");
const User = require("../models/userModel");

// @desc    Add product to  wishlist
// @route   POST/api/v1/wishlist
// @access  Protected/User
exports.addProductToWishlist = asyncHandler(async (req, res, next) => {
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      //$addToSet: Add product to wishlist array if productId not  exist
      $addToSet: { wishlist: req.body.productId },
    },
    { new: true }
  );
  res.status(200).json({
    status: "success",
    message: "product added successfully to your wishlist",
    data: user.wishlist,
  });
});


// @desc    Remove product from  wishlist
// @route   DELETE/api/v1/wishlist/:productId
// @access  Protected/User
exports.removeProductFromWishlist = asyncHandler(async (req, res, next) => {
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      //$pull: remove product from wishlist array if productId   exist
      $pull: { wishlist: req.params.productId },
    },
    { new: true }
  );
  res.status(200).json({
    status: "success",
    message: "product removed successfully from your wishlist",
    data: user.wishlist,
  });
});

// @desc    Get logged user  wishlist
// @route   GET/api/v1/wishlist/
// @access  Protected/User
exports.getLoggedUsersWishlist = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id).populate("wishlist");
  res.status(200).json({
    status: "success",
    message: "your wishlist",
    result:user.wishlist.length,
    data: user.wishlist,
  });
});