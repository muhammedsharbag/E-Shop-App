const  {check}  = require("express-validator");
const validatorMiddleware = require("../../middlewares/validatorMiddleware");
const User = require("../../models/userModel");

exports.addAddressValidator = [
    check("alias")
    .notEmpty()
    .withMessage("Alias required").custom(
        async (alias, { req }) => {
            const user = await User.findById(req.user._id);
            if (user.addresses.some((address) => address.alias === alias)) {
                throw new Error("Alias already exists");
            }
        }
    ),
    check("details").notEmpty().withMessage("Details required").isLength({min: 15})
    .withMessage("Details must be at least 15 characters long"),
    check("phone").notEmpty().withMessage("phone required"),
    check("city").notEmpty().withMessage("city required"),
    check("postalCode").notEmpty().withMessage("postal code required").isPostalCode(
        "US", // Specify the country code to match
        "full", // Specify full address (including apartment, suite, etc.)
        "short" // Specify short address (e.g. 94103)
    ),

    validatorMiddleware,
    
]
exports.removeAddressValidator =[
    check("addressId").isMongoId().withMessage("Invalid address id format"),
    validatorMiddleware,
]