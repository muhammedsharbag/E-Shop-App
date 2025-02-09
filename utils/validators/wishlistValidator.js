const  {check}  = require("express-validator");
const validatorMiddleware = require("../../middlewares/validatorMiddleware");
const Product = require("../../models/productModel");

exports.addProductToWishlistValidator = [
    check("productId")
      .isMongoId()
      .withMessage("Invalid product id format")
      .custom(async (value) => {
        const product = await Product.findById(value);
        if (!product) {
          throw new Error("Product not found");
        }
      }),
    validatorMiddleware,
  ];

exports.removeProductFromWishlistValidator  = [
    check("productId")
      .isMongoId()
      .withMessage("Invalid product id format")
      .custom(async (value) => {
        const product = await Product.findById(value);
        if (!product) {
          throw new Error("Product not found");
        }
      }),
    validatorMiddleware,
  ];

