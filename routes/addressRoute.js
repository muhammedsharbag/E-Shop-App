const express = require("express");

const authService = require("../services/authService");
const { addAddress, getLoggedUserAddresses, removeAddress } = require("../services/addressService");
const { removeAddressValidator, addAddressValidator } = require("../utils/validators/addressValidator");

const router = express.Router();
router.use(authService.protect);
router.use(authService.allowedTo("user"));

router
.route("/")
.post(addAddressValidator,addAddress)
.get(getLoggedUserAddresses);

router
.delete("/:addressId",removeAddressValidator,removeAddress)

module.exports = router;
