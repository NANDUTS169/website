const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Wishlist = require("../../models/wishlistSchema");

const cart = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.redirect("/login");
        }

        const userId = req.session.user;
        const cartData = await Cart.findOne({ userId }).populate("items.productId");

        let subtotal = 0;
        if (cartData) {
            subtotal = cartData.items.reduce((sum, item) => sum + item.totalPrice, 0);
        }

        res.render("cart", {
            user: req.session.user,
            cart: cartData,
            subtotal,
            discount: 0, 
            grandTotal: subtotal
        });

    } catch (err) {
        console.error("Error loading cart:", err);
        res.status(500).render("user-error", { error: "Failed to load cart" });
    }
};


// const addToCart = async (req, res) => {
//     try {
//         const { productId, quantity } = req.body;
//         const userId = req.session.user;

//         if (!productId || !quantity || quantity < 1 || quantity > 5) {
//             return res.status(400).json({ message: "Invalid product or quantity" });
//         }

//         const product = await Product.findById(productId).populate("category");
//         if (!product) return res.status(404).json({ message: "Product not found" });

//         // Check if product or category is blocked
//         if (product.status === "blocked" || product.category.status === "blocked") {
//             return res.status(400).json({ message: "This product is unavailable" });
//         }

//         // Out of stock
//         if (product.quantity < 1) {
//             return res.status(400).json({ message: "Out of stock" });
//         }

//         const price = product.salePrice || product.regularPrice;
//         let cart = await Cart.findOne({ userId });

//         if (!cart) {
//             cart = new Cart({
//                 userId,
//                 items: [{
//                     productId,
//                     quantity,
//                     price,
//                     totalPrice: price * quantity
//                 }]
//             });
//         } else {
//             const existingItem = cart.items.find(item => item.productId.toString() === productId);

//             if (existingItem) {
//                 const newQty = existingItem.quantity + quantity;

//                 if (newQty > 5) {
//                     return res.status(400).json({ message: "Maximum 5 units per product" });
//                 }
//                 if (newQty > product.quantity) {
//                     return res.status(400).json({ message: "Not enough stock" });
//                 }

//                 existingItem.quantity = newQty;
//                 existingItem.totalPrice = newQty * existingItem.price;
//             } else {
//                 cart.items.push({
//                     productId,
//                     quantity,
//                     price,
//                     totalPrice: price * quantity
//                 });
//             }
//         }

//         await cart.save();

//         await Wishlist.updateOne(
//             { userId },
//             { $pull: { items: { productId } } }
//         );

//         return res.status(200).json({ message: "Added to cart successfully" });

//     } catch (err) {
//         console.error("Error adding to cart:", err);
//         res.status(500).json({ message: "Server error" });
//     }
// };

const addToCart = async (req, res) => {
  try {
    const userId = (req.session.user?._id || req.session.user);
    let { productId, quantity } = req.body;

    if (!productId) {
      return res.status(400).json({ message: "Product id is required" });
    }
    quantity = Number(quantity) || 1;
    if (quantity < 1 || quantity > 5) {
      return res.status(400).json({ message: "Invalid quantity" });
    }

    const product = await Product.findById(productId).populate("category");
    if (!product) return res.status(404).json({ message: "Product not found" });

    // Match Product schema: block if not available
    const categoryBlocked = product.category && (product.category.isBlocked === true || product.category.status === "blocked" || product.category.isListed === false);
    if (product.isBlocked === true || product.status !== "Available" || product.quantity < 1 || categoryBlocked) {
      return res.status(400).json({ message: "This product is unavailable" });
    }

    const price = product.salePrice || product.regularPrice;
    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = new Cart({
        userId,
        items: [{ productId, quantity, price, totalPrice: price * quantity }]
      });
    } else {
      const existingItem = cart.items.find(i => i.productId.toString() === productId);
      if (existingItem) {
        const newQty = existingItem.quantity + quantity;
        if (newQty > 5) return res.status(400).json({ message: "Maximum 5 units per product" });
        if (newQty > product.quantity) return res.status(400).json({ message: "Not enough stock" });

        existingItem.quantity = newQty;
        existingItem.totalPrice = newQty * existingItem.price;
      } else {
        if (quantity > product.quantity) return res.status(400).json({ message: "Not enough stock" });
        cart.items.push({ productId, quantity, price, totalPrice: price * quantity });
      }
    }

    await cart.save();

    // Remove from wishlist if present
    await Wishlist.updateOne({ userId }, { $pull: { items: { productId } } });

    return res.status(200).json({ message: "Added to cart successfully" });
  } catch (err) {
    console.error("Error adding to cart:", err);
    return res.status(500).json({ message: "Server error" });
  }
};


const updateCartItem = async (req, res) => {
    try {
        const userId = req.session.user;
        const { productId, quantity } = req.body;

        if (!productId || quantity < 1 || quantity > 5) {
            return res.status(400).json({ message: "Invalid quantity" });
        }

        const product = await Product.findById(productId);
        if (!product) return res.status(404).json({ message: "Product not found" });

        if (quantity > product.quantity) {
            return res.status(400).json({ message: "Not enough stock available" });
        }

        const cart = await Cart.findOne({ userId });
        if (!cart) return res.status(404).json({ message: "Cart not found" });

        const item = cart.items.find(i => i.productId.toString() === productId);
        if (!item) return res.status(404).json({ message: "Item not in cart" });

        item.quantity = quantity;
        item.totalPrice = item.price * quantity;

        await cart.save();
        res.json({ success: true, message: "Cart updated successfully" });

    } catch (err) {
        console.error("Update cart error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const removeFromCart = async (req, res) => {
    try {
        const userId = req.session.user;
        const { productId } = req.params;

        const cart = await Cart.findOne({ userId });
        if (!cart) return res.status(404).json({ message: "Cart not found" });

        cart.items = cart.items.filter(i => i.productId.toString() !== productId);

        await cart.save();
        res.redirect("/cart");
    } catch (err) {
        console.error("Remove cart error:", err);
        res.status(500).json({ message: "Server error" });
    }
};


const validateCartBeforeCheckout = async (req, res, next) => {
    try {
        const userId = req.session.user;
        const cart = await Cart.findOne({ userId }).populate("items.productId");

        if (!cart) return res.redirect("/cart");

        const invalidItems = cart.items.filter(item => item.productId.quantity < item.quantity);

        if (invalidItems.length > 0) {
            return res.render("cart", {
                user: req.session.user,
                cart,
                subtotal: cart.items.reduce((sum, i) => sum + i.totalPrice, 0),
                discount: 0,
                grandTotal: cart.items.reduce((sum, i) => sum + i.totalPrice, 0),
                error: "Some items are out of stock. Please update your cart."
            });
        }

        next();
    } catch (err) {
        console.error("Cart validation error:", err);
        res.status(500).render("user-error", { error: "Failed to validate cart" });
    }
};


module.exports = {
    cart,
    addToCart,
    updateCartItem,
    removeFromCart,
    validateCartBeforeCheckout
};
