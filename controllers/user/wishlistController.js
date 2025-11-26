const Wishlist = require("../../models/wishlistSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema"); // only if you have it (safe to keep)

// Helper to normalize userId from session
function getUserIdFromSession(req) {
  return (req.session && (req.session.user?._id || req.session.user)) || null;
}

// Show Wishlist
// const getWishlist = async (req, res) => {
//   try {
//     const userId = getUserIdFromSession(req);
//     const wishlist = await Wishlist.findOne({ userId }).populate("items.productId");
//     return res.render("wishlist", { user: req.session.user, wishlist });
//   } catch (err) {
//     console.error("Error loading wishlist:", err);
//     return res.status(500).render("user-error", { error: "Failed to load wishlist" });
//   }
// };

const getWishlist = async (req, res) => {
  try {
    const userId = getUserIdFromSession(req); // your function
    const wishlist = await Wishlist.findOne({ userId })
      .populate({
        path: 'items.productId',
        select: 'productName productImage quantity isBlocked status regularPrice salePrice category',
        populate: { path: 'category', select: 'isListed name' } // populate category inside product
      })
      .lean();

    console.log('wishlist debug:', JSON.stringify(wishlist, null, 2)); // debug output
    return res.render('wishlist', { user: req.session.user, wishlist });
  } catch (err) {
    console.error('Error loading wishlist:', err);
    return res.status(500).render('user-error', { error: 'Failed to load wishlist' });
  }
};

// Add to Wishlist
const addToWishlist = async (req, res) => {
  try {
    const userId = getUserIdFromSession(req);
    if (!userId) {
      return res.status(401).json({ message: "Please log in" });
    }

    const { productId } = req.body;
    if (!productId) {
      return res.status(400).json({ message: "Product id is required" });
    }

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    let categoryBlocked = false;
    try {
      if (product.category) {
        const category = await Category.findById(product.category);
        if (category && (category.isBlocked === true || category.status === "blocked" || category.isListed === false)) {
          categoryBlocked = true;
        }
      }
    } catch (_) { }

    const unavailable =
      product.isBlocked === true ||
      product.status !== "Available" ||
      product.quantity <= 0 ||
      categoryBlocked;

    if (unavailable) {
      return res.status(400).json({ message: "Product unavailable" });
    }

    let wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
      wishlist = new Wishlist({
        userId,
        items: [{ productId }],
      });
    } else {
      const exists = wishlist.items.some(i => i.productId.toString() === productId);
      if (!exists) {
        wishlist.items.push({ productId });
      }
    }

    await wishlist.save();
    return res.status(200).json({ message: "Added to wishlist" });
  } catch (err) {
    console.error("Error adding to wishlist:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// Remove from Wishlist

const removeFromWishlist = async (req, res) => {
  try {
    const userId = getUserIdFromSession(req);
    const { productId } = req.body;
    if (!productId) return res.status(400).json({ message: "Product ID is required" });

    await Wishlist.updateOne(
      { userId },
      { $pull: { items: { productId } } }
    );

    return res.status(200).json({ message: "Removed from wishlist" });
  } catch (err) {
    console.error("Error removing wishlist item:", err);
    return res.status(500).json({ message: "Server error" });
  }
};


module.exports = {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
};
