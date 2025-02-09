const express = require("express");

const authService = require("../services/authService");
const { addProductToWishlist, removeProductFromWishlist, getLoggedUsersWishlist } = require("../services/wishlistService");
const { addProductToWishlistValidator, removeProductFromWishlistValidator } = require("../utils/validators/wishlistValidator");

const router = express.Router();
router.use(authService.protect);
router.use(authService.allowedTo("user"));

router
.route("/")
.post(addProductToWishlistValidator,addProductToWishlist)
.get(getLoggedUsersWishlist);

router
.delete("/:productId",removeProductFromWishlistValidator,removeProductFromWishlist)

module.exports = router;
