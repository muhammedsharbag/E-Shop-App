const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/apiError");

const Product = require("../models/productModel");
const Cart = require("../models/cartModel");
const Coupon = require("../models/couponModel");

const calcTotalPrice = (cart)=>{
    let totalPrice = 0;
cart.cartItems.forEach(item => {
    totalPrice += item.quantity * item.price
})
cart.totalCartPrice = totalPrice
cart.totalPriceAfterDiscount = undefined
return totalPrice;
}

// @desc    Add product to cart
// @route   POST/api/v1/cart
// @access  Private/User
exports.addProductToCart = asyncHandler(async(req,res,next)=>{
    const {productId,color} = req.body;
    const product = await Product.findById(productId)
// 1) Get Cart for Logged user
let cart = await Cart.findOne({user: req.user._id})

if(!cart){
    // Create Cart for logged user with product
    cart = await Cart.create({
        user: req.user._id,
        cartItems:[{product: productId, color, price:product.price}]
    })
}else{
    // If product exists in cart , Update quantity
    const productIndex = cart.cartItems.findIndex(item=>item.product.toString() === productId && item.color === color)
    if(productIndex> -1){
        const cartItem = cart.cartItems[productIndex]
        cartItem.quantity += 1
        cart.cartItems[productIndex] = cartItem
    }
    // If product does not exist in cart, push  product to cart item array
    else{
        cart.cartItems.push({product: productId, color,  price: product.price})
    } 
}
//Calculate total cart price
calcTotalPrice(cart);

await cart.save()


res.status(200).json({
    success: true,
    message: "Product added to cart successfully",
    data: cart
})
})

// @desc    Get logged user cart
// @route   GET/api/v1/cart
// @access  Private/User
exports.getLoggedUserCart = asyncHandler(async (req, res, next) => {
const cart = await Cart.findOne({user: req.user._id})
if(!cart) return next(new ApiError(`There is no cart for this user: ${req.user._id}`, 404))
    cart.totalPriceAfterDiscount = undefined
res.status(200).json({
    success: true,
    message: "Your cart",
    numOfCartItems:cart.cartItems.length,
    data: cart
})
})

// @desc    Remove Specific item from Cart
// @route   Delete/api/v1/cart/:itemId
// @access  Private/User
exports.removeSpecificCartItem = asyncHandler(async (req,res,next)=>{
    const cart = await Cart.findOneAndUpdate({user: req.user._id},{
        $pull: {cartItems: {_id:req.params.itemId}}
       

    },{new:true}

)
calcTotalPrice(cart)
await cart.save()
res.status(200).json({
    success: true,
    message: "Item removed successfully from cart",
    numOfCartItems:cart.cartItems.length,
    data: cart
})
})

// @desc    Clear logged user cartItems
// @route   Delete/api/v1/cart
// @access  Private/User
exports.clearCart = asyncHandler(async (req,res,next)=>{
    await Cart.findOneAndDelete({user: req.user._id})
res.status(204).send()
})

// @desc    Update cart item quantity
// @route   Put/api/v1/cart
// @access  Private/User
exports.updateCartItemQuantity = asyncHandler(async (req,res,next)=>{
    const {quantity} = req.body;
    
    const cart = await Cart.findOne({user: req.user._id})
        if(!cart){
        return next(new ApiError(`There is no cart for this user: ${req.user._id}`, 404))
    }
    const itemIndex = cart.cartItems.findIndex(item =>
        item._id.toString() === req.params.itemId
    )
    if(itemIndex > -1){
        const cartItem = cart.cartItems[itemIndex]
        cartItem.quantity = quantity
        cart.cartItems[itemIndex] = cartItem
    }
    else{
        return next(new ApiError(`No item found in cart with id: ${req.params.itemId}`, 404))
    }
    calcTotalPrice(cart)
    await cart.save()
    res.status(200).json({
        success: true,
        message: "Cart item quantity updated successfully",
        numOfCartItems:cart.cartItems.length,
        data: cart
})
})

// @desc    Apply Coupon to Cart
// @route   Put/api/v1/cart/applyCoupon
// @access  Private/User
exports.applyCoupon = asyncHandler(async(req,res,next)=>{
    const {name} = req.body;
    // Get Coupon based on Coupon name
    const coupon = await Coupon.findOne({
        name,
        expire:{$gt:Date.now()}
    })
    if(!coupon){
        return next(new ApiError("Coupon is invalid or expired", 404))
    } 
    // // Get logged user cart to get total cart price
    const cart = await Cart.findOne({user: req.user._id})
    if(!cart){
        return next(new ApiError(`There is no cart for this user: ${req.user._id}`, 404))
    
    }
    const totalPrice = calcTotalPrice(cart)
    // Apply coupon discount to total cart price
    const totalPriceAfterDiscount = (
        totalPrice - (totalPrice * coupon.discount / 100).toFixed(2)
        )
    cart.totalPriceAfterDiscount = totalPriceAfterDiscount;
    await cart.save()
    res.status(200).json({
        success: true,
        message: "Coupon applied successfully",
        numOfCartItems:cart.cartItems.length,
        data: cart
})
})



